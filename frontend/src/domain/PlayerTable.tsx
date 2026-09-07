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
            return (
              <tr
                key={row.id}
                data-testid={`row-${row.id}`}
                data-above-threshold={above}
                className={`border-b border-line ${selected ? 'bg-surface' : ''}`}
              >
                <td className="py-0">
                  {/* Il bersaglio e' un bottone vero: raggiungibile da tastiera,
                      annunciato come azione, e alto abbastanza da essere colpito.
                      Lo stato di selezione va su questo elemento e non su <tr>:
                      aria-selected e' uno stato di row supportato solo dentro un
                      antenato grid o treegrid (widget interattivi), non dentro
                      un <table> statico come il nostro — li' resterebbe nel DOM
                      ma invisibile agli assistivi. aria-current e' cio' che si
                      usa per segnalare l'elemento correntemente attivo in un
                      insieme quando aria-selected non si applica, ed e'
                      supportato su qualunque elemento, bottone incluso. */}
                  <button
                    type="button"
                    onClick={() => onSelect(row.id)}
                    aria-current={selected ? 'true' : undefined}
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
