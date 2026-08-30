package com.fantaagent.domain.strategy;

import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.auction.AuctionProjector;
import com.fantaagent.domain.auction.AuctionState;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.PlayerProjection;
import com.fantaagent.domain.player.Role;
import com.fantaagent.domain.player.RoleLookup;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class PriceModelTest {

    private static final Instant T = Instant.parse("2026-09-05T20:00:00Z");

    private static final LeagueRules RULES = new LeagueRules(2, 100,
            Map.of(Role.P, 1, Role.D, 2, Role.C, 2, Role.A, 1),
            List.of(Role.P, Role.D, Role.C, Role.A));

    private static final List<Participant> PARTICIPANTS = List.of(
            new Participant("me", "Io", 'I', true),
            new Participant("marco", "Marco", 'M', false));

    private final Map<String, Integer> listPrices = new HashMap<>();
    private final Map<String, Role> roles = new HashMap<>();
    private final List<PlayerProjection> projections = new ArrayList<>();

    private PlayerProjection add(String id, Role role, double points, int listPrice) {
        PlayerProjection p = new PlayerProjection(id, role, 6.0, 0.0, 30.0, points, 30.0);
        projections.add(p);
        listPrices.put(id, listPrice);
        roles.put(id, role);
        return p;
    }

    private final RoleLookup lookup = id -> roles.get(id);

    private AuctionState state(List<AuctionEvent> events) {
        return AuctionProjector.project(RULES, PARTICIPANTS, lookup, events);
    }

    private PriceModel build(AuctionState state) {
        return PriceModel.build(RULES, state, projections, id -> listPrices.get(id));
    }

    private void seedBalancedPool() {
        // 2 partecipanti * 100 crediti = 200 di monte crediti.
        // roster-worthy: 2 P, 4 D, 4 C, 2 A. Somma quotazioni = 200 -> scala 1.0.
        add("p1", Role.P, 300, 20);
        add("p2", Role.P, 290, 20);
        add("d1", Role.D, 280, 20);
        add("d2", Role.D, 270, 20);
        add("d3", Role.D, 260, 20);
        add("d4", Role.D, 250, 20);
        add("c1", Role.C, 240, 15);
        add("c2", Role.C, 230, 15);
        add("c3", Role.C, 220, 15);
        add("c4", Role.C, 210, 15);
        add("a1", Role.A, 200, 10);
        add("a2", Role.A, 190, 10);
    }

    @Test
    void atTheStartOfTheAuctionExpectedPriceEqualsTheScaledPrior() {
        seedBalancedPool();
        PriceModel model = build(state(List.of()));

        assertThat(model.inflationForward()).isCloseTo(1.0, org.assertj.core.api.Assertions.within(1e-9));
        assertThat(model.expectedPrice(projections.getFirst())).isEqualTo(20);
    }

    @Test
    void pricesRiseWhenManyCreditsChaseFewRemainingPlayers() {
        seedBalancedPool();
        // Marco compra due giocatori quasi gratis: restano molti crediti e pochi giocatori
        PriceModel model = build(state(List.of(
                new AuctionEvent.PlayerPurchased(1, T, "p1", "marco", 1),
                new AuctionEvent.PlayerPurchased(2, T, "d1", "marco", 1))));

        assertThat(model.inflationForward()).isGreaterThan(1.0);
        assertThat(model.expectedPrice(projections.get(2))).isGreaterThan(20);
    }

    @Test
    void pricesFallWhenTheLeagueHasOverspentEarly() {
        seedBalancedPool();
        PriceModel model = build(state(List.of(
                new AuctionEvent.PlayerPurchased(1, T, "p1", "marco", 80),
                new AuctionEvent.PlayerPurchased(2, T, "d1", "me", 70))));

        assertThat(model.inflationForward()).isLessThan(1.0);
    }

    @Test
    void aSystematicallyOverpaidRoleGetsABiasAboveOne() {
        seedBalancedPool();
        // I portieri vanno al doppio del prior, i difensori al prior
        PriceModel model = build(state(List.of(
                new AuctionEvent.PlayerPurchased(1, T, "p1", "marco", 40),
                new AuctionEvent.PlayerPurchased(2, T, "d1", "me", 20),
                new AuctionEvent.PlayerPurchased(3, T, "d2", "me", 20))));

        assertThat(model.roleBias().get(Role.P)).isGreaterThan(model.roleBias().get(Role.D));
    }

    @Test
    void roleBiasIsOneWhenNothingHasBeenSoldYet() {
        seedBalancedPool();
        PriceModel model = build(state(List.of()));

        assertThat(model.roleBias().values()).allSatisfy(bias ->
                assertThat(bias).isCloseTo(1.0, org.assertj.core.api.Assertions.within(1e-9)));
    }

    @Test
    void expectedPriceIsNeverBelowOne() {
        add("scarso", Role.A, 1, 1);
        PriceModel model = build(state(List.of()));

        assertThat(model.expectedPrice(projections.getFirst())).isGreaterThanOrEqualTo(1);
    }

    @Test
    void rosterWorthySelectsTheTopPlayersPerRole() {
        seedBalancedPool();
        add("d5", Role.D, 1.0, 1);   // 5° difensore: fuori dai 4 roster-worthy

        assertThat(PriceModel.rosterWorthy(RULES, projections))
                .contains("d1", "d2", "d3", "d4")
                .doesNotContain("d5");
    }
}
