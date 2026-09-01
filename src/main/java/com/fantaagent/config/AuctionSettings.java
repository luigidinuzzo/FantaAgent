package com.fantaagent.config;

/**
 * Preferenze del battitore d'asta: quanto dura il countdown fra un rilancio e
 * l'aggiudicazione, e se allo scadere suona un avviso.
 *
 * <p>Deliberatamente separate da {@link ScoringSettings}. Quelle sono regole di
 * punteggio della lega e da esse discende l'intero motore di valutazione: cambiarle
 * costringe a ricostruire la catena e, ad asta iniziata, e' vietato. Queste no —
 * non entrano in nessun calcolo, non cambiano il significato di un solo numero a
 * schermo, e vanno percio' modificabili in qualunque momento, anche a meta' asta,
 * perche' e' proprio li' che ci si accorge che cinque secondi sono troppi o troppo
 * pochi per la propria stanza.
 *
 * @param bidTimerSeconds secondi di countdown, riazzerati ad ogni rilancio
 * @param beepEnabled     avviso acustico allo scadere
 */
public record AuctionSettings(int bidTimerSeconds, boolean beepEnabled) {

    /** Cinque secondi, con avviso: il valore chiesto in fase di progetto. */
    public static final AuctionSettings DEFAULTS = new AuctionSettings(5, true);
}
