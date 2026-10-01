import { useId } from 'react';
import { FOCUS_RING } from './controls';

const BUTTON = `min-h-11 min-w-11 rounded-lg border border-control-border px-3 disabled:opacity-50 ${FOCUS_RING}`;

// Una freccia in un quadrato di 44px, senza bordo: da lg sta nella riga delle
// schede, dove un secondo contorno accanto a quello del pannello era rumore; sul
// telefono le parole intere mandavano il controllo su due righe.
const COMPACT_BUTTON = `min-h-11 min-w-11 rounded-lg disabled:opacity-50 ${FOCUS_RING} flex size-11 items-center justify-center text-lg hover:bg-line`;

/**
 * Sfoglia la fase corrente 25 giocatori alla volta.
 *
 * <p>Prima di questo controllo la route leggeva sempre {@code offset=0}: un
 * giocatore classificato 26esimo o oltre nella fase aperta non era raggiungibile
 * da nessun clic, e quindi non valutabile ne' acquistabile dalla SPA — un buco
 * scoperto nella revisione finale, non nella specifica. L'API portava gia' tutto
 * il necessario ({@code offset}, {@code total}, {@code hasPrevious}, {@code hasNext}
 * in {@code PhasePageResponse}); mancava solo chi lo leggesse.
 *
 * <p>Nessun secondo {@code role="status"}: il conteggio e' testo semplice, non una
 * live region — cambiare pagina non e' un evento da annunciare come lo sono un
 * acquisto o un cambio fase, e l'unica regione ambientale della schermata resta
 * {@code AuctionAnnouncer}.
 *
 * <p>{@code compact}: nel pannello delle schede dell'asta, a ogni misura, due
 * frecce e il conteggio fra loro — i bottoni con le parole intere non ci stavano
 * accanto alle schede, e sul telefono andavano su due righe. Il nome per chi
 * ascolta resta lo stesso (aria-label).
 */
export function PhasePager({
  offset,
  pageSize,
  total,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  navLabel = 'Pagine della fase',
  scope = 'della fase',
  compact = false,
}: {
  offset: number;
  pageSize: number;
  total: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  /** Nome del gruppo di navigazione per chi ascolta: il pager serve anche fuori dalla fase. */
  navLabel?: string;
  /** Di cosa sono le pagine, nei motivi dei bottoni spenti: «della fase», «dell'elenco». */
  scope?: string;
  /** Le due frecce col conteggio, su una riga sola. */
  compact?: boolean;
}) {
  const previousHintId = useId();
  const nextHintId = useId();

  // Una sola pagina: il controllo non ha nulla da voltare, e due bottoni
  // permanentemente spenti sarebbero solo rumore sullo schermo e per chi ascolta.
  if (total <= pageSize) {
    return null;
  }

  const previousReason = !hasPrevious ? `Non disponibile: questa è già la prima pagina ${scope}.` : null;
  const nextReason = !hasNext ? `Non disponibile: questa è l'ultima pagina ${scope}.` : null;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + pageSize, total);

  return (
    <nav
      aria-label={navLabel}
      className={`flex items-center ${
        compact ? 'flex-nowrap gap-1 text-meta' : 'mt-3 flex-wrap gap-3 text-sm'
      }`}
    >
      <button
        type="button"
        onClick={onPrevious}
        disabled={!hasPrevious}
        aria-label={compact ? 'Pagina precedente' : undefined}
        aria-describedby={previousReason ? previousHintId : undefined}
        className={compact ? COMPACT_BUTTON : BUTTON}
      >
        {compact ? <span aria-hidden="true">‹</span> : 'Pagina precedente'}
      </button>
      {previousReason ? <span id={previousHintId} className="sr-only">{previousReason}</span> : null}

      {/* .tnum: questi tre numeri si confrontano fra una pagina e la successiva,
          come ogni altro numero che questa migrazione ha allineato in colonna. */}
      <span className="tnum text-muted-foreground">
        {from}–{to} di {total}
      </span>

      <button
        type="button"
        onClick={onNext}
        disabled={!hasNext}
        aria-label={compact ? 'Pagina successiva' : undefined}
        aria-describedby={nextReason ? nextHintId : undefined}
        className={compact ? COMPACT_BUTTON : BUTTON}
      >
        {compact ? <span aria-hidden="true">›</span> : 'Pagina successiva'}
      </button>
      {nextReason ? <span id={nextHintId} className="sr-only">{nextReason}</span> : null}
    </nav>
  );
}
