import { useId } from 'react';
import { FOCUS_RING } from './controls';

const BUTTON = `min-h-11 min-w-11 rounded-lg border border-control-border px-3 disabled:opacity-50 ${FOCUS_RING}`;

// Da lg una freccia in un quadrato di 44px, senza bordo: sta nella riga delle
// schede, dove un secondo contorno accanto a quello del pannello era rumore. Sotto
// lg lo stesso bottone di sempre.
const COMPACT_BUTTON = `${BUTTON} lg:flex lg:size-11 lg:items-center lg:justify-center lg:border-0 lg:px-0 lg:text-lg lg:hover:bg-line`;

/** La freccia da lg in su, le parole sotto: il nome vero lo porta aria-label. */
function CompactLabel({ glyph, words }: { glyph: string; words: string }) {
  return (
    <>
      <span aria-hidden="true" className="max-lg:hidden">{glyph}</span>
      <span aria-hidden="true" className="lg:hidden">{words}</span>
    </>
  );
}

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
 * <p>{@code compact}: nella riga delle schede dell'asta, da lg in su, due frecce e
 * il conteggio fra loro — i bottoni con le parole intere non ci stavano accanto
 * alle schede. Il nome per chi ascolta resta lo stesso (aria-label). Sotto lg la
 * variante compatta si rende come quella di sempre: il telefono ha un suo piano.
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
  /** Le due frecce nella riga delle schede, da lg in su. */
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
      className={`mt-3 flex flex-wrap items-center gap-3 text-sm ${
        compact ? 'lg:mt-0 lg:flex-nowrap lg:gap-1 lg:text-meta' : ''
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
        {compact ? <CompactLabel glyph="‹" words="Pagina precedente" /> : 'Pagina precedente'}
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
        {compact ? <CompactLabel glyph="›" words="Pagina successiva" /> : 'Pagina successiva'}
      </button>
      {nextReason ? <span id={nextHintId} className="sr-only">{nextReason}</span> : null}
    </nav>
  );
}
