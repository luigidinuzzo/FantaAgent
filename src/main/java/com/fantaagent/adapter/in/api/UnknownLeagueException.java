package com.fantaagent.adapter.in.api;

public class UnknownLeagueException extends RuntimeException {

    public UnknownLeagueException(String leagueId) {
        super("nessuna lega con identificativo " + leagueId);
    }
}
