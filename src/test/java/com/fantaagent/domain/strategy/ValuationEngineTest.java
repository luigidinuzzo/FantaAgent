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
            1.0, 3.0, -3.0, 3.0, -0.5, -1.0, -1.0, 1.0, FLAT, FLAT, 0.0);

    private static final ReplacementLevels REPLACEMENT = new ReplacementLevels(
            Map.of(Role.P, 0.0, Role.D, 0.0, Role.C, 0.0, Role.A, 0.0),
            Map.of(Role.P, 6.0, Role.D, 6.0, Role.C, 6.0, Role.A, 6.0));

    private final ModifierCalculator modifiers = new ModifierCalculator(SCORING, REPLACEMENT);
    private final ValuationEngine engine = new ValuationEngine(
            new RosterCompleter(modifiers, REPLACEMENT), modifiers);

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

    /**
     * Isola la scarsita' dalla qualita' del giocatore: stesso target (stessi punti base,
     * stesso prezzo di listino), stesso budget, stesso gradiente sugli altri ruoli in
     * entrambi i contesti. L'unica differenza e' quanto vale l'alternativa nel ruolo D:
     * un'alternativa quasi equivalente (280 punti) contro una pessima (20 punti). Se il
     * motore misura davvero la scarsita' e non solo la qualita' assoluta del target, il
     * prezzo massimo nel caso senza alternativa deve essere molto piu' alto.
     */
    @Test
    void scarceAlternativeIsWorthAtLeastOneAndAHalfTimesTheCloseAlternativeCase() {
        seedGradientRoles();
        PlayerProjection closeCaseTarget = add("def", Role.D, 300, 20);
        add("okDef", Role.D, 280, 18);
        PriceRecommendation closeCase = engine.evaluate(context(closeCaseTarget, state(List.of())));

        pool.clear();
        priors.clear();
        roles.clear();
        seedGradientRoles();
        PlayerProjection scarceCaseTarget = add("def", Role.D, 300, 20);
        add("poorDef", Role.D, 20, 1);   // unica alternativa: perde 280 punti
        PriceRecommendation scarceCase = engine.evaluate(context(scarceCaseTarget, state(List.of())));

        assertThat(scarceCase.maxBid())
                .isGreaterThanOrEqualTo((int) Math.ceil(closeCase.maxBid() * 1.5));
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

    /**
     * Il test sopra usa un fixture di 8 giocatori e non dice nulla sul requisito reale:
     * il budget di 80 ms riguarda un catalogo da ~600 giocatori a metà asta, quando il
     * completamento della rosa (chiamato ~8 volte per ricerca binaria, 3 ricerche per
     * valutazione) ha davvero molti candidati da confrontare a ogni passo del greedy e
     * della local search.
     */
    @Test
    void staysWithinTheLatencyBudgetAtRealisticScale() {
        RealisticFixture fixture = buildRealisticFixture(20260830L);
        ValuationContext ctx = new ValuationContext(fixture.state(), fixture.target(),
                List.of(), fixture.available(), fixture.prices(), 40);

        for (int i = 0; i < 3; i++) {
            engine.evaluate(ctx); // riscaldamento della JIT
        }
        long start = System.nanoTime();
        int runs = 10;
        for (int i = 0; i < runs; i++) {
            engine.evaluate(ctx);
        }
        long averageMillis = (System.nanoTime() - start) / runs / 1_000_000;

        assertThat(averageMillis).isLessThan(80L);
    }

    /**
     * La shortlist di {@link RosterCompleter} prefiltra i candidati per contenere il
     * costo del completamento su un listone reale. Questo test verifica che non cambi
     * la risposta: confronta il motore con la shortlist attiva contro un motore con la
     * shortlist disattivata (dimensione {@code Integer.MAX_VALUE}, quindi tutti i
     * candidati visibili) sullo stesso fixture realistico. I prezzi sono generati con
     * dispersione deliberata del rapporto valore/prezzo (non punti/8 costante): solo
     * così un filtro sui soli punti potrebbe davvero scartare l'opzione economica e
     * dignitosa che il criterio valore/prezzo esiste per trovare, mettendo alla prova
     * l'unione delle due graduatorie invece di un caso in cui non potrebbe mai sbagliare.
     */
    @Test
    void shortlistDoesNotChangeMaxBidAtRealisticScale() {
        RealisticFixture fixture = buildRealisticFixture(20260901L);
        ValuationContext ctx = new ValuationContext(fixture.state(), fixture.target(),
                List.of(), fixture.available(), fixture.prices(), 40);

        RosterCompleter shortlisted = new RosterCompleter(modifiers, REPLACEMENT);
        RosterCompleter unlimited = new RosterCompleter(modifiers, REPLACEMENT,
                Integer.MAX_VALUE, Integer.MAX_VALUE);
        ValuationEngine engineWithShortlist = new ValuationEngine(shortlisted, modifiers);
        ValuationEngine engineWithoutShortlist = new ValuationEngine(unlimited, modifiers);

        int maxBidWithShortlist = engineWithShortlist.evaluate(ctx).maxBid();
        int maxBidWithoutShortlist = engineWithoutShortlist.evaluate(ctx).maxBid();

        assertThat(maxBidWithShortlist).isEqualTo(maxBidWithoutShortlist);
    }

    /**
     * {@code surplus(prezzo)} nasce da un'euristica greedy + local search e la ricerca
     * binaria del prezzo massimo ASSUME che sia solo approssimativamente monotona, non
     * monotona in senso stretto (si veda il javadoc di {@link ValuationEngine}). Questo
     * test scansiona ogni prezzo intero su un fixture piccolo e verifica empiricamente
     * l'ipotesi: se fallisse, vorrebbe dire che la ricerca binaria può restituire un
     * prezzo che non è il vero massimo.
     */
    @Test
    void surplusScansAsApproximatelyMonotoneAcrossEveryPrice() {
        seedPool();
        AuctionState state = state(List.of());
        ValuationContext ctx = context(p("bestDef"), state);
        int hardCap = state.mySquad().maxSpendableNow();

        double previous = Double.POSITIVE_INFINITY;
        for (int price = 1; price <= hardCap; price++) {
            double surplus = engine.surplusAt(ctx, price);
            assertThat(surplus)
                    .as("prezzo %d", price)
                    .isLessThanOrEqualTo(previous);
            previous = surplus;
        }
    }

    private record RealisticFixture(AuctionState state, PlayerProjection target,
                                    List<PlayerProjection> available, PriceModel prices) {
    }

    private RealisticFixture buildRealisticFixture(long seed) {
        LeagueRules realisticRules = new LeagueRules(8, 500,
                Map.of(Role.P, 3, Role.D, 8, Role.C, 8, Role.A, 6),
                List.of(Role.P, Role.D, Role.C, Role.A));

        List<Participant> realisticParticipants = new ArrayList<>();
        realisticParticipants.add(new Participant("me", "Io", 'I', true));
        for (int i = 1; i <= 7; i++) {
            realisticParticipants.add(new Participant("riv" + i, "Rivale " + i, (char) ('A' + i), false));
        }
        List<String> rivalIds = realisticParticipants.stream()
                .map(Participant::id)
                .filter(id -> !id.equals("me"))
                .toList();

        Random random = new Random(seed);
        List<PlayerProjection> bigPool = new ArrayList<>();
        Map<String, Double> bigPriors = new HashMap<>();
        Map<String, Role> bigRoles = new HashMap<>();

        // Proporzioni del listone reale: ~60 portieri, ~200 difensori, ~200
        // centrocampisti, ~140 attaccanti, per un totale di circa 600 giocatori.
        seedRealisticGroup(bigPool, bigPriors, bigRoles, random, Role.P, "gk", 60, 150.0);
        seedRealisticGroup(bigPool, bigPriors, bigRoles, random, Role.D, "df", 200, 320.0);
        seedRealisticGroup(bigPool, bigPriors, bigRoles, random, Role.C, "mf", 200, 380.0);
        seedRealisticGroup(bigPool, bigPriors, bigRoles, random, Role.A, "fw", 140, 420.0);

        Map<Role, Double> flatBias = new EnumMap<>(Role.class);
        for (Role role : Role.values()) {
            flatBias.put(role, 1.0);
        }
        PriceModel bigPrices = new PriceModel(bigPriors, 1.0, flatBias);

        // Stato di metà asta: i migliori giocatori di ogni ruolo (i primi generati,
        // quindi i piu' quotati) sono gia' stati venduti, distribuiti sui 7 rivali —
        // "me" non ha ancora comprato nulla. Sold totali: 8 + 23 + 22 + 17 = 70.
        Map<Role, Integer> soldPerRole = Map.of(Role.P, 8, Role.D, 23, Role.C, 22, Role.A, 17);
        List<AuctionEvent> events = new ArrayList<>();
        long seq = 1;
        Map<Role, String> prefixOf = Map.of(Role.P, "gk", Role.D, "df", Role.C, "mf", Role.A, "fw");
        for (Role role : List.of(Role.P, Role.D, Role.C, Role.A)) {
            String prefix = prefixOf.get(role);
            int count = soldPerRole.get(role);
            for (int i = 0; i < count; i++) {
                String playerId = prefix + i;
                String buyer = rivalIds.get(i % rivalIds.size());
                int price = Math.max(1, (int) Math.round(bigPriors.get(playerId)));
                events.add(new AuctionEvent.PlayerPurchased(seq++, T, playerId, buyer, price));
            }
        }
        AuctionState state = AuctionProjector.project(realisticRules, realisticParticipants,
                bigRoles::get, events);

        // Obiettivo: il primo difensore ancora libero dopo quelli gia' venduti — un
        // titolare di fascia medio-alta, non il migliore in assoluto ne' uno scarto.
        PlayerProjection target = bigPool.stream()
                .filter(pp -> pp.playerId().equals("df" + soldPerRole.get(Role.D)))
                .findFirst().orElseThrow();

        List<PlayerProjection> available = bigPool.stream()
                .filter(pp -> !state.soldPlayerIds().contains(pp.playerId()))
                .toList();

        return new RealisticFixture(state, target, available, bigPrices);
    }

    private static void seedRealisticGroup(List<PlayerProjection> poolOut, Map<String, Double> priorsOut,
                                           Map<String, Role> rolesOut, Random random, Role role,
                                           String prefix, int count, double topPoints) {
        for (int i = 0; i < count; i++) {
            double points = Math.max(5.0, topPoints * (1.0 - (double) i / count) + random.nextInt(21) - 10);
            // Dispersione deliberata del rapporto valore/prezzo: con un prezzo quasi
            // proporzionale ai punti (es. punti/8 costante), un filtro ordinato per
            // soli punti non potrebbe mai sbagliare e la shortlist non sarebbe messa
            // alla prova. Il moltiplicatore va da 0.3x (economico e dignitoso) a 3.0x
            // (sopravvalutato), includendo anche il caso costoso-e-forte quando i punti
            // di base sono già alti.
            double multiplier = 0.3 + random.nextDouble() * 2.7;
            double price = Math.max(1.0, Math.round(points / 8.0 * multiplier));
            String id = prefix + i;
            PlayerProjection projection = new PlayerProjection(id, role, 6.0, 0.0, 30.0, points, 30.0);
            poolOut.add(projection);
            priorsOut.put(id, price);
            rolesOut.put(id, role);
        }
    }
}
