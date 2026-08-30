package com.fantaagent.domain.league;

import com.fantaagent.domain.player.Role;

import java.util.List;
import java.util.Map;
import java.util.Optional;

public record LeagueRules(int participants, int budget, Map<Role, Integer> slots, List<Role> phases) {

    public LeagueRules {
        if (participants < 2) {
            throw new IllegalArgumentException("participants must be at least 2");
        }
        if (budget < 1) {
            throw new IllegalArgumentException("budget must be positive");
        }
        slots = Map.copyOf(slots);
        phases = List.copyOf(phases);
        for (Role role : Role.values()) {
            if (!slots.containsKey(role)) {
                throw new IllegalArgumentException("missing slot count for role " + role);
            }
        }
    }

    public int rosterSize() {
        return slots.values().stream().mapToInt(Integer::intValue).sum();
    }

    public int slots(Role role) {
        return slots.get(role);
    }

    /** Indice, a partire da 1, del giocatore marginale del ruolo. */
    public int replacementIndex(Role role) {
        return participants * slots(role) + 1;
    }

    public Role firstPhase() {
        return phases.getFirst();
    }

    public Optional<Role> nextPhase(Role current) {
        int i = phases.indexOf(current);
        if (i < 0 || i == phases.size() - 1) {
            return Optional.empty();
        }
        return Optional.of(phases.get(i + 1));
    }
}
