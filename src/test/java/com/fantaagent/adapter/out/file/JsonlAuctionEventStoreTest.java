package com.fantaagent.adapter.out.file;

import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class JsonlAuctionEventStoreTest {

    @TempDir
    Path tmp;

    private static final Instant T = Instant.parse("2026-09-05T20:00:00Z");

    @Test
    void startsEmptyWhenTheFileDoesNotExist() {
        JsonlAuctionEventStore store = new JsonlAuctionEventStore(tmp.resolve("events.jsonl"));

        assertThat(store.load()).isEmpty();
        assertThat(store.nextSeq()).isEqualTo(1L);
    }

    @Test
    void appendsAndReloadsEveryEventType() {
        Path file = tmp.resolve("events.jsonl");
        JsonlAuctionEventStore store = new JsonlAuctionEventStore(file);

        store.append(new AuctionEvent.AuctionStarted(1, T));
        store.append(new AuctionEvent.PhaseAdvanced(2, T, Role.D));
        store.append(new AuctionEvent.PlayerPurchased(3, T, "bastoni", "me", 47));
        store.append(new AuctionEvent.PurchaseCorrected(4, T, 3, "marco", 45));
        store.append(new AuctionEvent.PurchaseRevoked(5, T, 3));

        List<AuctionEvent> reloaded = new JsonlAuctionEventStore(file).load();

        assertThat(reloaded).containsExactly(
                new AuctionEvent.AuctionStarted(1, T),
                new AuctionEvent.PhaseAdvanced(2, T, Role.D),
                new AuctionEvent.PlayerPurchased(3, T, "bastoni", "me", 47),
                new AuctionEvent.PurchaseCorrected(4, T, 3, "marco", 45),
                new AuctionEvent.PurchaseRevoked(5, T, 3));
    }

    @Test
    void writesOneJsonObjectPerLine() throws Exception {
        Path file = tmp.resolve("events.jsonl");
        JsonlAuctionEventStore store = new JsonlAuctionEventStore(file);
        store.append(new AuctionEvent.PlayerPurchased(1, T, "bastoni", "me", 47));
        store.append(new AuctionEvent.PlayerPurchased(2, T, "dimarco", "me", 40));

        List<String> lines = Files.readAllLines(file);

        assertThat(lines).hasSize(2);
        assertThat(lines.getFirst()).startsWith("{").endsWith("}").contains("\"bastoni\"");
    }

    @Test
    void nextSeqContinuesAfterTheLastPersistedEvent() {
        Path file = tmp.resolve("events.jsonl");
        JsonlAuctionEventStore store = new JsonlAuctionEventStore(file);
        store.append(new AuctionEvent.PlayerPurchased(1, T, "bastoni", "me", 47));
        store.append(new AuctionEvent.PlayerPurchased(2, T, "dimarco", "me", 40));

        assertThat(store.nextSeq()).isEqualTo(3L);
        assertThat(new JsonlAuctionEventStore(file).nextSeq()).isEqualTo(3L);
    }

    @Test
    void backupCopiesTheWholeLogUnderALabelledName() {
        Path file = tmp.resolve("events.jsonl");
        JsonlAuctionEventStore store = new JsonlAuctionEventStore(file);
        store.append(new AuctionEvent.PlayerPurchased(1, T, "bastoni", "me", 47));

        store.backup("fine-P");

        Path backup = tmp.resolve("events-fine-P.jsonl.bak");
        assertThat(backup).exists();
        assertThat(new JsonlAuctionEventStore(backup).load()).hasSize(1);
    }

    @Test
    void backupIsANoOpWhenThereIsNothingToCopy() {
        JsonlAuctionEventStore store = new JsonlAuctionEventStore(tmp.resolve("events.jsonl"));

        store.backup("vuoto");

        assertThat(tmp.resolve("events-vuoto.jsonl.bak")).doesNotExist();
    }

    @Test
    void survivesAProcessRestartAfterEveryAppend() {
        Path file = tmp.resolve("events.jsonl");
        // Ogni append apre, scrive, forza su disco e chiude: simuliamo 50 crash.
        for (int i = 1; i <= 50; i++) {
            JsonlAuctionEventStore store = new JsonlAuctionEventStore(file);
            store.append(new AuctionEvent.PlayerPurchased(store.nextSeq(), T, "p" + i, "me", 1));
        }
        assertThat(new JsonlAuctionEventStore(file).load()).hasSize(50);
    }
}
