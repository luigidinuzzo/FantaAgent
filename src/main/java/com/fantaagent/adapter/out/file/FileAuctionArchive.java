package com.fantaagent.adapter.out.file;

import com.fantaagent.application.port.out.AuctionArchive;
import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.AuctionSettingsStore;
import com.fantaagent.config.LeagueMembersSettingsStore;
import com.fantaagent.config.LeagueRulesSettings;
import com.fantaagent.config.LeagueRulesSettingsStore;
import com.fantaagent.config.ScoringSettings;
import com.fantaagent.config.ScoringSettingsStore;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.application.port.out.AuctionEventStore;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Clock;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

/**
 * Le aste sotto {@code <data-dir>/auctions}: una directory per asta, con il registro
 * {@code events.jsonl} (più eventuali backup {@code .bak}), partecipanti, punteggio,
 * regole della lega, preferenze del battitore e l'ultimo export {@code rose.csv}.
 *
 * <p>Questa classe non ha alcun metodo che tronchi o riscriva un registro: l'unico modo
 * di scriverlo è l'append di {@link JsonlAuctionEventStore}. {@link #delete} non
 * distrugge: sposta la cartella intera nel cestino. Selezionare o creare un'asta,
 * quindi, non può in nessun caso perdere un registro esistente.
 */
public class FileAuctionArchive implements AuctionArchive {

    static final String LOG_NAME = "events.jsonl";

    static final String EXPORT_NAME = "rose.csv";
    static final String TRASH_DIR = "auctions-cestino";
    private static final DateTimeFormatter TRASH_STAMP =
            DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss").withZone(ZoneOffset.UTC);

    private final Path root;
    private final Path trash;
    private final Clock clock;

    public FileAuctionArchive(Path dataDir) {
        this(dataDir, Clock.systemUTC());
    }

    public FileAuctionArchive(Path dataDir, Clock clock) {
        this.root = dataDir.resolve("auctions");
        this.trash = dataDir.resolve(TRASH_DIR);
        this.clock = clock;
    }


    @Override
    public List<String> auctionIds() {
        if (!Files.isDirectory(root)) {
            return List.of();
        }
        try (Stream<Path> entries = Files.list(root)) {
            List<String> ids = new ArrayList<>();
            entries.filter(Files::isDirectory)
                    .filter(dir -> Files.exists(dir.resolve(LOG_NAME)))
                    .map(dir -> dir.getFileName().toString())
                    .sorted()
                    .forEach(ids::add);
            return List.copyOf(ids);
        } catch (IOException e) {
            throw new UncheckedIOException("impossibile elencare le aste in " + root, e);
        }
    }

    /**
     * Esiste anche una directory senza log: è pur sempre uno spazio già occupato, e
     * {@code createNew} deve evitarla invece di scriverci dentro.
     */
    @Override
    public boolean exists(String auctionId) {
        return Files.exists(directoryOf(auctionId));
    }

    @Override
    public AuctionEventStore open(String auctionId) {
        return new JsonlAuctionEventStore(directoryOf(auctionId).resolve(LOG_NAME));
    }

    @Override
    public Optional<Instant> lastWritten(String auctionId) {
        Path log = directoryOf(auctionId).resolve(LOG_NAME);
        if (!Files.exists(log)) {
            return Optional.empty();
        }
        try {
            return Optional.of(Files.getLastModifiedTime(log).toInstant());
        } catch (IOException e) {
            throw new UncheckedIOException("impossibile leggere la data di " + log, e);
        }
    }

    /**
     * I partecipanti dell'asta, letti dal suo stesso file.
     *
     * <p>Riusa {@link LeagueMembersSettingsStore} puntandolo alla cartella dell'asta:
     * stesso formato e stesso parser della configurazione generale, quindi un file si
     * puo' copiare dall'una all'altra e non esistono due modi di scrivere la stessa
     * cosa che possano divergere.
     */
    @Override
    public Optional<List<Participant>> participants(String auctionId) {
        return membersOf(auctionId).load();
    }

    @Override
    public void saveParticipants(String auctionId, List<Participant> participants) {
        new LeagueMembersSettingsStore(ensureDirectory(auctionId)).save(participants);
    }

    private LeagueMembersSettingsStore membersOf(String auctionId) {
        return new LeagueMembersSettingsStore(directoryOf(auctionId));
    }

    @Override
    public Optional<ScoringSettings> scoring(String auctionId) {
        return new ScoringSettingsStore(directoryOf(auctionId)).load();
    }

    @Override
    public void saveScoring(String auctionId, ScoringSettings settings) {
        new ScoringSettingsStore(ensureDirectory(auctionId)).save(settings);
    }

    @Override
    public Optional<LeagueRulesSettings> rules(String auctionId) {
        return new LeagueRulesSettingsStore(directoryOf(auctionId)).load();
    }

    @Override
    public void saveRules(String auctionId, LeagueRulesSettings settings) {
        new LeagueRulesSettingsStore(ensureDirectory(auctionId)).save(settings);
    }

    @Override
    public Optional<AuctionSettings> bidder(String auctionId) {
        return new AuctionSettingsStore(directoryOf(auctionId)).load();
    }

    @Override
    public void saveBidder(String auctionId, AuctionSettings settings) {
        new AuctionSettingsStore(ensureDirectory(auctionId)).save(settings);
    }

    @Override
    public void saveExport(String auctionId, String csv) {
        Path file = ensureDirectory(auctionId).resolve(EXPORT_NAME);
        try {
            Files.writeString(file, csv, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException("impossibile scrivere " + file, e);
        }
    }

    /**
     * Deroga dichiarata a "questa classe non cancella": non distrugge, sposta. La
     * cartella esce da {@code auctions/} e l'id torna libero; rimetterla a mano la
     * recupera. Una {@code Files.move} sullo stesso filesystem e' atomica: se fallisce,
     * la cartella e' ancora al suo posto.
     */
    @Override
    public void delete(String auctionId) {
        Path source = directoryOf(auctionId);
        if (!Files.isDirectory(source)) {
            throw new IllegalArgumentException("nessuna asta con identificativo " + auctionId);
        }
        Path target = trash.resolve(auctionId + "-" + TRASH_STAMP.format(clock.instant()));
        try {
            Files.createDirectories(trash);
            Files.move(source, target, StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException e) {
            throw new UncheckedIOException("impossibile spostare " + source + " nel cestino", e);
        }
    }

    private Path ensureDirectory(String auctionId) {
        Path dir = directoryOf(auctionId);
        try {
            Files.createDirectories(dir);
        } catch (IOException e) {
            throw new UncheckedIOException("impossibile creare la cartella di " + auctionId, e);
        }
        return dir;
    }

    private Path directoryOf(String auctionId) {
        String clean = auctionId == null ? "" : auctionId.trim();
        if (clean.isEmpty() || clean.contains("/") || clean.contains("\\") || clean.contains("..")) {
            throw new IllegalArgumentException("identificativo d'asta non valido: " + auctionId);
        }
        return root.resolve(clean);
    }
}
