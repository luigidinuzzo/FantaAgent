package com.fantaagent.adapter.out.jdbc;

import com.fantaagent.application.port.out.ConcurrentAppendException;
import com.fantaagent.application.port.out.DuplicateRequestException;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.player.Role;
import com.fantaagent.testsupport.SharedPostgres;
import com.fantaagent.testsupport.TestRows;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JdbcAuctionEventStoreTest {

    private static final ObjectMapper JSON = JsonMapper.builder().addModule(new JavaTimeModule()).build();
    // Postgres conserva i microsecondi: un Instant coi nanosecondi non tornerebbe uguale.
    private static final Instant AT = Instant.parse("2026-09-28T20:15:30.123456Z");

    private JdbcClient jdbc;
    private UUID admin;
    private UUID auction;
    private JdbcAuctionEventStore store;

    @BeforeEach
    void setUp() {
        jdbc = JdbcClient.create(SharedPostgres.migratedDatabase());
        admin = TestRows.user(jdbc, "admin@example.com");
        auction = TestRows.auction(jdbc, TestRows.league(jdbc, admin), admin);
        store = new JdbcAuctionEventStore(jdbc, JSON, auction, admin);
    }

    @Test
    void ogniTipoDiEventoTornaIdentico() {
        store.append(new AuctionEvent.AuctionStarted(1, AT, "Asta"));
        store.append(new AuctionEvent.AuctionRenamed(2, AT, "Asta nuova"));
        store.append(new AuctionEvent.PhaseAdvanced(3, AT, Role.D));
        store.append(new AuctionEvent.PlayerPurchased(4, AT, "p1", "u1", 12, "r-1"));
        store.append(new AuctionEvent.PurchaseCorrected(5, AT, 4, "u2", 15));
        store.append(new AuctionEvent.PurchaseRevoked(6, AT, 4));

        assertThat(store.load()).containsExactly(
                new AuctionEvent.AuctionStarted(1, AT, "Asta"),
                new AuctionEvent.AuctionRenamed(2, AT, "Asta nuova"),
                new AuctionEvent.PhaseAdvanced(3, AT, Role.D),
                new AuctionEvent.PlayerPurchased(4, AT, "p1", "u1", 12, "r-1"),
                new AuctionEvent.PurchaseCorrected(5, AT, 4, "u2", 15),
                new AuctionEvent.PurchaseRevoked(6, AT, 4));
    }

    @Test
    void ilProssimoNumeroSegueLUltimo() {
        assertThat(store.nextSeq()).isEqualTo(1);
        store.appendWithNextSeq(seq -> new AuctionEvent.AuctionStarted(seq, AT, null));
        assertThat(store.nextSeq()).isEqualTo(2);
    }

    @Test
    void ogniAstaHaLaSuaNumerazione() {
        UUID other = TestRows.auction(jdbc, TestRows.league(jdbc, admin), admin);
        JdbcAuctionEventStore otherStore = new JdbcAuctionEventStore(jdbc, JSON, other, admin);
        store.append(new AuctionEvent.AuctionStarted(1, AT, "A"));
        otherStore.append(new AuctionEvent.AuctionStarted(1, AT, "B"));

        assertThat(store.load()).containsExactly(new AuctionEvent.AuctionStarted(1, AT, "A"));
        assertThat(otherStore.load()).containsExactly(new AuctionEvent.AuctionStarted(1, AT, "B"));
    }

    @Test
    void unNumeroGiaPresoEUnConflittoNonUnaSovrascrittura() {
        store.append(new AuctionEvent.AuctionStarted(1, AT, "A"));
        assertThatThrownBy(() -> store.append(new AuctionEvent.PhaseAdvanced(1, AT, Role.D)))
                .isInstanceOf(ConcurrentAppendException.class)
                .extracting(e -> ((ConcurrentAppendException) e).seq()).isEqualTo(1L);
        assertThat(store.load()).containsExactly(new AuctionEvent.AuctionStarted(1, AT, "A"));
    }

    @Test
    void unaRichiestaRipetutaESegnalataComeTale() {
        store.append(new AuctionEvent.PlayerPurchased(1, AT, "p1", "u1", 12, "r-1"));
        assertThatThrownBy(() -> store.append(
                new AuctionEvent.PlayerPurchased(2, AT, "p2", "u1", 3, "r-1")))
                .isInstanceOf(DuplicateRequestException.class)
                .extracting(e -> ((DuplicateRequestException) e).requestId()).isEqualTo("r-1");
    }

    @Test
    void chiScriveRestaSullaRiga() {
        store.append(new AuctionEvent.AuctionStarted(1, AT, "A"));
        assertThat(jdbc.sql("SELECT actor_id FROM auction_event").query(UUID.class).single())
                .isEqualTo(admin);
    }

    @Test
    void laDataSiConservaAlMicrosecondo() {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        store.append(new AuctionEvent.AuctionStarted(1, now, "A"));
        assertThat(store.load().getFirst().at()).isEqualTo(now);
    }
}
