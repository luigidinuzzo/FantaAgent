package com.fantaagent.adapter.in.api;

public class UnknownPlayerException extends RuntimeException {

    public UnknownPlayerException(String playerId) {
        super("nessun giocatore con identificativo " + playerId);
    }
}
