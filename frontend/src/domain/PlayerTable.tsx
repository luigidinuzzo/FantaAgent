import { useId } from 'react';
import type { PhaseRowView } from '../api/types';
import { EmptyState } from './EmptyState';

const CAPTION_ID = 'player-table-caption';

export function PlayerTable({
  rows,
  selectedId,
  onSelect,
  disabled = false,
}: {
  rows: PhaseRowView[];
  selectedId: string | null;
  onSelect: (playerId: string) => void;
  /**
   * Un lotto alla volta e' aperto sul battitore: mentre lo e', la
   * selezione resta bloccata, non solo scoraggiata. Un clic vagante su
   * un'altra riga cambierebbe il giocatore sotto un rilancio in corso —
   * countdown, prezzo e beep perduti senza preavviso. Abbandonare un lotto
   * resta un gesto deliberato (si chiude il battitore), non un incidente
   * di un clic.
   */
  disabled?: boolean;
}) {
  const lockedHintId = useId();

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
      className="relative overflow-x-auto rounded-lg border border-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
    >
      <table className="w-cond w-full border-collapse text-sm">
        <caption id={CAPTION_ID} className="sr-only">
          Giocatori liberi nella fase corrente
        </caption>
        <thead>
          <tr className="border-b border-line-strong text-left text-muted-foreground">
            <th scope="col" className="py-2 font-normal">Giocatore</th>
            <th scope="col" className="py-2 font-normal">Sq</th>
            <th scope="col" className="py-2 text-right font-normal">Quot</th>
            <th scope="col" className="py-2 text-right font-normal">Tetto</th>
            <th scope="col" className="py-2 text-right font-normal">FM attesa</th>
            <th scope="col" className="py-2 text-right font-normal">Titolarità</th>
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
                    className="flex min-h-11 w-full items-center text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
                  >
                    {row.name}
                  </button>
                </td>
                <td className="py-2 text-muted-foreground">{row.team}</td>
                <td className="tnum py-2 text-right text-muted-foreground">{row.listPrice}</td>
                <td
                  data-testid={`maxbid-${row.id}`}
                  className={`tnum py-2 text-right ${above ? 'text-destructive' : 'text-accent'}`}
                >
                  {row.maxBid}
                  {/* Il colore da solo non e' informazione, e data-above-threshold
                      non entra nell'albero di accessibilita': e' un data-*, non
                      un'attributo ARIA. Questo testo e' l'equivalente per chi
                      non vede, letto insieme al numero. */}
                  {above ? <span className="sr-only">, oltre il tetto stimato</span> : null}
                </td>
                <td className="tnum py-2 text-right text-muted-foreground">
                  {row.fantamediaAttesa.toFixed(1)}
                </td>
                <td className="tnum py-2 text-right text-muted-foreground">
                  {Math.round(row.titolaritaPercent)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {disabled ? (
        <span id={lockedHintId} className="sr-only">
          Selezione bloccata: chiudi il battitore per scegliere un altro giocatore.
        </span>
      ) : null}
    </div>
  );
}
