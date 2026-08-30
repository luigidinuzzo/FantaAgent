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
    void refusesToGuessOnATypoAndLeavesItForTheReconciliationReport() {
        // Un refuso di un carattere non deve produrre un match: il nome resta irrisolto
        // e finisce nel report di riconciliazione che l'utente corregge con un alias.
        assertThat(resolver.resolve("Bastony")).isEmpty();
        assertThat(resolver.resolve("Dimarko")).isEmpty();
    }

    @Test
    void refusesShortSurnamesThatDifferByOneCharacter() {
        // Cognomi brevi come Conte/Conti collidono a distanza 1: un match approssimato
        // qui produrrebbe una risposta sicura ma sbagliata, quindi il resolver rifiuta.
        NameResolver conteOnly = new NameResolver(
                List.of(new Player("50", "Conte A.", "Napoli", Role.C, 10)), Map.of());
        assertThat(conteOnly.resolve("Conti")).isEmpty();
    }

    @Test
    void refusesWhenTwoPlayersNormaliseToTheSameName() {
        // Due giocatori distinti con lo stesso nome normalizzato: il nome pieno da solo
        // non è più un identificatore univoco, quindi il match esatto deve rifiutare.
        NameResolver collidingNames = new NameResolver(List.of(
                new Player("60", "Rossi M.", "Empoli", Role.C, 5),
                new Player("61", "Rossi M.", "Genoa", Role.D, 6)), Map.of());
        assertThat(collidingNames.resolve("Rossi M.")).isEmpty();
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
