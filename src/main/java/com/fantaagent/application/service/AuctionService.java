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
import java.util.Optional;
import java.util.Set;

/**
 * Registrazione degli eventi d'asta.
 *
 * <p>Lo stato viene riproiettato dal log a ogni lettura: con qualche centinaio di eventi
 * costa microsecondi ed elimina ogni possibilità di divergenza fra cache e verità.
 */
public class AuctionService {

    private final LeagueRules rules;
    private final List<Participant> participants;
    private final PlayerCatalog catalog;
    private final AuctionEventStore store;

    /**
     * Calcolato una sola volta alla costruzione, dallo stato del log trovato su disco
     * in quel momento — non ricalcolato ad ogni lettura come {@link #state()}. Se lo
     * fosse, resterebbe presente per sempre non appena esiste un solo holding, quindi
     * dal primo acquisto in poi il banner mentirebbe dicendo "ripreso dal log su disco"
     * anche per acquisti appena fatti in questa sessione. Va invece a vuoto al primo
     * {@link #recordPurchase} o {@link #undoLast} riusciti in questa sessione.
     */
    private Optional<ResumeSummary> resumeSummary;

    public AuctionService(LeagueRules rules, List<Participant> participants,
                          PlayerCatalog catalog, AuctionEventStore store) {
        this.rules = rules;
        this.participants = List.copyOf(participants);
        this.catalog = catalog;
        this.store = store;
        this.resumeSummary = summarize(state());
    }

    public AuctionState state() {
        return AuctionProjector.project(rules, participants, catalog, store.load());
    }

    public void recordPurchase(String playerId, String participantId, int price) {
        Player player = catalog.byId(playerId)
                .orElseThrow(() -> new IllegalArgumentException("giocatore sconosciuto: " + playerId));
        Participant buyer = participants.stream()
                .filter(p -> p.id().equals(participantId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException(
                        "partecipante sconosciuto: " + participantId));
        if (price < 1) {
            throw new IllegalArgumentException("il prezzo deve essere almeno 1");
        }

        AuctionState current = state();
        if (current.soldPlayerIds().contains(playerId)) {
            throw new IllegalArgumentException(player.name() + " è già stato acquistato");
        }
        Squad squad = current.squadOf(buyer.id());
        if (price > squad.budgetRemaining()) {
            throw new IllegalArgumentException(buyer.name() + " ha solo "
                    + squad.budgetRemaining() + " crediti di budget residuo");
        }
        if (!squad.hasRoom(player.role())) {
            throw new IllegalArgumentException(buyer.name()
                    + " ha già coperto tutti gli slot " + player.role());
        }

        store.append(new AuctionEvent.PlayerPurchased(
                store.nextSeq(), Instant.now(), playerId, buyer.id(), price));
        resumeSummary = Optional.empty();
    }

    /** @return false se non c'era nulla da annullare */
    public boolean undoLast() {
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
                store.append(new AuctionEvent.PurchaseRevoked(
                        store.nextSeq(), Instant.now(), purchased.seq()));
                resumeSummary = Optional.empty();
                return true;
            }
        }
        return false;
    }

    public void advancePhase() {
        Role current = state().currentPhase();
        rules.nextPhase(current).ifPresent(next -> {
            store.backup("fine-" + current.name());
            store.append(new AuctionEvent.PhaseAdvanced(store.nextSeq(), Instant.now(), next));
        });
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
        return resumeSummary;
    }

    private static Optional<ResumeSummary> summarize(AuctionState state) {
        if (state.holdings().isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(new ResumeSummary(state.holdings().size(), state.currentPhase()));
    }

    public int salesInCurrentPhase() {
        AuctionState current = state();
        return (int) current.holdings().stream()
                .filter(h -> h.role() == current.currentPhase())
                .count();
    }

    public Optional<Participant> byInitial(char initial) {
        char upper = Character.toUpperCase(initial);
        return participants.stream().filter(p -> p.initial() == upper).findFirst();
    }

    public Participant me() {
        return participants.stream()
                .filter(Participant::me)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("nessun partecipante marcato come me"));
    }

    public List<Participant> participants() {
        return participants;
    }

    /** Nome del giocatore per un holding, per la resa nel tabellone. */
    public String playerName(Holding holding) {
        return catalog.byId(holding.playerId()).map(Player::name).orElse(holding.playerId());
    }
}
