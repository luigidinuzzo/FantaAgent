package com.fantaagent.ingestion;

import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class NameResolverTest {

    private final List<Player> players = List.of(
            new Player("1", "Bastoni", "Inter", Role.D, 20),
            new Player("2", "Thuram M.", "Inter", Role.A, 35),
            new Player("3", "Dimarco", "Inter", Role.D, 22),
            new Player("4", "Gonzalez N.", "Juventus", Role.C, 18));

    private final NameResolver resolver = new NameResolver(players,
            Map.of("marcus thuram", "2"));

    @Test
    void normalizesCaseAccentsAndPunctuation() {
        assertThat(NameResolver.normalize("  Gonzàlez  N.  ")).isEqualTo("gonzalez n");
        assertThat(NameResolver.normalize("D'Ambrosio")).isEqualTo("dambrosio");
    }

    @Test
    void resolvesExactNormalizedMatch() {
        assertThat(resolver.resolve("BASTONI")).contains("1");
        assertThat(resolver.resolve("Thuram M.")).contains("2");
    }

    @Test
    void resolvesThroughExplicitAlias() {
        assertThat(resolver.resolve("Marcus Thuram")).contains("2");
    }

    @Test
    void resolvesSurnameWhenSourceOmitsInitial() {
        assertThat(resolver.resolve("Gonzalez")).contains("4");
    }

    @Test
    void toleratesSingleCharacterTypos() {
        assertThat(resolver.resolve("Bastony")).contains("1");
        assertThat(resolver.resolve("Dimarko")).contains("3");
    }

    @Test
    void returnsEmptyWhenNoConfidentMatchExists() {
        assertThat(resolver.resolve("Cristiano Ronaldo")).isEmpty();
    }

    @Test
    void returnsEmptyWhenSurnameIsAmbiguous() {
        NameResolver ambiguous = new NameResolver(List.of(
                new Player("10", "Thuram M.", "Inter", Role.A, 35),
                new Player("11", "Thuram K.", "Juventus", Role.C, 12)), Map.of());
        assertThat(ambiguous.resolve("Thuram")).isEmpty();
    }
}
