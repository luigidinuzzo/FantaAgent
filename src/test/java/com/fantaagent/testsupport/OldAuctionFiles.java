package com.fantaagent.testsupport;

import com.fantaagent.adapter.out.file.FileAuctionArchive;
import com.fantaagent.application.port.out.AuctionEventStore;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.league.Participant;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

/**
 * La cartella di un'asta come la scriveva il jar di prima, scritta dallo stesso codice
 * che la scriveva allora, e letta come la manderebbe il browser: nome e contenuto.
 */
public final class OldAuctionFiles {

    private OldAuctionFiles() {
    }

    public static Map<String, byte[]> write(Path dataDir, List<Participant> participants, List<AuctionEvent> events) {
        FileAuctionArchive archive = new FileAuctionArchive(dataDir);
        archive.saveParticipants("vecchia", participants);
        AuctionEventStore store = archive.open("vecchia");
        events.forEach(store::append);
        return read(dataDir.resolve("auctions").resolve("vecchia"));
    }

    public static Map<String, byte[]> read(Path auctionDir) {
        Map<String, byte[]> files = new LinkedHashMap<>();
        try (Stream<Path> paths = Files.list(auctionDir)) {
            for (Path p : paths.filter(Files::isRegularFile).toList()) {
                files.put(p.getFileName().toString(), Files.readAllBytes(p));
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return files;
    }
}
