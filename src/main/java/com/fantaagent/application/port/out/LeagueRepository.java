package com.fantaagent.application.port.out;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LeagueRepository {

    void insert(League league);

    Optional<League> byId(UUID id);

    /** Nome, regole, punteggio, preferenze del banditore. */
    void update(League league);

    /** @throws InitialTakenException se l'iniziale e' gia' di un altro membro */
    void insertMember(LeagueMember member);

    Optional<LeagueMember> member(UUID leagueId, UUID userId);

    /** In ordine d'ingresso nella lega. */
    List<LeagueMember> members(UUID leagueId);

    List<LeagueMember> membershipsOf(UUID userId);

    void deleteMember(UUID leagueId, UUID userId);
}
