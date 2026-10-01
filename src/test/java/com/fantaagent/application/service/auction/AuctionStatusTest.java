package com.fantaagent.application.service.auction;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AuctionStatusTest {

    @Test
    void senzaAcquistiEDaIniziare() {
        assertThat(AuctionStatus.of(0, 75)).isEqualTo(AuctionStatus.NOT_STARTED);
    }

    @Test
    void conQualcheAcquistoEInCorso() {
        assertThat(AuctionStatus.of(1, 75)).isEqualTo(AuctionStatus.IN_PROGRESS);
    }

    /** La stessa regola della schermata dell'asta: tutti i posti di tutte le squadre pieni. */
    @Test
    void coiPostiPieniEConclusa() {
        assertThat(AuctionStatus.of(75, 75)).isEqualTo(AuctionStatus.CONCLUDED);
    }
}
