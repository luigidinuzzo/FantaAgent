import { useId } from 'react';

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
 */
export function PhasePager({
  offset,
  pageSize,
  total,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
}: {
  offset: number;
  pageSize: number;
  total: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const previousHintId = useId();
  const nextHintId = useId();

  // Una sola pagina: il controllo non ha nulla da voltare, e due bottoni
  // permanentemente spenti sarebbero solo rumore sullo schermo e per chi ascolta.
  if (total <= pageSize) {
    return null;
  }

  const previousReason = !hasPrevious ? 'Non disponibile: questa è già la prima pagina della fase.' : null;
  const nextReason = !hasNext ? "Non disponibile: questa è l'ultima pagina della fase." : null;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + pageSize, total);

  return (
    <nav aria-label="Pagine della fase" className="mt-3 flex flex-wrap items-center gap-3 text-sm">
      <button
        type="button"
        onClick={onPrevious}
        disabled={!hasPrevious}
        aria-describedby={previousReason ? previousHintId : undefined}
        className="min-h-11 min-w-11 rounded-full border border-line px-3 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        Pagina precedente
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
        aria-describedby={nextReason ? nextHintId : undefined}
        className="min-h-11 min-w-11 rounded-full border border-line px-3 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        Pagina successiva
      </button>
      {nextReason ? <span id={nextHintId} className="sr-only">{nextReason}</span> : null}
    </nav>
  );
}
