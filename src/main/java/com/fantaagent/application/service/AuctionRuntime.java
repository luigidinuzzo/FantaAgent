package com.fantaagent.application.service;

import com.fantaagent.application.port.out.AuctionArchive;
import com.fantaagent.application.port.out.AuctionEventStore;
import com.fantaagent.application.port.out.AuctionTemplate;
import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.LeagueRulesSettings;
import com.fantaagent.config.ScoringSettings;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Role;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Supplier;

/**
 * Unico detentore di ciò che può cambiare mentre l'applicazione è in esecuzione:
 * l'asta selezionata, le sue regole, i suoi partecipanti, il suo punteggio, le
 * preferenze del battitore e l'intera catena di valutazione che ne discende.
 *
 * <p><b>Ogni asta porta i suoi valori.</b> Si leggono dalla cartella dell'asta; quelli
 * che mancano (aste create prima dei file nuovi) vengono dal {@link AuctionTemplate},
 * il modello con cui quelle aste sono state giocate. Il modello non si riscrive mai da
 * qui.
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

    /**
     * Una riga della home: come riconoscere l'asta e a che punto era rimasta.
     *
     * <p>{@code teams}, {@code budget} e {@code totalSlots} vengono dai file dell'asta
     * (o dal modello per quelle scritte prima): {@code totalSlots} e' squadre per
     * posti in rosa, cosi' che {@code purchases} su {@code totalSlots} dica quanto manca.
     * {@code myName} e {@code myBudgetRemaining} sono null se nessun partecipante e'
     * segnato come proprio.
     */
    public record AuctionSummary(String id, String name, Instant lastWritten, int purchases,
                                 Role phase, boolean selected, int teams, int budget,
                                 int totalSlots, String myName, Integer myBudgetRemaining) {

        /** Senza i dati della lega: per chi deve solo riconoscere l'asta. */
        public AuctionSummary(String id, String name, Instant lastWritten, int purchases,
                              Role phase, boolean selected) {
            this(id, name, lastWritten, purchases, phase, selected, 0, 0, 0, null, null);
        }

        /** Il nome se c'e', altrimenti l'identificativo: i registri vecchi non lo hanno. */
        public String label() {
            return name == null || name.isBlank() ? id : name;
        }
    }

    private final PlayerCatalog catalog;
    private final List<Double> seasonWeights;
    private final List<Role> phases;
    private final AuctionTemplate template;
    private final AuctionArchive archive;

    /**
     * L'unico campo mutabile della classe, e volatile: è qui che vive la garanzia di
     * atomicità. Aggiungere un secondo campo mutabile la annullerebbe, perché due
     * scritture separate sono osservabili a metà — vedi
     * {@code AuctionRuntimeAtomicityTest}, che lo verifica per riflessione.
     */
    private volatile RuntimeSnapshot current;

    public AuctionRuntime(PlayerCatalog catalog, List<Double> seasonWeights, List<Role> phases,
                          AuctionTemplate template, AuctionArchive archive) {
        this.catalog = catalog;
        this.seasonWeights = List.copyOf(seasonWeights);
        this.phases = List.copyOf(phases);
        this.template = template;
        this.archive = archive;
        this.current = snapshotOf(null);
    }

    /**
     * Lo snapshot di un'asta, o del modello con id null. Ogni parte viene dall'asta se
     * ha il suo file, altrimenti dal modello: le aste create prima dei file nuovi
     * ricadono sui valori con cui sono state giocate.
     */
    private RuntimeSnapshot snapshotOf(String auctionId) {
        if (auctionId == null) {
            return build(null, null, template.participants(), template.rules(),
                    template.scoring(), template.bidder());
        }
        return build(auctionId, archive.open(auctionId),
                archive.participants(auctionId).orElseGet(template::participants),
                archive.rules(auctionId).orElseGet(template::rules),
                archive.scoring(auctionId).orElseGet(template::scoring),
                archive.bidder(auctionId).orElseGet(template::bidder));
    }

    /** Le squadre sono i partecipanti: le regole si costruiscono sempre insieme a loro. */
    private RuntimeSnapshot build(String auctionId, AuctionEventStore store,
                                  List<Participant> participants, LeagueRulesSettings rulesSettings,
                                  ScoringSettings scoring, AuctionSettings bidder) {
        LeagueRules rules = rulesSettings.toRules(participants.size(), phases);
        ValuationChain chain = ValuationChain.build(rules, template.scoringRules(scoring),
                catalog, seasonWeights);
        return new RuntimeSnapshot(auctionId, store, participants, rules, scoring, bidder, chain);
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
        String name = events.stream()
                .filter(AuctionEvent.AuctionStarted.class::isInstance)
                .map(AuctionEvent.AuctionStarted.class::cast)
                .findFirst()
                .map(AuctionEvent.AuctionStarted::name)
                .orElse(null);
        // Una rinomina vale sul nome di avvio, e l'ultima sulle precedenti.
        for (AuctionEvent event : events) {
            if (event instanceof AuctionEvent.AuctionRenamed renamed) {
                name = renamed.name();
            }
        }
        return name;
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

    public LeagueRules rules() {
        return current.rules();
    }

    public ScoringSettings scoringSettings() {
        return current.scoring();
    }

    public AuctionSettings bidder() {
        return current.bidder();
    }

    public List<Participant> participants() {
        return current.participants();
    }

    /** Seleziona un'asta esistente: apre il suo log, non lo tocca in nessun altro modo. */
    public synchronized void select(String auctionId) {
        if (!archive.exists(auctionId)) {
            throw new IllegalArgumentException("nessuna asta con identificativo " + auctionId);
        }
        // Tutto si ricostruisce, niente si eredita: riusare regole o catena dell'asta di
        // prima rileggerebbe una rosa gia' pagata con un modello che non e' il suo.
        current = snapshotOf(auctionId);
    }

    /**
     * Crea l'asta sotto un identificatore datato ancora libero e la seleziona.
     *
     * <p>Va chiamata quando le impostazioni sono state CONFERMATE e validate: prima
     * creava la cartella al primo click, e chi si fermava alla schermata di conferma
     * lasciava dietro di se' un'asta vuota che restava per sempre nell'elenco.
     *
     * <p>L'identificatore è la data odierna, con un progressivo se quella cartella
     * esiste già: un'asta esistente non viene mai aperta credendo di crearne una nuova.
     *
     * @return l'identificatore creato
     */
    public synchronized String createNew(AuctionSetup setup) {
        String id = freeId(LocalDate.now().toString());
        // Il registro per ULTIMO: auctionIds() elenca solo le cartelle con events.jsonl,
        // quindi un errore su uno dei file prima lascia una cartella che la home non
        // mostra e che freeId non riusa.
        archive.saveParticipants(id, setup.participants());
        archive.saveScoring(id, setup.scoring());
        archive.saveRules(id, setup.rules());
        archive.saveBidder(id, setup.bidder());
        AuctionEventStore store = archive.open(id);
        store.appendWithNextSeq(seq -> new AuctionEvent.AuctionStarted(seq, Instant.now(), setup.name()));
        current = build(id, store, setup.participants(), setup.rules(), setup.scoring(), setup.bidder());
        return id;
    }

    /** Solo per /legacy, che non conosce le regole: crea l'asta dal modello. */
    public synchronized String createNew(String name) {
        return createNew(new AuctionSetup(name, template.rules(), template.participants(),
                template.scoring(), template.bidder()));
    }

    /**
     * Chiude l'asta aperta senza toccarne il registro: da qui si prepara la prossima.
     *
     * <p>Serve perche' la schermata di preparazione distingue le due modalita' da una
     * cosa sola — se un'asta e' aperta o no. Nessun dato va perso: il registro e' su
     * disco. Lo snapshot torna quello del modello, da cui parte la prossima asta.
     */
    public synchronized void deselect() {
        current = snapshotOf(null);
    }

    /**
     * Fissa i partecipanti dell'asta aperta e ripubblica lo snapshot.
     *
     * <p>Scrive nell'asta, mai nel modello: rinominare durante una serata non deve
     * toccare i nomi di quelle gia' concluse. Una lista di lunghezza diversa cambia il
     * numero di squadre e quindi regole e catena, che si ricostruiscono qui; la SPA ad
     * asta aperta lo impedisce a monte.
     */
    public synchronized void setParticipants(List<Participant> participants) {
        RuntimeSnapshot base = current;
        if (base.auctionId() != null) {
            archive.saveParticipants(base.auctionId(), participants);
        }
        current = build(base.auctionId(), base.store(), participants,
                LeagueRulesSettings.from(base.rules()), base.scoring(), base.bidder());
    }

    /** Le preferenze del battitore dell'asta aperta: non entrano in nessun calcolo. */
    public synchronized void setBidder(AuctionSettings bidder) {
        RuntimeSnapshot base = current;
        if (base.auctionId() == null) {
            throw new IllegalStateException(
                    "nessuna asta aperta a cui dare le preferenze del battitore");
        }
        archive.saveBidder(base.auctionId(), bidder);
        current = new RuntimeSnapshot(base.auctionId(), base.store(), base.participants(),
                base.rules(), base.scoring(), bidder, base.chain());
    }

    /**
     * Toglie un'asta dall'archivio. Se e' quella aperta prima la chiude: nessuno
     * snapshot deve restare a puntare un registro spostato nel cestino.
     */
    public synchronized void delete(String auctionId) {
        if (!archive.exists(auctionId)) {
            throw new IllegalArgumentException("nessuna asta con identificativo " + auctionId);
        }
        if (auctionId.equals(current.auctionId())) {
            current = snapshotOf(null);
        }
        archive.delete(auctionId);
    }

    /**
     * Da' un nuovo nome a un'asta, aperta o no, aggiungendo un evento al suo registro.
     *
     * <p>Sull'asta aperta si scrive con lo store dello snapshot, non con uno nuovo
     * aperto dall'archivio: il lock che assegna i numeri di sequenza e' dello store, e
     * due store sullo stesso file potrebbero dare lo stesso numero a due eventi.
     *
     * @throws IllegalArgumentException se l'asta non esiste o il nome e' vuoto
     */
    public synchronized void rename(String auctionId, String name) {
        if (!archive.exists(auctionId)) {
            throw new IllegalArgumentException("nessuna asta con identificativo " + auctionId);
        }
        String trimmed = name == null ? "" : name.trim();
        AuctionEventStore store = auctionId.equals(current.auctionId())
                ? current.store()
                : archive.open(auctionId);
        store.appendWithNextSeq(seq -> new AuctionEvent.AuctionRenamed(seq, Instant.now(), trimmed));
    }

    /**
     * Crea un'asta nuova con partecipanti, regole, punteggio e battitore di un'altra, e
     * nessun acquisto. Non cambia l'asta aperta: duplicare dalla home non deve chiudere
     * quella in corso.
     *
     * @return l'identificatore dell'asta creata
     * @throws IllegalArgumentException se l'asta da copiare non esiste
     */
    public synchronized String duplicate(String auctionId, String name) {
        if (!archive.exists(auctionId)) {
            throw new IllegalArgumentException("nessuna asta con identificativo " + auctionId);
        }
        AuctionSetup source = setupOf(auctionId);
        String id = freeId(LocalDate.now().toString());
        // Come in createNew, il registro per ULTIMO.
        archive.saveParticipants(id, source.participants());
        archive.saveScoring(id, source.scoring());
        archive.saveRules(id, source.rules());
        archive.saveBidder(id, source.bidder());
        archive.open(id).appendWithNextSeq(seq -> new AuctionEvent.AuctionStarted(seq, Instant.now(), name));
        return id;
    }

    /**
     * Partecipanti, regole, punteggio e battitore di un'asta, aperta o no, col suo
     * nome. Ogni parte viene dall'asta se ha il suo file, altrimenti dal modello:
     * lo stesso ripiego di {@link #snapshotOf}. Serve a copiarla e a partire da lei
     * preparando un'asta nuova.
     *
     * @throws IllegalArgumentException se l'asta non esiste
     */
    public AuctionSetup setupOf(String auctionId) {
        String name = labelOf(auctionId);
        return new AuctionSetup(name,
                archive.rules(auctionId).orElseGet(template::rules),
                archive.participants(auctionId).orElseGet(template::participants),
                archive.scoring(auctionId).orElseGet(template::scoring),
                archive.bidder(auctionId).orElseGet(template::bidder));
    }

    /** Il nome di un'asta come lo mostra la home: serve a proporre quello della copia. */
    public String labelOf(String auctionId) {
        if (!archive.exists(auctionId)) {
            throw new IllegalArgumentException("nessuna asta con identificativo " + auctionId);
        }
        String name = nameOf(archive.open(auctionId).load());
        return name == null || name.isBlank() ? auctionId : name;
    }

    /** Rilegge dall'archivio e dal modello l'asta corrente. Usato da /legacy. */
    public synchronized void rebuild() {
        current = snapshotOf(current.auctionId());
    }

    /** Le aste presenti sull'archivio, dalla più recente. */
    public List<AuctionSummary> auctions() {
        String selected = current.auctionId();
        List<AuctionSummary> summaries = new ArrayList<>();
        for (String id : archive.auctionIds()) {
            List<AuctionEvent> events = archive.open(id).load();
            List<Participant> members = archive.participants(id).orElseGet(template::participants);
            LeagueRulesSettings rules = archive.rules(id).orElseGet(template::rules);
            int slotsPerTeam = rules.slots().values().stream().mapToInt(Integer::intValue).sum();
            Participant me = members.stream().filter(Participant::me).findFirst().orElse(null);
            summaries.add(new AuctionSummary(id,
                    nameOf(events),
                    archive.lastWritten(id).orElse(null),
                    countPurchases(events),
                    lastPhase(events, phases.getFirst()),
                    id.equals(selected),
                    members.size(),
                    rules.budget(),
                    members.size() * slotsPerTeam,
                    me == null ? null : me.name(),
                    me == null ? null : rules.budget() - spentBy(events, me.id())));
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

    /**
     * I crediti spesi da un partecipante, letti dal log come {@link #countPurchases}:
     * gli acquisti annullati non contano, e una correzione sposta il prezzo (ed
     * eventualmente l'acquirente) dell'acquisto che corregge.
     */
    static int spentBy(List<AuctionEvent> events, String participantId) {
        Map<Long, AuctionEvent.PlayerPurchased> active = new LinkedHashMap<>();
        Map<Long, String> buyer = new HashMap<>();
        Map<Long, Integer> price = new HashMap<>();
        for (AuctionEvent event : events) {
            switch (event) {
                case AuctionEvent.PlayerPurchased p -> {
                    active.put(p.seq(), p);
                    buyer.put(p.seq(), p.participantId());
                    price.put(p.seq(), p.price());
                }
                case AuctionEvent.PurchaseRevoked r -> active.remove(r.targetSeq());
                case AuctionEvent.PurchaseCorrected c -> {
                    if (active.containsKey(c.targetSeq())) {
                        buyer.put(c.targetSeq(), c.newParticipantId());
                        price.put(c.targetSeq(), c.newPrice());
                    }
                }
                default -> {
                    // nome e fasi non spostano crediti
                }
            }
        }
        int spent = 0;
        for (Long seq : active.keySet()) {
            if (participantId.equals(buyer.get(seq))) {
                spent += price.get(seq);
            }
        }
        return spent;
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
