package com.fantaagent.config;

import com.fantaagent.domain.league.ScoringRules;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ScoringSettingsTest {

    @TempDir
    Path tmp;

    private static final Map<Role, Double> GOAL_BONUS =
            Map.of(Role.P, 3.0, Role.D, 4.0, Role.C, 3.5, Role.A, 3.0);

    /** La tabella reale della lega, come fornita dall'utente. */
    private static ScoringSettings realLeague(boolean enabled) {
        return new ScoringSettings(enabled, 3, List.of(
                new ScoringSettings.Step(6.0, 1.0),
                new ScoringSettings.Step(6.25, 1.5),
                new ScoringSettings.Step(6.5, 2.0),
                new ScoringSettings.Step(6.75, 2.5),
                new ScoringSettings.Step(7.0, 3.0)),
                GOAL_BONUS, 1.0, 3.0, -3.0, 3.0, -0.5, -1.0, -1.0, 0.0, true);
    }

    @Test
    void buildsTheDomainTableAndPrependsTheMissingZeroStep() {
        ScoringRules rules = realLeague(true).toScoringRules();

        // Il motore cerca il gradino piu' alto raggiunto: senza una soglia che copra
        // le medie basse una squadra scarsa non avrebbe alcun bonus definito.
        assertThat(rules.defenceModifier().thresholds()).hasSize(6);
        assertThat(rules.defenceModifier().bonusFor(5.4)).isZero();
        assertThat(rules.defenceModifier().bonusFor(6.10)).isEqualTo(1.0);
        assertThat(rules.defenceModifier().bonusFor(6.30)).isEqualTo(1.5);
        assertThat(rules.defenceModifier().bonusFor(6.90)).isEqualTo(2.5);
        assertThat(rules.defenceModifier().bonusFor(8.00)).isEqualTo(3.0);
        assertThat(rules.defenceModifier().defendersCounted()).isEqualTo(3);
    }

    @Test
    void aDisabledModifierProducesATableThatContributesNothing() {
        ScoringRules rules = realLeague(false).toScoringRules();

        assertThat(rules.defenceModifier().bonusFor(7.5)).isZero();
        assertThat(rules.defenceModifier().bonusFor(5.0)).isZero();
    }

    @Test
    void theGoalkeeperModifierIsAlwaysNeutralBecauseThisLeagueHasOnlyOne() {
        ScoringRules rules = realLeague(true).toScoringRules();

        assertThat(rules.goalkeeperModifier().bonusFor(9.0)).isZero();
    }

    @Test
    void survivesASaveAndReloadUnchanged() {
        ScoringSettingsStore store = new ScoringSettingsStore(tmp);
        ScoringSettings original = realLeague(true);

        store.save(original);
        ScoringSettings reloaded = store.load().orElseThrow();

        assertThat(reloaded.defenceModifierEnabled()).isTrue();
        assertThat(reloaded.defendersCounted()).isEqualTo(3);
        assertThat(reloaded.confirmed()).isTrue();
        assertThat(reloaded.cleanSheet()).isZero();
        assertThat(reloaded.thresholds()).containsExactlyElementsOf(original.thresholds());
        assertThat(reloaded.goalBonus()).isEqualTo(GOAL_BONUS);
        assertThat(reloaded.toScoringRules()).isEqualTo(original.toScoringRules());
    }

    @Test
    void anAbsentFileMeansNoChoiceYetRatherThanAnError() {
        assertThat(new ScoringSettingsStore(tmp).load()).isEmpty();
    }

    @Test
    void anUnreadableFileFailsLoudlyNamingIt() throws Exception {
        Files.writeString(tmp.resolve(ScoringSettingsStore.FILE_NAME), "questo non e' una mappa");

        assertThatThrownBy(() -> new ScoringSettingsStore(tmp).load())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining(ScoringSettingsStore.FILE_NAME);
    }

    @Test
    void acceptsTheRealLeagueTable() {
        assertThat(ScoringSettingsValidator.validate(realLeague(true))).isEmpty();
    }

    @Test
    void rejectsThresholdsThatDoNotRise() {
        ScoringSettings broken = new ScoringSettings(true, 3, List.of(
                new ScoringSettings.Step(6.5, 1.0),
                new ScoringSettings.Step(6.0, 2.0)),
                GOAL_BONUS, 1, 3, -3, 3, -0.5, -1, -1, 0, true);

        assertThat(ScoringSettingsValidator.validate(broken))
                .anySatisfy(e -> assertThat(e).contains("ordine crescente"));
    }

    @Test
    void rejectsABonusThatFallsAsTheUnitImproves() {
        // Se il bonus scendesse, l'argomento per cui conviene alzare la media del
        // reparto smetterebbe di valere e il motore consiglierebbe l'opposto.
        ScoringSettings broken = new ScoringSettings(true, 3, List.of(
                new ScoringSettings.Step(6.0, 2.0),
                new ScoringSettings.Step(6.5, 1.0)),
                GOAL_BONUS, 1, 3, -3, 3, -0.5, -1, -1, 0, true);

        assertThat(ScoringSettingsValidator.validate(broken))
                .anySatisfy(e -> assertThat(e).contains("non può rendere meno"));
    }

    @Test
    void rejectsAnActiveModifierWithNoThresholds() {
        ScoringSettings broken = new ScoringSettings(true, 3, List.of(),
                GOAL_BONUS, 1, 3, -3, 3, -0.5, -1, -1, 0, true);

        assertThat(ScoringSettingsValidator.validate(broken))
                .anySatisfy(e -> assertThat(e).contains("tabella è vuota"));
    }

    @Test
    void rejectsAnImpossibleDefenderCount() {
        ScoringSettings broken = new ScoringSettings(true, 0,
                List.of(new ScoringSettings.Step(6.0, 1.0)),
                GOAL_BONUS, 1, 3, -3, 3, -0.5, -1, -1, 0, true);

        assertThat(ScoringSettingsValidator.validate(broken))
                .anySatisfy(e -> assertThat(e).contains("fra 1 e 10"));
    }
}
