package com.fantaagent.application.service.auction;

import com.fantaagent.domain.player.Role;

import java.time.Instant;
import java.util.UUID;

/**
 * Una riga dell'elenco delle aste: quanto basta per riconoscerla e sapere a che punto
 * e'. {@code myBudgetRemaining} e' null per chi non ha un posto in quell'asta.
 */
public record AuctionCard(UUID id, String name, Instant createdAt, Instant lastWritten,
                          int purchases, Role phase, int teams, int budget, int totalSlots,
                          Integer myBudgetRemaining) {
}
