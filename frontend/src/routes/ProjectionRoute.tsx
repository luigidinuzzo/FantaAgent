import { useEffect, useState } from 'react';
import { AppShell } from '../AppShell';
import { useBoard, usePublicBidder } from '../api/hooks';
import type { BidBroadcast } from '../domain/bidChannel';
import { subscribeBid } from '../domain/bidChannel';
import { ConnectionStatus, isStale } from '../domain/ConnectionStatus';
import { EmptyState } from '../domain/EmptyState';
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
 *
 * <p>"Poter ricevere" non e' "il browser supporta BroadcastChannel": quell'API non
 * attraversa mai due dispositivi o due processi, vive solo dentro lo stesso browser.
 * L'unica prova onesta di essere davvero in ascolto dell'altra finestra e' aver
 * sentito qualcosa di recente — lo stesso principio di {@link isStale}, qui applicato
 * al canale fra le finestre invece che al server. La finestra privata (useIdleHeartbeat)
 * pubblica un segno di vita a intervalli regolari anche senza lotti aperti, apposta
 * perche' questa distinzione sia possibile: senza quel battito, "niente sentito di
 * recente" sarebbe vero anche durante una pausa perfettamente sana, e la schermata
 * avviserebbe senza motivo.
 *
 * <p>Le due segnalazioni di staleness — canale e server — sono indipendenti e
 * mostrate separatamente: {@link ConnectionStatus} nella testata dice se `useBoard()`
 * e' fresco, l'avviso qui sotto dice se il canale e' vivo. React Query lascia
 * `isError` false su un REFETCH fallito quando c'e' gia' un dato in cache (resta
 * `status: 'success'`), quindi senza ConnectionStatus la proiezione mostrerebbe rose e
 * budget congelati all'infinito se il server cadesse dopo il primo caricamento —
 * proprio lo schermo che finge di essere aggiornato che questa migrazione vieta.
 * Nessuna delle due frasi afferma la freschezza dell'ALTRA fonte: quando entrambe
 * sono stantie insieme, non devono contraddirsi.
 */
export function ProjectionRoute() {
  const board = useBoard();
  const [bid, setBid] = useState<BidBroadcast | null>(null);
  const [lastHeardAt, setLastHeardAt] = useState<number | undefined>(undefined);
  const [now, setNow] = useState(() => Date.now());
  const hasChannel = typeof BroadcastChannel !== 'undefined';
  const bidding = bid?.kind === 'bidding' ? bid : null;
  const player = usePublicBidder(bidding?.playerId ?? null);

  useEffect(
    () =>
      subscribeBid((message) => {
        setLastHeardAt(Date.now());
        setBid(message);
      }),
    [],
  );

  // Un tick al secondo: serve solo a far invecchiare "quanto manca sentito
  // qualcosa", lo stesso ritmo con cui AuctionRoute fa invecchiare il proprio
  // stato stantio (isStale in ConnectionStatus).
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  // Senza l'API non si potra' MAI ricevere: caso onesto e immediato, non
  // serve aspettare una soglia per saperlo. Con l'API presente, si e' "in
  // ascolto" solo se si e' sentito qualcosa di recente — non solo se
  // qualcosa potrebbe in teoria arrivare.
  const canReceive = hasChannel && !isStale({ updatedAt: lastHeardAt, isError: false, now });

  return (
    <AppShell
      slotStatus={
        <ConnectionStatus
          updatedAt={board.dataUpdatedAt || undefined}
          isError={board.isError}
          now={now}
        />
      }
    >
      {/* Nascosto alla vista, non dall'albero di accessibilita': una schermata con
          contenuto vero deve avere un h1 che chi ascolta puo' raggiungere, anche se
          chi guarda il proiettore non ha bisogno di leggere la parola "Proiezione". */}
      <h1 className="sr-only">Proiezione</h1>

      {!canReceive ? (
        // Non afferma nulla sulla freschezza dei tabelloni: quella e'
        // responsabilita' di ConnectionStatus qui sopra, non di questo
        // avviso. Le due segnalazioni sono indipendenti — se dicesse "i
        // tabelloni sono aggiornati" mentre il server e' anche lui stantio,
        // le due frasi si contraddirebbero nello stesso istante.
        <p className="border border-dashed border-line p-6 text-sm text-accent">
          Questa finestra non riceve dalla schermata privata: il giocatore all'asta non
          e' visibile qui.
        </p>
      ) : null}

      {/* Un lotto sentito ma non piu' fresco non si mostra: sarebbe la stessa
          schermata ferma che finge di essere aggiornata, contro cui il messaggio
          qui sopra sta avvisando nello stesso momento. */}
      {canReceive && bidding ? <PublicBidderDialog bid={bidding} player={player.data} /> : null}

      <section aria-labelledby="projection-board-heading" className="mt-6">
        <h2 id="projection-board-heading" className="mb-3 text-sm text-muted-foreground">
          Tabelloni
        </h2>
        {board.isLoading ? (
          <p className="text-sm text-muted-foreground">Carico i tabelloni…</p>
        ) : board.isError ? (
          // role="alert": puntuale su questa sezione, non una seconda live
          // region ambientale. L'unica di quel tipo nell'app resta AuctionAnnouncer.
          <p role="alert" className="text-sm text-destructive">
            Non riesco a caricare i tabelloni.
          </p>
        ) : (board.data?.columns.length ?? 0) === 0 ? (
          <EmptyState>Nessun partecipante in questa lega.</EmptyState>
        ) : (
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
        )}
      </section>
    </AppShell>
  );
}
