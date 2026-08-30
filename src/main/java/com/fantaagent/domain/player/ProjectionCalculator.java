package com.fantaagent.domain.player;

import com.fantaagent.domain.league.ScoringRules;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

public final class ProjectionCalculator {

    /** Pseudo-conteggio dello shrinkage: quante presenze "virtuali" alla media di ruolo. */
    public static final double SHRINKAGE_K = 15.0;

    public static final double SEASON_MATCHES = 38.0;

    /** Pesi delle stagioni, dalla più recente. Rinormalizzati su quelle disponibili. */
    private static final List<Double> SEASON_WEIGHTS = List.of(0.5, 0.3, 0.2);

    /** Prior grezzo di presenze per chi non ha storico, discriminato dalla quotazione. */
    private static final int STARTER_PRICE_THRESHOLD = 12;
    private static final double STARTER_PRIOR_APPEARANCES = 26.0;
    private static final double BENCH_PRIOR_APPEARANCES = 10.0;

    private final ScoringRules scoring;

    public ProjectionCalculator(ScoringRules scoring) {
        this.scoring = scoring;
    }

    public PlayerProjection project(Player player, List<SeasonStats> newestFirst,
                                    double roleAverageRating) {
        double weightedAppearances = 0.0;
        double weightedRatingNumerator = 0.0;
        double weightedBonus = 0.0;

        int seasons = Math.min(newestFirst.size(), SEASON_WEIGHTS.size());
        double weightSum = 0.0;
        for (int i = 0; i < seasons; i++) {
            weightSum += SEASON_WEIGHTS.get(i);
        }
        for (int i = 0; i < seasons; i++) {
            SeasonStats s = newestFirst.get(i);
            double w = SEASON_WEIGHTS.get(i) / weightSum;
            weightedAppearances += w * s.appearances();
            weightedRatingNumerator += w * s.appearances() * s.averageRating();
            weightedBonus += w * bonusPoints(s, player.role());
        }

        double observedRating = weightedAppearances > 0
                ? weightedRatingNumerator / weightedAppearances
                : roleAverageRating;
        double expectedRating =
                (weightedAppearances * observedRating + SHRINKAGE_K * roleAverageRating)
                / (weightedAppearances + SHRINKAGE_K);

        double bonusPerAppearance = weightedAppearances > 0
                ? weightedBonus / weightedAppearances
                : 0.0;

        double expectedAppearances = weightedAppearances > 0
                ? Math.min(SEASON_MATCHES, weightedAppearances)
                : priorAppearances(player);

        double basePoints = (expectedRating + bonusPerAppearance) * expectedAppearances;

        return new PlayerProjection(player.id(), player.role(), expectedRating,
                bonusPerAppearance, expectedAppearances, basePoints, weightedAppearances);
    }

    /** Punti bonus/malus totali di una stagione, con le regole della nostra lega. */
    private double bonusPoints(SeasonStats s, Role role) {
        int openPlayGoals = Math.max(0, s.goals() - s.penaltiesScored());
        double total = openPlayGoals * scoring.goalBonus(role)
                + s.penaltiesScored() * scoring.penaltyScored()
                + s.penaltiesMissed() * scoring.penaltyMissed()
                + s.assists() * scoring.assist()
                + s.yellowCards() * scoring.yellowCard()
                + s.redCards() * scoring.redCard();
        if (role == Role.P) {
            total += s.penaltiesSaved() * scoring.penaltySaved()
                    + s.goalsConceded() * scoring.goalConceded()
                    + s.cleanSheets() * scoring.cleanSheet();
        }
        return total;
    }

    private static double priorAppearances(Player player) {
        return player.listPrice() >= STARTER_PRICE_THRESHOLD
                ? STARTER_PRIOR_APPEARANCES
                : BENCH_PRIOR_APPEARANCES;
    }

    /** Media voto di ruolo, pesata per presenze: è il centro dello shrinkage. */
    public static Map<Role, Double> roleAverageRatings(
            List<Player> players, Function<String, List<SeasonStats>> statsOf) {
        Map<Role, double[]> accumulator = new EnumMap<>(Role.class);
        for (Role role : Role.values()) {
            accumulator.put(role, new double[2]);
        }
        for (Player player : players) {
            double[] acc = accumulator.get(player.role());
            for (SeasonStats s : statsOf.apply(player.id())) {
                acc[0] += s.appearances() * s.averageRating();
                acc[1] += s.appearances();
            }
        }
        Map<Role, Double> averages = new EnumMap<>(Role.class);
        for (Role role : Role.values()) {
            double[] acc = accumulator.get(role);
            averages.put(role, acc[1] > 0 ? acc[0] / acc[1] : 6.0);
        }
        return averages;
    }
}
