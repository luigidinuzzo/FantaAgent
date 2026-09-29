package com.fantaagent.application.port.out;

import com.fantaagent.config.AuctionSettings;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AuctionRepository {

    /** Asta e posti insieme: chi chiama apre la transazione. */
    void insert(AuctionRecord auction, List<Seat> seats);

    /** Anche se cancellata: e' chi chiama a decidere se una cancellata esiste. */
    Optional<AuctionRecord> byId(UUID id);

    /** Solo le non cancellate, dalla piu' recente. */
    List<AuctionRecord> byLeague(UUID leagueId);

    void rename(UUID id, String name);

    void updateBidder(UUID id, AuctionSettings bidder);

    void softDelete(UUID id, Instant at);

    /** In ordine di turno di chiamata. */
    List<Seat> seats(UUID auctionId);

    void replaceSeats(UUID auctionId, List<Seat> seats);

    void removeSeat(UUID auctionId, UUID userId);

    /**
     * Le aste non cancellate della lega in cui l'utente ha un posto, ordinate per
     * identificativo dell'asta: un ordine fisso e indipendente da chi chiama, cosi'
     * chi blocca piu' righe in sequenza (es. {@code removeMember}) le prende sempre
     * nello stesso ordine e due chiamate concorrenti su aste in comune non si
     * deadlockano bloccandole in ordine opposto.
     */
    List<UUID> auctionsWithSeat(UUID leagueId, UUID userId);

    /**
     * Blocca la riga dell'asta fino alla fine della transazione di chi chiama: due
     * scritture sulla stessa asta si mettono in fila invece di scontrarsi sul numero
     * di sequenza. Aste diverse non si bloccano a vicenda.
     */
    void lockForWrite(UUID auctionId);
}
