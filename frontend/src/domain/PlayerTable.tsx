import { useId } from 'react';
import type { PhaseRowView, PhaseSort, SortDir } from '../api/types';
import { EmptyState } from './EmptyState';

const CAPTION_ID = 'player-table-caption';

// Il riempimento laterale delle celle, uguale per intestazione e corpo: senza,
// il nome del giocatore comincia esattamente sul bordo sinistro della cornice e
// la titolarita' finisce su quello destro. Vive in una costante perche' le due
// file devono restare incolonnate: cambiarlo in un punto solo le disallinea.
const CELL_X = 'px-3';

/**
 * Il criterio dell'elenco, detto a parole. Ordinando per un'altra colonna la
 * didascalia continuava ad annunciare la quotazione: falso, e per giunta e'
 * l'unica riga che spiega perche' i giocatori stanno in quell'ordine.
 *
 * <p>La quotazione decrescente si spiega anche col PERCHE': e' l'ordine in cui i
 * giocatori vengono chiamati in asta, quindi non e' una scelta di comodo. Le
 * altre si spiegano da se'.
 */
const ORDER_PHRASE: Record<PhaseSort, Record<SortDir, string>> = {
  quotazione: {
    desc: 'dal più quotato: l’ordine in cui vengono chiamati',
    asc: 'dal meno quotato',
  },
  fantamedia: {
    desc: 'dalla fantamedia attesa più alta',
    asc: 'dalla fantamedia attesa più bassa',
  },
  titolarita: {
    desc: 'da chi gioca di più',
    asc: 'da chi gioca di meno',
  },
};

// L'intestazione ferma allo scorrimento c'e' solo con `fill`, da lg in su: li' la
// tabella e' la propria area di scorrimento, alta quanto il pannello delle schede
// che la contiene, e `position: sticky` si ancora a lei. Senza `fill` il
// contenitore ha `overflow-x-auto`, che fa calcolare anche `overflow-y` come
// `auto`: sticky si ancorerebbe a un riquadro che in verticale non scorre, e non
// farebbe niente.

// Le intestazioni ferme in alto con `fill`: il fondo pieno copre le righe che ci
// scorrono sotto. Senza padding verticale: l'intestazione e' alta quanto i suoi
// bottoni (44px), e col padding arrivava a 60 — sotto il banco, a 1440x900, era
// una riga di tabella in meno.
const STICKY_TH = 'lg:sticky lg:top-0 lg:z-10 lg:bg-surface lg:py-0';

/**
 * La freccia del verso, accanto alla colonna ordinata. Tratto vettoriale, mai
 * un'emoji, e decorativa: il verso lo dice {@code aria-sort} sull'intestazione.
 */
function SortArrow({ dir }: { dir: SortDir }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      className={`h-3 w-3 shrink-0 ${dir === 'asc' ? 'rotate-180' : ''}`}
      fill="currentColor"
    >
      <path d="M6 9.5 1.8 4.5h8.4z" />
    </svg>
  );
}

export function PlayerTable({
  rows,
  selectedId,
  onSelect,
  disabled = false,
  sort = 'quotazione',
  dir = 'desc',
  onSort,
  fill = false,
}: {
  rows: PhaseRowView[];
  selectedId: string | null;
  onSelect: (playerId: string) => void;
  /** La colonna su cui il SERVER ha ordinato questa pagina. */
  sort?: PhaseSort;
  dir?: SortDir;
  /**
   * Chiede un altro ordine. L'ordine vero lo fa il server: riordinare qui
   * significherebbe rimettere in fila la sola pagina che si ha in mano — venticinque
   * righe su duecento — e dire una bugia su tutte le altre.
   *
   * <p>Assente, le intestazioni restano testo: e' il caso di chi monta la tabella
   * senza saperla ordinare.
   */
  onSort?: (sort: PhaseSort, dir: SortDir) => void;
  /**
   * Un lotto alla volta e' aperto sul banco: mentre il conto alla rovescia corre, la
   * selezione resta bloccata, non solo scoraggiata. Un clic vagante su
   * un'altra riga cambierebbe il giocatore sotto un rilancio in corso —
   * countdown, prezzo e beep perduti senza preavviso. Abbandonare un lotto
   * resta un gesto deliberato (si chiude il conto alla rovescia), non un incidente
   * di un clic.
   */
  disabled?: boolean;
  /**
   * Da lg in su la tabella riempie il pannello delle schede dell'asta e scorre
   * dentro di se', con l'intestazione ferma. La legenda visibile passa nella riga
   * delle schede, quindi la didascalia resta solo per chi ascolta. Sotto lg la
   * tabella e' quella di sempre.
   */
  fill?: boolean;
}) {
  const lockedHintId = useId();
  const th = fill ? STICKY_TH : '';

  if (rows.length === 0) {
    // Uno schermo vuoto e' un invito ad agire, non un errore muto.
    return <EmptyState>Nessun giocatore libero in questa fase. Passa alla fase successiva.</EmptyState>;
  }

  return (
    // Il contenitore scorre in orizzontale: senza tabIndex chi naviga da
    // tastiera non ha modo di raggiungere le colonne fuori schermo, perche'
    // un div che scorre non e' focalizzabile e le celle non lo sono a loro
    // volta (WCAG 2.1.1). Reso focalizzabile va anche nominato, altrimenti
    // si annuncia come "gruppo" e basta: la caption fa da nome sia alla
    // regione sia alla tabella, che finora non ne aveva uno.
    <div
      role="region"
      tabIndex={0}
      aria-labelledby={CAPTION_ID}
      // Con fill, da lg, il pannello delle schede fa gia' da cornice: niente bordo.
      className={`relative overflow-x-auto rounded-lg border border-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
        fill ? 'lg:h-full lg:overflow-auto lg:rounded-none lg:border-0' : ''
      }`}
    >
      <table className={`w-full border-collapse text-sm ${fill ? 'lg:text-body' : ''}`}>
        {/* Visibile, non piu' sr-only: accanto, «Occasioni della fase» dichiara il
            proprio criterio e mostra altri nomi, e senza il suo questa tabella
            sembrava contraddirla — i consigliati non erano in cima e non si capiva
            perche'. L'ordine non e' casuale: e' quello in cui i giocatori vengono
            chiamati in asta e in cui l'occhio li cerca sul listone. Detto una volta
            in testa, le due liste smettono di sembrare in disaccordo. */}
        <caption
          id={CAPTION_ID}
          className={`px-3 pb-2 pt-1 text-left text-sm text-muted-foreground ${fill ? 'lg:sr-only' : ''}`}
        >
          {`Giocatori liberi nella fase corrente, ${ORDER_PHRASE[sort][dir]}.`}
          {/* Cosa vogliono dire i tre stati della colonna «Il tuo tetto». Il
              colore da solo non e' informazione, e qui non lo era nemmeno per chi
              il rosso lo distingue: si capiva solo sapendolo gia'. */}
          <span data-testid="player-table-legend" className="mt-1 block">
            In <span className="font-medium text-destructive">rosso</span> i tetti che il mercato supera:
            {' '}conviene fin lì, ma si pagherà di più. «Nessuno»: a nessun prezzo ci guadagni.
            {' '}Per i tetti più convenienti, «Occasioni della fase».
          </span>
        </caption>
        <thead>
          <tr className="border-b border-line-strong text-left text-muted-foreground">
            {/* Parole intere, non sigle: «Sq», «Quot», «FM attesa» si capivano solo
                da chi le aveva scritte. Sul telefono restano le tre colonne che
                servono a decidere; la squadra va sotto il nome. */}
            <th scope="col" className={`${CELL_X} py-2 font-normal ${th}`}>Giocatore</th>
            <th scope="col" className={`${CELL_X} py-2 font-normal max-sm:hidden ${th}`}>Squadra</th>
            <SortableHeader column="quotazione" label="Quotazione" sort={sort} dir={dir} onSort={onSort} sticky={fill} />
            {/* Non ordinabile, e non per dimenticanza: il tetto nasce da una
                valutazione completa per riga, e metterci in fila l'intera fase
                costerebbe secondi a ogni pagina chiesta. La stessa domanda —
                «dove conviene guardare» — ha gia' la sua risposta in «Occasioni
                della fase», detto nella legenda qui sopra. */}
            <th scope="col" className={`${CELL_X} py-2 text-right font-normal ${th}`}>Il tuo tetto</th>
            <SortableHeader column="fantamedia" label="Fantamedia attesa" sort={sort} dir={dir} onSort={onSort} sticky={fill} hideOnPhone />
            <SortableHeader column="titolarita" label="Titolarità" sort={sort} dir={dir} onSort={onSort} sticky={fill} hideOnPhone />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const above = row.margin < 0;
            const selected = row.id === selectedId;
            // Il nome accessibile porta insieme l'azione e lo stato: un
            // aria-current da solo annuncerebbe "corrente" senza dire di
            // cosa, e chi ascolta sentirebbe solo il nome del giocatore.
            // Il testo visibile nella cella resta il nome nudo — questo e'
            // cio' che si annuncia all'attivazione, non cio' che si legge.
            const accessibleLabel = selected
              ? `${row.name}, selezionato per la valutazione`
              : `Valuta ${row.name}`;
            return (
              <tr
                key={row.id}
                data-testid={`row-${row.id}`}
                data-above-threshold={above}
                className={`border-b border-line ${selected ? 'bg-surface' : ''}`}
              >
                <td className="min-w-11 py-0">
                  {/* Il bersaglio e' un bottone vero: raggiungibile da tastiera,
                      annunciato come azione, e alto abbastanza da essere colpito.
                      min-w-11 garantisce anche la larghezza minima (44px): senza,
                      dipende dall'auto-layout della tabella e regge per caso. */}
                  <button
                    type="button"
                    onClick={() => onSelect(row.id)}
                    aria-label={accessibleLabel}
                    disabled={disabled}
                    aria-describedby={disabled ? lockedHintId : undefined}
                    className={`${CELL_X} flex min-h-11 w-full items-center text-left max-lg:min-h-14 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50`}
                  >
                    <span className="flex flex-col py-1">
                      <span>{row.name}</span>
                      <span className="text-meta text-muted-foreground sm:hidden">{row.team} · {Math.round(row.titolaritaPercent)}% titolare</span>
                    </span>
                  </button>
                </td>
                <td className={`${CELL_X} py-2 text-muted-foreground max-sm:hidden`}>{row.team}</td>
                <td className={`tnum ${CELL_X} py-2 text-right text-muted-foreground`}>{row.listPrice}</td>
                <td
                  data-testid={`maxbid-${row.id}`}
                  // Tre stati, e solo uno colorato.
                  //
                  // Il rosso e' per «c'e' un tetto, ma il mercato te lo porta via»:
                  // l'unico caso in cui si puo' ancora essere tentati, e un avviso
                  // serve a qualcosa. Prima era colorato ANCHE il caso raggiungibile
                  // (in oro): colorare la regola insieme all'eccezione vuol dire non
                  // dire niente, e le due tinte calde a 14px su verde scuro si
                  // distinguevano a fatica.
                  //
                  // «Nessuno» arretra invece di gridare: su una fase intera tocca
                  // quasi meta' delle righe, e in rosso quella parola sovrastava i
                  // numeri accanto — che sono l'unica cosa su cui si agisce. Dove
                  // non c'e' niente da fare, non c'e' nessuno da avvisare.
                  // Con fill il tetto raggiungibile e' in grassetto: e' il numero su
                  // cui si decide, e nella tabella sotto il banco va trovato a colpo
                  // d'occhio fra quotazione e fantamedia.
                  className={`tnum ${CELL_X} py-2 text-right ${
                    row.maxBid === 0 ? 'text-muted-foreground' : above ? 'text-destructive' : fill ? 'lg:font-bold' : ''
                  }`}
                >
                  {/* Tetto zero non e' un prezzo basso: e' l'assenza di un prezzo —
                      il motore lo restituisce quando NESSUNA cifra, nemmeno uno,
                      lascia un guadagno. In colonna con 23 e 22 lo zero si leggeva
                      come una cifra, e per giunta come la piu' conveniente della
                      tabella. La parola risponde all'intestazione: il tuo tetto,
                      nessuno. E si porta dietro il proprio significato, quindi non
                      serve l'avviso di superamento qui sotto: sarebbe «nessuno,
                      oltre il tetto stimato», due volte la stessa cosa. */}
                  {row.maxBid === 0 ? 'nessuno' : row.maxBid}
                  {/* Il colore da solo non e' informazione, e data-above-threshold
                      non entra nell'albero di accessibilita': e' un data-*, non
                      un'attributo ARIA. Questo testo e' l'equivalente per chi
                      non vede, letto insieme al numero. */}
                  {above && row.maxBid > 0 ? (
                    <span className="sr-only">, oltre il tetto stimato</span>
                  ) : null}
                </td>
                <td className={`tnum ${CELL_X} py-2 text-right text-muted-foreground max-sm:hidden`}>
                  {row.fantamediaAttesa.toFixed(1)}
                </td>
                <td className={`tnum ${CELL_X} py-2 text-right text-muted-foreground max-sm:hidden`}>
                  {Math.round(row.titolaritaPercent)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {disabled ? (
        <span id={lockedHintId} className="sr-only">
          Selezione bloccata: chiudi il conto alla rovescia per scegliere un altro giocatore.
        </span>
      ) : null}
    </div>
  );
}

/**
 * Un'intestazione che si puo' richiamare per ordinare. Il verso lo porta
 * {@code aria-sort} sulla cella, che e' il modo in cui una tabella dice a chi
 * ascolta su cosa e' ordinata; la freccia e' la stessa cosa per chi guarda.
 *
 * <p>Richiamare la colonna gia' in uso ne rovescia il verso; una colonna nuova
 * parte dal suo verso naturale, il decrescente — la quotazione piu' alta, la
 * fantamedia migliore, chi gioca di piu'.
 */
function SortableHeader({ column, label, sort, dir, onSort, hideOnPhone = false, sticky = false }: {
  column: PhaseSort;
  label: string;
  sort: PhaseSort;
  dir: SortDir;
  onSort?: (sort: PhaseSort, dir: SortDir) => void;
  hideOnPhone?: boolean;
  /** Ferma in alto, come le altre intestazioni della tabella a riempimento. */
  sticky?: boolean;
}) {
  const active = sort === column;
  const cell = `${CELL_X} py-2 text-right font-normal ${hideOnPhone ? 'max-sm:hidden' : ''} ${sticky ? STICKY_TH : ''}`;

  if (!onSort) {
    return <th scope="col" className={cell}>{label}</th>;
  }
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cell}
    >
      <button
        type="button"
        onClick={() => onSort(column, active && dir === 'desc' ? 'asc' : 'desc')}
        className={`-mx-1 flex min-h-11 w-full items-center justify-end gap-1.5 rounded px-1 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
          active ? 'font-medium text-foreground' : ''
        }`}
      >
        {label}
        {active ? <SortArrow dir={dir} /> : null}
      </button>
    </th>
  );
}
