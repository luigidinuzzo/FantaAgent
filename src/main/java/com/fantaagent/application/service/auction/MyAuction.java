package com.fantaagent.application.service.auction;

import com.fantaagent.domain.player.Role;

import java.time.Instant;
import java.util.UUID;

/**
 * Un'asta in cui l'utente ha un posto, vista dalla home: quanto basta per
 * riconoscerla e decidere se entrarci. {@code lastActivity} e' l'ultimo evento
 * scritto, o la creazione per un'asta ancora senza acquisti.
 */
public record MyAuction(UUID id, UUID leagueId, String leagueName, String name, AuctionStatus status,
                        Role phase, int budgetRemaining, int slotsRemaining, Instant lastActivity,
                        boolean admin) {
}
