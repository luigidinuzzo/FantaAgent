package com.fantaagent.application.port.out;

public class EmailTakenException extends RuntimeException {

    public EmailTakenException(String email) {
        super("Esiste già un account con questo indirizzo.");
    }
}
