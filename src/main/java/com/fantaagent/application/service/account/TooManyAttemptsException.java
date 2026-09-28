package com.fantaagent.application.service.account;

import java.time.Duration;

public class TooManyAttemptsException extends RuntimeException {

    private final Duration waitFor;

    public TooManyAttemptsException(Duration waitFor) {
        super("Troppi tentativi di accesso. Riprova fra " + Math.max(1, waitFor.toSeconds()) + " secondi.");
        this.waitFor = waitFor;
    }

    public Duration waitFor() {
        return waitFor;
    }
}
