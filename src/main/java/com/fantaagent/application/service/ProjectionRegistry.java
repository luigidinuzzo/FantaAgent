package com.fantaagent.application.service;

import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.ScoringRules;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.PlayerProjection;
import com.fantaagent.domain.player.ProjectionCalculator;
import com.fantaagent.domain.player.Role;
import com.fantaagent.domain.strategy.ReplacementLevels;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Proiezioni calcolate una volta all'avvio. Non dipendono dallo stato dell'asta: i
 * modificatori, che invece ne dipendono, sono applicati dal motore di valutazione.
 */
public class ProjectionRegistry {

    private final Map<String, PlayerProjection> byId;
    private final ReplacementLevels replacement;

    private ProjectionRegistry(Map<String, PlayerProjection> byId, ReplacementLevels replacement) {
        this.byId = byId;
        this.replacement = replacement;
    }

    public static ProjectionRegistry build(LeagueRules rules, ScoringRules scoring,
                                           PlayerCatalog catalog, List<Double> seasonWeights) {
        List<Player> players = catalog.all();
        Map<Role, Double> roleAverages =
                ProjectionCalculator.roleAverageRatings(players, catalog::statsOf);
        ProjectionCalculator calculator = new ProjectionCalculator(scoring, seasonWeights);

        Map<String, PlayerProjection> byId = new LinkedHashMap<>();
        for (Player player : players) {
            byId.put(player.id(), calculator.project(player, catalog.statsOf(player.id()),
                    roleAverages.get(player.role())));
        }
        return new ProjectionRegistry(byId, ReplacementLevels.from(rules, byId.values()));
    }

    public PlayerProjection of(String playerId) {
        PlayerProjection projection = byId.get(playerId);
        if (projection == null) {
            throw new IllegalArgumentException("giocatore sconosciuto: " + playerId);
        }
        return projection;
    }

    public List<PlayerProjection> all() {
        return List.copyOf(byId.values());
    }

    public ReplacementLevels replacement() {
        return replacement;
    }
}
