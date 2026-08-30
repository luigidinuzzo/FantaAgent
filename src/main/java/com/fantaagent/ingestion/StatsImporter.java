package com.fantaagent.ingestion;

import com.fantaagent.domain.player.SeasonStats;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;

import java.io.IOException;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public class StatsImporter {

    public record StatsImport(List<SeasonStats> stats, ReconciliationReport report) {
    }

    public StatsImport importFrom(Path csv, String season, NameResolver resolver) {
        CSVFormat format = CSVFormat.DEFAULT.builder()
                .setHeader()
                .setSkipHeaderRecord(true)
                .setIgnoreSurroundingSpaces(true)
                .setTrim(true)
                .build();

        List<SeasonStats> stats = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        int rejected = 0;

        try (Reader reader = Files.newBufferedReader(csv, StandardCharsets.UTF_8);
             CSVParser parser = CSVParser.parse(reader, format)) {
            for (CSVRecord record : parser) {
                String name = record.get("Nome");
                Optional<String> id = resolver.resolve(name);
                if (id.isEmpty()) {
                    rejected++;
                    warnings.add("nome non risolvibile: " + name);
                    continue;
                }
                stats.add(new SeasonStats(
                        id.get(), season,
                        intOf(record, "Pv"),
                        doubleOf(record, "Mv"),
                        intOf(record, "Gf"),
                        intOf(record, "Ass"),
                        intOf(record, "Amm"),
                        intOf(record, "Esp"),
                        intOf(record, "Rs"),
                        intOf(record, "Rc"),
                        intOf(record, "Rp"),
                        intOf(record, "Gs"),
                        intOf(record, "Imb")));
            }
        } catch (IOException e) {
            throw new IllegalStateException("impossibile leggere le statistiche: " + csv, e);
        }
        return new StatsImport(stats, new ReconciliationReport(warnings, stats.size(), rejected));
    }

    private static int intOf(CSVRecord record, String column) {
        String raw = record.get(column);
        return raw == null || raw.isBlank() ? 0 : (int) Math.round(parse(raw));
    }

    private static double doubleOf(CSVRecord record, String column) {
        String raw = record.get(column);
        return raw == null || raw.isBlank() ? 0.0 : parse(raw);
    }

    private static double parse(String raw) {
        return Double.parseDouble(raw.replace(',', '.'));
    }
}
