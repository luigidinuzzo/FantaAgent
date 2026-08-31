package com.fantaagent.config;

import com.fantaagent.domain.player.Role;

import java.util.ArrayList;
import java.util.List;

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

    /** @return elenco vuoto se le impostazioni sono valide */
    public static List<String> validate(ScoringSettings s) {
        List<String> errors = new ArrayList<>();

        if (s.defendersCounted() < 1 || s.defendersCounted() > 10) {
            errors.add("I difensori conteggiati devono essere fra 1 e 10: indicato "
                    + s.defendersCounted() + ".");
        }

        if (s.defenceModifierEnabled()) {
            if (s.thresholds().isEmpty()) {
                errors.add("Il modificatore è attivo ma la tabella è vuota: "
                        + "serve almeno una soglia.");
            }
            for (int i = 0; i < s.thresholds().size(); i++) {
                ScoringSettings.Step step = s.thresholds().get(i);
                if (!isFinite(step.minAverage()) || !isFinite(step.bonus())) {
                    errors.add("Riga " + (i + 1) + " della tabella: valori non numerici.");
                    continue;
                }
                if (step.minAverage() < 0) {
                    errors.add("Riga " + (i + 1) + ": la media non può essere negativa.");
                }
                if (i > 0) {
                    ScoringSettings.Step previous = s.thresholds().get(i - 1);
                    if (step.minAverage() <= previous.minAverage()) {
                        errors.add("Riga " + (i + 1) + ": la media "
                                + step.minAverage() + " non è maggiore della precedente "
                                + previous.minAverage() + ". Le soglie vanno in ordine crescente.");
                    }
                    if (step.bonus() < previous.bonus()) {
                        errors.add("Riga " + (i + 1) + ": il bonus " + step.bonus()
                                + " è inferiore al precedente " + previous.bonus()
                                + ". Un reparto migliore non può rendere meno.");
                    }
                }
            }
        }

        for (Role role : Role.values()) {
            Double bonus = s.goalBonus().get(role);
            if (bonus == null || !isFinite(bonus)) {
                errors.add("Manca il bonus gol per il ruolo " + role + ".");
            }
        }

        checkFinite(errors, s.assist(), "assist");
        checkFinite(errors, s.penaltyScored(), "rigore segnato");
        checkFinite(errors, s.penaltyMissed(), "rigore sbagliato");
        checkFinite(errors, s.penaltySaved(), "rigore parato");
        checkFinite(errors, s.yellowCard(), "ammonizione");
        checkFinite(errors, s.redCard(), "espulsione");
        checkFinite(errors, s.goalConceded(), "gol subito");
        checkFinite(errors, s.cleanSheet(), "porta inviolata");

        return List.copyOf(errors);
    }

    private static void checkFinite(List<String> errors, double value, String label) {
        if (!isFinite(value)) {
            errors.add("Il valore per «" + label + "» non è un numero valido.");
        }
    }

    private static boolean isFinite(double v) {
        return !Double.isNaN(v) && !Double.isInfinite(v);
    }
}
