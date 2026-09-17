package com.fantaagent.config;

import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class LeagueRulesValidatorTest {

    private static Map<Role, Integer> slots(int p, int d, int c, int a) {
        return Map.of(Role.P, p, Role.D, d, Role.C, c, Role.A, a);
    }

    @Test
    void regoleValideNonDannoErrori() {
        assertThat(LeagueRulesValidator.validateByField(
                new LeagueRulesSettings(500, slots(3, 8, 8, 6)), 8)).isEmpty();
    }

    @Test
    void creditiSottoUnoStannoSottoLaChiaveBudget() {
        assertThat(LeagueRulesValidator.validateByField(
                new LeagueRulesSettings(0, slots(3, 8, 8, 6)), 8))
                .containsExactly(Map.entry("budget",
                        List.of("I crediti per squadra devono essere almeno 1: indicati 0.")));
    }

    @Test
    void ogniRuoloFuoriLimiteHaLaSuaChiave() {
        var errors = LeagueRulesValidator.validateByField(
                new LeagueRulesSettings(500, slots(0, 31, 8, 6)), 8);
        assertThat(errors).containsOnlyKeys("slots[P]", "slots[D]");
        assertThat(errors.get("slots[P]"))
                .containsExactly("Gli slot dei portieri devono essere fra 1 e 30: indicati 0.");
        assertThat(errors.get("slots[D]"))
                .containsExactly("Gli slot dei difensori devono essere fra 1 e 30: indicati 31.");
    }

    /** Un ruolo assente dal corpo e' un ruolo a zero slot, non un NullPointerException. */
    @Test
    void unRuoloMancanteEUnErroreDiCampo() {
        var errors = LeagueRulesValidator.validateByField(
                new LeagueRulesSettings(500, Map.of(Role.P, 3, Role.D, 8, Role.C, 8)), 8);
        assertThat(errors.get("slots[A]"))
                .containsExactly("Gli slot degli attaccanti devono essere fra 1 e 30: indicati 0.");
    }

    @Test
    void menoDiDuePartecipantiStaSottoLaChiaveParticipants() {
        assertThat(LeagueRulesValidator.validateByField(
                new LeagueRulesSettings(500, slots(3, 8, 8, 6)), 1))
                .containsExactly(Map.entry("participants", List.of("Servono almeno 2 partecipanti.")));
    }
}
