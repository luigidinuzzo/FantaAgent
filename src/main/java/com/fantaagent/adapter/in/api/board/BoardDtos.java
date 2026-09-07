package com.fantaagent.adapter.in.api.board;

import com.fantaagent.domain.player.Role;

import java.util.List;
import java.util.Map;

/**
 * I record del tabellone proiettato.
 *
 * <p>Vivono in un package proprio, e non insieme agli altri DTO dell'API, per un
 * motivo solo: cosi' una regola ArchUnit puo' dire "questo package non puo'
 * raggiungere le valutazioni" e la build fallisce se qualcuno ci prova. Un flag
 * "nascondi il prezzo" si dimentica; un package che non compila, no.
 *
 * <p>Chi aggiunge qui un campo che viene da una valutazione lo sta proiettando su
 * uno schermo che guardano tutti gli avversari.
 */
public final class BoardDtos {

    private BoardDtos() {
    }

    /** Una casella della rosa: il giocatore e quanto e' stato PAGATO. */
    public record BoardSlot(long seq, String playerName, int price) {
    }

    public record BoardColumn(String participantId, String participantName, boolean me,
                              int budgetRemaining, int slotsRemaining,
                              Map<Role, List<BoardSlot>> byRole) {
    }

    public record BoardResponse(String auctionId, Role currentPhase, List<BoardColumn> columns) {
    }
}
