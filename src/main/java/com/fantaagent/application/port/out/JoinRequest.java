package com.fantaagent.application.port.out;

import java.time.Instant;
import java.util.UUID;

/**
 * Qualcuno che chiede di entrare in una lega, con la squadra con cui giocherebbe.
 * {@code displayName} e {@code leagueName} si leggono insieme alla riga, per chi la
 * mostra: non si scrivono da qui.
 */
public record JoinRequest(UUID leagueId, UUID userId, String teamName, Instant requestedAt,
                          String displayName, String leagueName) {
}
