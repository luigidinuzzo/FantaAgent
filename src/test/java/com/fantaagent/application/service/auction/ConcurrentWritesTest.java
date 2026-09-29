package com.fantaagent.application.service.auction;

import com.fantaagent.application.port.out.AuctionRecord;
import com.fantaagent.application.service.league.LeagueAccess;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.testsupport.Fixtures;
import com.fantaagent.testsupport.PortalWorld;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Due richieste vere, due thread, lo stesso Postgres: la chiave primaria e la
 * rivalidazione insieme fanno si' che nessun acquisto si perda e nessun giocatore
 * finisca in due rose.
 */
class ConcurrentWritesTest {

    @Test
    void acquistiInParalleloNonSiPerdonoENonSiDoppiano() throws Exception {
        PortalWorld world = new PortalWorld();
        AuctionRegistry registry = new AuctionRegistry(world.auctions, world.auctionRepository, world.stores,
                world.catalog, Fixtures.template(), List.of(1.0), PortalWorld.PHASES, world.tx);
        LeagueAccess admin = world.league("anna", "bruno");
        UUID bruno = world.userId(admin, "bruno FC");
        AuctionRecord auction = world.auctions.create(admin, "Asta");

        ExecutorService pool = Executors.newFixedThreadPool(4);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<?>> results = new ArrayList<>();
        for (int i = 1; i <= 8; i++) {
            String player = "D" + i;
            String buyer = (i % 2 == 0 ? admin.userId() : bruno).toString();
            results.add(pool.submit(() -> {
                start.await();
                AuctionView view = registry.view(admin, auction.id());
                return view.write(() -> view.service().recordPurchase(player, buyer, 2, "r-" + player));
            }));
        }
        // Lo stesso giocatore chiesto due volte in parallelo: uno solo lo prende.
        for (int i = 0; i < 2; i++) {
            results.add(pool.submit(() -> {
                start.await();
                AuctionView view = registry.view(admin, auction.id());
                return view.write(() -> view.service()
                        .recordPurchase("C1", bruno.toString(), 3, "r-C1-" + UUID.randomUUID()));
            }));
        }
        start.countDown();
        int failures = 0;
        for (Future<?> f : results) {
            try {
                f.get();
            } catch (java.util.concurrent.ExecutionException e) {
                failures++;
            }
        }
        pool.shutdown();

        List<AuctionEvent> events = world.stores.open(auction.id(), admin.userId()).load();
        assertThat(events).extracting(AuctionEvent::seq)
                .containsExactlyElementsOf(java.util.stream.LongStream.rangeClosed(1, events.size()).boxed().toList());
        assertThat(events).filteredOn(AuctionEvent.PlayerPurchased.class::isInstance).hasSize(9);
        assertThat(failures).isEqualTo(1);
    }
}
