package com.fantaagent.application.service.auction;

import com.fantaagent.application.port.out.AuctionEventStore;
import com.fantaagent.application.service.league.LeagueAccess;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.player.Role;
import com.fantaagent.testsupport.PortalWorld;
import com.fantaagent.testsupport.SharedPostgres;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * La home con tante aste piene: 3 leghe, 10 aste ciascuna, 300 eventi per asta, sul
 * Postgres incorporato dietro un pool come in produzione (il DataSource dei test
 * Spring apre una connessione per query, e misurerebbe quella). Misura cio' che fa
 * {@code GET /api/auctions} — le leghe dell'utente, poi le sue aste — e controlla che
 * i numeri della home siano quelli dell'elenco delle aste della lega.
 */
class MyAuctionsTimingTest {

    private static final int LEAGUES = 3;
    private static final int AUCTIONS_PER_LEAGUE = 10;
    private static final int EVENTS_PER_AUCTION = 300;
    private static final int RUNS = 30;

    private HikariDataSource pool;
    private PortalWorld world;
    private UUID bruno;
    private final List<UUID> leagueIds = new ArrayList<>();

    @BeforeEach
    void setUp() {
        HikariConfig config = new HikariConfig();
        config.setDataSource(SharedPostgres.migratedDatabase());
        config.setMaximumPoolSize(4);
        pool = new HikariDataSource(config);
        world = new PortalWorld(pool);

        LeagueAccess first = world.league("anna", "bruno", "carla");
        UUID anna = first.userId();
        bruno = world.userId(first, "bruno FC");
        UUID carla = world.userId(first, "carla FC");
        leagueIds.add(first.leagueId());
        for (int l = 1; l < LEAGUES; l++) {
            LeagueAccess other = world.leagues.create(anna, "Lega " + l, "anna FC", "A");
            world.join(other, bruno, "bruno");
            world.join(other, carla, "carla");
            leagueIds.add(other.leagueId());
        }
        String[] buyers = {anna.toString(), bruno.toString(), carla.toString()};
        for (UUID leagueId : leagueIds) {
            LeagueAccess admin = world.leagues.access(leagueId, anna);
            for (int a = 0; a < AUCTIONS_PER_LEAGUE; a++) {
                fill(world.stores.open(world.auctions.create(admin, "Asta " + a).id(), anna), buyers);
            }
        }
    }

    /** Acquisti, con qualche annullamento, correzione e cambio di fase in mezzo. */
    private static void fill(AuctionEventStore store, String[] buyers) {
        Instant at = Instant.parse("2026-09-01T20:00:00Z");
        for (long seq = 2; seq <= EVENTS_PER_AUCTION; seq++) {
            at = at.plusSeconds(30);
            AuctionEvent event;
            if (seq % 50 == 0) {
                event = new AuctionEvent.PhaseAdvanced(seq, at, Role.values()[(int) (seq / 50) % 4]);
            } else if (seq % 17 == 0) {
                event = new AuctionEvent.PurchaseRevoked(seq, at, seq - 1);
            } else if (seq % 13 == 0) {
                event = new AuctionEvent.PurchaseCorrected(seq, at, seq - 1, buyers[(int) (seq % 3)], 7);
            } else {
                event = new AuctionEvent.PlayerPurchased(seq, at, "G" + seq, buyers[(int) (seq % 3)],
                        1 + (int) (seq % 9));
            }
            store.append(event);
        }
    }

    @AfterEach
    void tearDown() {
        pool.close();
    }

    private List<MyAuction> home() {
        return world.auctions.mine(world.leagues.mine(bruno));
    }

    @Test
    void laHomeConTrentaAstePieneRispondeInFrettaEConINumeriDellElenco() {
        for (int i = 0; i < 10; i++) {
            home();
        }
        long[] nanos = new long[RUNS];
        for (int i = 0; i < RUNS; i++) {
            long start = System.nanoTime();
            home();
            nanos[i] = System.nanoTime() - start;
        }
        Arrays.sort(nanos);
        double median = nanos[RUNS / 2] / 1e6;
        System.out.printf("home, %d aste x %d eventi: mediana %.1f ms, min %.1f ms, max %.1f ms%n",
                LEAGUES * AUCTIONS_PER_LEAGUE, EVENTS_PER_AUCTION, median, nanos[0] / 1e6, nanos[RUNS - 1] / 1e6);

        List<MyAuction> mine = home();
        assertThat(mine).hasSize(LEAGUES * AUCTIONS_PER_LEAGUE);
        Map<UUID, MyAuction> byId = mine.stream().collect(Collectors.toMap(MyAuction::id, Function.identity()));
        for (UUID leagueId : leagueIds) {
            for (AuctionCard card : world.auctions.list(world.leagues.access(leagueId, bruno))) {
                MyAuction home = byId.get(card.id());
                List<AuctionEvent> events = world.stores.open(card.id(), bruno).load();
                assertThat(home.budgetRemaining()).isEqualTo(card.myBudgetRemaining())
                        .isEqualTo(card.budget() - LogSummary.spentBy(events, bruno.toString()));
                assertThat(home.phase()).isEqualTo(card.phase()).isEqualTo(LogSummary.phase(events, Role.P));
                assertThat(home.lastActivity()).isEqualTo(card.lastWritten())
                        .isEqualTo(LogSummary.lastWritten(events));
                assertThat(card.purchases()).isEqualTo(LogSummary.purchases(events));
                assertThat(home.slotsRemaining())
                        .isEqualTo(card.totalSlots() / card.teams() - LogSummary.playersOf(events, bruno.toString()).size());
                assertThat(home.status()).isEqualTo(AuctionStatus.of(card.purchases(), card.totalSlots()));
            }
        }
        assertThat(median).as("mediana della home in ms").isLessThan(50);
    }
}
