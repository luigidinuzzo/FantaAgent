package com.fantaagent.application.port.out;

import java.util.UUID;

/**
 * Apre il registro di un'asta per chi sta facendo la richiesta.
 *
 * <p>Uno store per richiesta, non uno per asta: {@code actorId} e' chi firma ogni
 * evento che quello store scrive, e cambia da una richiesta all'altra. Aprirlo costa
 * niente — non legge nulla finche' non glielo si chiede.
 */
public interface AuctionEventStores {

    AuctionEventStore open(UUID auctionId, UUID actorId);
}
