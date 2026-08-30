package com.fantaagent.config;

import com.fantaagent.domain.league.ModifierTable;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.ScoringRules;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class StartupValidatorTest {

    private static final ModifierTable ANY_TABLE = new ModifierTable(3,
            List.of(new ModifierTable.Threshold(0.0, 0.0)));

    private static LeagueRules rules(Map<Role, Integer> slots) {
        return new LeagueRules(8, 500, slots, List.of(Role.P, Role.D, Role.C, Role.A));
    }

    private static Map<Role, Integer> validSlots() {
        return Map.of(Role.P, 3, Role.D, 8, Role.C, 8, Role.A, 6);
    }

    private static ScoringRules scoring(boolean confirmed) {
        return new ScoringRules(confirmed,
                Map.of(Role.P, 3.0, Role.D, 4.0, Role.C, 3.5, Role.A, 3.0),
                1.0, 3.0, -3.0, 3.0, -0.5, -1.0, -1.0, 1.0,
                ANY_TABLE, ANY_TABLE);
    }

    private static List<Participant> participants(int n) {
        return java.util.stream.IntStream.range(0, n)
                .mapToObj(i -> new Participant("p" + i, "P" + i, (char) ('A' + i), i == 0))
                .toList();
    }

    @Test
    void acceptsAValidConfiguration() {
        assertThatCode(() -> new StartupValidator(
                rules(validSlots()), scoring(true), participants(8), false).validate())
                .doesNotThrowAnyException();
    }

    @Test
    void rejectsWhenSlotsDoNotMatchParticipantCount() {
        List<Participant> nine = participants(9);
        assertThatThrownBy(() -> new StartupValidator(
                rules(validSlots()), scoring(true), nine, false).validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("participants");
    }

    @Test
    void rejectsDuplicateInitials() {
        List<Participant> clashing = List.of(
                new Participant("a", "Anna", 'A', true),
                new Participant("b", "Aldo", 'A', false));
        assertThatThrownBy(() -> new StartupValidator(
                new LeagueRules(2, 500, validSlots(), List.of(Role.P, Role.D, Role.C, Role.A)),
                scoring(true), clashing, false).validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("initial");
    }

    @Test
    void rejectsExactlyOneOwnerFlagViolation() {
        List<Participant> noMe = List.of(
                new Participant("a", "Anna", 'A', false),
                new Participant("b", "Bea", 'B', false));
        assertThatThrownBy(() -> new StartupValidator(
                new LeagueRules(2, 500, validSlots(), List.of(Role.P, Role.D, Role.C, Role.A)),
                scoring(true), noMe, false).validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("exactly one");
    }

    @Test
    void rejectsUnconfirmedModifiersOutsideDevProfile() {
        assertThatThrownBy(() -> new StartupValidator(
                rules(validSlots()), scoring(false), participants(8), false).validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("modifiers-confirmed");
    }

    @Test
    void allowsUnconfirmedModifiersInDevProfile() {
        assertThatCode(() -> new StartupValidator(
                rules(validSlots()), scoring(false), participants(8), true).validate())
                .doesNotThrowAnyException();
    }
}
