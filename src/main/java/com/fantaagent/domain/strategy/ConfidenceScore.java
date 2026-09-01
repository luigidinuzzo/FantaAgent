package com.fantaagent.domain.strategy;

/**
 * Confidenza della raccomandazione, come media geometrica di quattro fattori
 * indipendenti. La media geometrica è deliberata: un solo fattore debole deve abbassare
 * il risultato, non essere compensato dagli altri.
 */
public record ConfidenceScore(
        double value,
        double dataFactor,
        double startingFactor,
        double marketFactor,
        double stabilityFactor) {

    /** Presenze osservate oltre le quali i dati sono considerati sufficienti. */
    private static final double FULL_EVIDENCE_APPEARANCES = 25.0;

    /** Acquisti osservati nella fase oltre i quali il mercato è considerato calibrato. */
    private static final int FULL_MARKET_SAMPLES = 15;

    /** Nessun fattore scende sotto questa soglia: evita che la media collassi a zero. */
    private static final double FLOOR = 0.01;

    public static ConfidenceScore of(double data, double starting, double market, double stability) {
        double d = clamp(data);
        double s = clamp(starting);
        double m = clamp(market);
        double st = clamp(stability);
        double value = Math.pow(d * s * m * st, 0.25);
        return new ConfidenceScore(value, d, s, m, st);
    }

    /** 1..5, per la resa a pallini nella UI. */
    public int stars() {
        return Math.max(1, Math.min(5, (int) Math.ceil(value * 5)));
    }

    public static double dataFactor(double observedAppearances) {
        return Math.min(1.0, Math.max(0.0, observedAppearances / FULL_EVIDENCE_APPEARANCES));
    }

    public static double startingFactor(double startingProbability) {
        return Math.min(1.0, Math.max(0.0, startingProbability));
    }

    public static double marketFactor(int salesInPhase) {
        return Math.min(1.0, Math.max(0.0, (double) salesInPhase / FULL_MARKET_SAMPLES));
    }

    /** 1 quando perturbare i prezzi non muove il prezzo massimo, 0 quando lo stravolge. */
    public static double stabilityFactor(int maxBid, int low, int high) {
        int reference = Math.max(1, maxBid);
        double spread = (double) Math.abs(high - low) / reference;
        return Math.min(1.0, Math.max(0.0, 1.0 - spread));
    }

    private static double clamp(double factor) {
        if (Double.isNaN(factor)) {
            return FLOOR;
        }
        return Math.min(1.0, Math.max(FLOOR, factor));
    }
}
