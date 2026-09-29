package com.fantaagent.application.service.league;

/** Invito sconosciuto, scaduto o ritirato: per chi l'ha aperto, la cosa da fare e' la stessa. */
public class InviteUnavailableException extends RuntimeException {

    public InviteUnavailableException() {
        super("Questo invito è scaduto o è stato ritirato: chiedine uno nuovo a chi ti ha invitato.");
    }
}
