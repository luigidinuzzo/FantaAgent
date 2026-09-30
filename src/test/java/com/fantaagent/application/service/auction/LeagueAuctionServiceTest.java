package com.fantaagent.application.service.auction;

import com.fantaagent.application.port.out.AuctionRecord;
import com.fantaagent.application.port.out.Seat;
import com.fantaagent.application.service.league.AdminCannotLeaveException;
import com.fantaagent.application.service.league.AdminOnlyException;
import com.fantaagent.application.service.league.LeagueAccess;
import com.fantaagent.application.service.league.NotLeagueMemberException;
import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.LeagueRulesSettings;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.player.Role;
import com.fantaagent.testsupport.PortalWorld;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LeagueAuctionServiceTest {

    private PortalWorld world;
    private LeagueAccess admin;
    private UUID bruno;
    private UUID carla;

    @BeforeEach
    void setUp() {
        world = new PortalWorld();
        admin = world.league("anna", "bruno", "carla");
        bruno = world.userId(admin, "bruno FC");
        carla = world.userId(admin, "carla FC");
    }

    @Test
    void lAstaNasceConLeRegoleDellaLegaEIMembriComePosti() {
        AuctionRecord auction = world.auctions.create(admin, " Asta d'estate ");

        assertThat(auction.name()).isEqualTo("Asta d'estate");
        assertThat(auction.rules()).isEqualTo(admin.league().rules());
        assertThat(world.auctions.seats(admin, auction.id()))
                .extracting(Seat::teamName, Seat::position)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple("anna FC", 1),
                        org.assertj.core.groups.Tuple.tuple("bruno FC", 2),
                        org.assertj.core.groups.Tuple.tuple("carla FC", 3));
        assertThat(world.stores.open(auction.id(), admin.userId()).load())
                .singleElement().isInstanceOf(AuctionEvent.AuctionStarted.class);
    }

    @Test
    void cambiareLaLegaNonToccaLeAsteGiaCreate() {
        AuctionRecord auction = world.auctions.create(admin, "Asta");
        world.leagues.updateDefaults(admin, new LeagueRulesSettings(100,
                        Map.of(Role.P, 1, Role.D, 1, Role.C, 1, Role.A, 1)),
                admin.league().scoring(), admin.league().bidder());

        assertThat(world.auctions.find(admin, auction.id()).rules().budget()).isEqualTo(500);
    }

    @Test
    void soloLAmministratoreCreaUnAsta() {
        assertThatThrownBy(() -> world.auctions.create(world.as(admin, bruno), "Asta"))
                .isInstanceOf(AdminOnlyException.class);
    }

    @Test
    void daSoliNonSiFaUnAsta() {
        LeagueAccess alone = world.league("dario");
        assertThatThrownBy(() -> world.auctions.create(alone, "Asta"))
                .isInstanceOf(NotEnoughMembersException.class);
    }

    @Test
    void lElencoDiceAcquistiFaseECreditiMiei() {
        AuctionRecord auction = world.auctions.create(admin, "Asta");
        var store = world.stores.open(auction.id(), admin.userId());
        store.append(new AuctionEvent.PlayerPurchased(2, Instant.now(), "P1", bruno.toString(), 40));
        store.append(new AuctionEvent.PhaseAdvanced(3, Instant.now(), Role.D));

        AuctionCard card = world.auctions.list(world.as(admin, bruno)).getFirst();
        assertThat(card.purchases()).isEqualTo(1);
        assertThat(card.phase()).isEqualTo(Role.D);
        assertThat(card.teams()).isEqualTo(3);
        assertThat(card.totalSlots()).isEqualTo(75);
        assertThat(card.myBudgetRemaining()).isEqualTo(460);
    }

    @Test
    void unAstaCancellataNonSiVedePiu() {
        AuctionRecord auction = world.auctions.create(admin, "Asta");
        world.auctions.delete(admin, auction.id());
        assertThat(world.auctions.list(admin)).isEmpty();
        assertThatThrownBy(() -> world.auctions.find(admin, auction.id()))
                .isInstanceOf(AuctionNotFoundException.class);
    }

    @Test
    void unAstaDiUnAltraLegaNonSiTrova() {
        AuctionRecord auction = world.auctions.create(admin, "Asta");
        LeagueAccess other = world.league("dario", "enzo");
        assertThatThrownBy(() -> world.auctions.find(other, auction.id()))
                .isInstanceOf(AuctionNotFoundException.class);
    }

    @Test
    void primaDelPrimoAcquistoIPostiSiCambiano() {
        AuctionRecord auction = world.auctions.create(admin, "Asta");
        List<Seat> seats = world.auctions.replaceSeats(admin, auction.id(), List.of(
                new SeatRequest(carla, "Carla United", "Z"),
                new SeatRequest(admin.userId(), "anna FC", "A")));

        assertThat(seats).extracting(Seat::teamName).containsExactly("Carla United", "anna FC");
        assertThat(seats).extracting(Seat::position).containsExactly(1, 2);
    }

    @Test
    void dopoIlPrimoAcquistoSiCambiaSoloLOrdine() {
        AuctionRecord auction = world.auctions.create(admin, "Asta");
        world.stores.open(auction.id(), admin.userId())
                .append(new AuctionEvent.PlayerPurchased(2, Instant.now(), "P1", bruno.toString(), 40));

        List<Seat> reordered = world.auctions.replaceSeats(admin, auction.id(), List.of(
                new SeatRequest(carla, "carla FC", "C"),
                new SeatRequest(bruno, "bruno FC", "B"),
                new SeatRequest(admin.userId(), "anna FC", "A")));
        assertThat(reordered).extracting(Seat::teamName).containsExactly("carla FC", "bruno FC", "anna FC");

        assertThatThrownBy(() -> world.auctions.replaceSeats(admin, auction.id(), List.of(
                new SeatRequest(carla, "carla FC", "C"),
                new SeatRequest(admin.userId(), "anna FC", "A"))))
                .isInstanceOf(SeatsLockedException.class);
        assertThatThrownBy(() -> world.auctions.replaceSeats(admin, auction.id(), List.of(
                new SeatRequest(carla, "Altro nome", "C"),
                new SeatRequest(bruno, "bruno FC", "B"),
                new SeatRequest(admin.userId(), "anna FC", "A"))))
                .isInstanceOf(SeatsLockedException.class);
        assertThat(world.auctions.seatsLocked(admin, auction.id())).isTrue();
    }

    @Test
    void unPostoPerChiNonEMembroNonSiDa() {
        AuctionRecord auction = world.auctions.create(admin, "Asta");
        UUID stranger = world.user("sconosciuto");
        assertThatThrownBy(() -> world.auctions.replaceSeats(admin, auction.id(), List.of(
                new SeatRequest(stranger, "X FC", "X"),
                new SeatRequest(admin.userId(), "anna FC", "A"))))
                .isInstanceOf(com.fantaagent.application.service.league.InvalidLeagueDataException.class);
    }

    @Test
    void chiEsceLasciaIlPostoDoveHaGiaComprato() {
        AuctionRecord started = world.auctions.create(admin, "Iniziata");
        world.stores.open(started.id(), admin.userId())
                .append(new AuctionEvent.PlayerPurchased(2, Instant.now(), "P1", bruno.toString(), 40));
        AuctionRecord fresh = world.auctions.create(admin, "Nuova");

        world.auctions.removeMember(world.as(admin, bruno), bruno);

        assertThat(world.auctions.seats(admin, started.id())).extracting(Seat::userId).contains(bruno);
        assertThat(world.auctions.seats(admin, fresh.id())).extracting(Seat::userId).doesNotContain(bruno);
        assertThatThrownBy(() -> world.as(admin, bruno)).isInstanceOf(NotLeagueMemberException.class);
    }

    /**
     * Un'asta vive con almeno due posti: togliendo il secondo resterebbe con uno solo,
     * e da li' ogni lettura dell'asta fallirebbe. Il posto resta; l'amministratore lo
     * sistema dalle impostazioni dell'asta.
     */
    @Test
    void chiEsceLasciaIlPostoSeLAstaResterebbeConUnoSolo() {
        AuctionRecord pair = world.auctions.create(admin, "In due");
        world.auctions.replaceSeats(admin, pair.id(), List.of(
                new SeatRequest(admin.userId(), "anna FC", "A"),
                new SeatRequest(bruno, "bruno FC", "B")));
        AuctionRecord three = world.auctions.create(admin, "In tre");

        world.auctions.removeMember(admin, bruno);

        assertThat(world.auctions.seats(admin, pair.id())).extracting(Seat::userId)
                .containsExactly(admin.userId(), bruno);
        assertThat(world.auctions.seats(admin, three.id())).extracting(Seat::userId)
                .containsExactly(admin.userId(), carla);
    }

    @Test
    void lAmministratoreToglieUnMembroMaNonSeStesso() {
        world.auctions.removeMember(admin, carla);
        assertThatThrownBy(() -> world.as(admin, carla)).isInstanceOf(NotLeagueMemberException.class);
        assertThatThrownBy(() -> world.auctions.removeMember(admin, admin.userId()))
                .isInstanceOf(AdminCannotLeaveException.class);
        assertThatThrownBy(() -> world.auctions.removeMember(world.as(admin, bruno), admin.userId()))
                .isInstanceOf(AdminOnlyException.class);
    }

    @Test
    void lePreferenzeDelBanditoreSiCambianoAnchePerUnAstaIniziata() {
        AuctionRecord auction = world.auctions.create(admin, "Asta");
        world.auctions.updateBidder(admin, auction.id(), new AuctionSettings(12, false));
        assertThat(world.auctions.find(admin, auction.id()).bidder()).isEqualTo(new AuctionSettings(12, false));
    }
}
