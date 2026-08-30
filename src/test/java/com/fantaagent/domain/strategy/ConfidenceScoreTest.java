package com.fantaagent.domain.strategy;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class ConfidenceScoreTest {

    @Test
    void combinesFactorsWithTheGeometricMean() {
        ConfidenceScore score = ConfidenceScore.of(1.0, 1.0, 1.0, 1.0);
        assertThat(score.value()).isCloseTo(1.0, within(1e-9));

        ConfidenceScore half = ConfidenceScore.of(0.5, 0.5, 0.5, 0.5);
        assertThat(half.value()).isCloseTo(0.5, within(1e-9));
    }

    @Test
    void oneWeakFactorDragsTheWholeScoreDown() {
        // media aritmetica sarebbe 0.7750; la geometrica punisce il fattore basso
        ConfidenceScore score = ConfidenceScore.of(1.0, 1.0, 0.1, 1.0);
        assertThat(score.value()).isLessThan(0.6);
    }

    @Test
    void neverReturnsZeroSoTheUiAlwaysHasSomethingToShow() {
        assertThat(ConfidenceScore.of(0.0, 0.0, 0.0, 0.0).value()).isGreaterThan(0.0);
    }

    @Test
    void mapsToFiveStarsForTheUi() {
        assertThat(ConfidenceScore.of(1.0, 1.0, 1.0, 1.0).stars()).isEqualTo(5);
        assertThat(ConfidenceScore.of(0.01, 0.01, 0.01, 0.01).stars()).isEqualTo(1);
    }

    @Test
    void dataFactorSaturatesAtAFullSeasonOfEvidence() {
        assertThat(ConfidenceScore.dataFactor(0)).isZero();
        assertThat(ConfidenceScore.dataFactor(25)).isEqualTo(1.0);
        assertThat(ConfidenceScore.dataFactor(38)).isEqualTo(1.0);
        assertThat(ConfidenceScore.dataFactor(12.5)).isCloseTo(0.5, within(1e-9));
    }

    @Test
    void marketFactorGrowsWithObservedSalesInThePhase() {
        assertThat(ConfidenceScore.marketFactor(0)).isZero();
        assertThat(ConfidenceScore.marketFactor(15)).isEqualTo(1.0);
        assertThat(ConfidenceScore.marketFactor(100)).isEqualTo(1.0);
    }

    @Test
    void stabilityFallsWhenPerturbingPricesMovesTheAnswer() {
        assertThat(ConfidenceScore.stabilityFactor(40, 40, 40)).isEqualTo(1.0);
        assertThat(ConfidenceScore.stabilityFactor(40, 30, 50)).isCloseTo(0.5, within(1e-9));
        assertThat(ConfidenceScore.stabilityFactor(40, 0, 100)).isZero();
    }
}
