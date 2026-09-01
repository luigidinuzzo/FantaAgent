package com.fantaagent.domain.strategy;

import com.fantaagent.domain.auction.AuctionState;
import com.fantaagent.domain.player.PlayerProjection;

import java.util.List;

/**
 * Input completo e serializzabile del motore. Viene loggato insieme alla
 * raccomandazione: è ciò che permette di ricostruire, il giorno dopo, perché il motore
 * abbia detto quel numero.
 *
 * @param available giocatori ancora acquistabili, il giocatore in esame incluso
 */
public record ValuationContext(
        AuctionState state,
        PlayerProjection target,
        List<PlayerProjection> ownedByMe,
        List<PlayerProjection> available,
        PriceModel prices,
        int salesInCurrentPhase) {

    public ValuationContext {
        ownedByMe = List.copyOf(ownedByMe);
        available = List.copyOf(available);
    }
}
