package com.fantaagent.domain.strategy;

import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.auction.AuctionProjector;
import com.fantaagent.domain.auction.AuctionState;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.ModifierTable;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.league.ScoringRules;
import com.fantaagent.domain.player.PlayerProjection;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * S1: {@link ValuationEngineTest} usa in ogni test una tabella di modificatori piatta
 * (una sola soglia, bonus 0.0) e assegna {@code expectedRating = 6.0} a ogni
 * proiezione, quindi il termine dei modificatori è identicamente zero ovunque — rimuovere
 * i modificatori da {@link RosterCompleter} lascia tutti quei test verdi. Questa classe usa
 * tabelle a gradini REALI e proiezioni con voti DISPERSI, così il termine dei
 * modificatori è non nullo e varia da un candidato all'altro, esercitando il
 * comportamento distintivo del motore attraverso {@link ValuationEngine#evaluate}
 * invece che attraverso {@link ModifierCalculator} da solo.
 */
class ValuationEngineModifierCompositionTest {

    private static final Instant T = Instant.parse("2026-09-05T20:00:00Z");

    /** Gradini reali: 0.0 a 6.0, 1.0 fantapunti/giornata a 6.0, 3.0 a 6.5. */
    private static final ModifierTable DEFENCE = new ModifierTable(3, List.of(
            new ModifierTable.Threshold(0.0, 0.0),
            new ModifierTable.Threshold(6.0, 1.0),
            new ModifierTable.Threshold(6.5, 3.0)));

    private static final ModifierTable KEEPER = new ModifierTable(0, List.of(
            new ModifierTable.Threshold(0.0, 0.0),
            new ModifierTable.Threshold(6.2, 1.0)));

    private static final ScoringRules SCORING = new ScoringRules(true,
            Map.of(Role.P, 3.0, Role.D, 4.0, Role.C, 3.5, Role.A, 3.0),
            1.0, 3.0, -3.0, 3.0, -0.5, -1.0, -1.0, 1.0, DEFENCE, KEEPER);

    /** Marginale sotto ogni soglia, così un reparto scoperto non falsa il confronto. */
    private static final ReplacementLevels REPLACEMENT = new ReplacementLevels(
            Map.of(Role.P, 30.0, Role.D, 30.0, Role.C, 30.0, Role.A, 30.0),
            Map.of(Role.P, 5.9, Role.D, 5.9, Role.C, 6.0, Role.A, 6.0));

    private final ModifierCalculator modifiers = new ModifierCalculator(SCORING, REPLACEMENT);
    private final ValuationEngine engine =
            new ValuationEngine(new RosterCompleter(modifiers, REPLACEMENT), modifiers);

    private static PlayerProjection player(String id, Role role, double rating, double points) {
        return new PlayerProjection(id, role, rating, 0.0, 30.0, points, 30.0);
    }

    private static PriceModel flatPrices(Map<String, Double> priors) {
        Map<Role, Double> bias = new EnumMap<>(Role.class);
        for (Role role : Role.values()) {
            bias.put(role, 1.0);
        }
        return new PriceModel(priors, 1.0, bias);
    }

    // --- (a) comportamento distintivo, attraverso il motore composto -------------------

    /**
     * Stesso comportamento provato per {@link ModifierCalculator} in
     * {@code ModifierCalculatorTest.aDefenderCrossingTheThresholdBeatsAStrongerOneThatDoesNot},
     * ma qui asserito attraverso {@link ValuationEngine#evaluate}: un difensore che fa
     * scattare il reparto oltre la soglia deve valere di più — in max bid, non solo in
     * punti marginali — di uno nominalmente più forte che non la fa scattare.
     */
    @Test
    void aDefenderCrossingTheThresholdIsWorthMoreThanANominallyStrongerOneThatDoesNot() {
        List<PlayerProjection> pool = new ArrayList<>();
        Map<String, Double> priors = new HashMap<>();
        Map<String, Role> roles = new HashMap<>();

        add(pool, priors, roles, "gk", Role.P, 6.6, 150, 20);
        add(pool, priors, roles, "d1", Role.D, 6.6, 150, 20);
        add(pool, priors, roles, "d2", Role.D, 6.6, 150, 20);
        add(pool, priors, roles, "mid", Role.C, 6.0, 100, 10);
        add(pool, priors, roles, "fw", Role.A, 6.0, 100, 10);
        // media attuale con riempitivo 5.9: (6.6+6.6+6.6+5.9)/4 = 6.425 -> gradino 6.0
        PlayerProjection crosses = add(pool, priors, roles, "crosses", Role.D, 6.6, 140, 20); // media 6.6 -> 6.5
        PlayerProjection stronger = add(pool, priors, roles, "stronger", Role.D, 5.9, 175, 20); // media invariata

        LeagueRules rules = new LeagueRules(2, 100,
                Map.of(Role.P, 1, Role.D, 3, Role.C, 1, Role.A, 1),
                List.of(Role.P, Role.D, Role.C, Role.A));
        List<Participant> participants = List.of(
                new Participant("me", "Io", 'I', true),
                new Participant("marco", "Marco", 'M', false));

        List<AuctionEvent> events = List.of(
                new AuctionEvent.PlayerPurchased(1, T, "gk", "me", 20),
                new AuctionEvent.PlayerPurchased(2, T, "d1", "me", 20),
                new AuctionEvent.PlayerPurchased(3, T, "d2", "me", 20));
        AuctionState state = AuctionProjector.project(rules, participants, roles::get, events);
        List<PlayerProjection> owned = state.mySquad().playerIds().stream()
                .map(id -> pool.stream().filter(p -> p.playerId().equals(id)).findFirst().orElseThrow())
                .toList();
        List<PlayerProjection> available = pool.stream()
                .filter(p -> !state.soldPlayerIds().contains(p.playerId()))
                .toList();
        PriceModel prices = flatPrices(priors);

        PriceRecommendation recCrosses =
                engine.evaluate(new ValuationContext(state, crosses, owned, available, prices, 0));
        PriceRecommendation recStronger =
                engine.evaluate(new ValuationContext(state, stronger, owned, available, prices, 0));

        assertThat(recCrosses.maxBid()).isGreaterThan(recStronger.maxBid());
    }

    // --- (b) golden test mancante: metà fase D, blocco difensivo avviato ---------------

    private static final LeagueRules GOLDEN_RULES = new LeagueRules(4, 200,
            Map.of(Role.P, 1, Role.D, 4, Role.C, 2, Role.A, 2),
            List.of(Role.P, Role.D, Role.C, Role.A));

    private static final List<Participant> GOLDEN_PARTICIPANTS = List.of(
            new Participant("me", "Io", 'I', true),
            new Participant("riv1", "Rivale1", 'A', false),
            new Participant("riv2", "Rivale2", 'B', false),
            new Participant("riv3", "Rivale3", 'C', false));

    /**
     * Scenario nominato dalla spec §12 e mancante fra i golden test esistenti: metà
     * fase D, con "me" che ha già un portiere e un difensore (il blocco difensivo
     * "avviato") e due rivali che hanno già comprato un difensore ciascuno (il mercato
     * a metà fase). Voti dispersi e tabelle a gradini reali, non il fixture piatto
     * degli altri test del motore.
     */
    @Test
    void goldenMidDefencePhaseWithADefensiveBlockAlreadyStarted() {
        List<PlayerProjection> pool = new ArrayList<>();
        Map<String, Double> priors = new HashMap<>();
        Map<String, Role> roles = new HashMap<>();

        add(pool, priors, roles, "gk", Role.P, 6.1, 170, 30);
        add(pool, priors, roles, "d1", Role.D, 6.4, 140, 25);
        PlayerProjection target = add(pool, priors, roles, "target", Role.D, 6.7, 130, 28);
        add(pool, priors, roles, "soldRiv1", Role.D, 6.5, 150, 30);
        add(pool, priors, roles, "soldRiv2", Role.D, 6.3, 120, 22);
        add(pool, priors, roles, "altDef", Role.D, 6.0, 100, 15);
        add(pool, priors, roles, "mid1", Role.C, 6.0, 100, 15);
        add(pool, priors, roles, "mid2", Role.C, 6.0, 90, 12);
        add(pool, priors, roles, "fw1", Role.A, 6.0, 110, 18);
        add(pool, priors, roles, "fw2", Role.A, 6.0, 95, 14);

        List<AuctionEvent> events = List.of(
                new AuctionEvent.PlayerPurchased(1, T, "gk", "me", 30),
                new AuctionEvent.PlayerPurchased(2, T, "d1", "me", 25),
                new AuctionEvent.PlayerPurchased(3, T, "soldRiv1", "riv1", 30),
                new AuctionEvent.PlayerPurchased(4, T, "soldRiv2", "riv2", 22),
                new AuctionEvent.PhaseAdvanced(5, T, Role.D));
        AuctionState state = AuctionProjector.project(GOLDEN_RULES, GOLDEN_PARTICIPANTS, roles::get, events);
        List<PlayerProjection> owned = state.mySquad().playerIds().stream()
                .map(id -> pool.stream().filter(p -> p.playerId().equals(id)).findFirst().orElseThrow())
                .toList();
        List<PlayerProjection> available = pool.stream()
                .filter(p -> !state.soldPlayerIds().contains(p.playerId()))
                .toList();
        PriceModel prices = flatPrices(priors);

        assertThat(state.currentPhase()).isEqualTo(Role.D);
        assertThat(state.mySquad().budgetRemaining()).isEqualTo(145);
        assertThat(state.mySquad().slotsRemaining()).isEqualTo(7);

        PriceRecommendation rec = engine.evaluate(
                new ValuationContext(state, target, owned, available, prices, 2));

        assertThat(rec.hardCap()).isEqualTo(139);
        assertThat(rec.maxBid()).isEqualTo(87);
        assertThat(rec.expectedPrice()).isEqualTo(28);
        assertThat(rec.margin()).isEqualTo(59);
    }

    // --- (c) proprietà mancante: maxBid non crescente al calare degli slot residui ----

    private static final LeagueRules SHRINKING_SLOTS_RULES = new LeagueRules(2, 100,
            Map.of(Role.P, 1, Role.D, 4, Role.C, 1, Role.A, 1),
            List.of(Role.P, Role.D, Role.C, Role.A));

    /**
     * {@code maxBid} non deve crescere quando gli slot residui calano a parità di
     * target, listone e prezzi (spec §11, tabella dei test property-based). Come per
     * {@code surplusScansAsApproximatelyMonotoneAcrossEveryPrice} in
     * {@link ValuationEngineTest}, l'euristica greedy + local search di
     * {@link RosterCompleter} rende questa proprietà solo approssimativamente vera in
     * generale (una scansione ampiamente randomizzata su molti ruoli mostra eccezioni
     * locali); qui è verificata empiricamente su uno scenario rappresentativo — stesso
     * target D, stesso listone, budget e slot dello stesso ruolo che calano acquisto
     * dopo acquisto — dove si mantiene rigorosamente, con voti dispersi e tabelle reali.
     */
    @Test
    void maxBidDoesNotIncreaseAsRemainingSlotsFallAllElseEqual() {
        List<PlayerProjection> pool = new ArrayList<>();
        Map<String, Double> priors = new HashMap<>();
        Map<String, Role> roles = new HashMap<>();

        add(pool, priors, roles, "gk", Role.P, 6.3, 180, 15);
        add(pool, priors, roles, "mid", Role.C, 6.2, 150, 12);
        add(pool, priors, roles, "fw", Role.A, 6.1, 160, 14);
        PlayerProjection target = add(pool, priors, roles, "targetDef", Role.D, 6.4, 170, 18);
        add(pool, priors, roles, "d1", Role.D, 6.3, 150, 25);
        add(pool, priors, roles, "d2", Role.D, 6.2, 140, 22);
        add(pool, priors, roles, "d3", Role.D, 6.1, 130, 20);

        PriceModel prices = flatPrices(priors);
        String[] fillers = {"d1", "d2", "d3"};
        int[] fillerPrices = {25, 22, 20};

        List<AuctionEvent> events = new ArrayList<>();
        long seq = 1;
        Integer previousMaxBid = null;
        for (int step = 0; step <= 3; step++) {
            if (step > 0) {
                events.add(new AuctionEvent.PlayerPurchased(
                        seq++, T, fillers[step - 1], "me", fillerPrices[step - 1]));
            }
            AuctionState state =
                    AuctionProjector.project(SHRINKING_SLOTS_RULES, twoParticipants(), roles::get, events);
            List<PlayerProjection> owned = state.mySquad().playerIds().stream()
                    .map(id -> pool.stream().filter(p -> p.playerId().equals(id)).findFirst().orElseThrow())
                    .toList();
            List<PlayerProjection> available = pool.stream()
                    .filter(p -> !state.soldPlayerIds().contains(p.playerId()))
                    .toList();

            PriceRecommendation rec = engine.evaluate(
                    new ValuationContext(state, target, owned, available, prices, 0));

            if (previousMaxBid != null) {
                assertThat(rec.maxBid())
                        .as("passo %d: %d slot D residui", step, state.mySquad().slotsRemaining(Role.D))
                        .isLessThanOrEqualTo(previousMaxBid);
            }
            previousMaxBid = rec.maxBid();
        }
        // La sequenza deve muoversi davvero, non restare piatta per costruzione:
        // altrimenti la proprietà sarebbe soddisfatta banalmente.
        assertThat(previousMaxBid).isLessThan(37);
    }

    private static List<Participant> twoParticipants() {
        return List.of(
                new Participant("me", "Io", 'I', true),
                new Participant("marco", "Marco", 'M', false));
    }

    private static PlayerProjection add(List<PlayerProjection> pool, Map<String, Double> priors,
                                        Map<String, Role> roles, String id, Role role,
                                        double rating, double points, double price) {
        PlayerProjection p = player(id, role, rating, points);
        pool.add(p);
        priors.put(id, price);
        roles.put(id, role);
        return p;
    }
}
