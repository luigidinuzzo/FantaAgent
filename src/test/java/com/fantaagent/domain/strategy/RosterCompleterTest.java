package com.fantaagent.domain.strategy;

import com.fantaagent.domain.auction.Squad;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.ModifierTable;
import com.fantaagent.domain.league.ScoringRules;
import com.fantaagent.domain.player.PlayerProjection;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class RosterCompleterTest {

    private static final LeagueRules RULES = new LeagueRules(2, 100,
            Map.of(Role.P, 1, Role.D, 1, Role.C, 1, Role.A, 1),
            List.of(Role.P, Role.D, Role.C, Role.A));

    /** Modificatori disattivati: qui verifichiamo il greedy, non i modificatori. */
    private static final ModifierTable FLAT = new ModifierTable(1,
            List.of(new ModifierTable.Threshold(0.0, 0.0)));

    private static final ScoringRules SCORING = new ScoringRules(true,
            Map.of(Role.P, 3.0, Role.D, 4.0, Role.C, 3.5, Role.A, 3.0),
            1.0, 3.0, -3.0, 3.0, -0.5, -1.0, -1.0, 1.0, FLAT, FLAT);

    private static final ReplacementLevels REPLACEMENT = new ReplacementLevels(
            Map.of(Role.P, 0.0, Role.D, 0.0, Role.C, 0.0, Role.A, 0.0),
            Map.of(Role.P, 6.0, Role.D, 6.0, Role.C, 6.0, Role.A, 6.0));

    private final RosterCompleter completer =
            new RosterCompleter(new ModifierCalculator(SCORING, REPLACEMENT), REPLACEMENT);

    private final List<PlayerProjection> pool = new ArrayList<>();
    private final Map<String, Double> priors = new HashMap<>();

    private PlayerProjection add(String id, Role role, double points, double price) {
        PlayerProjection p = new PlayerProjection(id, role, 6.0, 0.0, 30.0, points, 30.0);
        pool.add(p);
        priors.put(id, price);
        return p;
    }

    private PriceModel prices() {
        Map<Role, Double> bias = new java.util.EnumMap<>(Role.class);
        for (Role role : Role.values()) {
            bias.put(role, 1.0);
        }
        return new PriceModel(priors, 1.0, bias);
    }

    private Squad emptySquad() {
        return new Squad("me", List.of(), RULES);
    }

    @Test
    void fillsEverySlotExactlyOnce() {
        add("p1", Role.P, 100, 10);
        add("d1", Role.D, 100, 10);
        add("c1", Role.C, 100, 10);
        add("a1", Role.A, 100, 10);

        RosterCompleter.Completion completion =
                completer.complete(emptySquad(), List.of(), pool, prices());

        assertThat(completion.picks()).hasSize(4);
        assertThat(completion.picks()).extracting(PlayerProjection::role)
                .containsExactlyInAnyOrder(Role.P, Role.D, Role.C, Role.A);
        assertThat(completion.budgetLeft()).isEqualTo(60);
    }

    @Test
    void prefersTheBestPointsPerCreditRatioWhenTheBudgetIsTight() {
        // Gli altri ruoli assorbono 90 crediti dei 100 disponibili: il rapporto
        // valore/prezzo conta solo quando il budget e' davvero vincolante.
        add("p1", Role.P, 1, 30);
        add("d1", Role.D, 1, 30);
        add("c1", Role.C, 1, 30);
        add("cheapStriker", Role.A, 90, 10);   // 9 punti per credito
        add("dearStriker", Role.A, 100, 50);   // 2 punti per credito, non finanziabile

        RosterCompleter.Completion completion =
                completer.complete(emptySquad(), List.of(), pool, prices());

        assertThat(completion.picks()).extracting(PlayerProjection::playerId)
                .contains("cheapStriker")
                .doesNotContain("dearStriker");
    }

    @Test
    void neverSpendsSoMuchThatASlotCannotBeFilled() {
        add("p1", Role.P, 500, 99);   // costoso e allettante: comprarlo lascerebbe 1 credito per 3 slot
        add("d1", Role.D, 10, 1);
        add("c1", Role.C, 10, 1);
        add("a1", Role.A, 10, 1);

        RosterCompleter.Completion completion =
                completer.complete(emptySquad(), List.of(), pool, prices());

        // La guardia di ammissibilita' esclude p1 a ogni passo: meglio tre slot coperti
        // che una rosa incompletabile. Il portiere resta scoperto e questo e' corretto.
        assertThat(completion.picks()).extracting(PlayerProjection::playerId)
                .containsExactlyInAnyOrder("d1", "c1", "a1");
        assertThat(completion.budgetLeft()).isGreaterThanOrEqualTo(0);
    }

    @Test
    void skipsRolesAlreadyCoveredByTheSquad() {
        add("p1", Role.P, 100, 10);
        add("p2", Role.P, 90, 10);
        add("d1", Role.D, 100, 10);
        add("c1", Role.C, 100, 10);
        add("a1", Role.A, 100, 10);

        Squad squad = emptySquad().with(
                new com.fantaagent.domain.auction.Holding(1, "p1", Role.P, "me", 10));
        PlayerProjection owned = pool.getFirst();

        RosterCompleter.Completion completion = completer.complete(
                squad, List.of(owned), pool.stream().filter(p -> !p.playerId().equals("p1")).toList(),
                prices());

        assertThat(completion.picks()).extracting(PlayerProjection::playerId)
                .doesNotContain("p2");
        assertThat(completion.picks()).hasSize(3);
    }

    @Test
    void totalPointsIncludeAlreadyOwnedPlayers() {
        add("p1", Role.P, 100, 10);
        add("d1", Role.D, 200, 10);
        add("c1", Role.C, 100, 10);
        add("a1", Role.A, 100, 10);

        RosterCompleter.Completion completion =
                completer.complete(emptySquad(), List.of(), pool, prices());

        assertThat(completion.totalPoints()).isEqualTo(500.0);
    }

    @Test
    void stopsCleanlyWhenThePoolCannotFillEveryRole() {
        add("p1", Role.P, 100, 10);   // manca ogni difensore, centrocampista e attaccante

        RosterCompleter.Completion completion =
                completer.complete(emptySquad(), List.of(), pool, prices());

        assertThat(completion.picks()).hasSize(1);
        assertThat(completion.totalPoints()).isEqualTo(100.0);
    }
}
