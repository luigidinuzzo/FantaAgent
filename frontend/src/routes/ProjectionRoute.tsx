import { useEffect, useState } from 'react';
import { AppShell } from '../AppShell';
import { useBoard, usePublicBidder } from '../api/hooks';
import type { BidBroadcast } from '../domain/bidChannel';
import { subscribeBid } from '../domain/bidChannel';
import { PublicBidderDialog } from '../domain/PublicBidderDialog';

const ROLE_ORDER = ['P', 'D', 'C', 'A'] as const;

/**
 * La schermata proiettata: mostra e basta.
 *
 * <p>I tabelloni arrivano dal server e sono sempre corretti. Il lotto corrente arriva
 * invece dall'altra finestra, perche' un rilancio non e' un fatto dell'asta e non tocca
 * il registro. Se quel canale non c'e' — la proiezione aperta su un altro dispositivo —
 * la schermata lo DICE, con la stessa disciplina dello stato stantio: una schermata
 * ferma che finge di essere aggiornata e' il difetto peggiore di questa migrazione.
 */
export function ProjectionRoute() {
  const board = useBoard();
  const [bid, setBid] = useState<BidBroadcast | null>(null);
  const [canReceive] = useState(() => typeof BroadcastChannel !== 'undefined');
  const bidding = bid?.kind === 'bidding' ? bid : null;
  const player = usePublicBidder(bidding?.playerId ?? null);

  useEffect(() => subscribeBid(setBid), []);

  return (
    <AppShell>
      {/* Nascosto alla vista, non dall'albero di accessibilita': una schermata con
          contenuto vero deve avere un h1 che chi ascolta puo' raggiungere, anche se
          chi guarda il proiettore non ha bisogno di leggere la parola "Proiezione". */}
      <h1 className="sr-only">Proiezione</h1>

      {!canReceive ? (
        <p className="border border-dashed border-line p-6 text-sm text-accent">
          Questa finestra non riceve dalla schermata privata: i tabelloni qui sotto sono
          aggiornati, il giocatore all'asta no.
        </p>
      ) : null}

      {bidding ? <PublicBidderDialog bid={bidding} player={player.data} /> : null}

      <section aria-labelledby="projection-board-heading" className="mt-6">
        <h2 id="projection-board-heading" className="mb-3 text-sm text-muted-foreground">
          Tabelloni
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {(board.data?.columns ?? []).map((c) => {
            const headingId = `board-col-${c.participantId}`;
            return (
              <section
                key={c.participantId}
                aria-labelledby={headingId}
                className={`border p-4 ${c.me ? 'border-accent' : 'border-line'}`}
              >
                <header className="flex items-baseline justify-between gap-2">
                  <h3 id={headingId} className="font-bold">
                    {c.participantName}
                  </h3>
                  <p className={`tnum w-exp font-bold ${c.me ? 'text-accent' : ''}`}>
                    {c.budgetRemaining}
                    <span className="sr-only"> crediti rimanenti</span>
                  </p>
                </header>
                <table className="w-cond mt-2 w-full border-collapse text-sm">
                  <caption className="sr-only">Rosa di {c.participantName}</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="sr-only">Giocatore</th>
                      <th scope="col" className="sr-only">Prezzo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ROLE_ORDER.flatMap((r) =>
                      c.byRole[r].map((s) => (
                        <tr key={s.seq} className="border-b border-line">
                          <td className="w-cond py-1">{s.playerName}</td>
                          <td className="tnum py-1 text-right text-muted-foreground">
                            {s.price}
                          </td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </section>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
