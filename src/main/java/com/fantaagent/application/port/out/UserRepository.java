package com.fantaagent.application.port.out;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository {

    /** @throws EmailTakenException se l'indirizzo e' gia' usato, senza distinguere maiuscole */
    void insert(UserAccount user);

    /** Senza distinguere maiuscole. */
    Optional<UserAccount> byEmail(String email);

    Optional<UserAccount> byId(UUID id);

    void updatePassword(UUID id, String passwordHash);

    void markVerified(UUID id, Instant at);

    void updateDisplayName(UUID id, String displayName);
}
