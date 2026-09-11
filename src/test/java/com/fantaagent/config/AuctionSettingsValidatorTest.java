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
     * test asseriscono queste frasi. Appiattire non deve cambiarle.
     *
     * <p>Pin sulla frase LETTERALE, non su un confronto con {@code
     * validateByField(...).values()...}: quel confronto sarebbe tautologico, perche'
     * {@code validate} e' DEFINITO come quel flatten — concorderebbe con se stesso
     * anche se l'ordine delle chiavi cambiasse. Con un solo controllo in questo
     * validatore non c'e' un ordine da riordinare, ma il nome del test non deve
     * promettere una fedelta' che l'asserzione non verifica.
     */
    @Test
    void ilMetodoVecchioResituisceLaFraseLetteraleDelCampo() {
        assertThat(AuctionSettingsValidator.validate(new AuctionSettings(500, true)))
                .containsExactly(
                        "La durata del timer deve essere fra 1 e 120 secondi: indicati 500.");
    }
}
