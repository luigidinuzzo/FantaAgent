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

    /**
     * @param name nome scelto per l'asta; puo' essere null nei registri scritti prima
     *             che il nome esistesse, e in quel caso si mostra l'identificativo.
     *             La data e l'ora sono gia' in {@code at}: non vanno duplicate.
     */
    record AuctionStarted(long seq, Instant at, String name) implements AuctionEvent {
    }

    /**
     * Il nuovo nome di un'asta. Il registro non si riscrive: il nome dato alla
     * creazione resta sull'evento di avvio, e vale l'ultimo di questi eventi.
     */
    record AuctionRenamed(long seq, Instant at, String name) implements AuctionEvent {

        public AuctionRenamed {
            if (name == null || name.isBlank()) {
                throw new IllegalArgumentException("name must not be blank");
            }
        }
    }

    record PhaseAdvanced(long seq, Instant at, Role role) implements AuctionEvent {
    }

    /**
     * @param requestId chiave di idempotenza della richiesta che lo ha prodotto.
     *                  Null nei registri scritti prima che l'idempotenza
     *                  esistesse, e per le scritture che non passano dall'API:
     *                  significa "nessuna richiesta da riconoscere", non errore.
     */
    record PlayerPurchased(long seq, Instant at, String playerId, String participantId,
                           int price, String requestId) implements AuctionEvent {

        public PlayerPurchased {
            if (price < 1) {
                throw new IllegalArgumentException("price must be at least 1");
            }
        }

        /** Forma senza chiave, per le scritture che non vengono da una richiesta HTTP. */
        public PlayerPurchased(long seq, Instant at, String playerId, String participantId,
                               int price) {
            this(seq, at, playerId, participantId, price, null);
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
