package com.fantaagent.ingestion;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Individua la riga di intestazione di un foglio XLSX di Fantacalcio.it, che non è
 * sempre la prima: gli export ufficiali anteppongono spesso una riga di titolo prima
 * dell'intestazione vera e propria. Si scandiscono le prime righe finché non se ne trova
 * una che contiene tutte le colonne richieste; oltre quel limite si rinuncia, per non
 * scambiare per intestazione una riga di dati che contiene per caso gli stessi testi.
 */
final class SheetHeaderScanner {

    private SheetHeaderScanner() {
    }

    record HeaderLocation(Map<String, Integer> columns, int rowIndex) {
    }

    /** {@code null} se nessuna delle prime {@code maxScanRows} righe contiene tutte le colonne richieste. */
    static HeaderLocation find(Sheet sheet, List<String> required, int maxScanRows) {
        int lastRow = sheet.getLastRowNum();
        int scanLimit = Math.min(maxScanRows - 1, lastRow);
        for (int r = 0; r <= scanLimit; r++) {
            Row row = sheet.getRow(r);
            if (row == null) {
                continue;
            }
            Map<String, Integer> columns = readHeader(row);
            if (columns.keySet().containsAll(required)) {
                return new HeaderLocation(columns, r);
            }
        }
        return null;
    }

    static Map<String, Integer> readHeader(Row header) {
        Map<String, Integer> columns = new HashMap<>();
        for (int c = 0; c < header.getLastCellNum(); c++) {
            String name = stringValue(header.getCell(c)).toLowerCase(Locale.ROOT).trim();
            if (!name.isBlank()) {
                columns.put(name, c);
            }
        }
        return columns;
    }

    static String stringValue(Cell cell) {
        if (cell == null) {
            return "";
        }
        // Una cella FORMULA va letta dal suo risultato in cache, non dal testo della formula.
        CellType type = cell.getCellType() == CellType.FORMULA
                ? cell.getCachedFormulaResultType()
                : cell.getCellType();
        return switch (type) {
            case NUMERIC -> {
                double d = cell.getNumericCellValue();
                yield d == Math.rint(d) ? String.valueOf((long) d) : String.valueOf(d);
            }
            case STRING -> cell.getStringCellValue();
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            default -> "";
        };
    }
}
