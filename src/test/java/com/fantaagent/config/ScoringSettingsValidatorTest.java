package com.fantaagent.config;

import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@code validateByField}, e la garanzia che {@code validate} ne resti l'appiattimento
 * fedele — stesso pattern di {@link AuctionSettingsValidatorTest}. I casi "per sezione"
 * (soglie che non salgono, bonus vuoti, ecc.) restano in {@link ScoringSettingsTest}.
 */
class ScoringSettingsValidatorTest {

    private static final Map<Role, Double> GOAL_BONUS =
            Map.of(Role.P, 3.0, Role.D, 4.0, Role.C, 3.5, Role.A, 3.0);

    private static ScoringSettings validLeague() {
        return new ScoringSettings(true, 3, List.of(
                new ScoringSettings.Step(6.0, 1.0),
                new ScoringSettings.Step(6.5, 2.0)),
                GOAL_BONUS, 1.0, 3.0, -3.0, 3.0, -0.5, -1.0, -1.0, 0.0, true);
    }

    @Test
    void unNumeroDiDifensoriFuoriIntervalloStaSottoIlSuoCampo() {
        ScoringSettings broken = new ScoringSettings(true, 0,
                List.of(new ScoringSettings.Step(6.0, 1.0)),
                GOAL_BONUS, 1, 3, -3, 3, -0.5, -1, -1, 0, true);

        Map<String, List<String>> errors = ScoringSettingsValidator.validateByField(broken);

        assertThat(errors).containsOnlyKeys("defendersCounted");
        assertThat(errors.get("defendersCounted")).hasSize(1);
    }

    @Test
    void unaTabellaVuotaConModificatoreAttivoStaSottoLaChiaveDellaTabella() {
        ScoringSettings broken = new ScoringSettings(true, 3, List.of(),
                GOAL_BONUS, 1, 3, -3, 3, -0.5, -1, -1, 0, true);

        Map<String, List<String>> errors = ScoringSettingsValidator.validateByField(broken);

        assertThat(errors).containsOnlyKeys("thresholds");
        assertThat(errors.get("thresholds")).hasSize(1);
    }

    /**
     * La terza riga (indice 2) rompe l'ordine crescente: la chiave e' quella di quella
     * riga precisa, non "thresholds" in generale — altrimenti chi guarda saprebbe che
     * la tabella e' sbagliata ma non quale riga correggere.
     */
    @Test
    void unaRigaGuastaStaSottoLaSuaChiaveIndicizzata() {
        ScoringSettings broken = new ScoringSettings(true, 3, List.of(
                new ScoringSettings.Step(6.0, 1.0),
                new ScoringSettings.Step(6.5, 2.0),
                new ScoringSettings.Step(6.4, 3.0)),
                GOAL_BONUS, 1, 3, -3, 3, -0.5, -1, -1, 0, true);

        Map<String, List<String>> errors = ScoringSettingsValidator.validateByField(broken);

        assertThat(errors).containsOnlyKeys("thresholds[2]");
        assertThat(errors.get("thresholds[2]")).anySatisfy(
                e -> assertThat(e).contains("ordine crescente"));
    }

    @Test
    void impostazioniValideNonProduconoChiavi() {
        assertThat(ScoringSettingsValidator.validateByField(validLeague())).isEmpty();
    }

    /**
     * La ragione per cui il metodo vecchio resta: SettingsController lo usa, e i suoi
     * test asseriscono queste frasi. Appiattire non deve cambiarle ne' riordinarle.
     *
     * <p>Pin sulle frasi LETTERALI, nell'ORDINE letterale — non su un confronto con
     * {@code validateByField(...).values()...}: quel confronto sarebbe tautologico,
     * perche' {@code validate} e' DEFINITO come quel flatten e concorderebbe con se
     * stesso anche se un controllo futuro venisse spostato altrove nel metodo. Le
     * cinque frasi qui sotto attraversano quattro rami diversi — defendersCounted,
     * la riga 2 della tabella, i quattro ruoli mancanti nell'ordine di
     * {@code Role.values()}, e assist — nell'ordine in cui quei rami girano oggi.
     */
    @Test
    void ilMetodoVecchioResituisceLeFrasiLetteraliNellOrdineDeiControlli() {
        ScoringSettings broken = new ScoringSettings(true, 0, List.of(
                new ScoringSettings.Step(6.0, 1.0),
                new ScoringSettings.Step(5.0, 2.0)),
                Map.of(), Double.NaN, 3, -3, 3, -0.5, -1, -1, 0, true);

        assertThat(ScoringSettingsValidator.validate(broken)).containsExactly(
                "I difensori conteggiati devono essere fra 1 e 10: indicato 0.",
                "Riga 2: la media 5.0 non è maggiore della precedente 6.0. "
                        + "Le soglie vanno in ordine crescente.",
                "Manca il bonus gol per il ruolo P.",
                "Manca il bonus gol per il ruolo D.",
                "Manca il bonus gol per il ruolo C.",
                "Manca il bonus gol per il ruolo A.",
                "Il valore per «assist» non è un numero valido.");
    }
}
