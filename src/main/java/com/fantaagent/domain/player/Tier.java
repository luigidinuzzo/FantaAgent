package com.fantaagent.domain.player;

/** Fascia di un giocatore, dal rango nel ruolo rapportato al giocatore marginale. */
public enum Tier {
    ELITE, TOP, MID, DEPTH, FILLER;

    public static Tier of(int rankInRole, int replacementIndex) {
        double ratio = (double) rankInRole / replacementIndex;
        if (ratio <= 0.15) {
            return ELITE;
        }
        if (ratio <= 0.35) {
            return TOP;
        }
        if (ratio <= 0.70) {
            return MID;
        }
        if (ratio <= 1.00) {
            return DEPTH;
        }
        return FILLER;
    }
}
