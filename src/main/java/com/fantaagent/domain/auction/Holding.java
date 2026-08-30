package com.fantaagent.domain.auction;

import com.fantaagent.domain.player.Role;

/**
 * Un giocatore posseduto da un partecipante. Il ruolo è denormalizzato qui perché
 * l'aritmetica degli slot deve funzionare senza consultare il catalogo.
 */
public record Holding(long seq, String playerId, Role role, String participantId, int price) {
}
