import type { PhaseRowView } from '../api/types';

export function PlayerTable({
  rows,
  selectedId,
  onSelect,
}: {
  rows: PhaseRowView[];
  selectedId: string | null;
  onSelect: (playerId: string) => void;
}) {
  if (rows.length === 0) {
    // Uno schermo vuoto e' un invito ad agire, non un errore muto.
    return (
      <p className="border border-dashed border-line p-6 text-sm text-muted-foreground">
        Nessun giocatore libero in questa fase. Passa alla fase successiva.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-cond w-full border-collapse text-sm">
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
                <td className="py-0">
                  {/* Il bersaglio e' un bottone vero: raggiungibile da tastiera,
                      annunciato come azione, e alto abbastanza da essere colpito. */}
                  <button
                    type="button"
                    onClick={() => onSelect(row.id)}
                    aria-label={accessibleLabel}
                    className="flex min-h-11 w-full items-center text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
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
    </div>
  );
}
