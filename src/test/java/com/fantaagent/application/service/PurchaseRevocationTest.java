package com.fantaagent.application.service;

import com.fantaagent.adapter.out.file.InMemoryPlayerCatalog;
import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PurchaseRevocationTest {

    private static final LeagueRules RULES = new LeagueRules(2, 30,
            Map.of(Role.P, 1, Role.D, 1, Role.C, 1, Role.A, 1),
            List.of(Role.P, Role.D, Role.C, Role.A));

    private static final Player BASTONI = new Player("d1", "Bastoni", "Inter", Role.D, 20);
    private static final Player DIMARCO = new Player("d2", "Dimarco", "Inter", Role.D, 18);

    private AuctionService service() {
        PlayerCatalog catalog = new InMemoryPlayerCatalog(List.of(BASTONI, DIMARCO), List.of());
        return new AuctionService(RULES,
                List.of(new Participant("anna", "Anna", 'A', true),
                        new Participant("bruno", "Bruno", 'B', false)),
                catalog, new InMemoryEventStore());
    }

    @Test
    void unIdInesistentePortaIlMotivoNotFound() {
        assertThatThrownBy(() -> service().revokePurchase(999))
                .isInstanceOf(PurchaseRevocationException.class)
                .isInstanceOf(IllegalArgumentException.class)
                .extracting(e -> ((PurchaseRevocationException) e).reason())
                .isEqualTo(PurchaseRevocationException.Reason.NOT_FOUND);
    }

    @Test
    void annullareDueVoltePortaIlMotivoAlreadyRevoked() {
        AuctionService service = service();
        service.recordPurchase("d1", "anna", 5);
        service.revokePurchase(1);

        assertThatThrownBy(() -> service.revokePurchase(1))
                .extracting(e -> ((PurchaseRevocationException) e).reason())
                .isEqualTo(PurchaseRevocationException.Reason.ALREADY_REVOKED);
    }

    /**
     * I messaggi sono quelli che RecapController mostra nel suo HTML e che i suoi test
     * asseriscono: cambiarli qui li romperebbe li'.
     */
    @Test
    void iMessaggiRestanoQuelliDiPrima() {
        assertThatThrownBy(() -> service().revokePurchase(999))
                .hasMessage("nessun acquisto con id 999");
    }
}
