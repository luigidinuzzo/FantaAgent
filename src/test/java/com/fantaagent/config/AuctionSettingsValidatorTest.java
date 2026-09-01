package com.fantaagent.config;

import org.junit.jupiter.api.Test;

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
}
