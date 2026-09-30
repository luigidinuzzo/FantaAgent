package com.fantaagent.application.port.out;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

public interface JoinRequestRepository {

    /** Una seconda richiesta per la stessa lega sostituisce la prima. */
    void upsert(JoinRequest request);

    Optional<JoinRequest> find(UUID leagueId, UUID userId);

    /** Le richieste di chi non e' ancora membro, dalla piu' vecchia. */
    List<JoinRequest> byLeague(UUID leagueId);

    /** Le richieste ancora aperte di un utente, dalla piu' recente. */
    List<JoinRequest> byUser(UUID userId);

    /** Quante richieste aperte ha ciascuna delle leghe date; le leghe senza non compaiono. */
    Map<UUID, Integer> countByLeague(Collection<UUID> leagueIds);

    /** @return false se non c'era */
    boolean delete(UUID leagueId, UUID userId);

    /**
     * Le leghe il cui nome contiene {@code text}, senza distinzione di maiuscole: prima
     * quelle che cominciano cosi', poi le altre, in ordine di nome.
     */
    List<LeagueMatch> search(String text, UUID viewer, int limit);
}
