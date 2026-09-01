package com.fantaagent.config;

import java.util.ArrayList;
import java.util.List;

/**
 * Validazione delle preferenze del battitore, come funzione pura — stesso schema di
 * {@link ScoringSettingsValidator}: una sola logica per il salvataggio dalla UI e per
 * la rilettura all'avvio, e l'elenco completo degli errori invece del primo soltanto.
 */
public final class AuctionSettingsValidator {

    /**
     * Sotto il secondo il countdown finirebbe prima che l'occhio lo veda; oltre i due
     * minuti non e' piu' un timer d'asta ma una pausa, e quasi certamente e' una cifra
     * digitata per sbaglio.
     */
    public static final int MIN_SECONDS = 1;
    public static final int MAX_SECONDS = 120;

    private AuctionSettingsValidator() {
    }

    /** @return elenco vuoto se le impostazioni sono valide */
    public static List<String> validate(AuctionSettings s) {
        List<String> errors = new ArrayList<>();
        if (s.bidTimerSeconds() < MIN_SECONDS || s.bidTimerSeconds() > MAX_SECONDS) {
            errors.add("La durata del timer deve essere fra " + MIN_SECONDS + " e "
                    + MAX_SECONDS + " secondi: indicati " + s.bidTimerSeconds() + ".");
        }
        return List.copyOf(errors);
    }
}
