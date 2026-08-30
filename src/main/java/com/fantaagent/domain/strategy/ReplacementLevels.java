package com.fantaagent.domain.strategy;

import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.player.PlayerProjection;
import com.fantaagent.domain.player.Role;

import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Collection;

/**
 * Punti e media voto del giocatore marginale per ruolo, cioè quello che resterebbe
 * comunque disponibile una volta che tutte le squadre hanno riempito quel ruolo.
 */
public record ReplacementLevels(Map<Role, Double> points, Map<Role, Double> ratings) {

    private static final double DEFAULT_RATING = 6.0;

    public ReplacementLevels {
        points = Map.copyOf(points);
        ratings = Map.copyOf(ratings);
    }

    public static ReplacementLevels from(LeagueRules rules, Collection<PlayerProjection> projections) {
        Map<Role, Double> points = new EnumMap<>(Role.class);
        Map<Role, Double> ratings = new EnumMap<>(Role.class);

        for (Role role : Role.values()) {
            List<PlayerProjection> ranked = projections.stream()
                    .filter(p -> p.role() == role)
                    .sorted(Comparator.comparingDouble(PlayerProjection::basePoints).reversed())
                    .toList();
            if (ranked.isEmpty()) {
                points.put(role, 0.0);
                ratings.put(role, DEFAULT_RATING);
                continue;
            }
            int index = Math.min(rules.replacementIndex(role), ranked.size()) - 1;
            PlayerProjection marginal = ranked.get(index);
            points.put(role, marginal.basePoints());
            ratings.put(role, marginal.expectedRating());
        }
        return new ReplacementLevels(points, ratings);
    }

    public double points(Role role) {
        return points.get(role);
    }

    public double rating(Role role) {
        return ratings.get(role);
    }
}
