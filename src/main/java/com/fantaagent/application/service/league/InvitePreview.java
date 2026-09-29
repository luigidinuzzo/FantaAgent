package com.fantaagent.application.service.league;

import java.util.List;
import java.util.UUID;

/**
 * Cio' che vede chi apre un invito, anche senza account. {@code takenInitials} serve
 * al modulo per non proporre un'iniziale gia' presa: e' l'unico dato dei membri che
 * esce, e senza nomi.
 */
public record InvitePreview(UUID leagueId, String leagueName, String invitedBy,
                            boolean alreadyMember, List<String> takenInitials) {
}
