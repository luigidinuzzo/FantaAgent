package com.fantaagent.application.service;

import com.fantaagent.adapter.out.file.InMemoryPlayerCatalog;
import com.fantaagent.application.port.out.AuctionEventStore;
import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class IdempotentPurchaseTest {

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
}
