package com.fantaagent.application.port.out;

import java.time.Instant;
import java.util.UUID;

/** Una persona registrata. {@code passwordHash} non esce mai dal backend. */
public record UserAccount(UUID id, String email, String passwordHash, String displayName,
                          Instant emailVerifiedAt, Instant createdAt) {

    public boolean emailVerified() {
        return emailVerifiedAt != null;
    }
}
