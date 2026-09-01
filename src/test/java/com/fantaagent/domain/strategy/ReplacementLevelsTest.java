package com.fantaagent.domain.strategy;

import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.player.PlayerProjection;
import com.fantaagent.domain.player.Role;
import com.fantaagent.domain.player.Tier;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ReplacementLevelsTest {

    private static final LeagueRules RULES = new LeagueRules(2, 500,
            Map.of(Role.P, 1, Role.D, 2, Role.C, 2, Role.A, 1),
            List.of(Role.P, Role.D, Role.C, Role.A));

    private static PlayerProjection projection(String id, Role role, double points, double rating) {
        return new PlayerProjection(id, role, rating, 0.0, 30.0, points, 30.0);
    }

    @Test
    void picksThePlayerAtTheReplacementIndex() {
        // 2 partecipanti x 2 slot D + 1 = 5° difensore
        List<PlayerProjection> projections = new ArrayList<>();
        double[] points = {300, 250, 200, 150, 100, 50};
        for (int i = 0; i < points.length; i++) {
            projections.add(projection("d" + i, Role.D, points[i], 6.5 - i * 0.1));
        }

        ReplacementLevels levels = ReplacementLevels.from(RULES, projections);

        assertThat(RULES.replacementIndex(Role.D)).isEqualTo(5);
        assertThat(levels.points(Role.D)).isEqualTo(100.0);
        assertThat(levels.rating(Role.D)).isCloseTo(6.1, org.assertj.core.api.Assertions.within(1e-9));
    }

    @Test
    void fallsBackToTheWorstAvailableWhenThePoolIsTooSmall() {
        List<PlayerProjection> projections = List.of(
                projection("d0", Role.D, 300, 6.5),
                projection("d1", Role.D, 250, 6.4));

        ReplacementLevels levels = ReplacementLevels.from(RULES, projections);

        assertThat(levels.points(Role.D)).isEqualTo(250.0);
    }

    @Test
    void returnsZeroPointsForRolesWithNoPlayers() {
        ReplacementLevels levels = ReplacementLevels.from(RULES, List.of());

        assertThat(levels.points(Role.A)).isZero();
        assertThat(levels.rating(Role.A)).isEqualTo(6.0);
    }

    @Test
    void assignsTiersByRankRelativeToTheReplacementIndex() {
        assertThat(Tier.of(1, 65)).isEqualTo(Tier.ELITE);
        assertThat(Tier.of(9, 65)).isEqualTo(Tier.ELITE);
        assertThat(Tier.of(20, 65)).isEqualTo(Tier.TOP);
        assertThat(Tier.of(40, 65)).isEqualTo(Tier.MID);
        assertThat(Tier.of(64, 65)).isEqualTo(Tier.DEPTH);
        assertThat(Tier.of(120, 65)).isEqualTo(Tier.FILLER);
    }
}
