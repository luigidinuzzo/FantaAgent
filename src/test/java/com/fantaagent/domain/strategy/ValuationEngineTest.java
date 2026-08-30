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
import com.fantaagent.domain.player.RoleLookup;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;

class ValuationEngineTest {

    private static final Instant T = Instant.parse("2026-09-05T20:00:00Z");

    private static final LeagueRules RULES = new LeagueRules(2, 100,
            Map.of(Role.P, 1, Role.D, 1, Role.C, 1, Role.A, 1),
            List.of(Role.P, Role.D, Role.C, Role.A));

    private static final List<Participant> PARTICIPANTS = List.of(
            new Participant("me", "Io", 'I', true),
            new Participant("marco", "Marco", 'M', false));

    private static final ModifierTable FLAT = new ModifierTable(1,
            List.of(new ModifierTable.Threshold(0.0, 0.0)));

    private static final ScoringRules SCORING = new ScoringRules(true,
            Map.of(Role.P, 3.0, Role.D, 4.0, Role.C, 3.5, Role.A, 3.0),
            1.0, 3.0, -3.0, 3.0, -0.5, -1.0, -1.0, 1.0, FLAT, FLAT);

    private static final ReplacementLevels REPLACEMENT = new ReplacementLevels(
            Map.of(Role.P, 0.0, Role.D, 0.0, Role.C, 0.0, Role.A, 0.0),
            Map.of(Role.P, 6.0, Role.D, 6.0, Role.C, 6.0, Role.A, 6.0));

    private final ModifierCalculator modifiers = new ModifierCalculator(SCORING, REPLACEMENT);
    private final ValuationEngine engine = new ValuationEngine(
            new RosterCompleter(modifiers, REPLACEMENT), modifiers, REPLACEMENT);

    private final List<PlayerProjection> pool = new ArrayList<>();
    private final Map<String, Double> priors = new HashMap<>();
    private final Map<String, Role> roles = new HashMap<>();

    private PlayerProjection add(String id, Role role, double points, double price) {
        PlayerProjection p = new PlayerProjection(id, role, 6.0, 0.0, 30.0, points, 30.0);
        pool.add(p);
        priors.put(id, price);
        roles.put(id, role);
        return p;
    }

    private PriceModel prices() {
        Map<Role, Double> bias = new EnumMap<>(Role.class);
        for (Role role : Role.values()) {
            bias.put(role, 1.0);
        }
        return new PriceModel(priors, 1.0, bias);
    }

    private AuctionState state(List<AuctionEvent> events) {
        return AuctionProjector.project(RULES, PARTICIPANTS, roles::get, events);
    }

    private ValuationContext context(PlayerProjection target, AuctionState state) {
        List<PlayerProjection> owned = state.mySquad().playerIds().stream()
                .map(id -> pool.stream().filter(p -> p.playerId().equals(id)).findFirst().orElseThrow())
                .toList();
        List<PlayerProjection> available = pool.stream()
                .filter(p -> !state.soldPlayerIds().contains(p.playerId()))
                .toList();
        return new ValuationContext(state, target, owned, available, prices(), 0);
    }

    private PlayerProjection p(String id) {
        return pool.stream().filter(x -> x.playerId().equals(id)).findFirst().orElseThrow();
    }

    /**
     * Ogni ruolo ha un'opzione economica e una costosa: senza questo gradiente il
     * surplus non degrada al crescere del prezzo e il prezzo massimo sarebbe deciso
     * dal solo vincolo di budget.
     */
    private void seedGradientRoles() {
        add("gk", Role.P, 100, 10);
        add("gkTop", Role.P, 200, 40);
        add("mid", Role.C, 100, 10);
        add("midTop", Role.C, 200, 40);
        add("fw", Role.A, 100, 10);
        add("fwTop", Role.A, 200, 40);
    }

    private void seedPool() {
        seedGradientRoles();
        add("bestDef", Role.D, 300, 20);
        add("okDef", Role.D, 280, 18);
    }

    @Test
    void neverRecommendsMoreThanTheHardCap() {
        seedPool();
        AuctionState state = state(List.of());
        PriceRecommendation rec = engine.evaluate(context(p("bestDef"), state));

        assertThat(rec.hardCap()).isEqualTo(state.mySquad().maxSpendableNow());
        assertThat(rec.maxBid()).isLessThanOrEqualTo(rec.hardCap());
    }

    @Test
    void aPlayerWithACloseAlternativeIsNotWorthMuchMoreThanThatAlternative() {
        seedPool();
        // bestDef vale 300, okDef 280 a 18: il vantaggio reale e' piccolo, e ogni
        // credito speso in piu' costringe a declassare portiere, centrocampo o attacco
        PriceRecommendation rec = engine.evaluate(context(p("bestDef"), state(List.of())));

        assertThat(rec.maxBid()).isLessThan(50);
        assertThat(rec.drivers()).anySatisfy(d ->
                assertThat(d.label()).containsIgnoringCase("alternativa"));
    }

    @Test
    void aPlayerWithNoRealAlternativeIsWorthMuchMore() {
        seedGradientRoles();
        PlayerProjection unique = add("uniqueDef", Role.D, 400, 20);
        add("poorDef", Role.D, 20, 1);   // unica alternativa: perde 380 punti

        PriceRecommendation scarce = engine.evaluate(context(unique, state(List.of())));

        // Stesso budget e stesso gradiente del test precedente: cambia solo quanto
        // costa rinunciare al giocatore. E' questo che il motore deve saper distinguere.
        assertThat(scarce.maxBid()).isGreaterThan(70);
    }

    @Test
    void refusesToBidWhenTheRoleIsAlreadyFull() {
        seedPool();
        AuctionState state = state(List.of(
                new AuctionEvent.PlayerPurchased(1, T, "bestDef", "me", 20)));

        PriceRecommendation rec = engine.evaluate(context(p("okDef"), state));

        assertThat(rec.maxBid()).isZero();
        assertThat(rec.walkAwayReason()).containsIgnoringCase("slot");
    }

    @Test
    void refusesToBidWhenTheBudgetIsExhausted() {
        seedPool();
        AuctionState state = state(List.of(
                new AuctionEvent.PlayerPurchased(1, T, "gk", "me", 97)));

        PriceRecommendation rec = engine.evaluate(context(p("bestDef"), state));

        assertThat(rec.hardCap()).isEqualTo(1);
        assertThat(rec.maxBid()).isLessThanOrEqualTo(1);
    }

    @Test
    void reportsTheMarginAgainstTheExpectedMarketPrice() {
        seedPool();
        PriceRecommendation rec = engine.evaluate(context(p("bestDef"), state(List.of())));

        assertThat(rec.expectedPrice()).isEqualTo(20);
        assertThat(rec.margin()).isEqualTo(rec.maxBid() - rec.expectedPrice());
    }

    @Test
    void alwaysExposesBetweenThreeAndFiveDrivers() {
        seedPool();
        PriceRecommendation rec = engine.evaluate(context(p("bestDef"), state(List.of())));

        assertThat(rec.drivers()).hasSizeBetween(3, 5);
        assertThat(rec.drivers()).allSatisfy(d -> {
            assertThat(d.label()).isNotBlank();
            assertThat(d.explanation()).isNotBlank();
        });
    }

    @Test
    void confidenceIsLowWhenNoSalesHaveBeenObserved() {
        seedPool();
        PriceRecommendation rec = engine.evaluate(context(p("bestDef"), state(List.of())));

        assertThat(rec.confidence().marketFactor()).isLessThan(0.2);
        assertThat(rec.confidence().stars()).isLessThanOrEqualTo(3);
    }

    @Test
    void goldenEndOfAuctionTwoSlotsAndFiveCredits() {
        // Scenario nominato dalla spec §12: budget quasi esaurito, due slot da coprire.
        seedPool();
        AuctionState state = state(List.of(
                new AuctionEvent.PlayerPurchased(1, T, "gk", "me", 50),
                new AuctionEvent.PlayerPurchased(2, T, "mid", "me", 45)));

        PriceRecommendation rec = engine.evaluate(context(p("bestDef"), state));

        // 5 crediti, 2 slot residui: si puo' spendere al massimo 4 su questo giocatore
        assertThat(state.mySquad().budgetRemaining()).isEqualTo(5);
        assertThat(state.mySquad().slotsRemaining()).isEqualTo(2);
        assertThat(rec.hardCap()).isEqualTo(4);
        assertThat(rec.maxBid()).isBetween(0, 4);
        assertThat(rec.margin()).isNegative();   // il mercato lo paga 20: va lasciato
    }

    @Test
    void propertyMaxBidNeverExceedsHardCapAcrossRandomStates() {
        Random random = new Random(20260905L);
        for (int run = 0; run < 200; run++) {
            pool.clear();
            priors.clear();
            roles.clear();
            add("gk", Role.P, 50 + random.nextInt(300), 1 + random.nextInt(40));
            add("mid", Role.C, 50 + random.nextInt(300), 1 + random.nextInt(40));
            add("fw", Role.A, 50 + random.nextInt(300), 1 + random.nextInt(40));
            PlayerProjection target = add("d1", Role.D, 50 + random.nextInt(400), 1 + random.nextInt(40));
            add("d2", Role.D, 50 + random.nextInt(400), 1 + random.nextInt(40));

            List<AuctionEvent> events = new ArrayList<>();
            if (random.nextBoolean()) {
                events.add(new AuctionEvent.PlayerPurchased(1, T, "gk", "me", 1 + random.nextInt(90)));
            }
            AuctionState state = state(events);

            PriceRecommendation rec = engine.evaluate(context(target, state));

            assertThat(rec.maxBid())
                    .as("run %d", run)
                    .isBetween(0, rec.hardCap());
        }
    }

    @Test
    void staysWithinTheLatencyBudget() {
        seedPool();
        AuctionState state = state(List.of());
        ValuationContext ctx = context(p("bestDef"), state);

        engine.evaluate(ctx); // riscaldamento della JIT
        long start = System.nanoTime();
        for (int i = 0; i < 20; i++) {
            engine.evaluate(ctx);
        }
        long averageMillis = (System.nanoTime() - start) / 20 / 1_000_000;

        assertThat(averageMillis).isLessThan(80L);
    }
}
