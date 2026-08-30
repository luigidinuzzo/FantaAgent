package com.fantaagent.domain.strategy;

import com.fantaagent.domain.auction.AuctionState;
import com.fantaagent.domain.auction.Holding;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.player.PlayerProjection;
import com.fantaagent.domain.player.Role;

import java.util.Collection;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.ToIntFunction;

/**
 * Prezzi attesi di mercato.
 *
 * <p>L'inflazione è forward-looking: confronta i crediti ancora in circolazione con il
 * valore dei giocatori ancora disponibili, così il motore sa che i prezzi saliranno
 * prima che salgano davvero.
 */
public record PriceModel(Map<String, Double> priors, double inflationForward, Map<Role, Double> roleBias) {

    /** Pseudo-conteggio dello smorzamento del bias di ruolo. */
    private static final double BIAS_K = 10.0;

    public PriceModel {
        priors = Map.copyOf(priors);
        roleBias = Map.copyOf(roleBias);
    }

    public int expectedPrice(PlayerProjection projection) {
        double prior = priors.getOrDefault(projection.playerId(), 1.0);
        double bias = roleBias.getOrDefault(projection.role(), 1.0);
        return Math.max(1, (int) Math.round(prior * inflationForward * bias));
    }

    /** I primi {@code partecipanti * slot(ruolo)} di ogni ruolo per punti attesi. */
    public static Set<String> rosterWorthy(LeagueRules rules, Collection<PlayerProjection> all) {
        Set<String> worthy = new HashSet<>();
        for (Role role : Role.values()) {
            all.stream()
                    .filter(p -> p.role() == role)
                    .sorted(Comparator.comparingDouble(PlayerProjection::basePoints).reversed())
                    .limit((long) rules.participants() * rules.slots(role))
                    .forEach(p -> worthy.add(p.playerId()));
        }
        return Set.copyOf(worthy);
    }

    public static PriceModel build(LeagueRules rules, AuctionState state,
                                   Collection<PlayerProjection> allProjections,
                                   ToIntFunction<String> listPriceOf) {
        Set<String> worthy = rosterWorthy(rules, allProjections);

        double listPriceSum = allProjections.stream()
                .filter(p -> worthy.contains(p.playerId()))
                .mapToInt(p -> listPriceOf.applyAsInt(p.playerId()))
                .sum();
        double leagueBudget = (double) rules.participants() * rules.budget();
        double scale = listPriceSum > 0 ? leagueBudget / listPriceSum : 1.0;

        Map<String, Double> priors = new HashMap<>();
        for (PlayerProjection p : allProjections) {
            priors.put(p.playerId(), listPriceOf.applyAsInt(p.playerId()) * scale);
        }

        Set<String> sold = state.soldPlayerIds();
        double remainingPriorValue = allProjections.stream()
                .filter(p -> worthy.contains(p.playerId()))
                .filter(p -> !sold.contains(p.playerId()))
                .mapToDouble(p -> priors.get(p.playerId()))
                .sum();
        double remainingCredits = state.squads().values().stream()
                .mapToInt(squad -> squad.budgetRemaining())
                .sum();
        double inflationForward = remainingPriorValue > 0
                ? remainingCredits / remainingPriorValue
                : 1.0;

        return new PriceModel(priors, inflationForward, computeRoleBias(state.holdings(), priors));
    }

    private static Map<Role, Double> computeRoleBias(List<Holding> holdings, Map<String, Double> priors) {
        double globalPaid = 0.0;
        double globalPrior = 0.0;
        Map<Role, double[]> perRole = new EnumMap<>(Role.class);
        for (Role role : Role.values()) {
            perRole.put(role, new double[3]); // pagato, prior, conteggio
        }
        for (Holding h : holdings) {
            double prior = priors.getOrDefault(h.playerId(), 1.0);
            globalPaid += h.price();
            globalPrior += prior;
            double[] acc = perRole.get(h.role());
            acc[0] += h.price();
            acc[1] += prior;
            acc[2] += 1;
        }
        double globalRatio = globalPrior > 0 ? globalPaid / globalPrior : 1.0;

        Map<Role, Double> bias = new EnumMap<>(Role.class);
        for (Role role : Role.values()) {
            double[] acc = perRole.get(role);
            double n = acc[2];
            double observed = acc[1] > 0 ? acc[0] / acc[1] : globalRatio;
            // smorzamento verso il rapporto globale finché i campioni di ruolo sono pochi
            double shrunk = (n * observed + BIAS_K * globalRatio) / (n + BIAS_K);
            bias.put(role, globalRatio > 0 ? shrunk / globalRatio : 1.0);
        }
        return bias;
    }
}
