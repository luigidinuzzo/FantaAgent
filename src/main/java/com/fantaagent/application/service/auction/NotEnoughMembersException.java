package com.fantaagent.application.service.auction;

public class NotEnoughMembersException extends RuntimeException {

    public NotEnoughMembersException() {
        super("Servono almeno 2 membri nella lega per creare un'asta.");
    }
}
