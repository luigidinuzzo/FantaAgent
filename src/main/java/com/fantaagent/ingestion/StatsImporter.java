package com.fantaagent.ingestion;

import com.fantaagent.domain.player.SeasonStats;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Importa le statistiche di una stagione dal file XLSX ufficiale di Fantacalcio.it
 * (foglio "Tutti").
 *
 * <p>Il join con il listone avviene per Id, non per nome: è l'unico identificatore
 * esatto condiviso dai due file, e rimuove il rischio di ambiguità che il matching per
 * nome comporterebbe. Una riga il cui id non compare nel listone corrente appartiene a
 * un giocatore non più in Serie A — condizione normale, non un errore — e viene
 * segnalata nel report ma non contata fra gli scarti.
 *
 * <p>La colonna {@code Fm} (fantamedia) non viene letta: questa applicazione ricalcola
 * la fantamedia con le regole della propria lega, non con quelle della fonte. Non esiste
 * una colonna imbattuta nella fonte: {@link SeasonStats#cleanSheets()} è sempre 0.
 */
public class StatsImporter {

    private static final List<String> REQUIRED = List.of("id");

    /** L'export ufficiale antepone una riga di titolo all'intestazione vera e propria. */
    private static final int MAX_HEADER_SCAN_ROWS = 10;

    public record StatsImport(List<SeasonStats> stats, ReconciliationReport report) {
    }

    public StatsImport importFrom(Path xlsx, String season, Set<String> knownPlayerIds) {
        try (InputStream in = Files.newInputStream(xlsx); Workbook wb = new XSSFWorkbook(in)) {
            Sheet sheet = wb.getSheetAt(0);
            SheetHeaderScanner.HeaderLocation header = findHeader(sheet, xlsx);
            Map<String, Integer> columns = header.columns();

            List<SeasonStats> stats = new ArrayList<>();
            List<String> warnings = new ArrayList<>();
            int rejected = 0;
            for (int r = header.rowIndex() + 1; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null || isBlank(row, columns)) {
                    continue;
                }
                String id;
                try {
                    id = requireId(row, columns);
                } catch (RuntimeException e) {
                    rejected++;
                    warnings.add("riga " + (r + 1) + ": " + e.getMessage());
                    continue;
                }
                if (!knownPlayerIds.contains(id)) {
                    // Non e' un errore: il giocatore non e' (piu') nel listone corrente,
                    // tipicamente perche' ha lasciato la Serie A tra questa stagione e
                    // quella in corso. Le sue statistiche vengono semplicemente ignorate.
                    warnings.add("riga " + (r + 1) + ": id " + id
                            + " non presente nel listone corrente (probabile giocatore non"
                            + " piu' in Serie A) — statistiche ignorate");
                    continue;
                }
                try {
                    stats.add(toStats(row, columns, id, season));
                } catch (RuntimeException e) {
                    rejected++;
                    warnings.add("riga " + (r + 1) + ": " + e.getMessage());
                }
            }
            return new StatsImport(stats, new ReconciliationReport(warnings, stats.size(), rejected));
        } catch (IOException e) {
            throw new IllegalStateException("impossibile leggere le statistiche: " + xlsx, e);
        }
    }

    private static SheetHeaderScanner.HeaderLocation findHeader(Sheet sheet, Path xlsx) {
        SheetHeaderScanner.HeaderLocation header =
                SheetHeaderScanner.find(sheet, REQUIRED, MAX_HEADER_SCAN_ROWS);
        if (header != null) {
            return header;
        }
        Row first = sheet.getRow(0);
        Map<String, Integer> columns = first == null ? Map.of() : SheetHeaderScanner.readHeader(first);
        for (String required : REQUIRED) {
            if (!columns.containsKey(required)) {
                throw new IllegalStateException(
                        "colonna obbligatoria mancante nelle statistiche: "
                        + required.toUpperCase(Locale.ROOT));
            }
        }
        throw new IllegalStateException(
                "intestazione delle statistiche non trovata nelle prime " + MAX_HEADER_SCAN_ROWS
                + " righe: " + xlsx);
    }

    private static boolean isBlank(Row row, Map<String, Integer> columns) {
        for (Integer index : columns.values()) {
            if (!SheetHeaderScanner.stringValue(row.getCell(index)).isBlank()) {
                return false;
            }
        }
        return true;
    }

    private static String requireId(Row row, Map<String, Integer> columns) {
        String id = valueOf(row, columns, "id").trim();
        if (id.isBlank()) {
            throw new IllegalArgumentException("id mancante");
        }
        return id;
    }

    private static SeasonStats toStats(Row row, Map<String, Integer> columns, String id, String season) {
        return new SeasonStats(
                id, season,
                intOf(row, columns, "pv"),
                doubleOf(row, columns, "mv"),
                intOf(row, columns, "gf"),
                intOf(row, columns, "ass"),
                intOf(row, columns, "amm"),
                intOf(row, columns, "esp"),
                intOf(row, columns, "r+"),
                intOf(row, columns, "r-"),
                intOf(row, columns, "rp"),
                intOf(row, columns, "gs"),
                0); // nessuna colonna imbattuta nella fonte: non si stima, resta 0
    }

    private static String valueOf(Row row, Map<String, Integer> columns, String column) {
        Integer index = columns.get(column);
        return index == null ? "" : SheetHeaderScanner.stringValue(row.getCell(index));
    }

    private static int intOf(Row row, Map<String, Integer> columns, String column) {
        String raw = valueOf(row, columns, column).trim();
        if (raw.isBlank()) {
            return 0;
        }
        try {
            return (int) Math.round(parse(raw));
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(column.toUpperCase(Locale.ROOT) + " non numerico: " + raw);
        }
    }

    private static double doubleOf(Row row, Map<String, Integer> columns, String column) {
        String raw = valueOf(row, columns, column).trim();
        if (raw.isBlank()) {
            return 0.0;
        }
        try {
            return parse(raw);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(column.toUpperCase(Locale.ROOT) + " non numerico: " + raw);
        }
    }

    private static double parse(String raw) {
        return Double.parseDouble(raw.replace(',', '.'));
    }
}
