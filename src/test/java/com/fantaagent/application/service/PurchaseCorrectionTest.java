package com.fantaagent.application.service;

import com.fantaagent.adapter.out.file.InMemoryPlayerCatalog;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Il potere correttivo dell'amministratore: stesso giocatore, altro prezzo o altro acquirente. */
class PurchaseCorrectionTest {

    private static final LeagueRules RULES = new LeagueRules(2, 100,
            Map.of(Role.P, 1, Role.D, 1, Role.C, 1, Role.A, 1), List.of(Role.P, Role.D, Role.C, Role.A));
    private static final List<Participant> PEOPLE = List.of(
            new Participant("a", "Anna", 'A', true), new Participant("b", "Bruno", 'B', false));

    private InMemoryEventStore store;
    private AuctionService service;
    private long seq;

    @BeforeEach
    void setUp() {
        store = new InMemoryEventStore();
        store.append(new AuctionEvent.AuctionStarted(1, Instant.now(), "Asta"));
        service = new AuctionService(RULES, PEOPLE, new InMemoryPlayerCatalog(List.of(
                new Player("p1", "Portiere Uno", "Inter", Role.P, 10),
                new Player("p2", "Portiere Due", "Milan", Role.P, 10)), List.of()), store);
        seq = service.recordPurchase("p1", "a", 40, "r-1").seq();
    }

    @Test
    void siCorreggeIlPrezzo() {
        service.correctPurchase(seq, "a", 55);
        assertThat(service.state().squadOf("a").budgetRemaining()).isEqualTo(45);
        assertThat(store.load().getLast()).isInstanceOf(AuctionEvent.PurchaseCorrected.class);
    }

    @Test
    void siSpostaAUnAltroPosto() {
        service.correctPurchase(seq, "b", 40);
        assertThat(service.state().squadOf("a").playerIds()).isEmpty();
        assertThat(service.state().squadOf("b").playerIds()).containsExactly("p1");
    }

    @Test
    void ilPrezzoLiberatoContaPerLoStessoAcquirente() {
        service.recordPurchase("p2", "b", 60, "r-2");
        service.correctPurchase(seq, "a", 100);
        assertThat(service.state().squadOf("a").budgetRemaining()).isZero();
    }

    @Test
    void nonSiSuperaIlBudgetDelNuovoAcquirente() {
        service.recordPurchase("p2", "b", 70, "r-2");
        assertThatThrownBy(() -> service.correctPurchase(seq, "b", 40))
                .isInstanceOf(PurchaseRejectedException.class);
    }

    @Test
    void nonSiSpostaAChiHaIlRuoloPieno() {
        service.recordPurchase("p2", "b", 10, "r-2");
        assertThatThrownBy(() -> service.correctPurchase(seq, "b", 40))
                .isInstanceOf(PurchaseRejectedException.class);
    }

    @Test
    void unAcquistoAnnullatoNonSiCorregge() {
        service.revokePurchase(seq);
        assertThatThrownBy(() -> service.correctPurchase(seq, "a", 10))
                .isInstanceOf(PurchaseRevocationException.class);
    }
}
