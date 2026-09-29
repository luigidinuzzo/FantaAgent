package com.fantaagent.application.service.auction;

import java.util.UUID;

/** Asta inesistente, cancellata o di un'altra lega: per chi chiede, non c'e'. */
public class AuctionNotFoundException extends RuntimeException {

    public AuctionNotFoundException(UUID auctionId) {
        super("nessuna asta " + auctionId + " in questa lega");
    }
}
