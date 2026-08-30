package com.fantaagent.domain.strategy;

import com.fantaagent.domain.auction.Holding;
import com.fantaagent.domain.auction.Squad;
import com.fantaagent.domain.player.PlayerProjection;
import com.fantaagent.domain.player.Role;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * Calcola il prezzo massimo come il prezzo oltre il quale acquistare il giocatore
 * smette di migliorare la migliore rosa ancora completabile.
 *
 * <p>{@code surplus(prezzo)} è monotono decrescente, quindi il prezzo massimo si trova
 * per ricerca binaria: circa otto completamenti invece di uno per ogni prezzo possibile.
 */
public final class ValuationEngine {

    /** Perturbazione dei prezzi usata per misurare la stabilità della soluzione. */
    private static final double STABILITY_PERTURBATION = 0.15;

    private final RosterCompleter completer;
    private final ModifierCalculator modifiers;
    private final ReplacementLevels replacement;

    public ValuationEngine(RosterCompleter completer, ModifierCalculator modifiers,
                           ReplacementLevels replacement) {
        this.completer = completer;
        this.modifiers = modifiers;
        this.replacement = replacement;
    }

    public PriceRecommendation evaluate(ValuationContext ctx) {
        Squad mySquad = ctx.state().mySquad();
        PlayerProjection target = ctx.target();
        int hardCap = mySquad.maxSpendableNow();
        int expectedPrice = ctx.prices().expectedPrice(target);

        if (!mySquad.hasRoom(target.role())) {
            return refusal(ctx, expectedPrice, hardCap,
                    "nessuno slot libero per il ruolo " + target.role());
        }
        if (hardCap < 1) {
            return refusal(ctx, expectedPrice, 0,
                    "budget esaurito: ogni slot residuo richiede almeno 1 credito");
        }

        int maxBid = maxBidFor(ctx, hardCap, ctx.prices());
        String walkAway = maxBid == 0
                ? "nessun vantaggio nemmeno a 1 credito rispetto alle alternative"
                : maxBid == hardCap
                        ? "oltre " + hardCap + " non potresti più coprire gli slot residui"
                        : "oltre " + maxBid + " il completamento della rosa perde più di quanto guadagni";

        int low = maxBidFor(ctx, hardCap, ctx.prices().withInflation(1 - STABILITY_PERTURBATION));
        int high = maxBidFor(ctx, hardCap, ctx.prices().withInflation(1 + STABILITY_PERTURBATION));

        ConfidenceScore confidence = ConfidenceScore.of(
                ConfidenceScore.dataFactor(target.observedAppearances()),
                ConfidenceScore.startingFactor(target.startingProbability()),
                ConfidenceScore.marketFactor(ctx.salesInCurrentPhase()),
                ConfidenceScore.stabilityFactor(maxBid, low, high));

        return new PriceRecommendation(target.playerId(), expectedPrice, maxBid, hardCap,
                maxBid - expectedPrice, walkAway, confidence, buildDrivers(ctx, maxBid, hardCap));
    }

    /** Prezzo intero più alto in [1, hardCap] con surplus positivo; 0 se non esiste. */
    private int maxBidFor(ValuationContext ctx, int hardCap, PriceModel prices) {
        double baseline = valueWithout(ctx, prices);
        if (surplus(ctx, prices, 1, baseline) <= 0) {
            return 0;
        }
        int low = 1;
        int high = hardCap;
        while (low < high) {
            int mid = low + (high - low + 1) / 2;
            if (surplus(ctx, prices, mid, baseline) > 0) {
                low = mid;
            } else {
                high = mid - 1;
            }
        }
        return low;
    }

    private double valueWithout(ValuationContext ctx, PriceModel prices) {
        return completer.complete(ctx.state().mySquad(), ctx.ownedByMe(),
                withoutTarget(ctx), prices).totalPoints();
    }

    private double surplus(ValuationContext ctx, PriceModel prices, int price, double baseline) {
        PlayerProjection target = ctx.target();
        Squad squadWith = ctx.state().mySquad().with(
                new Holding(-1L, target.playerId(), target.role(),
                        ctx.state().myParticipantId(), price));
        List<PlayerProjection> ownedWith = new ArrayList<>(ctx.ownedByMe());
        ownedWith.add(target);

        double valueWith = completer.complete(squadWith, ownedWith, withoutTarget(ctx), prices)
                .totalPoints();
        return valueWith - baseline;
    }

    private static List<PlayerProjection> withoutTarget(ValuationContext ctx) {
        return ctx.available().stream()
                .filter(p -> !p.playerId().equals(ctx.target().playerId()))
                .toList();
    }

    private PriceRecommendation refusal(ValuationContext ctx, int expectedPrice,
                                        int hardCap, String reason) {
        ConfidenceScore confidence = ConfidenceScore.of(
                ConfidenceScore.dataFactor(ctx.target().observedAppearances()),
                ConfidenceScore.startingFactor(ctx.target().startingProbability()),
                ConfidenceScore.marketFactor(ctx.salesInCurrentPhase()),
                1.0);
        return new PriceRecommendation(ctx.target().playerId(), expectedPrice, 0, hardCap,
                -expectedPrice, reason, confidence, buildDrivers(ctx, 0, hardCap));
    }

    private List<Driver> buildDrivers(ValuationContext ctx, int maxBid, int hardCap) {
        List<Driver> drivers = new ArrayList<>();
        PlayerProjection target = ctx.target();
        Squad mySquad = ctx.state().mySquad();

        double modifierDelta = modifiers.marginalPoints(ctx.ownedByMe(), target) - target.basePoints();
        drivers.add(new Driver("Modificatori", modifierDelta,
                modifierDelta > 0.5
                        ? String.format("alza il reparto: +%.1f punti stagionali oltre i suoi", modifierDelta)
                        : "nessun effetto rilevante sui modificatori con la rosa attuale"));

        int reserved = Math.max(0, mySquad.slotsRemaining() - 1);
        drivers.add(new Driver("Budget", hardCap,
                String.format("hardCap %d — restano %d crediti e %d slot da coprire",
                        hardCap, mySquad.budgetRemaining(), mySquad.slotsRemaining())));

        Optional<PlayerProjection> alternative = withoutTarget(ctx).stream()
                .filter(p -> p.role() == target.role())
                .max(Comparator.comparingDouble(PlayerProjection::basePoints));
        alternative.ifPresent(alt -> {
            double ratio = target.basePoints() > 0 ? alt.basePoints() / target.basePoints() : 0.0;
            drivers.add(new Driver("Alternativa", ctx.prices().expectedPrice(alt),
                    String.format("%s a ~%d crediti rende il %.0f%%",
                            alt.playerId(), ctx.prices().expectedPrice(alt), ratio * 100)));
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
