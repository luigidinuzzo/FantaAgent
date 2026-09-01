package com.fantaagent.domain.strategy;

import java.util.List;

/**
 * @param expectedPrice quanto lo pagherà il mercato
 * @param maxBid        oltre questo prezzo la rosa peggiora
 * @param hardCap       vincolo di budget: non superabile in nessun caso
 * @param margin        maxBid - expectedPrice; negativo significa "lascialo andare"
 */
public record PriceRecommendation(
        String playerId,
        int expectedPrice,
        int maxBid,
        int hardCap,
        int margin,
        String walkAwayReason,
        ConfidenceScore confidence,
        List<Driver> drivers) {

    public PriceRecommendation {
        drivers = List.copyOf(drivers);
        if (maxBid > hardCap) {
            throw new IllegalArgumentException("maxBid " + maxBid + " exceeds hard cap " + hardCap);
        }
    }

    public boolean worthPursuing() {
        return margin >= 0 && maxBid > 0;
    }
}
