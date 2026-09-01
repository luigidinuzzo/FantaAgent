package com.fantaagent.domain.strategy;

import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.auction.AuctionProjector;
import com.fantaagent.domain.auction.AuctionState;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Role;
import com.fantaagent.domain.player.RoleLookup;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class MarketPressureTest {

    private static final Instant T = Instant.parse("2026-09-05T20:00:00Z");

    private static final LeagueRules RULES = new LeagueRules(3, 100,
            Map.of(Role.P, 1, Role.D, 1, Role.C, 1, Role.A, 1),
            List.of(Role.P, Role.D, Role.C, Role.A));

    private static final List<Participant> PARTICIPANTS = List.of(
            new Participant("me", "Io", 'I', true),
            new Participant("marco", "Marco", 'M', false),
            new Participant("luca", "Luca", 'L', false));

    private static final Map<String, Role> ROLES = Map.of(
            "gk", Role.P, "def", Role.D, "def2", Role.D, "mid", Role.C, "fw", Role.A);

    private static final RoleLookup LOOKUP = ROLES::get;

    private AuctionState state(List<AuctionEvent> events) {
        return AuctionProjector.project(RULES, PARTICIPANTS, LOOKUP, events);
    }

    @Test
    void atTheStartEveryRivalCanBidUpToTheirBudgetMinusReservedSlots() {
        MarketPressure pressure = MarketPressure.from(state(List.of()));

        // 100 crediti, 4 slot: 100 - 3 = 97
        assertThat(pressure.maxRivalBid(Role.D)).isEqualTo(97);
        assertThat(pressure.rivalsNeeding(Role.D)).isEqualTo(2);
    }

    @Test
    void ignoresMyOwnBudget() {
        // Io ho speso quasi tutto; i rivali no. La pressione non deve cambiare.
        MarketPressure pressure = MarketPressure.from(state(List.of(
                new AuctionEvent.PlayerPurchased(1, T, "fw", "me", 97))));

        assertThat(pressure.maxRivalBid(Role.D)).isEqualTo(97);
    }

    @Test
    void excludesRivalsWhoAlreadyFilledTheRole() {
        MarketPressure pressure = MarketPressure.from(state(List.of(
                new AuctionEvent.PlayerPurchased(1, T, "def", "marco", 50))));

        // Marco ha il suo unico difensore: resta solo Luca in corsa
        assertThat(pressure.rivalsNeeding(Role.D)).isEqualTo(1);
        assertThat(pressure.maxRivalBid(Role.D)).isEqualTo(97);
    }

    @Test
    void reflectsHowMuchTheRichestRivalCanStillSpend() {
        MarketPressure pressure = MarketPressure.from(state(List.of(
                new AuctionEvent.PlayerPurchased(1, T, "gk", "marco", 60),
                new AuctionEvent.PlayerPurchased(2, T, "fw", "luca", 90))));

        // Marco: 40 crediti, 3 slot -> 38. Luca: 10 crediti, 3 slot -> 8.
        assertThat(pressure.maxRivalBid(Role.D)).isEqualTo(38);
    }

    @Test
    void isZeroWhenNoRivalStillNeedsTheRole() {
        // Entrambi i rivali hanno gia' il loro unico difensore: nessuna pressione residua.
        MarketPressure pressure = MarketPressure.from(state(List.of(
                new AuctionEvent.PlayerPurchased(1, T, "def", "marco", 10),
                new AuctionEvent.PlayerPurchased(2, T, "def2", "luca", 10))));

        assertThat(pressure.rivalsNeeding(Role.D)).isZero();
        assertThat(pressure.maxRivalBid(Role.D)).isZero();
    }
}
