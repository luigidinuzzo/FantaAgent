package com.fantaagent.domain.player;

/**
 * Punti attesi base di un giocatore, senza modificatori.
 *
 * <p>I modificatori dipendono dalla rosa e sono calcolati dal motore di valutazione:
 * questa proiezione resta perciò indipendente dal contesto e cacheabile.
 *
 * @param observedAppearances presenze pesate effettivamente osservate nello storico;
 *                            0 significa che {@code expectedAppearances} viene da un
 *                            prior e non da dati
 */
public record PlayerProjection(
        String playerId,
        Role role,
        double expectedRating,
        double bonusPerAppearance,
        double expectedAppearances,
        double basePoints,
        double observedAppearances) {

    public double startingProbability() {
        return Math.min(1.0, expectedAppearances / ProjectionCalculator.SEASON_MATCHES);
    }
}
