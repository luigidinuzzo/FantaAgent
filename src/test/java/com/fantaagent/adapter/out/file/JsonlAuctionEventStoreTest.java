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
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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
    void loadFailsNamingTheFileAndTheLineOfAnUnknownEventType() throws Exception {
        Path file = tmp.resolve("events.jsonl");
        JsonlAuctionEventStore store = new JsonlAuctionEventStore(file);
        store.append(new AuctionEvent.PlayerPurchased(1, T, "bastoni", "me", 47));
        // Riga 2 corrotta: tipo di evento sconosciuto, come un log scritto da un'altra versione.
        Files.writeString(file,
                "{\"type\":\"NonEsiste\",\"seq\":2,\"at\":\"2026-09-05T20:00:00Z\"}\n",
                java.nio.file.StandardOpenOption.APPEND);

        assertThatThrownBy(store::load)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining(file.toString())
                .hasMessageContaining("riga 2");
    }

    /**
     * S9: nextSeq() è leggi-l'ultimo-poi-più-uno, senza lock — due chiamate in overlap
     * possono calcolare lo stesso seq, e l'ultimo append vince silenziosamente
     * sull'altro nella proiezione (che chiave le mappe sul seq), pur restando
     * entrambi nel log su disco. Il refresh in background del pannello di fase e le
     * nuove vie di scrittura (/assign, /riepilogo/revoca) rendono le scritture in
     * overlap una situazione ordinaria, non più un caso limite da laboratorio.
     * {@code appendWithNextSeq} deve garantire seq tutti distinti anche con molte
     * scritture concorrenti dallo stesso processo.
     */
    @Test
    void appendWithNextSeqAssignsDistinctSeqsUnderConcurrentWrites() throws Exception {
        Path file = tmp.resolve("events.jsonl");
        JsonlAuctionEventStore store = new JsonlAuctionEventStore(file);

        int writers = 20;
        java.util.concurrent.ExecutorService pool = java.util.concurrent.Executors.newFixedThreadPool(writers);
        java.util.concurrent.CountDownLatch ready = new java.util.concurrent.CountDownLatch(writers);
        java.util.concurrent.CountDownLatch go = new java.util.concurrent.CountDownLatch(1);
        List<java.util.concurrent.Future<AuctionEvent>> results = new java.util.ArrayList<>();
        try {
            for (int i = 0; i < writers; i++) {
                String playerId = "p" + i;
                results.add(pool.submit(() -> {
                    ready.countDown();
                    go.await();
                    return store.appendWithNextSeq(
                            seq -> new AuctionEvent.PlayerPurchased(seq, T, playerId, "me", 1));
                }));
            }
            ready.await();
            go.countDown();
        } finally {
            pool.shutdown();
        }

        List<Long> assignedSeqs = new java.util.ArrayList<>();
        for (java.util.concurrent.Future<AuctionEvent> result : results) {
            assignedSeqs.add(result.get().seq());
        }

        assertThat(assignedSeqs).doesNotHaveDuplicates().hasSize(writers);
        assertThat(store.load()).hasSize(writers);
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
