package com.fantaagent.application.service.league;

import java.util.UUID;

/**
 * Lega inesistente e lega di cui non si e' membri sono la stessa risposta: un
 * identificativo non deve dire a chi non ne fa parte che la lega esiste.
 */
public class NotLeagueMemberException extends RuntimeException {

    public NotLeagueMemberException(UUID leagueId) {
        super("nessuna lega " + leagueId + " per questo utente");
    }
}
