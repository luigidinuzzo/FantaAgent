package com.fantaagent.domain.auction;

import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class SquadTest {

    private static final LeagueRules RULES = new LeagueRules(8, 500,
            Map.of(Role.P, 3, Role.D, 8, Role.C, 8, Role.A, 6),
            List.of(Role.P, Role.D, Role.C, Role.A));

    private static Holding holding(long seq, String playerId, Role role, int price) {
        return new Holding(seq, playerId, role, "me", price);
    }

    private final Squad empty = new Squad("me", List.of(), RULES);

    @Test
    void anEmptySquadHasTheFullBudgetAndAllSlots() {
        assertThat(empty.spent()).isZero();
        assertThat(empty.budgetRemaining()).isEqualTo(500);
        assertThat(empty.slotsRemaining()).isEqualTo(25);
        // 500 - 24 slot ancora da riempire a 1 credito ciascuno
        assertThat(empty.maxSpendableNow()).isEqualTo(476);
    }

    @Test
    void spendingReducesBudgetAndSlots() {
        Squad squad = empty.with(holding(1, "p1", Role.P, 30))
                          .with(holding(2, "d1", Role.D, 45));

        assertThat(squad.spent()).isEqualTo(75);
        assertThat(squad.budgetRemaining()).isEqualTo(425);
        assertThat(squad.slotsRemaining()).isEqualTo(23);
        assertThat(squad.count(Role.D)).isEqualTo(1);
        assertThat(squad.slotsRemaining(Role.D)).isEqualTo(7);
        assertThat(squad.maxSpendableNow()).isEqualTo(425 - 22);
    }

    @Test
    void maxSpendableIsZeroWhenTheRosterIsComplete() {
        Squad squad = empty;
        long seq = 0;
        for (Role role : Role.values()) {
            for (int i = 0; i < RULES.slots(role); i++) {
                squad = squad.with(holding(++seq, role + "-" + i, role, 1));
            }
        }
        assertThat(squad.slotsRemaining()).isZero();
        assertThat(squad.maxSpendableNow()).isZero();
        assertThat(squad.hasRoom(Role.A)).isFalse();
    }

    @Test
    void maxSpendableNeverGoesNegative() {
        Squad squad = empty.with(holding(1, "star", Role.A, 500));

        assertThat(squad.budgetRemaining()).isZero();
        assertThat(squad.maxSpendableNow()).isZero();
    }

    @Test
    void hasRoomReflectsPerRoleSlots() {
        Squad squad = empty
                .with(holding(1, "p1", Role.P, 1))
                .with(holding(2, "p2", Role.P, 1))
                .with(holding(3, "p3", Role.P, 1));

        assertThat(squad.hasRoom(Role.P)).isFalse();
        assertThat(squad.hasRoom(Role.D)).isTrue();
        assertThat(squad.playerIds()).containsExactly("p1", "p2", "p3");
    }
}
