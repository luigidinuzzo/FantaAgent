package com.fantaagent.config;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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

    /**
     * Gli errori con accanto il campo che li ha causati.
     *
     * <p>Il metodo storico {@link #validate} resta e delega a questo: la sua firma serve
     * ancora alla pagina Thymeleaf sotto {@code /legacy}, che mostra le frasi cosi'
     * come sono. Una logica, due consumatori.
     *
     * <p>Le chiavi si inseriscono nell'ordine in cui i controlli girano, perche'
     * l'appiattimento deve riprodurre l'ordine dei messaggi di prima — e' cio' che i
     * test di SettingsController verificano senza saperlo. La mappa restituita e' una
     * {@link LinkedHashMap} non modificabile apposta: {@code Map.copyOf} non garantisce
     * l'ordine di inserimento, e qui l'ordine e' parte del contratto.
     *
     * @return mappa vuota se le impostazioni sono valide
     */
    public static Map<String, List<String>> validateByField(AuctionSettings s) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        if (s.bidTimerSeconds() < MIN_SECONDS || s.bidTimerSeconds() > MAX_SECONDS) {
            errors.computeIfAbsent("bidTimerSeconds", k -> new ArrayList<>())
                    .add("La durata del timer deve essere fra " + MIN_SECONDS + " e "
                            + MAX_SECONDS + " secondi: indicati " + s.bidTimerSeconds() + ".");
        }
        return Collections.unmodifiableMap(errors);
    }

    /** @return elenco vuoto se le impostazioni sono valide */
    public static List<String> validate(AuctionSettings s) {
        return validateByField(s).values().stream().flatMap(List::stream).toList();
    }
}
