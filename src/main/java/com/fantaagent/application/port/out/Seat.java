package com.fantaagent.application.port.out;

import java.util.UUID;

/** Un posto d'asta: un membro, con la squadra con cui gioca e il suo turno di chiamata. */
public record Seat(UUID userId, String teamName, char initial, int position) {
}
