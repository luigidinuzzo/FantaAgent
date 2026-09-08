package com.fantaagent.application.service;

import com.fantaagent.application.port.out.AuctionEventStore;
import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.auction.AuctionProjector;
import com.fantaagent.domain.auction.AuctionState;
import com.fantaagent.domain.auction.Holding;
import com.fantaagent.domain.auction.Squad;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.function.Supplier;

/**
 * Registrazione degli eventi d'asta.
 *
 * <p>Lo stato viene riproiettato dal log a ogni lettura: con qualche centinaio di eventi
 * costa microsecondi ed elimina ogni possibilità di divergenza fra cache e verità.
 */
public class AuctionService {

    private final LeagueRules rules;
    private final PlayerCatalog catalog;

    /**
     * L'asta corrente, riletta ad ogni operazione invece di essere catturata alla
     * costruzione: è così che selezionare un'altra asta dalla home, o rinominare un
     * partecipante, ha effetto senza riavviare. Un solo {@code get()} per operazione,
     * mai due: {@link AuctionScope} tiene insieme log e partecipanti proprio perché
     * non siano leggibili separatamente.
     */
    private final Supplier<AuctionScope> scope;

    /**
     * Calcolato una sola volta per asta, dallo stato del log trovato su disco quando
     * quell'asta è stata aperta — non ricalcolato ad ogni lettura come {@link #state()}.
     * Se lo fosse, resterebbe presente per sempre non appena esiste un solo holding,
     * quindi dal primo acquisto in poi il banner mentirebbe dicendo "ripreso dal log su
     * disco" anche per acquisti appena fatti in questa sessione. Va invece a vuoto al
     * primo {@link #recordPurchase} o {@link #undoLast} riusciti in questa sessione, e
     * viene ricalcolato quando si passa a un'asta diversa.
     */
    private volatile Optional<ResumeSummary> resumeSummary = Optional.empty();

    /** Identificativo dell'asta per cui {@link #resumeSummary} è stato calcolato. */
    private volatile String summarizedAuctionId;

    /** Nessuna asta ha mai questo identificativo: distingue "mai calcolato" da null. */
    private static final String NEVER_SUMMARIZED = "\u0000mai";

    public AuctionService(LeagueRules rules, PlayerCatalog catalog, Supplier<AuctionScope> scope) {
        this.rules = rules;
        this.catalog = catalog;
        this.scope = scope;
        this.summarizedAuctionId = NEVER_SUMMARIZED;
    }

    /**
     * Asta fissa, decisa alla costruzione: la forma usata dai test e da chiunque non
     * abbia bisogno di cambiare asta a caldo.
     */
    public AuctionService(LeagueRules rules, List<Participant> participants,
                          PlayerCatalog catalog, AuctionEventStore store) {
        this(rules, catalog, fixedScope(participants, store));
        syncResumeSummary();
    }

    private static Supplier<AuctionScope> fixedScope(List<Participant> participants,
                                                     AuctionEventStore store) {
        AuctionScope fixed = new AuctionScope("fissa", store, participants);
        return () -> fixed;
    }

    public AuctionState state() {
        return state(scope.get());
    }

    private AuctionState state(AuctionScope currentScope) {
        return AuctionProjector.project(rules, currentScope.participants(), catalog,
                currentScope.store().load());
    }

    public String auctionId() {
        return scope.get().auctionId();
    }

    public void recordPurchase(String playerId, String participantId, int price) {
        recordPurchase(playerId, participantId, price, null);
    }

    /**
     * @param requestId chiave di idempotenza, o null. Se una richiesta con la
     *                  stessa chiave e' gia' stata registrata, non viene scritto
     *                  nulla e si restituisce l'evento di allora.
     * @return l'evento effettivamente presente nel log per questa richiesta. Non
     *         il seq soltanto: chi risponde al client deve poter comporre la
     *         risposta da cio' che il log contiene davvero. Su un secondo invio
     *         della stessa chiave con un corpo diverso, i dati della richiesta e
     *         quelli registrati divergono, e riportare i primi significherebbe
     *         confermare un acquisto che non e' mai stato scritto.
     */
    public AuctionEvent.PlayerPurchased recordPurchase(String playerId, String participantId,
                                                       int price, String requestId) {
        AuctionScope currentScope = scope.get();
        AuctionEventStore currentStore = currentScope.store();
        // Sezione critica sull'istanza dello store dello scope corrente, dal
        // controllo della chiave alla scrittura: senza un lock che le lega insieme,
        // due richieste con la STESSA chiave, rilasciate nello stesso istante,
        // potevano entrambe leggere "nessuna corrispondenza" in seqOf prima che
        // l'una o l'altra avesse scritto — e scrivere entrambe, il doppio acquisto
        // che questo metodo esiste per impedire. Il lock e' sullo store, non sul
        // metodo o sul servizio, perche' aste diverse non si devono bloccare a
        // vicenda quando il sotto-progetto 2 ne apre piu' di una.
        synchronized (currentStore) {
            // Il controllo della chiave precede ogni validazione: un secondo invio
            // della stessa richiesta deve riuscire come il primo, anche se nel
            // frattempo quel giocatore risulta venduto — venduto proprio da lei.
            if (requestId != null) {
                Optional<AuctionEvent.PlayerPurchased> already =
                        recordedFor(currentStore, requestId);
                if (already.isPresent()) {
                    return already.get();
                }
            }

            Player player = catalog.byId(playerId)
                    .orElseThrow(() -> new IllegalArgumentException("giocatore sconosciuto: " + playerId));
            Participant buyer = currentScope.participants().stream()
                    .filter(p -> p.id().equals(participantId))
                    .findFirst()
                    .orElseThrow(() -> new IllegalArgumentException(
                            "partecipante sconosciuto: " + participantId));
            if (price < 1) {
                throw new IllegalArgumentException("il prezzo deve essere almeno 1");
            }

            AuctionState current = state(currentScope);
            if (current.soldPlayerIds().contains(playerId)) {
                throw new PurchaseRejectedException(PurchaseRejectedException.Reason.ALREADY_SOLD,
                        player.name() + " è già stato acquistato");
            }
            Squad squad = current.squadOf(buyer.id());
            if (price > squad.budgetRemaining()) {
                throw new PurchaseRejectedException(
                        PurchaseRejectedException.Reason.INSUFFICIENT_BUDGET,
                        buyer.name() + " ha solo " + squad.budgetRemaining()
                        + " crediti di budget residuo");
            }
            if (!squad.hasRoom(player.role())) {
                throw new PurchaseRejectedException(
                        PurchaseRejectedException.Reason.ROLE_SLOTS_EXHAUSTED,
                        buyer.name() + " ha già coperto tutti gli slot " + player.role());
            }

            AuctionEvent written = currentStore.appendWithNextSeq(
                    seq -> new AuctionEvent.PlayerPurchased(seq, Instant.now(), playerId,
                            buyer.id(), price, requestId));
            markChangedInThisSession();
            return (AuctionEvent.PlayerPurchased) written;
        }
    }

    /** L'acquisto scritto per quella chiave, se c'e' gia' stato. */
    private Optional<AuctionEvent.PlayerPurchased> recordedFor(AuctionEventStore store,
                                                               String requestId) {
        return store.load().stream()
                .filter(AuctionEvent.PlayerPurchased.class::isInstance)
                .map(AuctionEvent.PlayerPurchased.class::cast)
                .filter(p -> requestId.equals(p.requestId()))
                .findFirst();
    }

    /** @return false se non c'era nulla da annullare */
    public boolean undoLast() {
        AuctionEventStore store = scope.get().store();
        List<AuctionEvent> events = store.load();
        Set<Long> revoked = new HashSet<>();
        for (AuctionEvent event : events) {
            if (event instanceof AuctionEvent.PurchaseRevoked r) {
                revoked.add(r.targetSeq());
            }
        }
        for (int i = events.size() - 1; i >= 0; i--) {
            if (events.get(i) instanceof AuctionEvent.PlayerPurchased purchased
                    && !revoked.contains(purchased.seq())) {
                store.appendWithNextSeq(seq -> new AuctionEvent.PurchaseRevoked(
                        seq, Instant.now(), purchased.seq()));
                markChangedInThisSession();
                return true;
            }
        }
        return false;
    }

    /**
     * Annulla un acquisto specifico, individuato dal suo seq — a differenza di
     * {@link #undoLast}, che raggiunge solo il più recente. Usato dalla pagina di
     * riepilogo, dove ogni "✕" rimuove UNA riga precisa, non necessariamente l'ultima
     * registrata in assoluto.
     */
    public void revokePurchase(long targetSeq) {
        AuctionEventStore store = scope.get().store();
        List<AuctionEvent> events = store.load();
        boolean exists = false;
        Set<Long> revoked = new HashSet<>();
        for (AuctionEvent event : events) {
            if (event instanceof AuctionEvent.PlayerPurchased purchased
                    && purchased.seq() == targetSeq) {
                exists = true;
            }
            if (event instanceof AuctionEvent.PurchaseRevoked r) {
                revoked.add(r.targetSeq());
            }
        }
        if (!exists) {
            throw new IllegalArgumentException("nessun acquisto con id " + targetSeq);
        }
        if (revoked.contains(targetSeq)) {
            throw new IllegalArgumentException("acquisto già annullato");
        }

        store.appendWithNextSeq(seq -> new AuctionEvent.PurchaseRevoked(seq, Instant.now(), targetSeq));
        markChangedInThisSession();
    }

    /** @return false se non c'era una fase successiva (si è già all'ultima) */
    public boolean advancePhase() {
        Optional<Role> next = rules.nextPhase(state().currentPhase());
        return next.isPresent() && selectPhase(next.get());
    }

    /**
     * Porta l'asta su una fase qualunque, in avanti o all'indietro.
     *
     * <p>Tornare indietro non toglie nulla: la fase è già registrata come evento nel
     * log, quindi spostarsi è solo appenderne un altro. Nessun acquisto viene perso e
     * non serve un nuovo tipo di evento — il log resta append-only e continua a
     * raccontare per intero anche i ripensamenti.
     *
     * @return false se si era già su quella fase (nessun evento scritto)
     * @throws IllegalArgumentException se il ruolo non è una fase configurata
     */
    public boolean selectPhase(Role role) {
        if (!rules.phases().contains(role)) {
            throw new IllegalArgumentException("fase non prevista dal regolamento: " + role);
        }
        Role current = state().currentPhase();
        if (current == role) {
            return false;
        }
        AuctionEventStore store = scope.get().store();
        store.backup("fine-" + current.name());
        store.appendWithNextSeq(seq -> new AuctionEvent.PhaseAdvanced(seq, Instant.now(), role));
        return true;
    }

    /**
     * Asta gia' in corso trovata sul disco all'avvio.
     *
     * <p>La spec impone di non riprendere in silenzio: ripartire su uno stato sbagliato
     * sarebbe peggio che non ripartire. La UI mostra questo riepilogo finche' l'utente
     * non lo chiude.
     */
    public record ResumeSummary(int purchases, Role phase) {
    }

    public Optional<ResumeSummary> resumeSummary() {
        syncResumeSummary();
        return resumeSummary;
    }

    /**
     * Ricalcola il riepilogo solo quando l'asta selezionata cambia: è il momento in cui
     * "trovata già in corso sul log" torna a essere una domanda sensata. Dentro la
     * stessa asta il riepilogo non viene mai ricalcolato, altrimenti riapparirebbe dopo
     * ogni acquisto fatto in questa sessione.
     */
    private void syncResumeSummary() {
        String id = scope.get().auctionId();
        if (!Objects.equals(id, summarizedAuctionId)) {
            summarizedAuctionId = id;
            resumeSummary = summarize(state());
        }
    }

    private void markChangedInThisSession() {
        summarizedAuctionId = scope.get().auctionId();
        resumeSummary = Optional.empty();
    }

    private static Optional<ResumeSummary> summarize(AuctionState state) {
        if (state.holdings().isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(new ResumeSummary(state.holdings().size(), state.currentPhase()));
    }

    public int salesInCurrentPhase() {
        return salesInCurrentPhase(state());
    }

    /**
     * Come {@link #salesInCurrentPhase()}, ma riusa uno stato già proiettato invece di
     * rileggere e rifoldare il log — usato da chi ha già uno stato a disposizione (es.
     * {@link PlayerAnalysisService#analyze(String, AuctionState, com.fantaagent.domain.strategy.PriceModel)})
     * per non pagare una proiezione in più per ogni riga valutata.
     */
    public int salesInCurrentPhase(AuctionState state) {
        return (int) state.holdings().stream()
                .filter(h -> h.role() == state.currentPhase())
                .count();
    }

    public Optional<Participant> byInitial(char initial) {
        char upper = Character.toUpperCase(initial);
        return participants().stream().filter(p -> p.initial() == upper).findFirst();
    }

    public Participant me() {
        return participants().stream()
                .filter(Participant::me)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("nessun partecipante marcato come me"));
    }

    public List<Participant> participants() {
        return scope.get().participants();
    }

    /** Nome del giocatore per un holding, per la resa nel tabellone. */
    public String playerName(Holding holding) {
        return catalog.byId(holding.playerId()).map(Player::name).orElse(holding.playerId());
    }
}
