package com.fantaagent.application.service;

import com.fantaagent.application.port.out.AuctionEventStore;
import com.fantaagent.domain.league.Participant;

import java.util.List;
import java.util.Objects;

/**
 * Tutto ciò che una richiesta deve leggere per essere servita: l'asta selezionata, i
 * partecipanti e la catena di valutazione.
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
                              List<Participant> participants, ValuationChain chain) {

    public RuntimeSnapshot {
        if ((auctionId == null) != (store == null)) {
            throw new IllegalArgumentException(
                    "auction id and event store must be either both present or both absent");
        }
        participants = List.copyOf(participants);
        Objects.requireNonNull(chain, "chain");
    }

    public boolean hasAuction() {
        return store != null;
    }

    /** @throws IllegalStateException se nessuna asta è stata ancora scelta */
    public AuctionScope scope() {
        if (!hasAuction()) {
            throw new IllegalStateException("no auction selected");
        }
        return new AuctionScope(auctionId, store, participants);
    }
}
