package com.fantaagent.domain.search;

import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class PlayerSearchTest {

    private final List<Player> players = List.of(
            new Player("1", "Thuram M.", "Inter", Role.A, 35),
            new Player("2", "Thuram K.", "Juventus", Role.C, 12),
            new Player("3", "Bastoni", "Inter", Role.D, 20),
            new Player("4", "Dimarco", "Inter", Role.D, 22),
            new Player("5", "Gonzàlez N.", "Juventus", Role.C, 18),
            new Player("6", "Basto", "Lecce", Role.D, 1));

    private final Map<String, Double> relevance = Map.of(
            "1", 300.0, "2", 90.0, "3", 260.0, "4", 250.0, "5", 150.0, "6", 20.0);

    private final PlayerSearch search =
            new PlayerSearch(players, id -> relevance.getOrDefault(id, 0.0));

    @Test
    void normalizesAccentsAndPunctuation() {
        assertThat(TextNormalizer.normalize("Gonzàlez N.")).isEqualTo("gonzalez n");
        assertThat(TextNormalizer.normalize("  D'AMBROSIO ")).isEqualTo("dambrosio");
    }

    @Test
    void prefersTheMoreRelevantPlayerOnAnAmbiguousPrefix() {
        List<Player> results = search.search("th", null, 5);

        assertThat(results).isNotEmpty();
        assertThat(results.getFirst().id()).isEqualTo("1");
        assertThat(results).extracting(Player::id).contains("2");
    }

    @Test
    void anExactMatchOutranksALongerPrefixMatch() {
        List<Player> results = search.search("basto", null, 5);

        assertThat(results.getFirst().id()).isEqualTo("6");
    }

    @Test
    void toleratesTypos() {
        assertThat(search.search("bastony", null, 5))
                .extracting(Player::id).contains("3");
        assertThat(search.search("dimarko", null, 5))
                .extracting(Player::id).contains("4");
    }

    @Test
    void boostsPlayersOfTheRoleCurrentlyOnAuction() {
        List<Player> withoutBoost = search.search("th", null, 5);
        List<Player> withBoost = search.search("th", Role.C, 5);

        assertThat(withoutBoost.getFirst().id()).isEqualTo("1");
        assertThat(withBoost.getFirst().id()).isEqualTo("2");
    }

    @Test
    void respectsTheResultLimit() {
        assertThat(search.search("a", null, 2)).hasSizeLessThanOrEqualTo(2);
    }

    @Test
    void returnsNothingForABlankQuery() {
        assertThat(search.search("", null, 5)).isEmpty();
        assertThat(search.search("   ", null, 5)).isEmpty();
    }

    @Test
    void returnsNothingWhenNoPlayerMatches() {
        assertThat(search.search("zzzzzz", null, 5)).isEmpty();
    }
}
