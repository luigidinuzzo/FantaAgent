package com.fantaagent.application.port.out;

import java.time.Instant;
import java.util.UUID;

/** Un link a uso singolo mandato per email. Del token si conserva solo l'hash. */
public record UserToken(UUID id, UUID userId, Purpose purpose, String tokenHash,
                        Instant createdAt, Instant expiresAt, Instant usedAt) {

    public enum Purpose { VERIFY_EMAIL, RESET_PASSWORD }
}
