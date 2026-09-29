package com.fantaagent.application.service.auction;

import java.util.UUID;

/** Un posto come lo chiede l'amministratore: la posizione e' l'ordine nella lista. */
public record SeatRequest(UUID userId, String teamName, String initial) {
}
