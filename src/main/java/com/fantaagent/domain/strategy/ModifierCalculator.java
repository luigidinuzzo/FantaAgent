package com.fantaagent.domain.strategy;

import com.fantaagent.domain.league.ScoringRules;
import com.fantaagent.domain.player.PlayerProjection;
import com.fantaagent.domain.player.ProjectionCalculator;
import com.fantaagent.domain.player.Role;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Traduce i modificatori di difesa e portiere in punti stagionali.
 *
 * <p>Il modificatore non è una proprietà del giocatore ma del reparto schierato: il
 * contributo di un singolo giocatore è quindi una differenza fra il reparto con e senza
 * di lui. Gli slot scoperti sono riempiti con la media voto del giocatore marginale del
 * ruolo, così che il termine sia definito anche a rosa vuota.
 */
public final class ModifierCalculator {

    private final ScoringRules scoring;
    private final ReplacementLevels replacement;

    public ModifierCalculator(ScoringRules scoring, ReplacementLevels replacement) {
        this.scoring = scoring;
        this.replacement = replacement;
    }

    public double modifierPoints(List<PlayerProjection> squad) {
        double keeperRating = bestRating(squad, Role.P).orElse(replacement.rating(Role.P));

        int defendersCounted = scoring.defenceModifier().defendersCounted();
        List<Double> defenderRatings = topRatings(squad, Role.D, defendersCounted);
        while (defenderRatings.size() < defendersCounted) {
            defenderRatings.add(replacement.rating(Role.D));
        }

        double sum = keeperRating;
        for (double rating : defenderRatings) {
            sum += rating;
        }
        double unitAverage = sum / (defenderRatings.size() + 1);

        double defenceBonus = scoring.defenceModifier().bonusFor(unitAverage);
        double keeperBonus = scoring.goalkeeperModifier().bonusFor(keeperRating);

        return ProjectionCalculator.SEASON_MATCHES * (defenceBonus + keeperBonus);
    }

    /** Valore complessivo della rosa: punti base dei giocatori più i modificatori. */
    public double squadPoints(List<PlayerProjection> squad) {
        double base = squad.stream().mapToDouble(PlayerProjection::basePoints).sum();
        return base + modifierPoints(squad);
    }

    /** Contributo del candidato alla rosa data, modificatori inclusi. */
    public double marginalPoints(List<PlayerProjection> squad, PlayerProjection candidate) {
        List<PlayerProjection> extended = new ArrayList<>(squad);
        extended.add(candidate);
        return candidate.basePoints() + (modifierPoints(extended) - modifierPoints(squad));
    }

    private static java.util.OptionalDouble bestRating(List<PlayerProjection> squad, Role role) {
        return squad.stream()
                .filter(p -> p.role() == role)
                .mapToDouble(PlayerProjection::expectedRating)
                .max();
    }

    private static List<Double> topRatings(List<PlayerProjection> squad, Role role, int howMany) {
        return new ArrayList<>(squad.stream()
                .filter(p -> p.role() == role)
                .map(PlayerProjection::expectedRating)
                .sorted(Comparator.reverseOrder())
                .limit(howMany)
                .toList());
    }
}
