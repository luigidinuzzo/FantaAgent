package com.fantaagent.application.service;

import com.fantaagent.application.port.out.AuctionEventStore;
import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.ScoringSettings;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;

import java.util.List;
import java.util.Objects;

/**
 * Tutto ciò che una richiesta deve leggere per essere servita: l'asta selezionata, i
 * partecipanti, le regole della lega e la catena di valutazione. Regole e catena
 * nascono nella stessa assegnazione: non esiste una catena calcolata con regole
 * diverse da quelle dello snapshot.
 *
 * <p>Un solo oggetto immutabile, pubblicato da {@link AuctionRuntime} con una sola
 * scrittura volatile. Chi legge prende questo record e da lì ricava tutto: non esiste
 * un ordine di letture che possa mettere insieme metà configurazione vecchia e metà
 * nuova.
 *
 * <p>{@code auctionId} e {@code store} sono nulli finché l'utente non ha scelto un'asta
 * dalla home: è uno stato legittimo dell'applicazione appena avviata, non un errore.
 */
public record RuntimeSnapshot(String auctionId, AuctionEventStore store,
                              List<Participant> participants, LeagueRules rules,
                              ScoringSettings scoring, AuctionSettings bidder,
                              ValuationChain chain) {

    public RuntimeSnapshot {
        if ((auctionId == null) != (store == null)) {
            throw new IllegalArgumentException(
                    "auction id and event store must be either both present or both absent");
        }
        participants = List.copyOf(participants);
        Objects.requireNonNull(rules, "rules");
        Objects.requireNonNull(scoring, "scoring");
        Objects.requireNonNull(bidder, "bidder");
        Objects.requireNonNull(chain, "chain");
    }

    public boolean hasAuction() {
        return store != null;
    }

    /** @throws IllegalStateException se nessuna asta è stata ancora scelta */
    public AuctionScope scope() {
        if (!hasAuction()) {
            throw new NoAuctionSelectedException();
        }
        return new AuctionScope(auctionId, store, participants, rules);
    }
}
