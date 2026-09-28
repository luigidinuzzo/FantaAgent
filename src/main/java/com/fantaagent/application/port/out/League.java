package com.fantaagent.application.port.out;

import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.LeagueRulesSettings;
import com.fantaagent.config.ScoringSettings;

import java.time.Instant;
import java.util.UUID;

/**
 * Un gruppo di persone che fa aste insieme, anno dopo anno. Regole, punteggio e
 * preferenze del banditore sono i valori PREDEFINITI delle aste future: ogni asta li
 * copia quando nasce, e cambiarli qui non tocca quelle gia' create.
 */
public record League(UUID id, String name, UUID createdBy, Instant createdAt,
                     LeagueRulesSettings rules, ScoringSettings scoring, AuctionSettings bidder) {

    public League withName(String newName) {
        return new League(id, newName, createdBy, createdAt, rules, scoring, bidder);
    }

    public League withDefaults(LeagueRulesSettings newRules, ScoringSettings newScoring,
                               AuctionSettings newBidder) {
        return new League(id, name, createdBy, createdAt, newRules, newScoring, newBidder);
    }
}
