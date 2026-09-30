package com.fantaagent.application.service.league;

/** La richiesta che l'amministratore voleva accettare non c'e' piu': ritirata, o gia' decisa. */
public class JoinRequestGoneException extends RuntimeException {

    public JoinRequestGoneException() {
        super("Questa richiesta non c'è più: è stata ritirata o qualcuno l'ha già gestita.");
    }
}
