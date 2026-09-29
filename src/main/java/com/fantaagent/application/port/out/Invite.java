package com.fantaagent.application.port.out;

import java.time.Instant;
import java.util.UUID;

public record Invite(UUID id, UUID leagueId, String tokenHash, UUID createdBy, Instant createdAt,
                     Instant expiresAt, Instant revokedAt) {

    public boolean usableAt(Instant now) {
        return revokedAt == null && expiresAt.isAfter(now);
    }
}
