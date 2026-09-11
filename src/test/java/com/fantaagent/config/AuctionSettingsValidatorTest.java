package com.fantaagent.config;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class AuctionSettingsValidatorTest {

    @Test
    void iDefaultSonoValidi() {
        assertThat(AuctionSettingsValidator.validate(AuctionSettings.DEFAULTS)).isEmpty();
    }

    @Test
    void gliEstremiAmmessiPassano() {
        assertThat(AuctionSettingsValidator.validate(new AuctionSettings(
                AuctionSettingsValidator.MIN_SECONDS, true))).isEmpty();
        assertThat(AuctionSettingsValidator.validate(new AuctionSettings(
                AuctionSettingsValidator.MAX_SECONDS, true))).isEmpty();
    }

    @Test
    void zeroEnegativiSonoRifiutati() {
        assertThat(AuctionSettingsValidator.validate(new AuctionSettings(0, true)))
                .singleElement().asString().contains("durata del timer");
        assertThat(AuctionSettingsValidator.validate(new AuctionSettings(-3, true)))
                .hasSize(1);
    }

    @Test
    void unaDurataAssurdaEriufiutata() {
        assertThat(AuctionSettingsValidator.validate(
                new AuctionSettings(AuctionSettingsValidator.MAX_SECONDS + 1, true)))
                .hasSize(1);
    }

    @Test
    void ilTimerFuoriIntervalloStaSottoIlSuoCampo() {
        Map<String, List<String>> errors = AuctionSettingsValidator
                .validateByField(new AuctionSettings(500, true));

        assertThat(errors).containsOnlyKeys("bidTimerSeconds");
        assertThat(errors.get("bidTimerSeconds")).hasSize(1);
    }

    @Test
    void impostazioniValideNonProduconoChiavi() {
        assertThat(AuctionSettingsValidator.validateByField(AuctionSettings.DEFAULTS))
                .isEmpty();
    }

    /**
     * La ragione per cui il metodo vecchio resta: SettingsController lo usa, e i suoi
     * test asseriscono queste frasi. Appiattire non deve cambiarle ne' riordinarle.
     */
    @Test
    void ilMetodoVecchioResituisceLeStesseFrasiNelloStessoOrdine() {
        AuctionSettings rotte = new AuctionSettings(500, true);

        assertThat(AuctionSettingsValidator.validate(rotte))
                .containsExactlyElementsOf(
                        AuctionSettingsValidator.validateByField(rotte).values().stream()
                                .flatMap(List::stream).toList());
    }
}
