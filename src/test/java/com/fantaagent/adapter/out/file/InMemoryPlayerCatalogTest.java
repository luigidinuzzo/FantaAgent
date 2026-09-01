package com.fantaagent.adapter.out.file;

import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import com.fantaagent.domain.player.SeasonStats;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class InMemoryPlayerCatalogTest {

    private static final Player BASTONI = new Player("1", "Bastoni", "Inter", Role.D, 20);
    private static final Player LAUTARO = new Player("2", "Lautaro", "Inter", Role.A, 40);

    private final InMemoryPlayerCatalog catalog = new InMemoryPlayerCatalog(
            List.of(BASTONI, LAUTARO),
            List.of(new SeasonStats("1", "2025-26", 30, 6.2, 2, 1, 5, 0, 0, 0, 0, 0, 0)));

    @Test
    void findsPlayerById() {
        assertThat(catalog.byId("1")).contains(BASTONI);
        assertThat(catalog.byId("999")).isEmpty();
    }

    @Test
    void filtersByRole() {
        assertThat(catalog.byRole(Role.D)).containsExactly(BASTONI);
        assertThat(catalog.byRole(Role.C)).isEmpty();
    }

    @Test
    void exposesRoleLookup() {
        assertThat(catalog.roleOf("2")).isEqualTo(Role.A);
    }

    @Test
    void roleLookupFailsLoudlyForUnknownPlayer() {
        assertThatThrownBy(() -> catalog.roleOf("999"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("999");
    }

    @Test
    void returnsStatsForPlayerAndEmptyListWhenAbsent() {
        assertThat(catalog.statsOf("1")).hasSize(1);
        assertThat(catalog.statsOf("2")).isEmpty();
    }

    @Test
    void byRoleReturnsImmutableList() {
        assertThatThrownBy(() -> catalog.byRole(Role.D).add(LAUTARO))
                .isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void allReturnsImmutableList() {
        assertThatThrownBy(() -> catalog.all().add(LAUTARO))
                .isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void statsOfReturnsImmutableList() {
        SeasonStats stats = new SeasonStats("1", "2025-26", 30, 6.2, 2, 1, 5, 0, 0, 0, 0, 0, 0);
        assertThatThrownBy(() -> catalog.statsOf("1").add(stats))
                .isInstanceOf(UnsupportedOperationException.class);
    }
}
