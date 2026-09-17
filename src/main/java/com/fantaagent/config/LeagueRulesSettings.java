package com.fantaagent.config;

import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.player.Role;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Crediti e slot per ruolo di un'asta, come si salvano in {@code league-rules.yml}.
 *
 * <p>Non e' {@link LeagueRules}: mancano apposta il numero di squadre, che e' la
 * lunghezza della lista dei partecipanti, e l'ordine delle fasi, che resta globale.
 * Salvare qui un numero di squadre vorrebbe dire due fonti per la stessa cosa.
 */
public record LeagueRulesSettings(int budget, Map<Role, Integer> slots) {

    public LeagueRulesSettings {
        slots = Map.copyOf(slots);
    }

    public LeagueRules toRules(int participants, List<Role> phases) {
        return new LeagueRules(participants, budget, slots, phases);
    }

    public static LeagueRulesSettings from(LeagueRules rules) {
        return new LeagueRulesSettings(rules.budget(), new EnumMap<>(rules.slots()));
    }
}
