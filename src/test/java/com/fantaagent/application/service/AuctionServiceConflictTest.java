package com.fantaagent.application.service;

import com.fantaagent.adapter.out.file.InMemoryPlayerCatalog;
import com.fantaagent.application.port.out.AuctionEventStore;
import com.fantaagent.application.port.out.ConcurrentAppendException;
import com.fantaagent.application.port.out.DuplicateRequestException;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.function.LongFunction;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Cosa succede quando un'altra richiesta scrive fra la lettura e la scrittura. Lo
 * store di prova simula l'altra richiesta: al momento dell'append inserisce prima
 * l'evento "concorrente" e poi rifiuta il seq, esattamente come farebbe la chiave
 * primaria su Postgres.
 */
class AuctionServiceConflictTest {

    private static final LeagueRules RULES = new LeagueRules(2, 100,
            Map.of(Role.P, 1, Role.D, 1, Role.C, 1, Role.A, 1), List.of(Role.P, Role.D, Role.C, Role.A));
    private static final List<Participant> PEOPLE = List.of(
            new Participant("a", "Anna", 'A', true), new Participant("b", "Bruno", 'B', false));
    private static final InMemoryPlayerCatalog CATALOG = new InMemoryPlayerCatalog(List.of(
            new Player("p1", "Portiere Uno", "Inter", Role.P, 10),
            new Player("d1", "Difensore Uno", "Milan", Role.D, 10)), List.of());

    /** Uno store che, alle prime N scritture, si fa superare da un evento altrui. */
    static final class RacingStore extends InMemoryEventStore {
        final Deque<LongFunction<AuctionEvent>> intruders = new ArrayDeque<>();
        boolean duplicateOnce;

        @Override
        public AuctionEvent appendWithNextSeq(LongFunction<AuctionEvent> factory) {
            long seq = nextSeq();
            AuctionEvent mine = factory.apply(seq);
            if (!intruders.isEmpty()) {
                super.append(intruders.poll().apply(seq));
                throw new ConcurrentAppendException(seq, null);
            }
            if (duplicateOnce && mine instanceof AuctionEvent.PlayerPurchased p) {
                duplicateOnce = false;
                super.append(mine);
                throw new DuplicateRequestException(p.requestId());
            }
            super.append(mine);
            return mine;
        }
    }

    private static AuctionService service(RacingStore store) {
        store.append(new AuctionEvent.AuctionStarted(1, Instant.now(), "Asta"));
        return new AuctionService(RULES, PEOPLE, CATALOG, store);
    }

    @Test
    void dopoUnConflittoSiRifannoIControlliNonSiRiscriveAllaCieca() {
        RacingStore store = new RacingStore();
        AuctionService service = service(store);
        store.intruders.add(seq -> new AuctionEvent.PlayerPurchased(seq, Instant.now(), "p1", "b", 5));

        assertThatThrownBy(() -> service.recordPurchase("p1", "a", 7, "r-1"))
                .isInstanceOf(PurchaseRejectedException.class)
                .hasMessageContaining("già stato acquistato");
        assertThat(service.state().squadOf("b").playerIds()).containsExactly("p1");
    }

    @Test
    void seIlConflittoNonCambiaNienteLaScritturaPassaColNumeroDopo() {
        RacingStore store = new RacingStore();
        AuctionService service = service(store);
        store.intruders.add(seq -> new AuctionEvent.PhaseAdvanced(seq, Instant.now(), Role.D));

        AuctionEvent.PlayerPurchased written = service.recordPurchase("p1", "a", 7, "r-1");

        assertThat(written.seq()).isEqualTo(3);
        assertThat(service.version()).isEqualTo(3);
    }

    @Test
    void alTerzoConflittoSiArrende() {
        RacingStore store = new RacingStore();
        AuctionService service = service(store);
        for (int i = 0; i < 3; i++) {
            store.intruders.add(seq -> new AuctionEvent.PhaseAdvanced(seq, Instant.now(), Role.D));
        }
        assertThatThrownBy(() -> service.recordPurchase("p1", "a", 7, "r-1"))
                .isInstanceOf(ConcurrentAppendException.class);
    }

    @Test
    void unaRichiestaGiaScrittaDaUnAltroTornaComeScritta() {
        RacingStore store = new RacingStore();
        AuctionService service = service(store);
        store.duplicateOnce = true;

        AuctionEvent.PlayerPurchased written = service.recordPurchase("p1", "a", 7, "r-1");

        assertThat(written.requestId()).isEqualTo("r-1");
        assertThat(service.state().holdings()).hasSize(1);
    }

    @Test
    void ancheIlCambioFaseRiprova() {
        RacingStore store = new RacingStore();
        AuctionService service = service(store);
        store.intruders.add(seq -> new AuctionEvent.PlayerPurchased(seq, Instant.now(), "d1", "b", 5));

        assertThat(service.selectPhase(Role.D)).isTrue();
        assertThat(service.state().currentPhase()).isEqualTo(Role.D);
    }
}
