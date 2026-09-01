package com.fantaagent.domain.league;

import com.fantaagent.domain.player.Role;

import java.util.Map;

public record ScoringRules(
        boolean modifiersConfirmed,
        Map<Role, Double> goalBonus,
        double assist,
        double penaltyScored,
        double penaltyMissed,
        double penaltySaved,
        double yellowCard,
        double redCard,
        double goalConceded,
        double cleanSheet,
        ModifierTable defenceModifier,
        ModifierTable goalkeeperModifier,
        double matchdayRatingSigma) {

    public ScoringRules {
        goalBonus = Map.copyOf(goalBonus);
        for (Role role : Role.values()) {
            if (!goalBonus.containsKey(role)) {
                throw new IllegalArgumentException("missing goal bonus for role " + role);
            }
        }
        if (matchdayRatingSigma < 0) {
            throw new IllegalArgumentException("matchdayRatingSigma must not be negative");
        }
    }

    public double goalBonus(Role role) {
        return goalBonus.get(role);
    }
}
