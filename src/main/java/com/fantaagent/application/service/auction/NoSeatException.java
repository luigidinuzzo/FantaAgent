package com.fantaagent.application.service.auction;

public class NoSeatException extends RuntimeException {

    public NoSeatException() {
        super("Non hai un posto in quest'asta: i consigli non sono disponibili.");
    }
}
