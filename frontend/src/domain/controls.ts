/**
 * L'altezza dei controlli, decisa in un posto solo.
 *
 * <p>Dentro una stessa riga i controlli hanno TUTTI la stessa altezza e lo
 * stesso raggio: l'enfasi la portano il colore e la larghezza, mai la statura.
 * Una riga con un bottone da 80, due da 64 e un campo da 64 con l'etichetta
 * sopra non si legge come un gruppo — si legge come un errore.
 *
 * <p>Due contesti, due altezze, e la differenza e' la fretta con cui si
 * colpiscono:
 *
 * <ul>
 *   <li>{@link CONTROL_H} — la riga della scheda di decisione. Si usa guardando
 *       lo schermo, con calma: e' la misura comoda del resto dell'applicazione.
 *   <li>{@link BID_CONTROL_H} — la riga del rilancio. Si colpisce guardando il
 *       tavolo e non lo schermo, quindi il bersaglio e' piu' grande.
 * </ul>
 *
 * <p>Le etichette non stanno MAI sopra il controllo: un'etichetta sopra alza la
 * scatola e, allineando la riga per il fondo, fa sporgere in cima proprio gli
 * elementi etichettati. Vanno accanto, sulla stessa linea.
 */

/** La riga di controlli della scheda di decisione: 56px. */
export const CONTROL_H = 'min-h-14';

/** La riga del rilancio: 64px, bersagli da colpire senza mirare. */
export const BID_CONTROL_H = 'min-h-16';

/** Il raggio dei controlli del rilancio, uno per tutti. */
export const BID_RADIUS = 'rounded-lg';

/** Il contorno di messa a fuoco, identico ovunque. */
export const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent';

const BUTTON_SHAPE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 disabled:opacity-50';

/**
 * L'azione principale della schermata: una sola per schermata porta l'oro. Il
 * contorno di messa a fuoco e' chiaro e non oro, perche' oro su oro non si vede.
 */
export const BUTTON_PRIMARY =
  `${BUTTON_SHAPE} bg-accent font-semibold text-on-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground`;

/** Ogni altra azione: contorno e nient'altro. */
export const BUTTON_SECONDARY =
  `${BUTTON_SHAPE} border border-control-border font-medium hover:bg-line ${FOCUS_RING}`;

/** Cio' che non si puo' annullare: togliere, eliminare, uscire. */
export const BUTTON_DESTRUCTIVE =
  `${BUTTON_SHAPE} bg-destructive font-semibold text-on-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground`;

/** Un campo di testo: 48px, col bordo dei controlli. */
export const FIELD =
  `min-h-12 w-full rounded-lg border border-control-border bg-surface px-4 text-base placeholder:text-muted-foreground ${FOCUS_RING}`;
