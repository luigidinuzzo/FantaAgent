package com.fantaagent.ingestion;

import com.fantaagent.adapter.out.file.InMemoryPlayerCatalog;
import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.domain.player.SeasonStats;
import org.yaml.snakeyaml.Yaml;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;

/**
 * Carica il catalogo dai file di riferimento.
 *
 * <p>Convenzioni: il listone è {@code <dataDir>/reference/listone*.xlsx} — se più file
 * corrispondono si sceglie quello lessicograficamente ultimo, così un nome come
 * {@code listone-2027.xlsx} prevale su {@code listone-2026.xlsx}; ogni file
 * {@code <dataDir>/reference/stats-<stagione>.csv} è una stagione, la cui etichetta è
 * ricavata dal nome del file; {@code <dataDir>/reference/aliases.yaml}, se presente,
 * mappa un nome grezzo sull'id del listone. Se la directory o il listone non esistono
 * il catalogo torna vuoto: sarà {@link com.fantaagent.config.StartupValidator} a
 * decidere se questo è bloccante (lo è fuori dal profilo dev).
 */
public class CatalogLoader {

    public record LoadedCatalog(PlayerCatalog catalog, ReconciliationReport report) {
    }

    public LoadedCatalog load(Path dataDir) {
        Path reference = dataDir.resolve("reference");
        Optional<Path> listone = findListone(reference);
        if (listone.isEmpty()) {
            return new LoadedCatalog(new InMemoryPlayerCatalog(List.of(), List.of()),
                    new ReconciliationReport(
                            List.of("nessun file listone*.xlsx trovato in " + reference
                                    + " — catalogo vuoto"), 0, 0));
        }

        ListoneImporter.ListoneImport listoneImport = new ListoneImporter().importFrom(listone.get());
        Map<String, String> aliases = loadAliases(reference.resolve("aliases.yaml"));
        NameResolver resolver = new NameResolver(listoneImport.players(), aliases);

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

    /** Il file {@code listone*.xlsx} lessicograficamente ultimo nella directory, se ce n'è uno. */
    private Optional<Path> findListone(Path reference) {
        if (!Files.isDirectory(reference)) {
            return Optional.empty();
        }
        try (Stream<Path> files = Files.list(reference)) {
            return files
                    .filter(p -> p.getFileName().toString().startsWith("listone"))
                    .filter(p -> p.getFileName().toString().endsWith(".xlsx"))
                    .max(java.util.Comparator.comparing(p -> p.getFileName().toString()));
        } catch (IOException e) {
            throw new IllegalStateException("impossibile elencare " + reference, e);
        }
    }

    /**
     * Alias espliciti da {@code aliases.yaml}: una mappa piatta nome-grezzo -> id.
     * File assente = mappa vuota; file malformato fallisce in modo rumoroso, perché un
     * alias silenziosamente ignorato lascerebbe irrisolto un nome che l'utente crede
     * già corretto.
     */
    private Map<String, String> loadAliases(Path aliasesFile) {
        if (!Files.exists(aliasesFile)) {
            return Map.of();
        }
        try (InputStream in = Files.newInputStream(aliasesFile)) {
            Object loaded = new Yaml().load(in);
            if (loaded == null) {
                return Map.of();
            }
            if (!(loaded instanceof Map<?, ?> raw)) {
                throw new IllegalStateException(
                        "aliases.yaml malformato: atteso un mapping nome -> id, trovato " + aliasesFile);
            }
            Map<String, String> aliases = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : raw.entrySet()) {
                if (!(entry.getKey() instanceof String key) || !(entry.getValue() instanceof String value)) {
                    throw new IllegalStateException(
                            "aliases.yaml malformato: voce non testuale in " + aliasesFile);
                }
                aliases.put(key, value);
            }
            return aliases;
        } catch (IOException e) {
            throw new IllegalStateException("impossibile leggere " + aliasesFile, e);
        } catch (org.yaml.snakeyaml.error.YAMLException e) {
            throw new IllegalStateException("aliases.yaml malformato: " + aliasesFile, e);
        }
    }
}
