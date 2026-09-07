package com.fantaagent.application.service;

import com.fantaagent.adapter.out.file.InMemoryPlayerCatalog;
import com.fantaagent.adapter.out.file.JsonlAuctionEventStore;
import com.fantaagent.application.port.out.AuctionEventStore;
import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class IdempotentPurchaseTest {

    @TempDir
    Path tmp;

    private static final LeagueRules RULES = new LeagueRules(2, 100,
            Map.of(Role.P, 1, Role.D, 2, Role.C, 1, Role.A, 1),
            List.of(Role.P, Role.D, Role.C, Role.A));

    private static final Player BASTONI = new Player("d1", "Bastoni", "Inter", Role.D, 20);

    private final AuctionEventStore store = new InMemoryEventStore();

    private AuctionService service() {
        PlayerCatalog catalog = new InMemoryPlayerCatalog(List.of(BASTONI), List.of());
        return new AuctionService(RULES,
                List.of(new Participant("anna", "Anna", 'A', true),
                        new Participant("bruno", "Bruno", 'B', false)),
                catalog, store);
    }

    @Test
    void laStessaChiaveNonScriveDueVolte() {
        AuctionService service = service();

        long first = service.recordPurchase("d1", "anna", 20, "req-1");
        long second = service.recordPurchase("d1", "anna", 20, "req-1");

        assertThat(second).isEqualTo(first);
        assertThat(store.load()).hasSize(1);
        assertThat(service.state().holdings()).hasSize(1);
    }

    /**
     * La chiave protegge dai doppi invii della STESSA richiesta, non dalle regole
     * d'asta: una chiave diversa che punta allo stesso giocatore è un secondo
     * acquisto vero e proprio, e deve essere rifiutato dal dominio come tale — non
     * silenziato come se fosse una riconsegna della prima richiesta.
     */
    @Test
    void unaChiaveDiversaNonMascheraIlRifiutoDiDominio() {
        AuctionService service = service();
        service.recordPurchase("d1", "anna", 20, "req-1");

        assertThatThrownBy(() -> service.recordPurchase("d1", "bruno", 20, "req-2"))
                .isInstanceOf(PurchaseRejectedException.class)
                .extracting(e -> ((PurchaseRejectedException) e).reason())
                .isEqualTo(PurchaseRejectedException.Reason.ALREADY_SOLD);
        assertThat(store.load()).hasSize(1);
    }

    @Test
    void senzaChiaveIlComportamentoRestaQuelloDiPrima() {
        AuctionService service = service();
        service.recordPurchase("d1", "anna", 20);

        assertThat(store.load()).hasSize(1);
    }

    /**
     * S7: {@code seqOf} legge il log, e {@code appendWithNextSeq} lo scrive, ma
     * niente lega le due operazioni insieme in una singola sezione critica. Due
     * richieste con la STESSA chiave, rilasciate nello stesso istante, possono
     * entrambe leggere "nessuna corrispondenza" prima che l'una o l'altra scriva —
     * e scrivere entrambe. Usa il vero {@link JsonlAuctionEventStore}, non il doppio
     * in memoria: il suo append reale su disco (apri, scrivi, fsync, chiudi) dura
     * ordini di grandezza piu' del controllo in memoria che lo precede, il che
     * allarga la finestra della corsa invece di richiedere iterazioni ripetute per
     * beccarla.
     */
    @Test
    void richiesteSimultaneeConLaStessaChiaveNonScrivonoDueVolte() throws Exception {
        AuctionEventStore fileStore = new JsonlAuctionEventStore(tmp.resolve("events.jsonl"));
        AuctionService service = new AuctionService(RULES,
                List.of(new Participant("anna", "Anna", 'A', true),
                        new Participant("bruno", "Bruno", 'B', false)),
                new InMemoryPlayerCatalog(List.of(BASTONI), List.of()), fileStore);

        CountDownLatch pronti = new CountDownLatch(2);
        CountDownLatch via = new CountDownLatch(1);
        List<Long> seqs = Collections.synchronizedList(new ArrayList<>());
        List<Throwable> errori = Collections.synchronizedList(new ArrayList<>());

        Runnable compra = () -> {
            pronti.countDown();
            try {
                via.await();
                seqs.add(service.recordPurchase("d1", "anna", 20, "req-simultanea"));
            } catch (Throwable t) {
                errori.add(t);
            }
        };
        Thread t1 = new Thread(compra);
        Thread t2 = new Thread(compra);
        t1.start();
        t2.start();
        pronti.await();
        via.countDown();
        t1.join();
        t2.join();

        assertThat(errori).describedAs("nessuna delle due richieste deve fallire").isEmpty();
        assertThat(fileStore.load())
                .describedAs("una sola scrittura per quella chiave, non una per richiesta")
                .hasSize(1);
        assertThat(seqs)
                .describedAs("entrambe le chiamate devono tornare lo stesso seq")
                .hasSize(2)
                .containsOnly(seqs.getFirst());
    }
}
