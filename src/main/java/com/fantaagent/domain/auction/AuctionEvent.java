package com.fantaagent.domain.auction;

import com.fantaagent.domain.player.Role;

import java.time.Instant;

/**
 * Evento immutabile del log d'asta. Il log è append-only: una correzione o un
 * annullamento sono nuovi eventi che ne referenziano uno precedente, mai una modifica
 * o una cancellazione di quello originale.
 */
public sealed interface AuctionEvent {

    long seq();

    Instant at();

    record AuctionStarted(long seq, Instant at) implements AuctionEvent {
    }

    record PhaseAdvanced(long seq, Instant at, Role role) implements AuctionEvent {
    }

    record PlayerPurchased(long seq, Instant at, String playerId, String participantId, int price)
            implements AuctionEvent {

        public PlayerPurchased {
            if (price < 1) {
                throw new IllegalArgumentException("price must be at least 1");
            }
        }
    }

    record PurchaseRevoked(long seq, Instant at, long targetSeq) implements AuctionEvent {
    }

    record PurchaseCorrected(long seq, Instant at, long targetSeq,
                             String newParticipantId, int newPrice) implements AuctionEvent {

        public PurchaseCorrected {
            if (newPrice < 1) {
                throw new IllegalArgumentException("price must be at least 1");
            }
        }
    }
}
