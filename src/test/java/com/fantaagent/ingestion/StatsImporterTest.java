package com.fantaagent.ingestion;

import com.fantaagent.domain.player.SeasonStats;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class StatsImporterTest {

    @TempDir
    Path tmp;

    private static final String[] HEADER =
            {"Id", "R", "Rm", "Nome", "Squadra", "Pv", "Mv", "Fm", "Gf", "Gs", "Rp", "Rc", "R+", "R-",
                    "Ass", "Amm", "Esp", "Au"};

    private Path writeWorkbook(String[]... rows) throws Exception {
        Path file = tmp.resolve("statistiche.xlsx");
        try (XSSFWorkbook wb = new XSSFWorkbook(); OutputStream out = Files.newOutputStream(file)) {
            Sheet sheet = wb.createSheet("Tutti");
            for (int r = 0; r < rows.length; r++) {
                Row row = sheet.createRow(r);
                for (int c = 0; c < rows[r].length; c++) {
                    row.createCell(c).setCellValue(rows[r][c]);
                }
            }
            wb.write(out);
        }
        return file;
    }

    @Test
    void joinsRowsToTheirIdSkippingTheTitleRowAboveTheHeader() throws Exception {
        // Riga 0 = titolo dell'export, riga 1 = intestazione vera, dati da riga 2.
        Path file = writeWorkbook(
                new String[]{"Statistiche Fantacalcio 2025-26"},
                HEADER,
                new String[]{"1", "D", "Rm", "Bastoni", "Inter", "30", "6.15", "6.30", "2", "0", "0", "0", "0", "0", "3", "5", "0", "0"});

        StatsImporter.StatsImport result =
                new StatsImporter().importFrom(file, "2025-26", Set.of("1"));

        assertThat(result.stats()).hasSize(1);
        SeasonStats bastoni = result.stats().getFirst();
        assertThat(bastoni.playerId()).isEqualTo("1");
        assertThat(bastoni.season()).isEqualTo("2025-26");
        assertThat(bastoni.appearances()).isEqualTo(30);
        assertThat(bastoni.averageRating()).isEqualTo(6.15);
        assertThat(bastoni.goals()).isEqualTo(2);
        assertThat(bastoni.assists()).isEqualTo(3);
        assertThat(bastoni.yellowCards()).isEqualTo(5);
        assertThat(bastoni.cleanSheets()).isZero();
        assertThat(result.report().clean()).isTrue();
    }

    @Test
    void reportsRowsWhoseIdIsNoLongerInTheListoneWithoutTreatingItAsAnError() throws Exception {
        Path file = writeWorkbook(HEADER,
                new String[]{"1", "D", "Rm", "Bastoni", "Inter", "30", "6.15", "6.30", "2", "0", "0", "0", "0", "0", "3", "5", "0", "0"},
                new String[]{"99", "A", "Pc", "Trasferito", "Estero", "10", "6.00", "6.00", "1", "0", "0", "0", "0", "0", "0", "0", "0", "0"});

        StatsImporter.StatsImport result =
                new StatsImporter().importFrom(file, "2024-25", Set.of("1"));

        assertThat(result.stats()).hasSize(1);
        assertThat(result.report().rejected()).isZero();
        assertThat(result.report().warnings()).anySatisfy(w -> assertThat(w)
                .contains("99")
                .doesNotContain("errore"));
    }

    @Test
    void mapsEachPenaltyColumnToItsOwnField() throws Exception {
        // Rp/Rc/R+/R- -> parati/NON USATO/segnati/sbagliati. Valori tutti diversi
        // apposta: con valori uguali una trasposizione fra le colonne passerebbe
        // inosservata, e falserebbe i punti attesi dei rigoristi.
        Path file = writeWorkbook(HEADER,
                new String[]{"1", "P", "Pt", "Portiere", "Inter", "30", "6.20", "6.50", "0", "10", "3", "9", "5", "2",
                        "0", "0", "0", "1"});

        StatsImporter.StatsImport result =
                new StatsImporter().importFrom(file, "2025-26", Set.of("1"));

        SeasonStats stats = result.stats().getFirst();
        assertThat(stats.penaltiesSaved()).isEqualTo(3);   // colonna Rp
        assertThat(stats.penaltiesScored()).isEqualTo(5);  // colonna R+
        assertThat(stats.penaltiesMissed()).isEqualTo(2);  // colonna R-
        assertThat(stats.goalsConceded()).isEqualTo(10);   // colonna Gs
    }

    @Test
    void rejectsARowWithoutAnId() throws Exception {
        Path file = writeWorkbook(HEADER,
                new String[]{"", "D", "Rm", "SenzaId", "Inter", "30", "6.15", "6.30", "0", "0", "0", "0", "0", "0",
                        "0", "0", "0", "0"});

        StatsImporter.StatsImport result =
                new StatsImporter().importFrom(file, "2025-26", Set.of());

        assertThat(result.stats()).isEmpty();
        assertThat(result.report().rejected()).isEqualTo(1);
    }

    @Test
    void failsLoudlyWhenTheIdColumnIsMissing() throws Exception {
        Path file = writeWorkbook(
                new String[]{"R", "Nome", "Squadra", "Pv", "Mv"},
                new String[]{"D", "Bastoni", "Inter", "30", "6.15"});

        assertThatThrownBy(() -> new StatsImporter().importFrom(file, "2025-26", Set.of()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("ID");
    }
}
