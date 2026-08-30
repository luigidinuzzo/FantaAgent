package com.fantaagent.ingestion;

import com.fantaagent.domain.player.Role;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class ListoneImporterTest {

    @TempDir
    Path tmp;

    private Path writeWorkbook(String[][] rows) throws Exception {
        Path file = tmp.resolve("listone.xlsx");
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
    void importsValidRows() throws Exception {
        Path file = writeWorkbook(new String[][]{
                {"Id", "R", "Nome", "Squadra", "Qt.A"},
                {"1", "D", "Bastoni", "Inter", "20"},
                {"2", "A", "Lautaro", "Inter", "40"}});

        ListoneImporter.ListoneImport result = new ListoneImporter().importFrom(file);

        assertThat(result.players()).hasSize(2);
        assertThat(result.players().getFirst().role()).isEqualTo(Role.D);
        assertThat(result.players().getFirst().listPrice()).isEqualTo(20);
        assertThat(result.report().clean()).isTrue();
    }

    @Test
    void toleratesColumnsInAnyOrderAndDifferentCase() throws Exception {
        Path file = writeWorkbook(new String[][]{
                {"squadra", "NOME", "qt.a", "id", "r"},
                {"Inter", "Bastoni", "20", "1", "D"}});

        ListoneImporter.ListoneImport result = new ListoneImporter().importFrom(file);

        assertThat(result.players()).hasSize(1);
        assertThat(result.players().getFirst().team()).isEqualTo("Inter");
    }

    @Test
    void rejectsBadRowsWithoutAbortingTheImport() throws Exception {
        Path file = writeWorkbook(new String[][]{
                {"Id", "R", "Nome", "Squadra", "Qt.A"},
                {"1", "D", "Bastoni", "Inter", "20"},
                {"2", "X", "Ignoto", "Inter", "10"},
                {"", "A", "SenzaId", "Inter", "10"},
                {"4", "A", "PrezzoRotto", "Inter", "n/d"}});

        ListoneImporter.ListoneImport result = new ListoneImporter().importFrom(file);

        assertThat(result.players()).hasSize(1);
        assertThat(result.report().rejected()).isEqualTo(3);
        assertThat(result.report().clean()).isFalse();
        assertThat(result.report().render()).contains("X").contains("n/d");
    }

    @Test
    void failsLoudlyWhenAMandatoryColumnIsMissing() throws Exception {
        Path file = writeWorkbook(new String[][]{
                {"Id", "Nome", "Squadra", "Qt.A"},
                {"1", "Bastoni", "Inter", "20"}});

        org.assertj.core.api.Assertions
                .assertThatThrownBy(() -> new ListoneImporter().importFrom(file))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("R");
    }
}
