import type { ReactNode } from 'react';
import type { ValuationResponse } from '../api/types';
import { RoleBadge } from './RoleBadge';

/**
 * Il segno meno tipografico, non il trattino: e' un numero, non una parola
 * spezzata. Arrotonda: i contributi dei driver arrivano dal calcolo in virgola
 * mobile, e un «+0.14296393920221817» non e' un numero da leggere — mandava a
 * capo la riga e allungava da solo la colonna dei consigli.
 *
 * <p>Esportato: {@link AnalysisPanel} lo riusa per il contributo dei driver,
 * stessa disciplina del segno per lo stesso tipo di numero.
 */
export function signed(n: number): string {
  const rounded = Math.round(n);
  // Object.is: -0 arrotondato resta -0, e «−0» letto in una colonna di
  // contributi sembra un valore negativo minuscolo invece di nessun effetto.
  const safe = Object.is(rounded, -0) ? 0 : rounded;
  return safe >= 0 ? `+${safe}` : `−${Math.abs(safe)}`;
}

export function PlayerDecisionCard({
  valuation,
  stale,
  bare = false,
  children,
}: {
  valuation: ValuationResponse;
  stale: boolean;
  /**
   * Senza cornice propria: la card sta gia' dentro il riquadro del battitore, che
   * e' fisso in pagina e porta bordo, fondo e titolo. Due cornici concentriche
   * dello stesso colore erano solo rumore attorno al numero che conta.
   */
  bare?: boolean;
  /** La riga dei controlli del lotto. */
  children?: ReactNode;
}) {
  const nameId = `player-name-${valuation.playerId}`;
  const frame = bare
    ? ''
    : `rounded-2xl border bg-surface p-5 ${
        stale ? 'border-dashed border-muted-foreground' : 'border-panel-border'
      }`;

  // Stantia: si attenua il BLOCCO DELLA VALUTAZIONE, non la scheda intera. Il
  // nome del giocatore non invecchia, e soprattutto i controlli non vanno
  // toccati: BidPanel disabilita Aggiudica con la sua opacita', e le due si
  // moltiplicavano — un bottone al 30% non raggiunge il contrasto richiesto ai
  // controlli. Il bordo tratteggiato e l'avviso sr-only qui sotto bastano a
  // dire che il dato e' vecchio.
  const dimmed = stale ? 'opacity-60 transition-opacity duration-200' : '';

  const verdictColor = valuation.worthPursuing ? 'text-positive' : 'text-destructive';

  return (
    <section
      data-testid="decision-card"
      data-stale={stale}
      aria-labelledby={nameId}
      className={`flex flex-1 flex-col ${frame}`}
    >
      {stale ? (
        // Statico, non una live region: la pagina ne ha una sola
        // (AuctionAnnouncer) e una seconda competerebbe con quella. aria-busy
        // non basta: significa "si sta aggiornando ora", non "questo e'
        // vecchio", e la maggior parte degli screen reader non lo annuncia
        // affatto su una regione non viva. Questo testo lo si incontra
        // leggendo la scheda, come il bordo tratteggiato per chi vede.
        <p className="sr-only">I valori mostrati non sono più aggiornati.</p>
      ) : null}

      <header className="flex items-baseline gap-3">
        <h2 id={nameId} className="w-exp min-w-0 truncate text-2xl font-extrabold">
          {valuation.name}
        </h2>
        {/* La pillola al posto della parola: e' lo stesso segno che marca il
            ruolo nella tabella di fase e nei risultati della ricerca, quindi il
            giocatore sul banco si riconosce con lo stesso colpo d'occhio. Il
            ruolo per esteso non se ne va — RoleBadge lo porta in sr-only, che
            e' come lo riceve chi ascolta. */}
        {/* self-center: l'intestazione allinea per la linea di base (nome e
            squadra devono poggiare sulla stessa riga), ma una pillola tonda su
            quella linea si appoggia con la lettera che ha dentro e il cerchio
            finisce fuori squadra. Si centra sull'altezza del nome, e basta. */}
        <span className="flex shrink-0 self-center">
          <RoleBadge role={valuation.role} />
        </span>
        <p className="shrink-0 text-sm text-muted-foreground">{valuation.team}</p>
      </header>

      {/* In alto, non centrato: i prezzi si leggono subito sotto il nome, e i
          controlli si impilano sotto di loro nell'ordine in cui si usano —
          prima si fa correre il conto alla rovescia, poi si registra a quanto e
          a chi e' andato. Lo spazio che avanza resta in fondo: un numero che si
          consulta di continuo deve stare sempre alla stessa quota, e centrando
          il gruppo si spostava a ogni riga in piu' o in meno (la ragione del
          "Lascia", per esempio). */}
      <div className="flex flex-1 flex-col gap-6 pt-5">
        <div className={dimmed}>
          {/* Una colonna per voce, valore sopra ed etichetta sotto: la stessa
              disciplina con cui il battitore mostra secondi e offerta mentre il
              conto corre, cosi' le due facce dello stesso riquadro si
              somigliano e passare dall'una all'altra non obbliga a rileggere
              tutto.

              Prima «il tuo tetto» stava nella stessa riga di «mercato» e
              «margine», stessa taglia e stesso colore: si leggeva come il terzo
              elemento di un elenco invece che come il nome del numero grande, e
              quale fosse il tetto non si capiva.

              I quattro numeri sono crediti sullo stesso asse, in ordine di
              racconto: dove ti fermi, quanto vale di listino, quanto lo paghera'
              il tavolo, quanto ci guadagni. */}
          <dl className="grid w-fit grid-cols-[auto_auto_auto_auto] items-baseline gap-x-10">
            {/* dt PRIMA del suo dd nel sorgente, come vuole una lista di
                definizioni: e' anche l'ordine in cui conviene sentirli letti —
                «il tuo tetto, quaranta». Che l'etichetta appaia SOTTO il numero
                lo decide la griglia con row-start, non l'ordine del documento. */}
            {/* «il tuo tetto» resta il nome breve, lo stesso della tabella e del
                battitore; accanto, cosa vuol dire. Il limite assoluto, a destra, si
                chiama «mai oltre»: due «tetti» non dicevano quale valesse. */}
            <dt className="col-start-1 row-start-2 mt-2 text-sm text-muted-foreground">
              il tuo tetto <span className="text-muted-foreground/80">· fin qui conviene</span>
            </dt>
            <dd className="col-start-1 row-start-1 flex items-baseline gap-x-4">
              <span
                data-testid="max-bid"
                className={`tnum w-exp text-[64px] font-extrabold leading-[0.82] tracking-tight ${
                  // Su "Lascia" il tetto non e' un traguardo, e' un muro: l'oro
                  // e' il colore del via in tutta l'applicazione, e lasciarlo
                  // qui invitava a rilanciare fin la' proprio dove si dice di
                  // non farlo. Il numero resta grande — serve ancora saperlo.
                  valuation.worthPursuing ? 'text-accent' : 'text-foreground'
                }`}
              >
                {valuation.maxBid}
              </span>
              {/* Il verdetto accanto al tetto, non in una colonna sua: e' cosa
                  farne di QUEL numero, non una quarta misura. */}
              <span className={`w-cond text-3xl font-extrabold leading-none ${verdictColor}`}>
                {valuation.worthPursuing ? 'Prendi' : 'Lascia'}
              </span>
            </dd>

            {/* La quotazione di listino: l'unico numero della valutazione che
                non compare ne' qui ne' nel pannello dei consigli, che tiene il
                limite «mai oltre», l'affidabilita' della stima e i driver. Da' un metro a «mercato»:
                sapere che il tavolo pagherà 29 non dice se è caro finche' non si
                sa da quanto si parte. */}
            <dt className="col-start-2 row-start-2 mt-2 text-sm text-muted-foreground">
              quotazione
            </dt>
            <dd
              data-testid="list-price"
              className="tnum w-exp col-start-2 row-start-1 text-3xl font-extrabold leading-none text-muted-foreground"
            >
              {valuation.listPrice}
            </dd>

            <dt className="col-start-3 row-start-2 mt-2 text-sm text-muted-foreground">
              mercato
            </dt>
            <dd
              data-testid="expected-price"
              className="tnum w-exp col-start-3 row-start-1 text-3xl font-extrabold leading-none"
            >
              {valuation.expectedPrice}
            </dd>

            <dt className="col-start-4 row-start-2 mt-2 text-sm text-muted-foreground">
              margine
            </dt>
            <dd
              data-testid="margin"
              className={`tnum w-exp col-start-4 row-start-1 text-3xl font-extrabold leading-none ${verdictColor}`}
            >
              {signed(valuation.margin)}
            </dd>
          </dl>

          {/* Il perche' si lascia, in testo pieno: una frase intera in rosso si
              legge male, e il rosso lo porta gia' la parola qui sopra.

              Lo spazio e' riservato SEMPRE, due righe, anche quando la frase non
              c'e': i controlli qui sotto non devono spostarsi passando da un
              giocatore da prendere a uno da lasciare. Si preme «Aggiudica»
              guardando il tavolo, non lo schermo, e un bersaglio che scende di
              una riga fra un lotto e l'altro e' un clic sbagliato che aspetta di
              succedere. Il prezzo e' una riga vuota quando il verdetto e'
              «Prendi»: e' il costo che questa stabilita' vale.

              line-clamp-2 e' la garanzia che le due righe bastino comunque: una
              spiegazione piu' lunga si taglia con i puntini invece di spingere.
              Il taglio e' solo visivo — nell'albero di accessibilita' la frase
              resta intera. */}
          <p className="mt-3 line-clamp-2 h-10 max-w-[80ch] text-sm">
            {valuation.worthPursuing ? null : valuation.walkAwayReason}
          </p>
        </div>

        {children ? <div>{children}</div> : null}
      </div>
    </section>
  );
}
