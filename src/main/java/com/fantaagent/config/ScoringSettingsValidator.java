package com.fantaagent.config;

import com.fantaagent.domain.player.Role;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Validazione delle impostazioni di punteggio, come funzione pura.
 *
 * <p>È pura di proposito: la stessa logica serve il salvataggio dalla UI e il controllo
 * all'avvio, e due validazioni separate che divergono sono peggio di una sola più
 * severa. Restituisce l'elenco degli errori invece di lanciare, perché la UI deve
 * mostrarli tutti insieme e non uno per volta.
 */
public final class ScoringSettingsValidator {

    private ScoringSettingsValidator() {
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
     * <p>Le righe della tabella hanno una chiave indicizzata (0-based, {@code
     * "thresholds[2]"}) perche' riguardano una riga precisa; un errore "la tabella e'
     * vuota" riguarda la tabella nel suo insieme e sta sotto {@code "thresholds"}.
     *
     * @return mappa vuota se le impostazioni sono valide
     */
    public static Map<String, List<String>> validateByField(ScoringSettings s) {
        Map<String, List<String>> errors = new LinkedHashMap<>();

        if (s.defendersCounted() < 1 || s.defendersCounted() > 10) {
            add(errors, "defendersCounted", "I difensori conteggiati devono essere fra 1 e 10: "
                    + "indicato " + s.defendersCounted() + ".");
        }

        if (s.defenceModifierEnabled()) {
            if (s.thresholds().isEmpty()) {
                add(errors, "thresholds", "Il modificatore è attivo ma la tabella è vuota: "
                        + "serve almeno una soglia.");
            }
            for (int i = 0; i < s.thresholds().size(); i++) {
                ScoringSettings.Step step = s.thresholds().get(i);
                String rowKey = "thresholds[" + i + "]";
                if (!isFinite(step.minAverage()) || !isFinite(step.bonus())) {
                    add(errors, rowKey, "Riga " + (i + 1) + " della tabella: valori non numerici.");
                    continue;
                }
                if (step.minAverage() < 0) {
                    add(errors, rowKey, "Riga " + (i + 1) + ": la media non può essere negativa.");
                }
                if (i > 0) {
                    ScoringSettings.Step previous = s.thresholds().get(i - 1);
                    if (step.minAverage() <= previous.minAverage()) {
                        add(errors, rowKey, "Riga " + (i + 1) + ": la media "
                                + step.minAverage() + " non è maggiore della precedente "
                                + previous.minAverage() + ". Le soglie vanno in ordine crescente.");
                    }
                    if (step.bonus() < previous.bonus()) {
                        add(errors, rowKey, "Riga " + (i + 1) + ": il bonus " + step.bonus()
                                + " è inferiore al precedente " + previous.bonus()
                                + ". Un reparto migliore non può rendere meno.");
                    }
                }
            }
        }

        for (Role role : Role.values()) {
            Double bonus = s.goalBonus().get(role);
            if (bonus == null || !isFinite(bonus)) {
                add(errors, "goalBonus[" + role + "]", "Manca il bonus gol per il ruolo " + role + ".");
            }
        }

        checkFinite(errors, s.assist(), "assist", "assist");
        checkFinite(errors, s.penaltyScored(), "penaltyScored", "rigore segnato");
        checkFinite(errors, s.penaltyMissed(), "penaltyMissed", "rigore sbagliato");
        checkFinite(errors, s.penaltySaved(), "penaltySaved", "rigore parato");
        checkFinite(errors, s.yellowCard(), "yellowCard", "ammonizione");
        checkFinite(errors, s.redCard(), "redCard", "espulsione");
        checkFinite(errors, s.goalConceded(), "goalConceded", "gol subito");
        checkFinite(errors, s.cleanSheet(), "cleanSheet", "porta inviolata");

        return Collections.unmodifiableMap(errors);
    }

    /** @return elenco vuoto se le impostazioni sono valide */
    public static List<String> validate(ScoringSettings s) {
        return validateByField(s).values().stream().flatMap(List::stream).toList();
    }

    private static void add(Map<String, List<String>> errors, String key, String message) {
        errors.computeIfAbsent(key, k -> new ArrayList<>()).add(message);
    }

    private static void checkFinite(Map<String, List<String>> errors, double value,
                                    String field, String label) {
        if (!isFinite(value)) {
            add(errors, field, "Il valore per «" + label + "» non è un numero valido.");
        }
    }

    private static boolean isFinite(double v) {
        return !Double.isNaN(v) && !Double.isInfinite(v);
    }
}
