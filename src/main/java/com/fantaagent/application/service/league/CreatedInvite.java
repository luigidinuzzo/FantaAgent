package com.fantaagent.application.service.league;

import com.fantaagent.application.port.out.Invite;

/** Il link esiste solo qui, nella risposta alla creazione: dopo, resta l'hash. */
public record CreatedInvite(Invite invite, String link) {
}
