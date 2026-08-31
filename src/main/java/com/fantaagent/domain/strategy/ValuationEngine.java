package com.fantaagent.domain.strategy;

import com.fantaagent.domain.auction.Holding;
import com.fantaagent.domain.auction.Squad;
import com.fantaagent.domain.player.PlayerProjection;
import com.fantaagent.domain.player.Role;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.function.UnaryOperator;

/**
 * Calcola il prezzo massimo come il prezzo oltre il quale acquistare il giocatore
 * smette di migliorare la migliore rosa ancora completabile.
 *
 * <p>{@code surplus(prezzo)} è calcolato componendo l'euristica greedy + local search di
 * {@link RosterCompleter}, quindi è solo approssimativamente monotono non crescente nel
 * prezzo, non monotono in senso stretto. La ricerca binaria su {@code [1, hardCap]}
 * ASSUME questa monotonicità approssimata per restare a ~8 completamenti invece di uno
 * per ogni prezzo possibile: se l'euristica producesse un'inversione locale, il prezzo
 * trovato potrebbe non essere il vero massimo. Un test a fixture ridotto scansiona
 * {@code surplus} su ogni prezzo intero per verificare empiricamente questa ipotesi.
 */
public final class ValuationEngine {

    /** Perturbazione dei prezzi usata per misurare la stabilità della soluzione. */
    private static final double STABILITY_PERTURBATION = 0.15;

    private final RosterCompleter completer;
    private final ModifierCalculator modifiers;
    private final UnaryOperator<String> playerNameResolver;

    public ValuationEngine(RosterCompleter completer, ModifierCalculator modifiers) {
        this(completer, modifiers, UnaryOperator.identity());
    }

    /**
     * @param playerNameResolver risolve un {@code playerId} nel nome da mostrare
     *                           all'utente, ad esempio per il driver "Alternativa". Il
     *                           dominio non conosce i nomi dei giocatori: il resolver e'
     *                           iniettato da chi assembla il motore e ha accesso al
     *                           catalogo. Di default e' l'identita', cosi' i test e i
     *                           chiamanti esistenti non cambiano comportamento.
     */
    public ValuationEngine(RosterCompleter completer, ModifierCalculator modifiers,
                           UnaryOperator<String> playerNameResolver) {
        this.completer = completer;
        this.modifiers = modifiers;
        this.playerNameResolver = playerNameResolver;
    }

    public PriceRecommendation evaluate(ValuationContext ctx) {
        Squad mySquad = ctx.state().mySquad();
        PlayerProjection target = ctx.target();
        int hardCap = mySquad.maxSpendableNow();
        int expectedPrice = ctx.prices().expectedPrice(target);
        // Calcolato una sola volta per valutazione: rifarlo a ogni chiamata di surplus()
        // (circa 27 volte fra le tre ricerche binarie) sposterebbe solo il costo.
        List<PlayerProjection> availableWithoutTarget = withoutTarget(ctx);

        if (!mySquad.hasRoom(target.role())) {
            return refusal(ctx, expectedPrice, hardCap, availableWithoutTarget,
                    "nessuno slot libero per il ruolo " + target.role());
        }
        if (hardCap < 1) {
            return refusal(ctx, expectedPrice, hardCap, availableWithoutTarget,
                    "budget esaurito: ogni slot residuo richiede almeno 1 credito");
        }

        int maxBid = maxBidFor(ctx, hardCap, ctx.prices(), availableWithoutTarget);
        String walkAway = maxBid == 0
                ? "nessun vantaggio nemmeno a 1 credito rispetto alle alternative"
                : maxBid == hardCap
                        ? "oltre " + hardCap + " non potresti più coprire gli slot residui"
                        : "oltre " + maxBid + " il completamento della rosa perde più di quanto guadagni";

        int low = maxBidFor(ctx, hardCap, ctx.prices().withInflation(1 - STABILITY_PERTURBATION),
                availableWithoutTarget);
        int high = maxBidFor(ctx, hardCap, ctx.prices().withInflation(1 + STABILITY_PERTURBATION),
                availableWithoutTarget);

        ConfidenceScore confidence = ConfidenceScore.of(
                ConfidenceScore.dataFactor(target.observedAppearances()),
                ConfidenceScore.startingFactor(target.startingProbability()),
                ConfidenceScore.marketFactor(ctx.salesInCurrentPhase()),
                ConfidenceScore.stabilityFactor(maxBid, low, high));

        return new PriceRecommendation(target.playerId(), expectedPrice, maxBid, hardCap,
                maxBid - expectedPrice, walkAway, confidence,
                buildDrivers(ctx, hardCap, availableWithoutTarget));
    }

    /** Prezzo intero più alto in [1, hardCap] con surplus positivo; 0 se non esiste. */
    private int maxBidFor(ValuationContext ctx, int hardCap, PriceModel prices,
                          List<PlayerProjection> availableWithoutTarget) {
        double baseline = valueWithout(ctx, prices, availableWithoutTarget);
        if (surplus(ctx, prices, 1, baseline, availableWithoutTarget) <= 0) {
            return 0;
        }
        int low = 1;
        int high = hardCap;
        while (low < high) {
            int mid = low + (high - low + 1) / 2;
            if (surplus(ctx, prices, mid, baseline, availableWithoutTarget) > 0) {
                low = mid;
            } else {
                high = mid - 1;
            }
        }
        return low;
    }

    private double valueWithout(ValuationContext ctx, PriceModel prices,
                                List<PlayerProjection> availableWithoutTarget) {
        return completer.complete(ctx.state().mySquad(), ctx.ownedByMe(),
                availableWithoutTarget, prices).totalPoints();
    }

    private double surplus(ValuationContext ctx, PriceModel prices, int price, double baseline,
                           List<PlayerProjection> availableWithoutTarget) {
        PlayerProjection target = ctx.target();
        Squad squadWith = ctx.state().mySquad().with(
                new Holding(-1L, target.playerId(), target.role(),
                        ctx.state().myParticipantId(), price));
        List<PlayerProjection> ownedWith = new ArrayList<>(ctx.ownedByMe());
        ownedWith.add(target);

        double valueWith = completer.complete(squadWith, ownedWith, availableWithoutTarget, prices)
                .totalPoints();
        return valueWith - baseline;
    }

    /**
     * Solo per i test: espone {@code surplus(prezzo)} per verificare empiricamente
     * l'ipotesi di monotonicità approssimata su cui si basa la ricerca binaria.
     */
    double surplusAt(ValuationContext ctx, int price) {
        List<PlayerProjection> availableWithoutTarget = withoutTarget(ctx);
        double baseline = valueWithout(ctx, ctx.prices(), availableWithoutTarget);
        return surplus(ctx, ctx.prices(), price, baseline, availableWithoutTarget);
    }

    private static List<PlayerProjection> withoutTarget(ValuationContext ctx) {
        return ctx.available().stream()
                .filter(p -> !p.playerId().equals(ctx.target().playerId()))
                .toList();
    }

    private PriceRecommendation refusal(ValuationContext ctx, int expectedPrice, int hardCap,
                                        List<PlayerProjection> availableWithoutTarget, String reason) {
        ConfidenceScore confidence = ConfidenceScore.of(
                ConfidenceScore.dataFactor(ctx.target().observedAppearances()),
                ConfidenceScore.startingFactor(ctx.target().startingProbability()),
                ConfidenceScore.marketFactor(ctx.salesInCurrentPhase()),
                1.0);
        return new PriceRecommendation(ctx.target().playerId(), expectedPrice, 0, hardCap,
                -expectedPrice, reason, confidence, buildDrivers(ctx, hardCap, availableWithoutTarget));
    }

    private List<Driver> buildDrivers(ValuationContext ctx, int hardCap,
                                      List<PlayerProjection> availableWithoutTarget) {
        List<Driver> drivers = new ArrayList<>();
        PlayerProjection target = ctx.target();
        Squad mySquad = ctx.state().mySquad();

        double modifierDelta = modifiers.marginalPoints(ctx.ownedByMe(), target) - target.basePoints();
        drivers.add(new Driver("Modificatori", modifierDelta,
                modifierDelta > 0.5
                        ? String.format("alza il reparto: +%.1f punti stagionali oltre i suoi", modifierDelta)
                        : "nessun effetto rilevante sui modificatori con la rosa attuale"));

        drivers.add(new Driver("Budget", hardCap,
                String.format("hardCap %d — restano %d crediti e %d slot da coprire",
                        hardCap, mySquad.budgetRemaining(), mySquad.slotsRemaining())));

        Optional<PlayerProjection> alternative = availableWithoutTarget.stream()
                .filter(p -> p.role() == target.role())
                .max(Comparator.comparingDouble(PlayerProjection::basePoints));
        alternative.ifPresent(alt -> {
            double ratio = target.basePoints() > 0 ? alt.basePoints() / target.basePoints() : 0.0;
            int altPrice = ctx.prices().expectedPrice(alt);
            int realDifference = ctx.prices().expectedPrice(target) - altPrice;
            drivers.add(new Driver("Alternativa", altPrice,
                    String.format("%s a ~%d crediti rende il %.0f%%, differenza reale %d crediti",
                            playerNameResolver.apply(alt.playerId()), altPrice, ratio * 100,
                            realDifference)));
        });

        MarketPressure pressure = MarketPressure.from(ctx.state());
        drivers.add(new Driver("Concorrenza", pressure.maxRivalBid(target.role()),
                String.format("%d avversari cercano ancora un %s, il più ricco può arrivare a %d",
                        pressure.rivalsNeeding(target.role()), target.role(),
                        pressure.maxRivalBid(target.role()))));

        drivers.add(new Driver("Inflazione", ctx.prices().inflationForward(),
                String.format("il mercato viaggia al %.0f%% dei valori teorici",
                        ctx.prices().inflationForward() * 100)));

        return drivers.size() > 5 ? drivers.subList(0, 5) : drivers;
    }
}
