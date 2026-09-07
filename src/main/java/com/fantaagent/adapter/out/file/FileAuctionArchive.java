package com.fantaagent.adapter.out.file;

import com.fantaagent.application.port.out.AuctionArchive;
import com.fantaagent.config.LeagueMembersSettingsStore;
import com.fantaagent.config.ScoringSettings;
import com.fantaagent.config.ScoringSettingsStore;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.application.port.out.AuctionEventStore;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

/**
 * Le aste sotto {@code <data-dir>/auctions}: una directory per asta, dentro il solo
 * {@code events.jsonl} (più eventuali backup {@code .bak}).
 *
 * <p>Questa classe non ha alcun metodo che cancelli, rinomini o tronchi: l'unico modo
 * di scrivere è l'append di {@link JsonlAuctionEventStore}. Selezionare o creare
 * un'asta, quindi, non può in nessun caso perdere un registro esistente.
 */
public class FileAuctionArchive implements AuctionArchive {

    static final String LOG_NAME = "events.jsonl";

    private final Path root;

    public FileAuctionArchive(Path dataDir) {
        this.root = dataDir.resolve("auctions");
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
        try {
            Files.createDirectories(directoryOf(auctionId));
        } catch (IOException e) {
            throw new UncheckedIOException("impossibile creare la cartella di " + auctionId, e);
        }
        membersOf(auctionId).save(participants);
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
        try {
            Files.createDirectories(directoryOf(auctionId));
        } catch (IOException e) {
            throw new UncheckedIOException("impossibile creare la cartella di " + auctionId, e);
        }
        new ScoringSettingsStore(directoryOf(auctionId)).save(settings);
    }

    private Path directoryOf(String auctionId) {
        String clean = auctionId == null ? "" : auctionId.trim();
        if (clean.isEmpty() || clean.contains("/") || clean.contains("\\") || clean.contains("..")) {
            throw new IllegalArgumentException("identificativo d'asta non valido: " + auctionId);
        }
        return root.resolve(clean);
    }
}
