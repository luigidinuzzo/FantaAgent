package com.fantaagent.application.service.league;

/** Una lega senza amministratore non la potrebbe piu' gestire nessuno. */
public class AdminCannotLeaveException extends RuntimeException {

    public AdminCannotLeaveException() {
        super("L'amministratore non può lasciare la lega.");
    }
}
