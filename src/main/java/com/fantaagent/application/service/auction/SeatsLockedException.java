package com.fantaagent.application.service.auction;

public class SeatsLockedException extends RuntimeException {

    public SeatsLockedException() {
        super("L'asta è iniziata: chi partecipa, i nomi delle squadre e le iniziali non si cambiano più."
                + " Si può cambiare solo il turno di chiamata.");
    }
}
