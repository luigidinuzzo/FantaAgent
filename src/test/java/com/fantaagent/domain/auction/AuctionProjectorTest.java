package com.fantaagent.domain.auction;

import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Role;
import com.fantaagent.domain.player.RoleLookup;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class AuctionProjectorTest {

    private static final LeagueRules RULES = new LeagueRules(2, 500,
            Map.of(Role.P, 3, Role.D, 8, Role.C, 8, Role.A, 6),
            List.of(Role.P, Role.D, Role.C, Role.A));

    private static final List<Participant> PARTICIPANTS = List.of(
            new Participant("me", "Io", 'I', true),
            new Participant("marco", "Marco", 'M', false));

    private static final Map<String, Role> ROLES = Map.of(
            "sommer", Role.P, "bastoni", Role.D, "dimarco", Role.D, "lautaro", Role.A);

    private static final RoleLookup LOOKUP = id -> {
        Role role = ROLES.get(id);
        if (role == null) {
            throw new IllegalArgumentException("unknown player id: " + id);
        }
        return role;
    };

    private static final Instant T = Instant.parse("2026-09-05T20:00:00Z");

    private AuctionState project(List<AuctionEvent> events) {
        return AuctionProjector.project(RULES, PARTICIPANTS, LOOKUP, events);
    }

    @Test
    void anEmptyLogYieldsTheFirstPhaseAndEmptySquads() {
        AuctionState state = project(List.of());

        assertThat(state.currentPhase()).isEqualTo(Role.P);
        assertThat(state.mySquad().holdings()).isEmpty();
        assertThat(state.squadOf("marco").budgetRemaining()).isEqualTo(500);
        assertThat(state.soldPlayerIds()).isEmpty();
    }

    @Test
    void purchasesLandInTheRightSquads() {
        AuctionState state = project(List.of(
                new AuctionEvent.AuctionStarted(1, T, "prova"),
                new AuctionEvent.PlayerPurchased(2, T, "sommer", "me", 30),
                new AuctionEvent.PlayerPurchased(3, T, "bastoni", "marco", 45)));

        assertThat(state.mySquad().spent()).isEqualTo(30);
        assertThat(state.squadOf("marco").spent()).isEqualTo(45);
        assertThat(state.soldPlayerIds()).containsExactlyInAnyOrder("sommer", "bastoni");
        assertThat(state.holdings()).hasSize(2);
    }

    @Test
    void phaseAdvancesAreApplied() {
        AuctionState state = project(List.of(
                new AuctionEvent.AuctionStarted(1, T, "prova"),
                new AuctionEvent.PhaseAdvanced(2, T, Role.D)));

        assertThat(state.currentPhase()).isEqualTo(Role.D);
    }

    @Test
    void revokingAPurchaseRestoresBudgetAndFreesThePlayer() {
        AuctionState state = project(List.of(
                new AuctionEvent.PlayerPurchased(1, T, "sommer", "me", 30),
                new AuctionEvent.PlayerPurchased(2, T, "bastoni", "me", 45),
                new AuctionEvent.PurchaseRevoked(3, T, 2)));

        assertThat(state.mySquad().spent()).isEqualTo(30);
        assertThat(state.soldPlayerIds()).containsExactly("sommer");
    }

    @Test
    void correctingAPurchaseUpdatesPriceAndOwnerWithoutChangingThePlayer() {
        AuctionState state = project(List.of(
                new AuctionEvent.PlayerPurchased(1, T, "lautaro", "me", 90),
                new AuctionEvent.PurchaseCorrected(2, T, 1, "marco", 75)));

        assertThat(state.mySquad().holdings()).isEmpty();
        assertThat(state.squadOf("marco").spent()).isEqualTo(75);
        assertThat(state.soldPlayerIds()).containsExactly("lautaro");
    }

    @Test
    void revokingAnAlreadyRevokedPurchaseIsANoOp() {
        AuctionState state = project(List.of(
                new AuctionEvent.PlayerPurchased(1, T, "sommer", "me", 30),
                new AuctionEvent.PurchaseRevoked(2, T, 1),
                new AuctionEvent.PurchaseRevoked(3, T, 1)));

        assertThat(state.holdings()).isEmpty();
        assertThat(state.mySquad().budgetRemaining()).isEqualTo(500);
    }

    @Test
    void projectionIsPureAndRepeatable() {
        List<AuctionEvent> events = List.of(
                new AuctionEvent.PlayerPurchased(1, T, "sommer", "me", 30),
                new AuctionEvent.PlayerPurchased(2, T, "dimarco", "marco", 40));

        assertThat(project(events)).isEqualTo(project(events));
    }

    @Test
    void unaFaseECompletaQuandoNessunPartecipanteHaPiuSlotPerQuelRuolo() {
        // Un solo slot per ruolo e due partecipanti: bastano due portieri venduti
        // perche' la fase P non abbia piu' senso per nessuno.
        LeagueRules unoPerRuolo = new LeagueRules(2, 500,
                Map.of(Role.P, 1, Role.D, 1, Role.C, 1, Role.A, 1),
                List.of(Role.P, Role.D, Role.C, Role.A));
        RoleLookup portieri = id -> Role.P;

        AuctionState ancoraAperta = AuctionProjector.project(unoPerRuolo, PARTICIPANTS, portieri,
                List.of(new AuctionEvent.PlayerPurchased(1L, T, "gk1", "me", 10)));
        assertThat(ancoraAperta.slotsRemainingFor(Role.P)).isEqualTo(1);
        assertThat(ancoraAperta.isPhaseComplete(Role.P)).isFalse();

        AuctionState completa = AuctionProjector.project(unoPerRuolo, PARTICIPANTS, portieri,
                List.of(new AuctionEvent.PlayerPurchased(1L, T, "gk1", "me", 10),
                        new AuctionEvent.PlayerPurchased(2L, T, "gk2", "marco", 10)));

        assertThat(completa.slotsRemainingFor(Role.P)).isZero();
        assertThat(completa.isPhaseComplete(Role.P)).isTrue();
        // La completezza e' per ruolo, non globale: gli altri restano aperti.
        assertThat(completa.isPhaseComplete(Role.D)).isFalse();
    }
}
