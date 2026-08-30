package com.fantaagent.domain.strategy;

import com.fantaagent.domain.league.ModifierTable;
import com.fantaagent.domain.league.ScoringRules;
import com.fantaagent.domain.player.PlayerProjection;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class ModifierCalculatorTest {

    /** Un gradino a 6.0 che vale 1 gol, uno a 6.5 che ne vale 3. */
    private static final ModifierTable DEFENCE = new ModifierTable(3, List.of(
            new ModifierTable.Threshold(0.0, 0.0),
            new ModifierTable.Threshold(6.0, 1.0),
            new ModifierTable.Threshold(6.5, 3.0)));

    private static final ModifierTable KEEPER = new ModifierTable(0, List.of(
            new ModifierTable.Threshold(0.0, 0.0),
            new ModifierTable.Threshold(6.2, 1.0)));

    private final ScoringRules scoring = new ScoringRules(true,
            Map.of(Role.P, 3.0, Role.D, 4.0, Role.C, 3.5, Role.A, 3.0),
            1.0, 3.0, -3.0, 3.0, -0.5, -1.0, -1.0, 1.0, DEFENCE, KEEPER);

    /** Marginale: portieri 5.9, difensori 5.9 — sotto ogni soglia. */
    private final ReplacementLevels replacement = new ReplacementLevels(
            Map.of(Role.P, 100.0, Role.D, 100.0, Role.C, 100.0, Role.A, 100.0),
            Map.of(Role.P, 5.9, Role.D, 5.9, Role.C, 5.9, Role.A, 5.9));

    private final ModifierCalculator calculator = new ModifierCalculator(scoring, replacement);

    private static PlayerProjection player(String id, Role role, double rating, double points) {
        return new PlayerProjection(id, role, rating, 0.0, 30.0, points, 30.0);
    }

    @Test
    void anEmptySquadFallsBackToReplacementRatings() {
        // reparto tutto a 5.9: nessuna soglia raggiunta, nessun bonus
        assertThat(calculator.modifierPoints(List.of())).isZero();
    }

    @Test
    void reachingTheDefenceThresholdIsWorthAWholeStep() {
        // portiere 6.0 + tre difensori 6.4 -> media (6.0+6.4*3)/4 = 6.3 -> gradino 6.0 = 1 gol
        List<PlayerProjection> squad = List.of(
                player("gk", Role.P, 6.0, 150),
                player("d1", Role.D, 6.4, 150),
                player("d2", Role.D, 6.4, 150),
                player("d3", Role.D, 6.4, 150));

        // difesa: 38 * 1.0 ; portiere: 6.0 < 6.2 -> 0
        assertThat(calculator.modifierPoints(squad)).isCloseTo(38.0, within(0.001));
    }

    @Test
    void theGoalkeeperModifierDependsOnTheKeepersOwnRating() {
        // 6.0 e 6.2 lasciano la media di reparto sotto 6.0 in entrambi i casi
        // (con tre riempitivi a 5.9): cosi' varia solo il gradino del portiere.
        List<PlayerProjection> weak = List.of(player("gk", Role.P, 6.0, 150));
        List<PlayerProjection> strong = List.of(player("gk", Role.P, 6.2, 150));

        // difesa invariata; cambia solo il gradino del portiere: 38 * 1.0
        assertThat(calculator.modifierPoints(strong) - calculator.modifierPoints(weak))
                .isCloseTo(38.0, within(0.001));
    }

    @Test
    void onlyTheBestDefendersCountTowardsTheAverage() {
        List<PlayerProjection> squad = List.of(
                player("gk", Role.P, 6.0, 150),
                player("d1", Role.D, 6.8, 150),
                player("d2", Role.D, 6.8, 150),
                player("d3", Role.D, 6.8, 150),
                player("d4", Role.D, 4.0, 10));   // riserva scarsa, deve essere ignorata

        // media (6.0 + 6.8*3)/4 = 6.6 -> gradino 6.5
        assertThat(calculator.modifierPoints(squad)).isCloseTo(38.0 * 3.0, within(0.001));
    }

    @Test
    void marginalPointsIncludeTheModifierDelta() {
        // media attuale (6.4 + 6.8 + 6.8 + riempitivo 5.9) / 4 = 6.475 -> gradino 6.0
        List<PlayerProjection> squad = List.of(
                player("gk", Role.P, 6.4, 150),
                player("d1", Role.D, 6.8, 150),
                player("d2", Role.D, 6.8, 150));
        // il terzo sostituisce il riempitivo e porta la media a 6.7 -> gradino 6.5
        PlayerProjection third = player("d3", Role.D, 6.8, 120);

        double marginal = calculator.marginalPoints(squad, third);

        assertThat(marginal).isGreaterThan(third.basePoints());
    }

    @Test
    void aDefenderCrossingTheThresholdBeatsAStrongerOneThatDoesNot() {
        // È il comportamento distintivo del motore: se si rompe, l'app torna a essere un listone.
        List<PlayerProjection> squad = List.of(
                player("gk", Role.P, 6.6, 150),
                player("d1", Role.D, 6.6, 150),
                player("d2", Role.D, 6.6, 150));

        // media attuale con riempitivo 5.9: (6.6+6.6+6.6+5.9)/4 = 6.425 -> gradino 6.0
        PlayerProjection crosses = player("cross", Role.D, 6.6, 140);   // media 6.6 -> gradino 6.5
        PlayerProjection stronger = player("strong", Role.D, 5.9, 175); // media invariata

        assertThat(calculator.marginalPoints(squad, crosses))
                .isGreaterThan(calculator.marginalPoints(squad, stronger));
    }

    @Test
    void squadPointsSumBasePointsAndModifiers() {
        List<PlayerProjection> squad = List.of(
                player("gk", Role.P, 6.0, 150),
                player("d1", Role.D, 6.4, 100),
                player("d2", Role.D, 6.4, 100),
                player("d3", Role.D, 6.4, 100));

        assertThat(calculator.squadPoints(squad)).isCloseTo(450.0 + 38.0, within(0.001));
    }
}
