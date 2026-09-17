package com.fantaagent.application.service;

import com.fantaagent.application.port.out.AuctionArchive;
import com.fantaagent.application.port.out.AuctionEventStore;
import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.league.ScoringRules;
import com.fantaagent.domain.player.Role;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Supplier;

/**
 * Unico detentore di ciò che può cambiare mentre l'applicazione è in esecuzione:
 * l'asta selezionata e l'intera catena che discende dalle regole di punteggio.
 *
 * <p><b>Perché esiste.</b> Prima, l'identificatore dell'asta era un {@code @Value}
 * letto all'avvio e le {@code ScoringRules} un singleton da cui proiezioni, livelli di
 * rimpiazzo e motore erano derivati una volta sola: cambiare qualcosa richiedeva un
 * riavvio. Qui i servizi non catturano più i loro collaboratori alla costruzione, ma
 * leggono lo {@link RuntimeSnapshot} corrente ad ogni richiesta.
 *
 * <p><b>Atomicità.</b> Ogni mutazione costruisce per intero il nuovo snapshot e poi lo
 * pubblica con UNA sola assegnazione al campo volatile {@link #current}. Chi legge vede
 * o tutto il vecchio o tutto il nuovo; una catena mezza vecchia e mezza nuova non è
 * osservabile, e {@link ValuationChain} la rifiuta comunque in costruzione. Le
 * mutazioni sono serializzate fra loro da {@code synchronized}; le letture non
 * prendono mai un lock.
 *
 * <p><b>Nessun log perduto.</b> {@link #select} e {@link #createNew} si limitano ad
 * aprire un file diverso. {@link #createNew} sceglie un identificatore ancora libero e
 * non scrive mai dentro la directory di un'asta esistente.
 */
public class AuctionRuntime {

    /** Una riga della home: come riconoscere l'asta e a che punto era rimasta. */
    public record AuctionSummary(String id, String name, Instant lastWritten, int purchases,
                                 Role phase, boolean selected) {

        /** Il nome se c'e', altrimenti l'identificativo: i registri vecchi non lo hanno. */
        public String label() {
            return name == null || name.isBlank() ? id : name;
        }
    }

    private final LeagueRules rules;
    private final PlayerCatalog catalog;
    private final List<Double> seasonWeights;
    /**
     * Regole in vigore per una data asta. Prende l'identificativo — null quando nessuna
     * e' aperta — perche' ogni asta ha le proprie: erano globali, e configurarne una
     * nuova cambiava i NUMERI mostrati per quelle vecchie.
     */
    private final java.util.function.Function<String, ScoringRules> scoringLoader;
    private final Supplier<List<Participant>> participantsLoader;
    private final AuctionArchive archive;

    /**
     * Copia dentro l'asta indicata le regole di punteggio in vigore adesso. E' un
     * collaboratore e non codice qui dentro perche' il FORMATO di quel file appartiene
     * al livello di configurazione: il runtime sa che va fissato, non come si scrive.
     */
    private final java.util.function.Consumer<String> scoringSnapshot;

    /**
     * L'unico campo mutabile della classe, e volatile: è qui che vive la garanzia di
     * atomicità. Aggiungere un secondo campo mutabile la annullerebbe, perché due
     * scritture separate sono osservabili a metà — vedi
     * {@code AuctionRuntimeAtomicityTest}, che lo verifica per riflessione.
     */
    private volatile RuntimeSnapshot current;

    public AuctionRuntime(LeagueRules rules, PlayerCatalog catalog, List<Double> seasonWeights,
                          java.util.function.Function<String, ScoringRules> scoringLoader,
                          Supplier<List<Participant>> participantsLoader,
                          AuctionArchive archive,
                          java.util.function.Consumer<String> scoringSnapshot) {
        this.rules = rules;
        this.catalog = catalog;
        this.seasonWeights = List.copyOf(seasonWeights);
        this.scoringLoader = scoringLoader;
        this.participantsLoader = participantsLoader;
        this.archive = archive;
        this.scoringSnapshot = scoringSnapshot;
        this.current = new RuntimeSnapshot(null, null, participantsLoader.get(), rules,
                ValuationChain.build(rules, scoringLoader.apply(null), catalog, seasonWeights));
    }

    /** Lo stato corrente, coerente in tutte le sue parti. Una sola lettura volatile. */
    public RuntimeSnapshot snapshot() {
        return current;
    }

    /**
     * L'identificativo dell'asta scelta, o null se non ce n'e' una. Legge lo stesso
     * snapshot volatile di {@link #snapshot()}: nessun secondo campo mutabile, che
     * annullerebbe la garanzia di atomicita' verificata da AuctionRuntimeAtomicityTest.
     */
    public String currentAuctionId() {
        return current.auctionId();
    }

    /** Il nome dell'asta scelta, o il suo identificativo se il registro non lo porta. */
    public String currentAuctionLabel() {
        String id = current.auctionId();
        if (id == null) {
            return null;
        }
        String name = nameOf(current.store().load());
        return name == null || name.isBlank() ? id : name;
    }

    /**
     * Il nome sta sull'evento di avvio; e' assente nei registri scritti prima che il
     * campo esistesse, e li' questo metodo restituisce null.
     *
     * <p>L'ordine dei passaggi non e' indifferente. Prima si trova l'evento, POI se ne
     * legge il nome: {@code findFirst()} costruisce un {@link java.util.Optional} sul
     * primo elemento e lancia NullPointerException se quell'elemento e' null, quindi
     * mappare al nome PRIMA di findFirst faceva esplodere la home su ogni asta priva di
     * nome — cioe' su tutte quelle esistenti. {@code Optional.map}, al contrario, di un
     * risultato nullo fa un Optional vuoto, che e' esattamente il significato voluto.
     */
    private static String nameOf(List<AuctionEvent> events) {
        return events.stream()
                .filter(AuctionEvent.AuctionStarted.class::isInstance)
                .map(AuctionEvent.AuctionStarted.class::cast)
                .findFirst()
                .map(AuctionEvent.AuctionStarted::name)
                .orElse(null);
    }

    public boolean hasAuction() {
        return current.hasAuction();
    }

    /**
     * Da passare ai servizi al posto di un collaboratore fisso: ogni chiamata rilegge
     * lo snapshot corrente e ne ricava un blocco coerente.
     */
    public Supplier<AuctionScope> scopes() {
        return () -> current.scope();
    }

    public Supplier<ValuationChain> chains() {
        return () -> current.chain();
    }

    /** Seleziona un'asta esistente: apre il suo log, non lo tocca in nessun altro modo. */
    public synchronized void select(String auctionId) {
        if (!archive.exists(auctionId)) {
            throw new IllegalArgumentException("nessuna asta con identificativo " + auctionId);
        }
        // La catena si ricostruisce, non si eredita: ogni asta ha le proprie regole di
        // punteggio, e riusare quella di prima significherebbe rileggere una rosa gia'
        // pagata con un modello che non e' quello con cui e' stata comprata.
        current = new RuntimeSnapshot(auctionId, archive.open(auctionId),
                participantsOf(auctionId), rules,
                ValuationChain.build(rules, scoringLoader.apply(auctionId), catalog, seasonWeights));
    }

    /**
     * I partecipanti da usare per quell'asta: i suoi, se li ha.
     *
     * <p>Nomi e iniziali appartengono alla serata, non all'applicazione. Quando erano
     * un'unica configurazione globale, configurare una seconda asta riscriveva i nomi
     * mostrati per la prima: gli acquisti restavano corretti — il registro li lega agli
     * id — ma le rose comparivano intestate alle persone sbagliate.
     *
     * <p>Le aste scritte prima di questa separazione non hanno un proprio elenco e
     * ricadono su quello generale. E' il meglio possibile senza inventare dati: per
     * fissare i nomi giusti basta aprire quell'asta e salvarli una volta.
     */
    private List<Participant> participantsOf(String auctionId) {
        if (auctionId == null) {
            return participantsLoader.get();
        }
        return archive.participants(auctionId).orElseGet(participantsLoader);
    }

    /**
     * Crea un'asta sotto un identificatore datato ancora libero e la seleziona.
     *
     * <p>L'identificatore è la data odierna; se quella directory esiste già si aggiunge
     * un progressivo, così un'asta esistente non viene mai aperta credendo di crearne
     * una nuova. L'unica scrittura è l'evento {@code AuctionStarted} in un log che
     * prima non c'era.
     *
     * @return l'identificatore creato
     */
    /**
     * Crea l'asta e la seleziona.
     *
     * <p>Va chiamata quando le impostazioni sono state CONFERMATE, non quando l'utente
     * dichiara di voler cominciare: prima creava la cartella al primo click, e chi si
     * fermava alla schermata di conferma lasciava dietro di se' un'asta vuota che
     * restava per sempre nell'elenco della home.
     *
     * @param name nome scelto dall'utente; l'identificativo resta invece derivato dalla
     *             data, perche' e' anche il nome della cartella su disco e deve restare
     *             ordinabile e privo di caratteri che un filesystem rifiuta.
     */
    public synchronized String createNew(String name) {
        String id = freeId(LocalDate.now().toString());
        AuctionEventStore store = archive.open(id);
        store.appendWithNextSeq(seq -> new AuctionEvent.AuctionStarted(seq, Instant.now(), name));
        // I partecipanti configurati adesso diventano quelli DI QUESTA asta: da qui in
        // avanti riconfigurarne un'altra non tocchera' piu' i nomi di questa.
        List<Participant> participants = participantsLoader.get();
        archive.saveParticipants(id, participants);
        // E lo stesso per le regole di punteggio: da qui in avanti configurarne altre
        // non tocchera' i numeri di questa.
        scoringSnapshot.accept(id);
        current = new RuntimeSnapshot(id, store, participants, rules,
                ValuationChain.build(rules, scoringLoader.apply(id), catalog, seasonWeights));
        return id;
    }

    /**
     * Rilegge le impostazioni dell'utente e ricostruisce l'intera catena, poi la
     * pubblica in blocco. L'asta selezionata non cambia: le impostazioni non sono una
     * proprietà del log.
     */
    /**
     * Chiude l'asta aperta senza toccarne il registro: da qui si prepara la prossima.
     *
     * <p>Serve perche' la schermata di preparazione distingue le due modalita' da una
     * cosa sola — se un'asta e' aperta o no. Senza questo, dire "nuova asta" con una
     * gia' aperta portava alle impostazioni di QUELLA, in sola lettura e senza campo
     * per il nome, e salvando se ne rinominavano i partecipanti invece di crearne
     * un'altra. Nessun dato andava perso, ma l'asta nuova non nasceva e quella vecchia
     * cambiava nomi.
     *
     * <p>I partecipanti tornano quelli della configurazione generale, che e' il modello
     * da cui parte la prossima asta.
     */
    public synchronized void deselect() {
        current = new RuntimeSnapshot(null, null, participantsLoader.get(), rules,
                ValuationChain.build(rules, scoringLoader.apply(null), catalog, seasonWeights));
    }

    /**
     * Fissa i partecipanti dell'asta aperta e ripubblica lo snapshot.
     *
     * <p>Scrive nell'asta, non nella configurazione generale: rinominare durante una
     * serata non deve toccare i nomi di quelle gia' concluse.
     */
    public synchronized void setParticipants(List<Participant> participants) {
        RuntimeSnapshot base = current;
        if (base.auctionId() != null) {
            archive.saveParticipants(base.auctionId(), participants);
        }
        current = new RuntimeSnapshot(base.auctionId(), base.store(), participants, base.rules(),
                base.chain());
    }

    public synchronized void rebuild() {
        RuntimeSnapshot base = current;
        ScoringRules scoring = scoringLoader.apply(base.auctionId());
        List<Participant> participants = participantsOf(base.auctionId());
        ValuationChain chain = ValuationChain.build(rules, scoring, catalog, seasonWeights);
        current = new RuntimeSnapshot(base.auctionId(), base.store(), participants, rules, chain);
    }

    /** Le aste presenti sull'archivio, dalla più recente. */
    public List<AuctionSummary> auctions() {
        String selected = current.auctionId();
        List<AuctionSummary> summaries = new ArrayList<>();
        for (String id : archive.auctionIds()) {
            List<AuctionEvent> events = archive.open(id).load();
            summaries.add(new AuctionSummary(id,
                    nameOf(events),
                    archive.lastWritten(id).orElse(null),
                    countPurchases(events),
                    lastPhase(events, rules.firstPhase()),
                    id.equals(selected)));
        }
        summaries.sort((a, b) -> {
            if (a.lastWritten() == null || b.lastWritten() == null) {
                return a.id().compareTo(b.id());
            }
            return b.lastWritten().compareTo(a.lastWritten());
        });
        return List.copyOf(summaries);
    }

    private String freeId(String base) {
        if (!archive.exists(base)) {
            return base;
        }
        for (int n = 2; n < 1000; n++) {
            String candidate = base + "-" + n;
            if (!archive.exists(candidate)) {
                return candidate;
            }
        }
        throw new IllegalStateException("troppe aste create oggi con lo stesso identificativo " + base);
    }

    /**
     * Conteggio letto dal log senza proiettarlo: la home elenca anche aste con
     * partecipanti o giocatori che il catalogo corrente potrebbe non conoscere più, e
     * una proiezione fallirebbe proprio sulle aste più vecchie — quelle che l'elenco
     * serve a ritrovare.
     */
    static int countPurchases(List<AuctionEvent> events) {
        Set<Long> revoked = new HashSet<>();
        for (AuctionEvent event : events) {
            if (event instanceof AuctionEvent.PurchaseRevoked r) {
                revoked.add(r.targetSeq());
            }
        }
        int purchases = 0;
        for (AuctionEvent event : events) {
            if (event instanceof AuctionEvent.PlayerPurchased p && !revoked.contains(p.seq())) {
                purchases++;
            }
        }
        return purchases;
    }

    static Role lastPhase(List<AuctionEvent> events, Role fallback) {
        Role phase = fallback;
        for (AuctionEvent event : events) {
            if (event instanceof AuctionEvent.PhaseAdvanced advanced) {
                phase = advanced.role();
            }
        }
        return phase;
    }
}
