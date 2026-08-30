package com.fantaagent.ingestion;

import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import com.fantaagent.domain.player.SeasonStats;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class StatsImporterTest {

    @TempDir
    Path tmp;

    private final NameResolver resolver = new NameResolver(List.of(
            new Player("1", "Bastoni", "Inter", Role.D, 20),
            new Player("2", "Sommer", "Inter", Role.P, 15)), Map.of());

    private Path csv(String body) throws Exception {
        Path file = tmp.resolve("stats.csv");
        Files.writeString(file, body, StandardCharsets.UTF_8);
        return file;
    }

    @Test
    void importsResolvableRows() throws Exception {
        Path file = csv("""
                Nome,Pv,Mv,Gf,Ass,Amm,Esp,Rp,Rc,Rs,Gs,Imb
                Bastoni,30,6.15,2,3,5,0,0,0,0,0,0
                Sommer,34,6.40,0,0,1,0,2,0,0,38,12
                """);

        StatsImporter.StatsImport result =
                new StatsImporter().importFrom(file, "2025-26", resolver);

        assertThat(result.stats()).hasSize(2);
        SeasonStats bastoni = result.stats().getFirst();
        assertThat(bastoni.playerId()).isEqualTo("1");
        assertThat(bastoni.appearances()).isEqualTo(30);
        assertThat(bastoni.averageRating()).isEqualTo(6.15);
        assertThat(bastoni.assists()).isEqualTo(3);
        assertThat(result.stats().get(1).cleanSheets()).isEqualTo(12);
        assertThat(result.report().clean()).isTrue();
    }

    @Test
    void reportsUnresolvableNamesInsteadOfGuessing() throws Exception {
        Path file = csv("""
                Nome,Pv,Mv,Gf,Ass,Amm,Esp,Rp,Rc,Rs,Gs,Imb
                Bastoni,30,6.15,2,3,5,0,0,0,0,0,0
                Giocatore Inesistente,10,6.00,0,0,0,0,0,0,0,0,0
                """);

        StatsImporter.StatsImport result =
                new StatsImporter().importFrom(file, "2025-26", resolver);

        assertThat(result.stats()).hasSize(1);
        assertThat(result.report().rejected()).isEqualTo(1);
        assertThat(result.report().render()).contains("Giocatore Inesistente");
    }

    @Test
    void acceptsCommaAsDecimalSeparator() throws Exception {
        Path file = csv("""
                Nome,Pv,Mv,Gf,Ass,Amm,Esp,Rp,Rc,Rs,Gs,Imb
                Bastoni,30,"6,15",2,3,5,0,0,0,0,0,0
                """);

        StatsImporter.StatsImport result =
                new StatsImporter().importFrom(file, "2025-26", resolver);

        assertThat(result.stats().getFirst().averageRating()).isEqualTo(6.15);
    }

    @Test
    void mapsEachPenaltyColumnToItsOwnField() throws Exception {
        // Rs/Rc/Rp -> segnati/sbagliati/parati. Valori tutti diversi apposta: con
        // valori uguali una trasposizione fra le tre colonne passerebbe inosservata,
        // e falserebbe i punti attesi di ogni rigorista, cioe' i giocatori piu' cari.
        Path file = csv("""
                Nome,Pv,Mv,Gf,Ass,Amm,Esp,Rp,Rc,Rs,Gs,Imb
                Bastoni,30,6.15,7,0,0,0,3,2,5,0,0
                """);

        StatsImporter.StatsImport result =
                new StatsImporter().importFrom(file, "2025-26", resolver);

        SeasonStats stats = result.stats().getFirst();
        assertThat(stats.penaltiesScored()).isEqualTo(5);   // colonna Rs
        assertThat(stats.penaltiesMissed()).isEqualTo(2);   // colonna Rc
        assertThat(stats.penaltiesSaved()).isEqualTo(3);    // colonna Rp
        assertThat(stats.goals()).isEqualTo(7);
    }
}
