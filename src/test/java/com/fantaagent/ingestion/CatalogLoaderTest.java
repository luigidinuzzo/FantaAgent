package com.fantaagent.ingestion;

import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class CatalogLoaderTest {

    @TempDir
    Path tmp;

    private void writeListone(Path file, String... playerRow) throws Exception {
        try (XSSFWorkbook wb = new XSSFWorkbook(); OutputStream out = Files.newOutputStream(file)) {
            Sheet sheet = wb.createSheet("Tutti");
            Row header = sheet.createRow(0);
            String[] headers = {"Id", "R", "Nome", "Squadra", "Qt.A"};
            for (int c = 0; c < headers.length; c++) {
                header.createCell(c).setCellValue(headers[c]);
            }
            Row row = sheet.createRow(1);
            for (int c = 0; c < playerRow.length; c++) {
                row.createCell(c).setCellValue(playerRow[c]);
            }
            wb.write(out);
        }
    }

    private void writeStats(Path file, String[]... dataRows) throws Exception {
        try (XSSFWorkbook wb = new XSSFWorkbook(); OutputStream out = Files.newOutputStream(file)) {
            Sheet sheet = wb.createSheet("Tutti");
            String[] headers = {"Id", "R", "Rm", "Nome", "Squadra", "Pv", "Mv", "Fm", "Gf", "Gs", "Rp", "Rc",
                    "R+", "R-", "Ass", "Amm", "Esp", "Au"};
            Row header = sheet.createRow(0);
            for (int c = 0; c < headers.length; c++) {
                header.createCell(c).setCellValue(headers[c]);
            }
            for (int r = 0; r < dataRows.length; r++) {
                Row row = sheet.createRow(r + 1);
                for (int c = 0; c < dataRows[r].length; c++) {
                    row.createCell(c).setCellValue(dataRows[r][c]);
                }
            }
            wb.write(out);
        }
    }

    @Test
    void returnsAnEmptyCatalogWhenNoListoneIsPresent() {
        CatalogLoader.LoadedCatalog result = new CatalogLoader().load(tmp);

        assertThat(result.catalog().all()).isEmpty();
        assertThat(result.report().warnings()).anySatisfy(w -> assertThat(w).contains("Quotazioni"));
    }

    @Test
    void loadsTheQuotazioniFileDirectlyFromTheDataDir() throws Exception {
        writeListone(tmp.resolve("Quotazioni_Fantacalcio_Stagione_2026_27.xlsx"),
                "1", "D", "Bastoni", "Inter", "20");

        CatalogLoader.LoadedCatalog result = new CatalogLoader().load(tmp);

        assertThat(result.catalog().all()).hasSize(1);
    }

    @Test
    void picksTheLexicographicallyLastQuotazioniFileWhenSeveralMatch() throws Exception {
        writeListone(tmp.resolve("Quotazioni_Fantacalcio_Stagione_2025_26.xlsx"),
                "1", "D", "Vecchio", "Inter", "20");
        writeListone(tmp.resolve("Quotazioni_Fantacalcio_Stagione_2026_27.xlsx"),
                "2", "D", "Nuovo", "Inter", "20");

        CatalogLoader.LoadedCatalog result = new CatalogLoader().load(tmp);

        assertThat(result.catalog().all()).hasSize(1);
        assertThat(result.catalog().all().getFirst().name()).isEqualTo("Nuovo");
    }

    @Test
    void joinsStatisticheFilesToTheListoneById() throws Exception {
        writeListone(tmp.resolve("Quotazioni_Fantacalcio_Stagione_2026_27.xlsx"),
                "1", "D", "Bastoni", "Inter", "20");
        writeStats(tmp.resolve("Statistiche_Fantacalcio_Stagione_2025_26.xlsx"),
                new String[]{"1", "D", "Rm", "Bastoni", "Inter", "30", "6.15", "6.30", "2", "0", "0", "0",
                        "0", "0", "3", "5", "0", "0"});

        CatalogLoader.LoadedCatalog result = new CatalogLoader().load(tmp);

        assertThat(result.catalog().statsOf("1")).hasSize(1);
        assertThat(result.catalog().statsOf("1").getFirst().season()).isEqualTo("2025-26");
    }

    @Test
    void reportsStatsRowsWhoseIdLeftTheListoneWithoutAborting() throws Exception {
        writeListone(tmp.resolve("Quotazioni_Fantacalcio_Stagione_2026_27.xlsx"),
                "1", "D", "Bastoni", "Inter", "20");
        writeStats(tmp.resolve("Statistiche_Fantacalcio_Stagione_2024_25.xlsx"),
                new String[]{"99", "A", "Pc", "Trasferito", "Estero", "10", "6.00", "6.00", "1", "0", "0",
                        "0", "0", "0", "0", "0", "0", "0"});

        CatalogLoader.LoadedCatalog result = new CatalogLoader().load(tmp);

        assertThat(result.catalog().statsOf("99")).isEmpty();
        assertThat(result.report().warnings()).anySatisfy(w -> assertThat(w).contains("99"));
    }

    @Test
    void skipsWithAWarningAStatisticheFileWhoseNameDoesNotFitTheSeasonPattern() throws Exception {
        writeListone(tmp.resolve("Quotazioni_Fantacalcio_Stagione_2026_27.xlsx"),
                "1", "D", "Bastoni", "Inter", "20");
        writeStats(tmp.resolve("Statistiche_SenzaAnno.xlsx"),
                new String[]{"1", "D", "Rm", "Bastoni", "Inter", "30", "6.15", "6.30", "2", "0", "0", "0",
                        "0", "0", "3", "5", "0", "0"});

        CatalogLoader.LoadedCatalog result = new CatalogLoader().load(tmp);

        assertThat(result.catalog().statsOf("1")).isEmpty();
        assertThat(result.report().warnings())
                .anySatisfy(w -> assertThat(w).contains("Statistiche_SenzaAnno.xlsx"));
    }
}
