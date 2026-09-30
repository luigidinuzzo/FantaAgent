package com.fantaagent.application.port.out;

import java.util.UUID;

/**
 * Una lega trovata cercandone il nome. Esce solo cio' che serve a riconoscerla fra
 * due leghe con lo stesso nome: chi la amministra e quanti ne fanno parte, non chi.
 *
 * @param member  chi cerca ne fa gia' parte
 * @param pending chi cerca ha gia' chiesto di entrare
 */
public record LeagueMatch(UUID id, String name, String adminName, int members,
                          boolean member, boolean pending) {
}
