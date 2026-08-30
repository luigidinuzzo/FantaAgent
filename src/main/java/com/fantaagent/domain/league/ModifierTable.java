package com.fantaagent.domain.league;

import java.util.List;

/**
 * Tabella a gradini che mappa una media voto sul bonus in gol del modificatore.
 *
 * @param defendersCounted quanti difensori entrano nel calcolo della media di reparto;
 *                         0 per un modificatore che guarda solo il portiere
 */
public record ModifierTable(int defendersCounted, List<Threshold> thresholds) {

    public record Threshold(double minAverage, double bonus) {
    }

    public ModifierTable {
        thresholds = List.copyOf(thresholds);
        if (thresholds.isEmpty()) {
            throw new IllegalArgumentException("modifier table must have at least one threshold");
        }
        for (int i = 1; i < thresholds.size(); i++) {
            if (thresholds.get(i).minAverage() <= thresholds.get(i - 1).minAverage()) {
                throw new IllegalArgumentException("modifier thresholds must be strictly monotonic");
            }
        }
    }

    /** Bonus della soglia più alta raggiunta dalla media indicata. */
    public double bonusFor(double average) {
        double bonus = thresholds.getFirst().bonus();
        for (Threshold t : thresholds) {
            if (average >= t.minAverage()) {
                bonus = t.bonus();
            } else {
                break;
            }
        }
        return bonus;
    }
}
