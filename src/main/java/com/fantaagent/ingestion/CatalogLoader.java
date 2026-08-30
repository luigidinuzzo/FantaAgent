package com.fantaagent.ingestion;

import com.fantaagent.adapter.out.file.InMemoryPlayerCatalog;
import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.domain.player.SeasonStats;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

/**
 * Carica il catalogo dai file di riferimento.
 *
 * <p>Convenzioni: il listone è {@code <dataDir>/reference/listone.xlsx}; ogni file
 * {@code <dataDir>/reference/stats-<stagione>.csv} è una stagione, la cui etichetta è
 * ricavata dal nome del file. Se la directory non esiste il catalogo è vuoto: le fasi
 * 1-3 devono poter girare prima che i file reali siano disponibili.
 */
public class CatalogLoader {

    public record LoadedCatalog(PlayerCatalog catalog, ReconciliationReport report) {
    }

    public LoadedCatalog load(Path dataDir) {
        Path reference = dataDir.resolve("reference");
        Path listone = reference.resolve("listone.xlsx");
        if (!Files.exists(listone)) {
            return new LoadedCatalog(new InMemoryPlayerCatalog(List.of(), List.of()),
                    new ReconciliationReport(
                            List.of("listone assente: " + listone + " — catalogo vuoto"), 0, 0));
        }

        ListoneImporter.ListoneImport listoneImport = new ListoneImporter().importFrom(listone);
        NameResolver resolver = new NameResolver(listoneImport.players(), Map.of());

        List<SeasonStats> allStats = new ArrayList<>();
        List<String> warnings = new ArrayList<>(listoneImport.report().warnings());
        int rejected = listoneImport.report().rejected();

        try (Stream<Path> files = Files.list(reference)) {
            List<Path> statFiles = files
                    .filter(p -> p.getFileName().toString().startsWith("stats-"))
                    .filter(p -> p.getFileName().toString().endsWith(".csv"))
                    .sorted()
                    .toList();
            for (Path file : statFiles) {
                String fileName = file.getFileName().toString();
                String season = fileName.substring("stats-".length(), fileName.length() - ".csv".length());
                StatsImporter.StatsImport imported =
                        new StatsImporter().importFrom(file, season, resolver);
                allStats.addAll(imported.stats());
                warnings.addAll(imported.report().warnings());
                rejected += imported.report().rejected();
            }
        } catch (IOException e) {
            throw new IllegalStateException("impossibile elencare " + reference, e);
        }

        PlayerCatalog catalog = new InMemoryPlayerCatalog(listoneImport.players(), allStats);
        return new LoadedCatalog(catalog,
                new ReconciliationReport(warnings, listoneImport.players().size(), rejected));
    }
}
