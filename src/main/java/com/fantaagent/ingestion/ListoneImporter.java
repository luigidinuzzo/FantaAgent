package com.fantaagent.ingestion;

import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public class ListoneImporter {

    private static final List<String> REQUIRED = List.of("id", "r", "nome", "squadra", "qt.a");

    public record ListoneImport(List<Player> players, ReconciliationReport report) {
    }

    public ListoneImport importFrom(Path xlsx) {
        try (InputStream in = Files.newInputStream(xlsx); Workbook wb = new XSSFWorkbook(in)) {
            Sheet sheet = wb.getSheetAt(0);
            Map<String, Integer> columns = readHeader(sheet.getRow(0));
            for (String required : REQUIRED) {
                if (!columns.containsKey(required)) {
                    throw new IllegalStateException(
                            "colonna obbligatoria mancante nel listone: " + required.toUpperCase(Locale.ROOT));
                }
            }
            List<Player> players = new ArrayList<>();
            List<String> warnings = new ArrayList<>();
            int rejected = 0;
            for (int r = 1; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null) {
                    continue;
                }
                try {
                    players.add(toPlayer(row, columns));
                } catch (RuntimeException e) {
                    rejected++;
                    warnings.add("riga " + (r + 1) + ": " + e.getMessage());
                }
            }
            return new ListoneImport(players, new ReconciliationReport(warnings, players.size(), rejected));
        } catch (IOException e) {
            throw new IllegalStateException("impossibile leggere il listone: " + xlsx, e);
        }
    }

    private static Map<String, Integer> readHeader(Row header) {
        if (header == null) {
            throw new IllegalStateException("il listone non ha una riga di intestazione");
        }
        Map<String, Integer> columns = new HashMap<>();
        for (int c = 0; c < header.getLastCellNum(); c++) {
            String name = stringValue(header.getCell(c)).toLowerCase(Locale.ROOT).trim();
            if (!name.isBlank()) {
                columns.put(name, c);
            }
        }
        return columns;
    }

    private static Player toPlayer(Row row, Map<String, Integer> columns) {
        String id = stringValue(row.getCell(columns.get("id"))).trim();
        if (id.isBlank()) {
            throw new IllegalArgumentException("id mancante");
        }
        String roleRaw = stringValue(row.getCell(columns.get("r"))).trim().toUpperCase(Locale.ROOT);
        Role role;
        try {
            role = Role.valueOf(roleRaw);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("ruolo sconosciuto: " + roleRaw);
        }
        String name = stringValue(row.getCell(columns.get("nome"))).trim();
        String team = stringValue(row.getCell(columns.get("squadra"))).trim();
        String priceRaw = stringValue(row.getCell(columns.get("qt.a"))).trim();
        int price;
        try {
            price = (int) Math.round(Double.parseDouble(priceRaw.replace(',', '.')));
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("quotazione non numerica: " + priceRaw);
        }
        return new Player(id, name, team, role, Math.max(1, price));
    }

    private static String stringValue(Cell cell) {
        if (cell == null) {
            return "";
        }
        if (cell.getCellType() == CellType.NUMERIC) {
            double d = cell.getNumericCellValue();
            return d == Math.rint(d) ? String.valueOf((long) d) : String.valueOf(d);
        }
        return cell.toString();
    }
}
