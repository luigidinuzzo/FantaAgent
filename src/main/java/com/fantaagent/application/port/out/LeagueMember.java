package com.fantaagent.application.port.out;

import java.time.Instant;
import java.util.UUID;

/**
 * Una persona in una lega, con la squadra con cui gioca. {@code displayName} e' il
 * nome dell'account, letto insieme alla riga: non si scrive da qui.
 */
public record LeagueMember(UUID leagueId, UUID userId, MemberRole role, String teamName,
                           char initial, Instant joinedAt, String displayName) {
}
