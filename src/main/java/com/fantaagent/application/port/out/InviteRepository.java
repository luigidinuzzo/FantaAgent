package com.fantaagent.application.port.out;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface InviteRepository {

    void insert(Invite invite);

    Optional<Invite> byHash(String tokenHash);

    /** Dal piu' recente. */
    List<Invite> byLeague(UUID leagueId);

    /** @return false se l'invito non e' di quella lega o era gia' ritirato */
    boolean revoke(UUID leagueId, UUID inviteId, Instant at);
}
