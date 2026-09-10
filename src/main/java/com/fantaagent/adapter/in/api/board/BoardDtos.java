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
 *
 * <p>Dove si ferma: la regola ArchUnit vede il nome di un tipo proibito, non la
 * provenienza di un valore. Un int calcolato da una valutazione altrove e
 * passato qui sotto un nome innocuo — {@code ceiling}, non {@code maxBid} —
 * passerebbe sia la regola sia il test sul corpo JSON, che cerca parole, non
 * origini.
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

    /**
     * Il giocatore all'asta come lo vede lo schermo condiviso.
     *
     * <p>Sta qui, e non fra i DTO dell'API, per la stessa ragione degli altri record di
     * questo file: cosi' la regola ArchUnit che vieta a questo package di raggiungere
     * {@code domain.strategy} copre anche lui. Un battitore proiettato che potesse
     * nominare una valutazione sarebbe il modo piu' diretto di perdere l'asta.
     */
    public record PublicBidderResponse(String playerId, String name, String team,
                                       Role role, int listPrice,
                                       int timerSeconds, boolean beepEnabled) {
    }
}
