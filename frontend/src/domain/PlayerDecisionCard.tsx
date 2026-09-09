import type { ReactNode } from 'react';
import type { ValuationResponse } from '../api/types';

const ROLE_LABEL: Record<string, string> = {
  P: 'portiere',
  D: 'difensore',
  C: 'centrocampista',
  A: 'attaccante',
};

/** Il segno meno tipografico, non il trattino: e' un numero, non una parola spezzata. */
function signed(n: number): string {
  return n >= 0 ? `+${n}` : `−${Math.abs(n)}`;
}

export function PlayerDecisionCard({
  valuation,
  stale,
  children,
}: {
  valuation: ValuationResponse;
  stale: boolean;
  children?: ReactNode;
}) {
  const nameId = `player-name-${valuation.playerId}`;

  // I driver con spiegazione vuota non sono un errore di battitura da
  // mostrare: senza filtro, drivers: [] produce un punto isolato e una
  // spiegazione vuota produce una virgola doppia. Entrambi validi per il tipo.
  const driverText = valuation.drivers
    .map((d) => d.explanation)
    .filter((explanation) => explanation.trim().length > 0)
    .join(', ');

  return (
    <section
      data-testid="decision-card"
      data-stale={stale}
      aria-labelledby={nameId}
      className={[
        'relative border p-5 transition-opacity duration-200',
        // Il gradiente e' l'unico effetto decorativo del progetto, e sta su un
        // solo elemento: quello che decide.
        'bg-[radial-gradient(120%_90%_at_30%_0%,var(--color-surface)_0%,var(--color-background)_70%)]',
        stale ? 'border-dashed border-line opacity-60' : 'border-line-strong',
      ].join(' ')}
    >
      {/* Arco d'angolo: una linea di campo, non un ornamento. */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 h-8 w-8 rounded-br-full border-b border-r border-line-strong"
      />

      {stale ? (
        // Statico, non una live region: la pagina ne ha una sola
        // (AuctionAnnouncer, task successivo) e una seconda competerebbe con
        // quella. aria-busy non basta: significa "si sta aggiornando ora", non
        // "questo e' vecchio", e la maggior parte degli screen reader non lo
        // annuncia affatto su una regione non viva. Questo testo lo si
        // incontra leggendo la scheda, come il bordo tratteggiato per chi vede.
        <p className="sr-only">I valori mostrati non sono più aggiornati.</p>
      ) : null}

      <header className="flex items-baseline gap-3 pl-7">
        <h2 id={nameId} className="w-exp text-xl font-extrabold">
          {valuation.name}
        </h2>
        <p className="text-sm text-muted-foreground">
          {ROLE_LABEL[valuation.role]}, {valuation.team}
        </p>
      </header>

      <div className="mt-4 flex flex-wrap items-end gap-8">
        <p>
          <span
            data-testid="max-bid"
            className="tnum w-exp block text-[76px] font-extrabold leading-[0.86] tracking-tight text-accent"
          >
            {valuation.maxBid}
          </span>
          <span className="mt-1 block text-sm text-muted-foreground">il tuo tetto</span>
        </p>

        <dl className="pb-3 text-sm text-muted-foreground">
          <div className="flex gap-2">
            <dt>mercato</dt>
            <dd data-testid="expected-price" className="tnum text-foreground">
              {valuation.expectedPrice}
            </dd>
          </div>
          <div className="mt-1 flex gap-2">
            <dt>margine</dt>
            <dd
              data-testid="margin"
              className={`tnum ${valuation.worthPursuing ? 'text-positive' : 'text-destructive'}`}
            >
              {signed(valuation.margin)}
            </dd>
          </div>
        </dl>

        <p
          className={`pb-3 text-sm font-bold ${
            valuation.worthPursuing ? 'text-positive' : 'text-destructive'
          }`}
        >
          {valuation.worthPursuing ? 'Prendi' : 'Lascia'}
        </p>
      </div>

      {driverText ? (
        <p className="mt-3 max-w-[60ch] text-sm text-muted-foreground">{driverText}.</p>
      ) : null}

      {!valuation.worthPursuing && valuation.walkAwayReason ? (
        <p className="mt-2 max-w-[60ch] text-sm text-destructive">
          {valuation.walkAwayReason}
        </p>
      ) : null}

      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}
