package com.fantaagent.domain.player;

import com.fantaagent.domain.league.ModifierTable;
import com.fantaagent.domain.league.ScoringRules;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

class ProjectionCalculatorTest {

    private static final ModifierTable ANY = new ModifierTable(3,
            List.of(new ModifierTable.Threshold(0.0, 0.0)));

    private final ScoringRules scoring = new ScoringRules(true,
            Map.of(Role.P, 3.0, Role.D, 4.0, Role.C, 3.5, Role.A, 3.0),
            1.0, 3.0, -3.0, 3.0, -0.5, -1.0, -1.0, 1.0, ANY, ANY);

    private final ProjectionCalculator calculator =
            new ProjectionCalculator(scoring, List.of(0.5, 0.3, 0.2));

    private static SeasonStats stats(String season, int appearances, double rating,
                                     int goals, int assists, int yellow,
                                     int penScored, int penMissed) {
        return new SeasonStats("1", season, appearances, rating, goals, assists,
                yellow, 0, penScored, penMissed, 0, 0, 0);
    }

    @Test
    void appliesShrinkageAndBonusesForASingleSeason() {
        Player player = new Player("1", "Bomber", "Inter", Role.A, 40);
        // 30 presenze, mv 6.5, 10 gol di cui 2 su rigore, 5 assist, 3 gialli, 1 rigore sbagliato
        List<SeasonStats> history = List.of(stats("2025-26", 30, 6.5, 10, 5, 3, 2, 1));

        PlayerProjection p = calculator.project(player, history, 6.0);

        // (30*6.5 + 15*6.0) / 45 = 6.333...
        assertThat(p.expectedRating()).isCloseTo(6.3333, within(0.0005));
        // (8*3.0) + (2*3.0) + (5*1.0) + (1*-3.0) + (3*-0.5) = 30.5 su 30 presenze
        assertThat(p.bonusPerAppearance()).isCloseTo(1.01667, within(0.0005));
        assertThat(p.expectedAppearances()).isEqualTo(30.0);
        assertThat(p.basePoints()).isCloseTo(220.5, within(0.01));
        assertThat(p.observedAppearances()).isEqualTo(30.0);
    }

    @Test
    void weightsRecentSeasonsMoreHeavily() {
        Player player = new Player("1", "Veterano", "Inter", Role.D, 15);
        List<SeasonStats> history = List.of(
                stats("2025-26", 30, 6.5, 0, 0, 0, 0, 0),
                stats("2024-25", 20, 6.0, 0, 0, 0, 0, 0));

        PlayerProjection p = calculator.project(player, history, 6.0);

        // presenze pesate: 0.625*30 + 0.375*20 = 26.25
        assertThat(p.expectedAppearances()).isCloseTo(26.25, within(0.01));
        // rating pesato per presenze = 6.3571; shrinkage verso 6.0 con K=15
        assertThat(p.expectedRating()).isCloseTo(6.2273, within(0.0005));
    }

    @Test
    void shrinksSmallSamplesHardTowardsTheRoleAverage() {
        Player player = new Player("1", "Meteora", "Lecce", Role.A, 8);
        List<SeasonStats> history = List.of(stats("2025-26", 4, 8.5, 0, 0, 0, 0, 0));

        PlayerProjection p = calculator.project(player, history, 6.0);

        // (4*8.5 + 15*6.0) / 19 = 6.526 — non 8.5
        assertThat(p.expectedRating()).isCloseTo(6.5263, within(0.0005));
    }

    @Test
    void usesAListPricePriorForPlayersWithoutHistory() {
        Player expensive = new Player("1", "Neoacquisto", "Inter", Role.A, 30);
        Player cheap = new Player("2", "Riserva", "Lecce", Role.A, 5);

        PlayerProjection rich = calculator.project(expensive, List.of(), 6.0);
        PlayerProjection poor = calculator.project(cheap, List.of(), 6.0);

        assertThat(rich.observedAppearances()).isZero();
        assertThat(rich.expectedRating()).isEqualTo(6.0);
        assertThat(rich.expectedAppearances()).isGreaterThan(poor.expectedAppearances());
        assertThat(rich.basePoints()).isGreaterThan(0.0);
    }

    @Test
    void countsGoalkeeperSpecificBonuses() {
        Player keeper = new Player("1", "Portiere", "Inter", Role.P, 18);
        SeasonStats season = new SeasonStats("1", "2025-26", 30, 6.2,
                0, 0, 1, 0, 0, 0, 2, 30, 12);

        PlayerProjection p = calculator.project(keeper, List.of(season), 6.0);

        // 2*3.0 (rigori parati) + 1*-0.5 (giallo) + 30*-1.0 (gol subiti) + 12*1.0 (imbattuto)
        assertThat(p.bonusPerAppearance()).isCloseTo(-12.5 / 30.0, within(0.0005));
    }

    @Test
    void rejectsAnEmptyListOfSeasonWeights() {
        // Il calcolatore riceve i pesi, non li possiede: una lista vuota è un errore di
        // configurazione da far vedere subito, non da tollerare in silenzio.
        assertThatThrownBy(() -> new ProjectionCalculator(scoring, List.of()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void computesRoleAveragesWeightedByAppearances() {
        List<Player> players = List.of(
                new Player("1", "A", "Inter", Role.D, 20),
                new Player("2", "B", "Lecce", Role.D, 5));
        Map<String, List<SeasonStats>> byId = Map.of(
                "1", List.of(stats("2025-26", 30, 6.4, 0, 0, 0, 0, 0)),
                "2", List.of(new SeasonStats("2", "2025-26", 10, 5.8, 0, 0, 0, 0, 0, 0, 0, 0, 0)));

        Map<Role, Double> averages =
                ProjectionCalculator.roleAverageRatings(players, id -> byId.getOrDefault(id, List.of()));

        // (30*6.4 + 10*5.8) / 40 = 6.25
        assertThat(averages.get(Role.D)).isCloseTo(6.25, within(0.0005));
    }
}
