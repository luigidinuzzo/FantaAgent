package com.fantaagent.adapter.in.api;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Risolve il segmento {@code {leagueId}} delle rotte.
 *
 * <p>In questo sotto-progetto esiste una lega sola, e questa classe si limita a
 * rifiutare gli altri identificativi. Esiste comunque, e viene chiamata da ogni
 * endpoint, perche' e' il punto in cui il sotto-progetto 2 innestera' la
 * risoluzione vera senza toccare un solo controller: un 404 che oggi arriva da un
 * confronto di stringhe domani arrivera' da una query, e il frontend non se ne
 * accorgera'.
 */
@Component
public class LeagueGuard {

    private final String leagueId;

    public LeagueGuard(@Value("${fantaagent.league-id:default}") String leagueId) {
        this.leagueId = leagueId;
    }

    public void check(String candidate) {
        if (!leagueId.equals(candidate)) {
            throw new UnknownLeagueException(candidate);
        }
    }
}
