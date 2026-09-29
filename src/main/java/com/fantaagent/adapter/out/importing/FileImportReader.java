package com.fantaagent.adapter.out.importing;

import com.fantaagent.adapter.out.file.FileAuctionArchive;
import com.fantaagent.application.port.out.AuctionTemplate;
import com.fantaagent.application.port.out.ImportedAuction;
import com.fantaagent.application.port.out.ImportedAuctionReader;
import com.fantaagent.application.service.importing.InvalidImportException;
import com.fantaagent.domain.auction.AuctionEvent;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;

/**
 * Legge la cartella di un'asta del jar di prima riusando {@link FileAuctionArchive}
 * cosi' com'e': i file si copiano in una cartella temporanea con la struttura che
 * l'archivio si aspetta, si leggono, e la cartella si cancella. L'archivio su file non
 * si estende; si usa soltanto, finche' esistono aste da portare dentro.
 */
public class FileImportReader implements ImportedAuctionReader {

    static final String ID = "importata";
    static final Set<String> ACCEPTED = Set.of("events.jsonl", "league-members.yml",
            "league-rules.yml", "league-settings.yml", "auction-settings.yml");

    private final AuctionTemplate template;

    public FileImportReader(AuctionTemplate template) {
        this.template = template;
    }

    @Override
    public ImportedAuction read(Map<String, byte[]> files) {
        if (!files.containsKey("events.jsonl")) {
            throw invalid("Manca il registro degli acquisti dell'asta.");
        }
        Path root = null;
        try {
            root = Files.createTempDirectory("fantaagent-import");
            Path dir = Files.createDirectories(root.resolve("auctions").resolve(ID));
            for (Map.Entry<String, byte[]> f : files.entrySet()) {
                if (ACCEPTED.contains(f.getKey())) {
                    Files.write(dir.resolve(f.getKey()), f.getValue());
                }
            }
            FileAuctionArchive archive = new FileAuctionArchive(root);
            List<AuctionEvent> events;
            try {
                events = archive.open(ID).load();
            } catch (RuntimeException e) {
                throw invalid("Il registro degli acquisti non si legge: è danneggiato o non viene da FantaAgent.");
            }
            try {
                return new ImportedAuction(nameOf(events),
                        archive.participants(ID).orElseGet(template::participants),
                        archive.rules(ID).orElseGet(template::rules),
                        archive.scoring(ID).orElseGet(template::scoring),
                        archive.bidder(ID).orElseGet(template::bidder),
                        events);
            } catch (RuntimeException e) {
                throw invalid("Le impostazioni dell'asta non si leggono: sono danneggiate o non vengono da FantaAgent.");
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        } finally {
            deleteQuietly(root);
        }
    }

    /** L'ultimo nome dato all'asta, o uno di ripiego per i registri che non ne hanno. */
    static String nameOf(List<AuctionEvent> events) {
        String name = null;
        for (AuctionEvent e : events) {
            if (e instanceof AuctionEvent.AuctionStarted s && s.name() != null && !s.name().isBlank()) {
                name = s.name();
            }
            if (e instanceof AuctionEvent.AuctionRenamed r) {
                name = r.name();
            }
        }
        return name == null ? "Asta importata" : name;
    }

    private static InvalidImportException invalid(String message) {
        return new InvalidImportException(Map.of("files", List.of(message)));
    }

    private static void deleteQuietly(Path root) {
        if (root == null) {
            return;
        }
        try (Stream<Path> paths = Files.walk(root)) {
            paths.sorted(Comparator.reverseOrder()).forEach(p -> p.toFile().delete());
        } catch (IOException ignored) {
            // una cartella temporanea rimasta non e' un errore di chi importa
        }
    }
}
