package com.fantaagent.domain.league;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ModifierTableTest {

    private final ModifierTable table = new ModifierTable(3, List.of(
            new ModifierTable.Threshold(0.0, 0.0),
            new ModifierTable.Threshold(6.0, 1.0),
            new ModifierTable.Threshold(6.5, 3.0)));

    @Test
    void returnsBonusOfHighestThresholdReached() {
        assertThat(table.bonusFor(5.99)).isEqualTo(0.0);
        assertThat(table.bonusFor(6.00)).isEqualTo(1.0);
        assertThat(table.bonusFor(6.49)).isEqualTo(1.0);
        assertThat(table.bonusFor(6.50)).isEqualTo(3.0);
        assertThat(table.bonusFor(9.00)).isEqualTo(3.0);
    }

    @Test
    void rejectsNonMonotonicThresholds() {
        assertThatThrownBy(() -> new ModifierTable(3, List.of(
                new ModifierTable.Threshold(6.5, 3.0),
                new ModifierTable.Threshold(6.0, 1.0))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("monotonic");
    }

    @Test
    void rejectsEmptyTable() {
        assertThatThrownBy(() -> new ModifierTable(3, List.of()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    /** La tabella reale della lega, usata per la verifica sui dati reali. */
    private static final ModifierTable REAL_LEAGUE_TABLE = new ModifierTable(3, List.of(
            new ModifierTable.Threshold(0.0, 0.0),
            new ModifierTable.Threshold(6.00, 1.0),
            new ModifierTable.Threshold(6.25, 1.5),
            new ModifierTable.Threshold(6.50, 2.0),
            new ModifierTable.Threshold(6.75, 2.5),
            new ModifierTable.Threshold(7.00, 3.0)));

    @Test
    void withZeroSigmaReproducesBonusForExactly() {
        // sigma = 0: la distribuzione collassa su un punto, l'integrale della tabella
        // a gradini deve coincidere esattamente col valore puntuale, comprese le medie
        // che cadono esattamente su una soglia.
        for (double mean : new double[] {5.4, 5.99, 6.00, 6.10, 6.25, 6.499, 6.50, 6.999, 7.00, 8.00}) {
            assertThat(REAL_LEAGUE_TABLE.expectedBonus(mean, 0.0))
                    .isEqualTo(REAL_LEAGUE_TABLE.bonusFor(mean));
        }
    }

    @Test
    void isNonDecreasingInMeanForAFixedPositiveSigma() {
        double sigma = 0.55;
        double previous = REAL_LEAGUE_TABLE.expectedBonus(5.0, sigma);
        for (double mean = 5.1; mean <= 8.0; mean += 0.1) {
            double current = REAL_LEAGUE_TABLE.expectedBonus(mean, sigma);
            assertThat(current).isGreaterThanOrEqualTo(previous);
            previous = current;
        }
    }

    @Test
    void withPositiveSigmaExceedsThePointValueBelowAHighThreshold() {
        // Alla media di reparto reale (6.2) bonusFor vale 1.0: nessuna giornata sopra
        // 6.25 conta per il punto singolo. Con sigma > 0 alcune giornate superano le
        // soglie più alte, quindi il valore atteso deve essere strettamente maggiore.
        double pointValue = REAL_LEAGUE_TABLE.bonusFor(6.2);
        assertThat(pointValue).isEqualTo(1.0);

        double expected = REAL_LEAGUE_TABLE.expectedBonus(6.2, 0.55);
        assertThat(expected).isGreaterThan(pointValue);
    }

    @Test
    void neverFallsOutsideTheTablesMinAndMaxBonus() {
        double minBonus = REAL_LEAGUE_TABLE.thresholds().stream()
                .mapToDouble(ModifierTable.Threshold::bonus).min().orElseThrow();
        double maxBonus = REAL_LEAGUE_TABLE.thresholds().stream()
                .mapToDouble(ModifierTable.Threshold::bonus).max().orElseThrow();

        for (double mean = 3.0; mean <= 10.0; mean += 0.5) {
            for (double sigma : new double[] {0.0, 0.01, 0.3, 0.55, 1.0, 5.0}) {
                double value = REAL_LEAGUE_TABLE.expectedBonus(mean, sigma);
                assertThat(value).isBetween(minBonus, maxBonus);
            }
        }
    }

    @Test
    void rejectsANegativeSigma() {
        assertThatThrownBy(() -> REAL_LEAGUE_TABLE.expectedBonus(6.2, -0.1))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
