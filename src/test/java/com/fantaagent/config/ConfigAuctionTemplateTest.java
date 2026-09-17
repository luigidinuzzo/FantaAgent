package com.fantaagent.config;

import com.fantaagent.domain.league.ScoringRules;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Il modello senza file globali (profilo dev: data-dir inesistente) deve dare lo stesso
 * punteggio di application.yml, tabella del portiere compresa, che ScoringSettings non
 * sa rappresentare.
 */
@SpringBootTest
@ActiveProfiles("dev")
class ConfigAuctionTemplateTest {

    @Autowired
    private LeagueProperties props;

    @Autowired
    private ConfigAuctionTemplate template;

    @Test
    void senzaFileGlobaleIlPunteggioEQuelloDiApplicationYml() {
        ScoringRules expected = SettingsConfig.fromProperties(props);
        ScoringRules actual = template.scoringRules(template.scoring());
        assertThat(actual.goalkeeperModifier()).isEqualTo(expected.goalkeeperModifier());
        assertThat(actual.defenceModifier()).isEqualTo(expected.defenceModifier());
        assertThat(actual.assist()).isEqualTo(expected.assist());
    }

    @Test
    void unPunteggioModificatoNonRicadeSuApplicationYml() {
        ScoringSettings s = template.scoring();
        ScoringSettings changed = new ScoringSettings(s.defenceModifierEnabled(), s.defendersCounted(),
                s.thresholds(), s.goalBonus(), s.assist() + 1, s.penaltyScored(), s.penaltyMissed(),
                s.penaltySaved(), s.yellowCard(), s.redCard(), s.goalConceded(), s.cleanSheet(),
                s.confirmed());
        assertThat(template.scoringRules(changed).assist()).isEqualTo(s.assist() + 1);
    }
}
