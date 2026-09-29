package com.fantaagent.application.port.out;

import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.LeagueRulesSettings;
import com.fantaagent.config.ScoringSettings;

import java.time.Instant;
import java.util.UUID;

/**
 * Un'asta di una lega. Regole e punteggio sono quelli della lega al momento della
 * creazione e non cambiano piu': da loro discendono i numeri con cui le rose sono
 * state pagate. Le preferenze del banditore si', perche' non entrano in nessun calcolo.
 */
public record AuctionRecord(UUID id, UUID leagueId, String name, UUID createdBy, Instant createdAt,
                            Instant deletedAt, LeagueRulesSettings rules, ScoringSettings scoring,
                            AuctionSettings bidder) {
}
