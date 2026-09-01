package com.fantaagent.application.service;

import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.domain.auction.AuctionState;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.PlayerProjection;
import com.fantaagent.domain.search.PlayerSearch;
import com.fantaagent.domain.strategy.PriceModel;
import com.fantaagent.domain.strategy.PriceRecommendation;

import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Supplier;

public class PlayerSearchService {

    private static final int SEARCH_LIMIT = 8;

    /**
     * Quanti candidati per ciascuna delle due graduatorie che formano l'insieme
     * valutato per la lista target (punti base, e rapporto punti/prezzo atteso). Un
     * prefiltro sui soli punti base scarterebbe proprio i giocatori a basso costo e
     * alto margine che la lista target esiste per trovare, perché il margine è
     * indipendente dai punti assoluti. L'unione delle due graduatorie, deduplicata,
     * resta vicina ai quindici candidati originari perché ogni valutazione costa
     * qualche decina di millisecondi: il budget di un secondo per il pannello è
     * misurato su questa scala in {@code PlayerSearchServiceLatencyTest}.
     */
    private static final int TARGET_CANDIDATES_PER_CRITERION = 8;

    /**
     * Righe per pagina della tabella di fase: 25, misurato in
     * {@code PlayerSearchServiceLatencyTest} — su un fixture realistico (~600
     * giocatori, a metà asta) {@code phasePlayers(25)} costa 341 ms, circa 12
     * ms/riga. Un batch che coprisse in un colpo solo l'intera fase D (192
     * difensori disponibili su quel fixture) costerebbe circa 2,3 s: sotto la soglia
     * misurata, ma comunque un'attesa intera per una tabella che l'utente vuole
     * vedere subito — da cui il taglio a pagine da 25.
     */
    public static final int PHASE_PAGE_SIZE = 25;

    public record TargetRow(Player player, PriceRecommendation recommendation) {

        public int margin() {
            return recommendation.margin();
        }
    }

    public record PhaseRow(Player player, PriceRecommendation recommendation,
                           PlayerProjection projection) {

        public double fantamediaAttesa() {
            return projection.expectedRating() + projection.bonusPerAppearance();
        }

        public double titolaritaPercent() {
            return projection.startingProbability() * 100.0;
        }
    }

    /**
     * Una pagina della tabella di fase, con quanto serve a muoversi avanti E indietro.
     *
     * <p>Porta {@code offset} e {@code total} invece del solo "c'e' altro": con un
     * bottone "indietro" la vista deve sapere dove si trova, non solo dove puo'
     * andare, e il numero di pagina va calcolato in un posto solo — farlo nel template
     * significherebbe riscrivere l'aritmetica dei bordi in Thymeleaf, dove sbagliarla
     * non fa fallire alcun test.
     */
    public record PhasePage(List<PhaseRow> rows, int offset, int pageSize, int total) {

        public boolean hasPrevious() {
            return offset > 0;
        }

        public boolean hasNext() {
            return offset + rows.size() < total;
        }

        public int previousOffset() {
            return Math.max(0, offset - pageSize);
        }

        public int nextOffset() {
            return offset + rows.size();
        }

        public int pageNumber() {
            return pageSize <= 0 ? 1 : offset / pageSize + 1;
        }

        public int pageCount() {
            return pageSize <= 0 ? 1 : Math.max(1, (total + pageSize - 1) / pageSize);
        }
    }

    private final PlayerCatalog catalog;
    private final PlayerSearch search;
    private final AuctionService auction;
    private final PlayerAnalysisService analysis;

    /**
     * Riletta ad ogni richiesta invece di essere catturata alla costruzione: salvare le
     * impostazioni la sostituisce in blocco. Ogni metodo pubblico la legge una volta
     * sola e la passa avanti, così tutte le righe di una pagina nascono dallo stesso
     * modello di punteggio.
     */
    private final Supplier<ValuationChain> chain;

    public PlayerSearchService(PlayerCatalog catalog, Supplier<ValuationChain> chain,
                               AuctionService auction, PlayerAnalysisService analysis) {
        this.catalog = catalog;
        this.chain = chain;
        this.auction = auction;
        this.analysis = analysis;
        // Il catalogo non cambia a caldo, quindi l'indice di ricerca si costruisce una
        // volta sola; solo il criterio di ordinamento rilegge le proiezioni correnti.
        this.search = new PlayerSearch(catalog.all(),
                id -> chain.get().projections().of(id).basePoints());
    }

    /**
     * Catena fissa, decisa alla costruzione: la forma usata dai test. Prende la catena
     * dal servizio di analisi invece di costruirne una seconda, e verifica che le
     * proiezioni passate siano davvero le stesse — due catene diverse dentro la stessa
     * pagina sono esattamente ciò che questo progetto sta cercando di rendere
     * impossibile.
     */
    public PlayerSearchService(PlayerCatalog catalog, ProjectionRegistry projections,
                               AuctionService auction, PlayerAnalysisService analysis) {
        this(catalog, analysis.chains(), auction, analysis);
        if (analysis.chains().get().projections() != projections) {
            throw new IllegalArgumentException(
                    "the projections given differ from the ones the analysis service uses");
        }
    }

    public List<Player> search(String query) {
        AuctionState state = auction.state();
        Set<String> sold = state.soldPlayerIds();
        return search.search(query, state.currentPhase(), SEARCH_LIMIT * 2).stream()
                .filter(p -> !sold.contains(p.id()))
                .limit(SEARCH_LIMIT)
                .toList();
    }

    /** Migliori obiettivi della fase corrente, ordinati per margine decrescente. */
    public List<TargetRow> targets(int limit) {
        ValuationChain current = chain.get();
        ProjectionRegistry projections = current.projections();
        AuctionState state = auction.state();
        Set<String> sold = state.soldPlayerIds();
        // Costruito una sola volta e riusato su tutti i candidati: rifarlo per ciascuno
        // ripeterebbe una scansione dell'intero catalogo TARGET_CANDIDATES_PER_CRITERION
        // volte.
        PriceModel prices = analysis.priceModelFor(state, current);

        List<PlayerProjection> ofPhase = projections.all().stream()
                .filter(p -> p.role() == state.currentPhase())
                .filter(p -> !sold.contains(p.playerId()))
                .toList();

        List<PlayerProjection> byPoints = ofPhase.stream()
                .sorted(Comparator.comparingDouble(PlayerProjection::basePoints).reversed())
                .limit(TARGET_CANDIDATES_PER_CRITERION)
                .toList();
        // Proxy economico: punti/prezzo, non il vero margine (che richiede la
        // valutazione completa del motore) — solo per non scartare a monte i profili
        // economici-e-dignitosi che il margine esiste per trovare.
        List<PlayerProjection> byMarginProxy = ofPhase.stream()
                .sorted(Comparator.comparingDouble(
                        (PlayerProjection p) -> p.basePoints() / Math.max(1, prices.expectedPrice(p)))
                        .reversed())
                .limit(TARGET_CANDIDATES_PER_CRITERION)
                .toList();

        Set<String> candidateIds = new LinkedHashSet<>();
        byPoints.forEach(p -> candidateIds.add(p.playerId()));
        byMarginProxy.forEach(p -> candidateIds.add(p.playerId()));

        return candidateIds.stream()
                .map(id -> new TargetRow(
                        catalog.byId(id).orElseThrow(),
                        analysis.analyze(id, state, prices, current)))
                .sorted(Comparator.comparingInt(TargetRow::margin).reversed())
                .limit(limit)
                .toList();
    }

    /**
     * Giocatori disponibili della fase corrente, ordinati per punti attesi
     * decrescenti: "qual è il migliore disponibile di questo ruolo", diversa dalla
     * domanda a cui risponde {@link #targets}, "dove sta l'affare". Il max bid è
     * calcolato SOLO per le righe della pagina richiesta, riusando sia lo stesso
     * {@link AuctionState} sia lo stesso {@link PriceModel} costruiti una volta per
     * batch — mai un modello per riga, altrimenti la scansione dell'intero catalogo si
     * ripeterebbe {@code limit} volte, e mai una riproiezione del log per riga,
     * altrimenti ogni riga potrebbe finire valutata contro uno stato diverso da quello
     * usato per la pagina e il modello di prezzo. Lo stato è letto una sola volta qui e
     * passato per intero fino a {@link PlayerAnalysisService#analyze(String, AuctionState, PriceModel)},
     * che a sua volta lo passa ad {@link AuctionService#salesInCurrentPhase(AuctionState)}
     * invece di richiamare la versione senza argomenti (che rileggerebbe e rifolderebbe
     * il log da capo).
     */
    public PhasePage phasePlayers(int offset, int limit) {
        ValuationChain current = chain.get();
        ProjectionRegistry projections = current.projections();
        AuctionState state = auction.state();
        Set<String> sold = state.soldPlayerIds();

        record Candidate(PlayerProjection projection, Player player) {
        }

        /*
         * Ordinati per quotazione Fantacalcio.it decrescente: e' l'ordine in cui i
         * giocatori vengono chiamati in asta e in cui l'occhio li cerca sul listone,
         * quindi i piu' rilevanti stanno in cima. I due criteri successivi non sono
         * decorativi: le quotazioni pari sono frequentissime (decine di giocatori a 1),
         * e senza un ordine totale due richieste della stessa pagina potrebbero
         * disporre gli stessi giocatori in ordine diverso — uno finirebbe su due pagine
         * e un altro su nessuna. I punti attesi decidono fra pari quotazione, l'id
         * decide fra pari punti, e a quel punto l'ordine e' riproducibile.
         */
        List<Candidate> ofPhase = projections.all().stream()
                .filter(p -> p.role() == state.currentPhase())
                .filter(p -> !sold.contains(p.playerId()))
                .map(p -> new Candidate(p, catalog.byId(p.playerId()).orElseThrow()))
                .sorted(Comparator.comparingInt((Candidate c) -> c.player().listPrice()).reversed()
                        .thenComparing(Comparator.comparingDouble(
                                (Candidate c) -> c.projection().basePoints()).reversed())
                        .thenComparing(c -> c.player().id()))
                .toList();

        int total = ofPhase.size();
        int start = clampToPageStart(offset, limit, total);
        List<Candidate> page = ofPhase.stream().skip(start).limit(limit).toList();

        PriceModel prices = analysis.priceModelFor(state, current);
        List<PhaseRow> rows = page.stream()
                .map(c -> new PhaseRow(c.player(),
                        analysis.analyze(c.player().id(), state, prices, current), c.projection()))
                .toList();

        return new PhasePage(rows, start, limit, total);
    }

    /**
     * Riporta un offset dentro i limiti, allineato all'inizio di una pagina.
     *
     * <p>Serve perche' l'offset sopravvive agli acquisti: si sta guardando l'ultima
     * pagina, si compra, e i giocatori rimasti non arrivano piu' fin li'. Senza questa
     * correzione la tabella si ricaricherebbe vuota — un vuoto muto che sembra un
     * errore di caricamento invece di "sei oltre la fine". Meglio l'ultima pagina piena.
     */
    private static int clampToPageStart(int offset, int limit, int total) {
        if (offset <= 0 || total == 0 || limit <= 0) {
            return 0;
        }
        int lastPageStart = ((total - 1) / limit) * limit;
        return Math.min(offset, lastPageStart);
    }
}
