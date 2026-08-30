package com.fantaagent.domain.strategy;

import com.fantaagent.domain.auction.Squad;
import com.fantaagent.domain.player.PlayerProjection;
import com.fantaagent.domain.player.Role;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
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

    /**
     * Candidati per ruolo tenuti dalla graduatoria per rapporto valore/prezzo, la
     * stessa metrica usata dal greedy. Un filtro basato sui soli punti scarterebbe
     * proprio i profili economici-e-dignitosi che il criterio valore/prezzo esiste per
     * trovare — motivo per cui la shortlist è un'unione di due graduatorie, non una sola.
     */
    static final int DEFAULT_RATIO_SHORTLIST_SIZE = 12;

    /**
     * Candidati per ruolo tenuti dalla graduatoria per soli punti base, indipendente dal
     * prezzo: recupera i giocatori costosi ma di fascia alta, che il proxy sul rapporto
     * valore/prezzo può sottovalutare perché non vede l'effetto sui modificatori.
     */
    static final int DEFAULT_POINTS_SHORTLIST_SIZE = 15;

    public record Completion(List<PlayerProjection> picks, double totalPoints, int budgetLeft) {

        public Completion {
            picks = List.copyOf(picks);
        }
    }

    private final ModifierCalculator modifiers;
    private final ReplacementLevels replacement;
    private final int ratioShortlistSize;
    private final int pointsShortlistSize;

    public RosterCompleter(ModifierCalculator modifiers, ReplacementLevels replacement) {
        this(modifiers, replacement, DEFAULT_RATIO_SHORTLIST_SIZE, DEFAULT_POINTS_SHORTLIST_SIZE);
    }

    /**
     * Visibile al package solo perché i test di correttezza devono poter disattivare la
     * shortlist (dimensioni {@code Integer.MAX_VALUE}) per confrontare il risultato con
     * quello senza limiti sui candidati.
     */
    RosterCompleter(ModifierCalculator modifiers, ReplacementLevels replacement,
                    int ratioShortlistSize, int pointsShortlistSize) {
        this.modifiers = modifiers;
        this.replacement = replacement;
        this.ratioShortlistSize = ratioShortlistSize;
        this.pointsShortlistSize = pointsShortlistSize;
    }

    public Completion complete(Squad squad, List<PlayerProjection> owned,
                               Collection<PlayerProjection> available, PriceModel prices) {
        List<PlayerProjection> roster = new ArrayList<>(owned);
        List<PlayerProjection> picks = new ArrayList<>();
        Set<String> taken = new HashSet<>();
        owned.forEach(p -> taken.add(p.playerId()));

        // Calcolata una sola volta per chiamata: rifarla a ogni passo sposterebbe
        // semplicemente il costo invece di rimuoverlo.
        List<PlayerProjection> shortlist = shortlistByRole(available, prices);

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

            for (PlayerProjection candidate : shortlist) {
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
                // A parita' di punteggio vince l'id piu' basso, non l'ordine di
                // iterazione: la riproducibilita' delle raccomandazioni e' un requisito
                // della spec e non deve dipendere dal tipo di collezione che il
                // chiamante passa.
                if (score > bestScore
                        || (score == bestScore && best != null
                            && candidate.playerId().compareTo(best.playerId()) < 0)) {
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

        budget = localSearch(roster, picks, shortlist, prices, budget);

        return new Completion(picks, modifiers.squadPoints(roster), budget);
    }

    /**
     * Unione, per ruolo, dei migliori {@link #ratioShortlistSize} per rapporto
     * valore/prezzo e dei migliori {@link #pointsShortlistSize} per soli punti base,
     * deduplicata. Entrambe le graduatorie spezzano i pareggi per id: un ordinamento
     * stabile su una collezione il cui ordine di iterazione varia (es. uno Set)
     * altrimenti farebbe dipendere da quell'ordine QUALI giocatori sopravvivono al
     * taglio, non solo in che ordine compaiono.
     */
    private List<PlayerProjection> shortlistByRole(Collection<PlayerProjection> available, PriceModel prices) {
        Set<String> seen = new HashSet<>();
        List<PlayerProjection> flat = new ArrayList<>();

        for (Role role : Role.values()) {
            List<PlayerProjection> ofRole = available.stream()
                    .filter(p -> p.role() == role)
                    .toList();

            List<PlayerProjection> byRatio = ofRole.stream()
                    .sorted(Comparator
                            .comparingDouble((PlayerProjection p) -> ratioProxy(p, prices))
                            .reversed()
                            .thenComparing(PlayerProjection::playerId))
                    .limit(ratioShortlistSize)
                    .toList();
            List<PlayerProjection> byPoints = ofRole.stream()
                    .sorted(Comparator
                            .comparingDouble(PlayerProjection::basePoints)
                            .reversed()
                            .thenComparing(PlayerProjection::playerId))
                    .limit(pointsShortlistSize)
                    .toList();

            for (PlayerProjection p : byRatio) {
                if (seen.add(p.playerId())) {
                    flat.add(p);
                }
            }
            for (PlayerProjection p : byPoints) {
                if (seen.add(p.playerId())) {
                    flat.add(p);
                }
            }
        }
        return flat;
    }

    /** Lo stesso criterio del greedy, senza il termine dei modificatori: dipende dalla rosa. */
    private double ratioProxy(PlayerProjection candidate, PriceModel prices) {
        int cost = Math.max(1, prices.expectedPrice(candidate));
        return (candidate.basePoints() - replacement.points(candidate.role())) / cost;
    }

    /**
     * Tenta di sostituire un giocatore scelto con uno non scelto dello stesso ruolo,
     * accettando lo scambio solo se aumenta i punti totali senza sforare il budget.
     *
     * <p>Non riapplica qui la riserva "1 credito per slot ancora scoperto" del greedy: la
     * local search agisce solo dopo che il greedy si e' fermato e scambia sempre uno slot
     * gia' riempito con un altro giocatore, senza mai aprirne di nuovi. Uno slot rimasto
     * scoperto era gia' inammissibile per il greedy e resta tale qui; nessuno scambio può
     * quindi renderlo peggiore di quanto già non fosse.
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

                PlayerProjection bestSwap = null;
                int bestSwapCost = 0;
                double bestSwapPoints = currentPoints;

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
                    double swappedPoints = modifiers.squadPoints(swapped);
                    // Stesso principio del greedy: a parita' di miglioramento vince l'id
                    // piu' basso, non il primo candidato incontrato nella collezione.
                    if (swappedPoints > bestSwapPoints
                            || (swappedPoints == bestSwapPoints && bestSwap != null
                                && candidate.playerId().compareTo(bestSwap.playerId()) < 0)) {
                        bestSwap = candidate;
                        bestSwapCost = candidateCost;
                        bestSwapPoints = swappedPoints;
                    }
                }

                if (bestSwap != null) {
                    roster.remove(current);
                    roster.add(bestSwap);
                    picks.set(i, bestSwap);
                    inRoster.remove(current.playerId());
                    inRoster.add(bestSwap.playerId());
                    budget -= (bestSwapCost - currentCost);
                    improved = true;
                }
            }
            if (!improved) {
                break;
            }
        }
        return budget;
    }
}
