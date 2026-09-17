package com.fantaagent.config;

import com.fantaagent.adapter.out.file.InMemoryPlayerCatalog;
import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.domain.league.ModifierTable;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.ScoringRules;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class StartupValidatorTest {

    private static final ModifierTable ANY_TABLE = new ModifierTable(3,
            List.of(new ModifierTable.Threshold(0.0, 0.0)));

    private static final PlayerCatalog NON_EMPTY_CATALOG = new InMemoryPlayerCatalog(
            List.of(new Player("1", "Bastoni", "Inter", Role.D, 20)), List.of());

    private static final PlayerCatalog EMPTY_CATALOG = new InMemoryPlayerCatalog(List.of(), List.of());

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
                ANY_TABLE, ANY_TABLE, 0.0);
    }

    private static ScoringRules scoring(boolean confirmed, ModifierTable defence, ModifierTable keeper) {
        return new ScoringRules(confirmed,
                Map.of(Role.P, 3.0, Role.D, 4.0, Role.C, 3.5, Role.A, 3.0),
                1.0, 3.0, -3.0, 3.0, -0.5, -1.0, -1.0, 1.0,
                defence, keeper, 0.0);
    }

    private static List<Participant> participants(int n) {
        return java.util.stream.IntStream.range(0, n)
                .mapToObj(i -> new Participant("p" + i, "P" + i, (char) ('A' + i), i == 0))
                .toList();
    }

    private static StartupValidator validator(LeagueRules rules, ScoringRules scoring,
                                              List<Participant> participants, boolean devProfile) {
        return new StartupValidator(rules, scoring, participants, devProfile,
                NON_EMPTY_CATALOG, 25, "data");
    }

    @Test
    void acceptsAValidConfiguration() {
        assertThatCode(() -> validator(
                rules(validSlots()), scoring(true), participants(8), false).validate())
                .doesNotThrowAnyException();
    }

    @Test
    void rejectsDuplicateInitials() {
        List<Participant> clashing = List.of(
                new Participant("a", "Anna", 'A', true),
                new Participant("b", "Aldo", 'A', false));
        assertThatThrownBy(() -> validator(
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
        assertThatThrownBy(() -> validator(
                new LeagueRules(2, 500, validSlots(), List.of(Role.P, Role.D, Role.C, Role.A)),
                scoring(true), noMe, false).validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("esattamente un");
    }

    @Test
    void rejectsUnconfirmedModifiersOutsideDevProfile() {
        assertThatThrownBy(() -> validator(
                rules(validSlots()), scoring(false), participants(8), false).validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("modifiers-confirmed");
    }

    @Test
    void allowsUnconfirmedModifiersInDevProfile() {
        assertThatCode(() -> validator(
                rules(validSlots()), scoring(false), participants(8), true).validate())
                .doesNotThrowAnyException();
    }

    @Test
    void rejectsWhenSlotsSumDoesNotMatchTheConfiguredRosterSize() {
        Map<Role, Integer> tooFew = Map.of(Role.P, 3, Role.D, 8, Role.C, 8, Role.A, 5);
        assertThatThrownBy(() -> new StartupValidator(
                rules(tooFew), scoring(true), participants(8), false,
                NON_EMPTY_CATALOG, 25, "data").validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("roster-size");
    }

    @Test
    void rejectsNonPositiveBudget() {
        LeagueRules zeroBudget = new LeagueRules(8, 0, validSlots(), List.of(Role.P, Role.D, Role.C, Role.A));
        assertThatThrownBy(() -> validator(zeroBudget, scoring(true), participants(8), false).validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("budget");
    }

    @Test
    void rejectsADefenceModifierTableThatIsNotNonDecreasing() {
        ModifierTable badDefence = new ModifierTable(3, List.of(
                new ModifierTable.Threshold(0.0, 2.0),
                new ModifierTable.Threshold(6.0, 1.0)));
        assertThatThrownBy(() -> validator(
                rules(validSlots()), scoring(true, badDefence, ANY_TABLE), participants(8), false).validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("defence-modifier");
    }

    @Test
    void rejectsAGoalkeeperModifierTableThatIsNotNonDecreasing() {
        ModifierTable badKeeper = new ModifierTable(0, List.of(
                new ModifierTable.Threshold(0.0, 1.0),
                new ModifierTable.Threshold(6.2, 0.5)));
        assertThatThrownBy(() -> validator(
                rules(validSlots()), scoring(true, ANY_TABLE, badKeeper), participants(8), false).validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("goalkeeper-modifier");
    }

    @Test
    void rejectsAnEmptyCatalogOutsideDevProfile() {
        assertThatThrownBy(() -> new StartupValidator(
                rules(validSlots()), scoring(true), participants(8), false,
                EMPTY_CATALOG, 25, "data").validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("data/Quotazioni");
    }

    @Test
    void allowsAnEmptyCatalogInDevProfile() {
        assertThatCode(() -> new StartupValidator(
                rules(validSlots()), scoring(true), participants(8), true,
                EMPTY_CATALOG, 25, "data").validate())
                .doesNotThrowAnyException();
    }
}
