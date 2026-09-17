package com.fantaagent.config;

import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LeagueRulesSettingsStoreTest {

    @TempDir
    Path dir;

    @Test
    void senzaFileNonCeNiente() {
        assertThat(new LeagueRulesSettingsStore(dir).load()).isEmpty();
    }

    @Test
    void cioCheSiSalvaSiRilegge() {
        var store = new LeagueRulesSettingsStore(dir);
        var saved = new LeagueRulesSettings(300, Map.of(Role.P, 2, Role.D, 6, Role.C, 7, Role.A, 5));
        store.save(saved);

        assertThat(store.file()).isEqualTo(dir.resolve("league-rules.yml"));
        assertThat(store.load()).contains(saved);
    }

    @Test
    void ilFileNonPortaNeSquadreNeFasi() throws Exception {
        var store = new LeagueRulesSettingsStore(dir);
        store.save(new LeagueRulesSettings(500, Map.of(Role.P, 3, Role.D, 8, Role.C, 8, Role.A, 6)));
        String yaml = Files.readString(store.file());
        assertThat(yaml).contains("budget: 500").contains("P: 3").contains("A: 6");
        assertThat(yaml).doesNotContain("participants").doesNotContain("phases");
    }

    @Test
    void unFileIllegibileLoDiceConIlSuoPercorso() throws Exception {
        Files.writeString(dir.resolve("league-rules.yml"), "- non una mappa\n");
        assertThatThrownBy(() -> new LeagueRulesSettingsStore(dir).load())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("league-rules.yml");
    }

    @Test
    void leRegoleDelDominioSiCostruisconoConPartecipantiEFasi() {
        var s = new LeagueRulesSettings(500, Map.of(Role.P, 3, Role.D, 8, Role.C, 8, Role.A, 6));
        LeagueRules rules = s.toRules(6, List.of(Role.P, Role.D, Role.C, Role.A));
        assertThat(rules.participants()).isEqualTo(6);
        assertThat(rules.budget()).isEqualTo(500);
        assertThat(LeagueRulesSettings.from(rules)).isEqualTo(s);
    }
}
