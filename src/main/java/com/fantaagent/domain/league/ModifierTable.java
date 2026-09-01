package com.fantaagent.domain.league;

import java.util.List;

/**
 * Tabella a gradini che mappa una media voto sul bonus del modificatore.
 *
 * <p>{@code bonus} è espresso in FANTAPUNTI per giornata, non in gol: è il punteggio
 * aggiunto al totale di reparto ad ogni giornata quando la media raggiunge la soglia,
 * non un numero di gol attesi. {@link com.fantaagent.domain.strategy.ModifierCalculator}
 * lo moltiplica per {@code SEASON_MATCHES} per ottenere il contributo stagionale.
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

    /**
     * Valore atteso del bonus quando la media voto di giornata è distribuita
     * normalmente con media {@code mean} e deviazione standard {@code sigma}.
     *
     * <p>{@code bonusFor} legge la tabella nel punto singolo dato dalla media
     * stagionale, ma la tabella è definita sulla media di GIORNATA, che oscilla
     * settimana per settimana attorno a quella media stagionale. Per una funzione
     * a gradini la media del bonus non è il bonus della media: ogni soglia sopra
     * la media stagionale viene comunque superata in una parte delle giornate, e
     * questo metodo ne tiene conto integrando la tabella sulla distribuzione
     * anziché valutarla in un punto solo.
     *
     * <p>Il valore atteso è la somma, su ogni soglia, del suo bonus per la
     * probabilità che la media di giornata cada nel suo bin (fra questa soglia e
     * la successiva). Con {@code sigma == 0} la distribuzione collassa su un
     * punto e il risultato coincide esattamente con {@link #bonusFor(double)}.
     *
     * @throws IllegalArgumentException se {@code sigma} è negativo
     */
    public double expectedBonus(double mean, double sigma) {
        if (sigma < 0) {
            throw new IllegalArgumentException("sigma must not be negative");
        }
        if (sigma == 0) {
            return bonusFor(mean);
        }
        double expected = 0.0;
        for (int i = 0; i < thresholds.size(); i++) {
            double lowerCdf = normalCdf(thresholds.get(i).minAverage(), mean, sigma);
            double upperCdf = (i + 1 < thresholds.size())
                    ? normalCdf(thresholds.get(i + 1).minAverage(), mean, sigma)
                    : 1.0;
            double binProbability = upperCdf - lowerCdf;
            expected += thresholds.get(i).bonus() * binProbability;
        }
        return expected;
    }

    /** P(X &lt;= x) per X ~ N(mean, sigma^2). */
    private static double normalCdf(double x, double mean, double sigma) {
        double z = (x - mean) / (sigma * Math.sqrt(2.0));
        return 0.5 * (1.0 + erf(z));
    }

    /**
     * Approssimazione razionale della funzione degli errori (Abramowitz &amp; Stegun,
     * formula 7.1.26), accurata a circa 1.5e-7 in valore assoluto. Non esiste una
     * libreria matematica di terze parti disponibile nel dominio, quindi è scritta
     * a mano qui.
     */
    private static double erf(double x) {
        double sign = x < 0 ? -1.0 : 1.0;
        double ax = Math.abs(x);

        double a1 = 0.254829592;
        double a2 = -0.284496736;
        double a3 = 1.421413741;
        double a4 = -1.453152027;
        double a5 = 1.061405429;
        double p = 0.3275911;

        double t = 1.0 / (1.0 + p * ax);
        double poly = ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t;
        double y = 1.0 - poly * Math.exp(-ax * ax);

        return sign * y;
    }
}
