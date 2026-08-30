package com.fantaagent.domain.strategy;

import com.fantaagent.domain.auction.Squad;
import com.fantaagent.domain.player.PlayerProjection;
import com.fantaagent.domain.player.Role;

import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Completa la rosa con un greedy sul rapporto valore/prezzo, seguito da una passata di
 * local search.
 *
 * <p>Il greedy da solo può fissarsi su un blocco difensivo sub-ottimo, perché con i
 * modificatori il valore marginale dipende dall'ordine di inserimento. La local search
 * tenta scambi a parità di ruolo e recupera gran parte del divario. Il risultato resta
 * un'euristica: l'incertezza sui prezzi attesi è comunque maggiore dell'errore residuo.
 */
public final class RosterCompleter {

    private static final int LOCAL_SEARCH_PASSES = 3;

    public record Completion(List<PlayerProjection> picks, double totalPoints, int budgetLeft) {

        public Completion {
            picks = List.copyOf(picks);
        }
    }

    private final ModifierCalculator modifiers;
    private final ReplacementLevels replacement;

    public RosterCompleter(ModifierCalculator modifiers, ReplacementLevels replacement) {
        this.modifiers = modifiers;
        this.replacement = replacement;
    }

    public Completion complete(Squad squad, List<PlayerProjection> owned,
                               Collection<PlayerProjection> available, PriceModel prices) {
        List<PlayerProjection> roster = new ArrayList<>(owned);
        List<PlayerProjection> picks = new ArrayList<>();
        Set<String> taken = new HashSet<>();
        owned.forEach(p -> taken.add(p.playerId()));

        Map<Role, Integer> openSlots = new EnumMap<>(Role.class);
        for (Role role : Role.values()) {
            openSlots.put(role, squad.slotsRemaining(role));
        }
        int budget = squad.budgetRemaining();
        int slotsLeft = openSlots.values().stream().mapToInt(Integer::intValue).sum();

        while (slotsLeft > 0) {
            PlayerProjection best = null;
            double bestScore = Double.NEGATIVE_INFINITY;
            int bestCost = 0;

            for (PlayerProjection candidate : available) {
                if (taken.contains(candidate.playerId())) {
                    continue;
                }
                if (openSlots.get(candidate.role()) <= 0) {
                    continue;
                }
                int cost = Math.max(1, prices.expectedPrice(candidate));
                if (cost > budget - (slotsLeft - 1)) {
                    continue;
                }
                double gain = modifiers.marginalPoints(roster, candidate)
                        - replacement.points(candidate.role());
                double score = gain / cost;
                if (score > bestScore) {
                    bestScore = score;
                    best = candidate;
                    bestCost = cost;
                }
            }

            if (best == null) {
                break; // nessun candidato ammissibile per gli slot residui
            }
            roster.add(best);
            picks.add(best);
            taken.add(best.playerId());
            openSlots.merge(best.role(), -1, Integer::sum);
            budget -= bestCost;
            slotsLeft--;
        }

        budget = localSearch(roster, picks, available, prices, budget);

        return new Completion(picks, modifiers.squadPoints(roster), budget);
    }

    /**
     * Tenta di sostituire un giocatore scelto con uno non scelto dello stesso ruolo,
     * accettando lo scambio solo se aumenta i punti totali senza sforare il budget.
     */
    private int localSearch(List<PlayerProjection> roster, List<PlayerProjection> picks,
                            Collection<PlayerProjection> available, PriceModel prices, int budget) {
        Set<String> inRoster = new HashSet<>();
        roster.forEach(p -> inRoster.add(p.playerId()));

        for (int pass = 0; pass < LOCAL_SEARCH_PASSES; pass++) {
            boolean improved = false;
            for (int i = 0; i < picks.size(); i++) {
                PlayerProjection current = picks.get(i);
                int currentCost = Math.max(1, prices.expectedPrice(current));
                double currentPoints = modifiers.squadPoints(roster);

                for (PlayerProjection candidate : available) {
                    if (inRoster.contains(candidate.playerId())
                            || candidate.role() != current.role()) {
                        continue;
                    }
                    int candidateCost = Math.max(1, prices.expectedPrice(candidate));
                    if (candidateCost - currentCost > budget) {
                        continue;
                    }
                    List<PlayerProjection> swapped = new ArrayList<>(roster);
                    swapped.remove(current);
                    swapped.add(candidate);
                    if (modifiers.squadPoints(swapped) > currentPoints) {
                        roster.clear();
                        roster.addAll(swapped);
                        picks.set(i, candidate);
                        inRoster.remove(current.playerId());
                        inRoster.add(candidate.playerId());
                        budget -= (candidateCost - currentCost);
                        improved = true;
                        break;
                    }
                }
            }
            if (!improved) {
                break;
            }
        }
        return budget;
    }
}
