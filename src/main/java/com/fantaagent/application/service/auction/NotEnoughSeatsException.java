package com.fantaagent.application.service.auction;

/** Un turno di chiamata con meno di due squadre: le regole dell'asta ne vogliono almeno due. */
public class NotEnoughSeatsException extends RuntimeException {

    public NotEnoughSeatsException() {
        super("Servono almeno due squadre nel turno.");
    }
}
