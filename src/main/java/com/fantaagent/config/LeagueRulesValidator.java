package com.fantaagent.config;

import com.fantaagent.domain.player.Role;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Validazione di crediti, slot e numero di squadre al salvataggio, come funzione pura.
 *
 * <p>Il limite di {@link #MAX_SLOTS} non e' una regola del gioco: e' una sponda contro
 * un refuso (300 al posto di 3), che altrimenti costruirebbe rose impossibili senza
 * dire niente.
 */
public final class LeagueRulesValidator {

    public static final int MIN_BUDGET = 1;
    public static final int MIN_SLOTS = 1;
    public static final int MAX_SLOTS = 30;
    public static final int MIN_PARTICIPANTS = 2;

    private static final Map<Role, String> ROLE_PLURAL = Map.of(
            Role.P, "dei portieri", Role.D, "dei difensori",
            Role.C, "dei centrocampisti", Role.A, "degli attaccanti");

    private LeagueRulesValidator() {
    }

    public static Map<String, List<String>> validateByField(LeagueRulesSettings rules, int participants) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        if (rules.budget() < MIN_BUDGET) {
            add(errors, "budget", "I crediti per squadra devono essere almeno " + MIN_BUDGET
                    + ": indicati " + rules.budget() + ".");
        }
        for (Role role : Role.values()) {
            int n = rules.slots().getOrDefault(role, 0);
            if (n < MIN_SLOTS || n > MAX_SLOTS) {
                add(errors, "slots[" + role.name() + "]", "Gli slot " + ROLE_PLURAL.get(role)
                        + " devono essere fra " + MIN_SLOTS + " e " + MAX_SLOTS
                        + ": indicati " + n + ".");
            }
        }
        if (participants < MIN_PARTICIPANTS) {
            add(errors, "participants", "Servono almeno " + MIN_PARTICIPANTS + " partecipanti.");
        }
        return Collections.unmodifiableMap(errors);
    }

    private static void add(Map<String, List<String>> errors, String key, String message) {
        errors.computeIfAbsent(key, k -> new ArrayList<>()).add(message);
    }
}
