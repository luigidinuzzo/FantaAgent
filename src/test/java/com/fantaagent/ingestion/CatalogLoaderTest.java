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
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CatalogLoaderTest {

    @TempDir
    Path tmp;

    private Path reference() throws Exception {
        Path reference = tmp.resolve("reference");
        Files.createDirectories(reference);
        return reference;
    }

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

    @Test
    void returnsAnEmptyCatalogWhenNoListoneIsPresent() {
        CatalogLoader.LoadedCatalog result = new CatalogLoader().load(tmp);

        assertThat(result.catalog().all()).isEmpty();
        assertThat(result.report().warnings()).anySatisfy(w -> assertThat(w).contains("listone"));
    }

    @Test
    void loadsAFileNamedListoneXlsxExactly() throws Exception {
        Path reference = reference();
        writeListone(reference.resolve("listone.xlsx"), "1", "D", "Bastoni", "Inter", "20");

        CatalogLoader.LoadedCatalog result = new CatalogLoader().load(tmp);

        assertThat(result.catalog().all()).hasSize(1);
    }

    @Test
    void picksTheLexicographicallyLastListoneWhenSeveralMatch() throws Exception {
        Path reference = reference();
        writeListone(reference.resolve("listone-2025.xlsx"), "1", "D", "Vecchio", "Inter", "20");
        writeListone(reference.resolve("listone-2026.xlsx"), "2", "D", "Nuovo", "Inter", "20");

        CatalogLoader.LoadedCatalog result = new CatalogLoader().load(tmp);

        assertThat(result.catalog().all()).hasSize(1);
        assertThat(result.catalog().all().getFirst().name()).isEqualTo("Nuovo");
    }

    @Test
    void resolvesAnAliasFromAliasesYaml() throws Exception {
        Path reference = reference();
        writeListone(reference.resolve("listone-2026.xlsx"), "1", "D", "Thuram M.", "Inter", "35");
        Files.writeString(reference.resolve("aliases.yaml"), "Marcus Thuram: \"1\"\n");
        Files.writeString(reference.resolve("stats-2025.csv"),
                "Nome,Pv,Mv,Gf,Ass,Amm,Esp,Rp,Rc,Rs,Gs,Imb\n"
                + "Marcus Thuram,30,6.50,10,5,2,0,0,0,0,0,0\n");

        CatalogLoader.LoadedCatalog result = new CatalogLoader().load(tmp);

        assertThat(result.catalog().statsOf("1")).isNotEmpty();
    }

    @Test
    void failsLoudlyOnAMalformedAliasesFile() throws Exception {
        Path reference = reference();
        writeListone(reference.resolve("listone.xlsx"), "1", "D", "Bastoni", "Inter", "20");
        Files.writeString(reference.resolve("aliases.yaml"), "- non\n- e un mapping\n");

        assertThatThrownBy(() -> new CatalogLoader().load(tmp))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("aliases.yaml");
    }

    @Test
    void aMissingAliasesFileIsNotAnError() throws Exception {
        reference();
        writeListone(tmp.resolve("reference").resolve("listone.xlsx"), "1", "D", "Bastoni", "Inter", "20");

        assertThat(new CatalogLoader().load(tmp).catalog().all()).hasSize(1);
    }
}
