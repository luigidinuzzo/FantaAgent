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
}
