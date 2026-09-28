package com.fantaagent.application.port.out;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface UserTokenRepository {

    void insert(UserToken token);

    Optional<UserToken> byHash(String tokenHash);

    /**
     * Segna il token come usato, solo se non lo era gia'.
     *
     * @return false se un'altra richiesta l'ha usato prima: due clic sullo stesso
     *         link non devono valere due volte
     */
    boolean markUsed(UUID id, Instant at);
}
