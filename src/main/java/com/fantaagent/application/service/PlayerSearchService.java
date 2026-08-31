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
     * Righe per pagina della tabella di fase: circa 25, misurato in
     * {@code PlayerSearchServiceLatencyTest} per restare sotto 1,5 s a rosa
     * realistica — un batch più grande farebbe scattare il taglio (il max bid costa
     * circa 45 ms/giocatore).
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

    public record PhasePage(List<PhaseRow> rows, boolean hasMore, int nextOffset) {
    }

    private final PlayerCatalog catalog;
    private final PlayerSearch search;
    private final AuctionService auction;
    private final PlayerAnalysisService analysis;
    private final ProjectionRegistry projections;

    public PlayerSearchService(PlayerCatalog catalog, ProjectionRegistry projections,
                               AuctionService auction, PlayerAnalysisService analysis) {
        this.catalog = catalog;
        this.projections = projections;
        this.auction = auction;
        this.analysis = analysis;
        this.search = new PlayerSearch(catalog.all(),
                id -> projections.of(id).basePoints());
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
        AuctionState state = auction.state();
        Set<String> sold = state.soldPlayerIds();
        // Costruito una sola volta e riusato su tutti i candidati: rifarlo per ciascuno
        // ripeterebbe una scansione dell'intero catalogo TARGET_CANDIDATES_PER_CRITERION
        // volte.
        PriceModel prices = analysis.priceModelFor(state);

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
                        analysis.analyze(id, state, prices)))
                .sorted(Comparator.comparingInt(TargetRow::margin).reversed())
                .limit(limit)
                .toList();
    }

    /**
     * Giocatori disponibili della fase corrente, ordinati per punti attesi
     * decrescenti: "qual è il migliore disponibile di questo ruolo", diversa dalla
     * domanda a cui risponde {@link #targets}, "dove sta l'affare". Il max bid è
     * calcolato SOLO per le righe della pagina richiesta, riusando lo stesso
     * {@link PriceModel} costruito una volta per batch — mai un modello per riga,
     * altrimenti la scansione dell'intero catalogo si ripeterebbe {@code limit} volte.
     */
    public PhasePage phasePlayers(int offset, int limit) {
        AuctionState state = auction.state();
        Set<String> sold = state.soldPlayerIds();

        List<PlayerProjection> ofPhase = projections.all().stream()
                .filter(p -> p.role() == state.currentPhase())
                .filter(p -> !sold.contains(p.playerId()))
                .sorted(Comparator.comparingDouble(PlayerProjection::basePoints).reversed())
                .toList();

        List<PlayerProjection> page = ofPhase.stream().skip(Math.max(0, offset)).limit(limit).toList();

        PriceModel prices = analysis.priceModelFor(state);
        List<PhaseRow> rows = page.stream()
                .map(p -> new PhaseRow(catalog.byId(p.playerId()).orElseThrow(),
                        analysis.analyze(p.playerId(), state, prices), p))
                .toList();

        boolean hasMore = offset + page.size() < ofPhase.size();
        return new PhasePage(rows, hasMore, offset + page.size());
    }
}
