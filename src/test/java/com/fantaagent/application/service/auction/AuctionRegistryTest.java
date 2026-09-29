package com.fantaagent.application.service.auction;

import com.fantaagent.application.port.out.AuctionRecord;
import com.fantaagent.application.service.league.LeagueAccess;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.testsupport.Fixtures;
import com.fantaagent.testsupport.PortalWorld;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AuctionRegistryTest {

    private PortalWorld world;
    private AuctionRegistry registry;
    private LeagueAccess admin;
    private UUID bruno;
    private AuctionRecord auction;

    @BeforeEach
    void setUp() {
        world = new PortalWorld();
        registry = new AuctionRegistry(world.auctions, world.auctionRepository, world.stores, world.catalog,
                Fixtures.template(), List.of(1.0), PortalWorld.PHASES, world.tx);
        admin = world.league("anna", "bruno", "carla");
        bruno = world.userId(admin, "bruno FC");
        auction = world.auctions.create(admin, "Asta");
    }

    @Test
    void ilPostoDiChiGuardaEQuelloDellUtente() {
        AuctionView view = registry.view(world.as(admin, bruno), auction.id());

        assertThat(view.mySeat()).contains(bruno.toString());
        assertThat(view.participants()).filteredOn(Participant::me)
                .singleElement().extracting(Participant::id).isEqualTo(bruno.toString());
        assertThat(view.service().state().myParticipantId()).isEqualTo(bruno.toString());
    }

    @Test
    void dueUtentiVedonoLoStessoStatoMaConPostiDiversi() {
        AuctionView anna = registry.view(admin, auction.id());
        AuctionView b = registry.view(world.as(admin, bruno), auction.id());
        anna.write(() -> anna.service().recordPurchase("P1", bruno.toString(), 30, "r-1"));

        assertThat(b.service().state().squadOf(bruno.toString()).budgetRemaining()).isEqualTo(470);
        assertThat(b.service().state().mySquad().budgetRemaining()).isEqualTo(470);
        assertThat(anna.service().state().mySquad().budgetRemaining()).isEqualTo(500);
    }

    @Test
    void iConsigliSonoCalcolatiSulPostoDiChiChiede() {
        AuctionView anna = registry.view(admin, auction.id());
        anna.service().recordPurchase("P1", bruno.toString(), 400, "r-1");

        int annaCap = registry.view(admin, auction.id()).analysis().analyze("D1").hardCap();
        int brunoCap = registry.view(world.as(admin, bruno), auction.id()).analysis().analyze("D1").hardCap();

        assertThat(brunoCap).isLessThan(annaCap);
    }

    @Test
    void chiScriveFirmaLEvento() {
        registry.view(admin, auction.id()).service().recordPurchase("P1", bruno.toString(), 30, "r-1");
        assertThat(world.jdbc.sql("SELECT actor_id FROM auction_event WHERE seq = 2").query(UUID.class).single())
                .isEqualTo(admin.userId());
    }

    @Test
    void unMembroSenzaPostoVedeLoStatoMaNonHaConsigli() {
        registry.view(admin, auction.id()).service().recordPurchase("P1", bruno.toString(), 30, "r-1");
        UUID late = world.user("dario");
        world.join(admin, late, "dario");

        AuctionView view = registry.view(world.as(admin, late), auction.id());

        assertThat(view.mySeat()).isEmpty();
        assertThat(view.service().state().holdings()).hasSize(1);
        assertThatThrownBy(view::requireSeat).isInstanceOf(NoSeatException.class);
    }

    @Test
    void laCatenaSiRiusaFinchePostiERegoleNonCambiano() {
        AuctionView first = registry.view(admin, auction.id());
        AuctionView second = registry.view(world.as(admin, bruno), auction.id());
        assertThat(second.chain()).isSameAs(first.chain());

        world.auctions.removeMember(admin, world.userId(admin, "carla FC"));
        AuctionView third = registry.view(admin, auction.id());
        assertThat(third.chain()).isNotSameAs(first.chain());
        assertThat(third.rules().participants()).isEqualTo(2);
    }

    @Test
    void unAstaDiUnAltraLegaNonSiApre() {
        LeagueAccess other = world.league("enzo", "fabio");
        assertThatThrownBy(() -> registry.view(other, auction.id()))
                .isInstanceOf(AuctionNotFoundException.class);
    }

    @Test
    void ilRegistroScrittoPrimaDellaVistaEGiaDentro() {
        world.stores.open(auction.id(), admin.userId())
                .append(new AuctionEvent.PhaseAdvanced(2, java.time.Instant.now(), com.fantaagent.domain.player.Role.D));
        assertThat(registry.view(admin, auction.id()).service().state().currentPhase())
                .isEqualTo(com.fantaagent.domain.player.Role.D);
    }
}
