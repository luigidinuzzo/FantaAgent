package com.fantaagent.application.service;

/**
 * Nessuna asta e' stata ancora scelta dalla home.
 *
 * <p>Non e' un errore di programmazione: e' lo stato normale dell'applicazione appena
 * avviata. Ha un tipo proprio perche' la web layer possa rimandare l'utente alla home
 * invece di indovinare su quale asta stia lavorando — indovinare significherebbe
 * scrivere eventi nel registro sbagliato.
 */
public class NoAuctionSelectedException extends IllegalStateException {

    public NoAuctionSelectedException() {
        super("no auction selected");
    }
}
