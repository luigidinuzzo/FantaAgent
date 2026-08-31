package com.fantaagent.ingestion;

import com.fantaagent.adapter.out.file.InMemoryPlayerCatalog;
import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.SeasonStats;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Carica il catalogo dai file ufficiali esportati da Fantacalcio.it.
 *
 * <p>Convenzioni: il listone è l'unico file {@code <dataDir>/Quotazioni_*.xlsx} — se più
 * file corrispondono si sceglie quello lessicograficamente ultimo, così un nome più
 * recente prevale; ogni file {@code <dataDir>/Statistiche_*.xlsx} è una stagione, la cui
 * etichetta è ricavata dal suffisso {@code <AAAA>_<AA>} del nome file (reso come
 * {@code AAAA-AA}). Il join fra listone e statistiche avviene per Id, l'identificatore
 * esatto condiviso dai due file — si veda {@link StatsImporter}. Se la directory o il
 * listone non esistono il catalogo torna vuoto: sarà {@link com.fantaagent.config.StartupValidator}
 * a decidere se questo è bloccante (lo è fuori dal profilo dev).
 */
public class CatalogLoader {

    private static final Pattern SEASON_SUFFIX = Pattern.compile("^Statistiche_.*_(\\d{4})_(\\d{2})\\.xlsx$");

    public record LoadedCatalog(PlayerCatalog catalog, ReconciliationReport report) {
    }

    public LoadedCatalog load(Path dataDir) {
        Optional<Path> listone = findListone(dataDir);
        if (listone.isEmpty()) {
            return new LoadedCatalog(new InMemoryPlayerCatalog(List.of(), List.of()),
                    new ReconciliationReport(
                            List.of("nessun file Quotazioni_*.xlsx trovato in " + dataDir
                                    + " — catalogo vuoto"), 0, 0));
        }

        ListoneImporter.ListoneImport listoneImport = new ListoneImporter().importFrom(listone.get());
        Set<String> knownPlayerIds = listoneImport.players().stream()
                .map(Player::id)
                .collect(Collectors.toCollection(HashSet::new));

        List<SeasonStats> allStats = new ArrayList<>();
        List<String> warnings = new ArrayList<>(listoneImport.report().warnings());
        int rejected = listoneImport.report().rejected();

        try (Stream<Path> files = Files.list(dataDir)) {
            List<Path> statFiles = files
                    .filter(p -> p.getFileName().toString().startsWith("Statistiche_"))
                    .filter(p -> p.getFileName().toString().endsWith(".xlsx"))
                    .sorted()
                    .toList();
            for (Path file : statFiles) {
                String fileName = file.getFileName().toString();
                Optional<String> season = seasonLabelOf(fileName);
                if (season.isEmpty()) {
                    warnings.add("file statistiche ignorato, nome non nel formato atteso "
                            + "Statistiche_..._<AAAA>_<AA>.xlsx: " + fileName);
                    continue;
                }
                StatsImporter.StatsImport imported =
                        new StatsImporter().importFrom(file, season.get(), knownPlayerIds);
                allStats.addAll(imported.stats());
                warnings.addAll(imported.report().warnings());
                rejected += imported.report().rejected();
            }
        } catch (IOException e) {
            throw new IllegalStateException("impossibile elencare " + dataDir, e);
        }

        PlayerCatalog catalog = new InMemoryPlayerCatalog(listoneImport.players(), allStats);
        return new LoadedCatalog(catalog,
                new ReconciliationReport(warnings, listoneImport.players().size(), rejected));
    }

    /** Il file {@code Quotazioni_*.xlsx} lessicograficamente ultimo nella directory, se ce n'è uno. */
    private Optional<Path> findListone(Path dataDir) {
        if (!Files.isDirectory(dataDir)) {
            return Optional.empty();
        }
        try (Stream<Path> files = Files.list(dataDir)) {
            return files
                    .filter(p -> p.getFileName().toString().startsWith("Quotazioni_"))
                    .filter(p -> p.getFileName().toString().endsWith(".xlsx"))
                    .max(Comparator.comparing(p -> p.getFileName().toString()));
        } catch (IOException e) {
            throw new IllegalStateException("impossibile elencare " + dataDir, e);
        }
    }

    /** Ricava l'etichetta di stagione {@code AAAA-AA} dal suffisso {@code _<AAAA>_<AA>.xlsx} del nome file. */
    private static Optional<String> seasonLabelOf(String fileName) {
        Matcher m = SEASON_SUFFIX.matcher(fileName);
        if (!m.matches()) {
            return Optional.empty();
        }
        return Optional.of(m.group(1) + "-" + m.group(2));
    }
}
