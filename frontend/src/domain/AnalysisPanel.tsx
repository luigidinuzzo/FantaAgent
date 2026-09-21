import type { ValuationResponse } from '../api/types';
import { signed } from './PlayerDecisionCard';

const HEADING_ID = 'analysis-panel-heading';
const STARS = 5;

/** Una stella, tratto vettoriale: mai un'emoji. Decorativa — il fatto lo dice
 * il testo di {@code role="img"} del contenitore, non questa singola stella. */
function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={`h-4 w-4 ${filled ? 'fill-accent text-accent' : 'fill-none text-muted-foreground'}`}
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinejoin="round"
    >
      <path d="M10 2.2l2.47 5 5.53.8-4 3.9.94 5.5L10 14.7l-4.94 2.7.94-5.5-4-3.9 5.53-.8z" />
    </svg>
  );
}

/**
 * Perche' questo prezzo: il tetto duro, la confidenza e i driver della
 * valutazione. E' esattamente la classe di dati che la proiezione — sullo
 * schermo che guardano tutti al tavolo — non puo' mostrare: {@code hardCap} e
 * {@code confidenceStars} arrivano dall'API dalla prima tappa e nessuna
 * schermata li ha mai mostrati finora. `no-restricted-imports` in
 * `.oxlintrc.json` vieta a `ProjectionRoute` e `PublicBidderDialog` di
 * importare questo file, come gia' vieta loro `PlayerDecisionCard` e
 * `BidderDialog`.
 *
 * <p>Non e' una live region: l'unico {@code role="status"} della pagina resta
 * {@code AuctionAnnouncer}, e una seconda competerebbe con quella.
 */
export function AnalysisPanel({ valuation }: { valuation: ValuationResponse | null }) {
  // Senza giocatore scelto la colonna non cambia forma: resta lo stesso
  // pannello, con lo stesso titolo e la stessa altezza, e dentro l'invito a
  // sceglierne uno. Prima qui compariva un riquadro tratteggiato diverso da
  // tutto il resto: sembrava un guasto, non un invito.
  if (!valuation) {
    return (
      <section aria-labelledby={HEADING_ID} className="panel flex flex-col rounded-2xl p-5">
        <h2 id={HEADING_ID} className="text-sm font-bold text-muted-foreground">
          Perché questo prezzo
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Cerca un giocatore o scegline uno dalla tabella per vedere quanto conviene spendere.
        </p>
      </section>
    );
  }

  // I driver con spiegazione vuota non sono un errore di battitura da
  // mostrare: senza filtro, un driver con spiegazione vuota comparirebbe come
  // una voce muta nell'elenco. Il filtro (e il testo che descrive) vengono da
  // PlayerDecisionCard, che li ospitava prima che si spostassero qui.
  const shownDrivers = valuation.drivers.filter((d) => d.explanation.trim().length > 0);

  return (
    // Nessun self-start: i tre pannelli della riga — crediti, battitore,
    // consigli — finiscono sulla stessa linea, ed e' la griglia a stirarli
    // perche' lo facciano. Alto quanto il suo testo, questo si fermava a meta'
    // colonna e la riga si leggeva come sbilenca.
    // min-h-0: senza, un figlio che scorre dentro un contenitore flex si
    // allunga comunque fino al proprio contenuto invece di fermarsi — e la
    // colonna tornerebbe a spingere in alto la riga, che e' esattamente cio'
    // che qui si vuole impedire.
    <section
      aria-labelledby={HEADING_ID}
      className="panel flex min-h-0 flex-col rounded-2xl p-5"
    >
      <h2 id={HEADING_ID} className="shrink-0 text-sm font-bold text-muted-foreground">
        Perché questo prezzo
      </h2>

      <div className="mt-3 flex shrink-0 flex-wrap items-end gap-6">
        <p>
          <span data-testid="hard-cap" className="tnum w-exp block text-3xl font-extrabold">
            {valuation.hardCap}
          </span>
          <span className="mt-1 block text-sm text-muted-foreground">tetto duro</span>
        </p>

        {/* Le stelle sono un'immagine: il nome accessibile del contenitore
            dice la confidenza a parole, per chi non le vede. "3" letto da un
            sintetizzatore non e' una confidenza, e' un numero nudo — la
            frase qui e' cio' che rende l'informazione la stessa per tutti. */}
        <div
          role="img"
          aria-label={`confidenza ${valuation.confidenceStars} su 5`}
          className="flex items-center gap-0.5 pb-1"
        >
          {Array.from({ length: STARS }, (_, i) => (
            <Star key={i} filled={i < valuation.confidenceStars} />
          ))}
        </div>
      </div>

      {/* I driver scorrono dentro il pannello: sono da uno a cinque, con
          spiegazioni lunghe quanto capita, ed erano loro a decidere l'altezza
          dell'intera riga — scegliendo un giocatore il riquadro del battitore e
          la colonna delle squadre si allungavano di conseguenza. Qui dentro il
          contenuto varia e la cornice no. */}
      {shownDrivers.length > 0 ? (
        <dl className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-2 text-sm">
          {shownDrivers.map((driver) => (
            <div key={driver.label}>
              <div className="flex items-baseline gap-2">
                <dt className="font-bold">{driver.label}</dt>
                <dd className="tnum text-muted-foreground">{signed(driver.contribution)}</dd>
              </div>
              <dd className="mt-0.5 text-muted-foreground">{driver.explanation}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}
