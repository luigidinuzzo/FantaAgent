import { Fragment, useEffect, useState } from 'react';
import { AppShell } from '../AppShell';
import { useAuctionState, useBoard, usePublicBidder } from '../api/hooks';
import type { BoardColumn, Role } from '../api/types';
import type { BidBroadcast } from '../domain/bidChannel';
import { subscribeBid } from '../domain/bidChannel';
import { ConnectionStatus, isStale } from '../domain/ConnectionStatus';
import { EmptyState } from '../domain/EmptyState';
import { PublicBidderDialog } from '../domain/PublicBidderDialog';
import { ROLE_NAME_PLURAL_CAPITALIZED, ROLES } from '../domain/roles';

const ROLE_ORDER = ROLES;

const ROLE_NAME = ROLE_NAME_PLURAL_CAPITALIZED;

/**
 * Il colore del ruolo come testo, per la lettera nella fascia sottile. La fascia
 * piena a tutta larghezza di prima occupava una riga intera per dire una lettera.
 */
const ROLE_TEXT: Record<Role, string> = {
  P: 'text-role-p', D: 'text-role-d', C: 'text-role-c', A: 'text-role-a',
};
const ROLE_BORDER: Record<Role, string> = {
  P: 'border-role-p', D: 'border-role-d', C: 'border-role-c', A: 'border-role-a',
};

/**
 * Una riga del tabellone: la misura del testo segue l'altezza della finestra,
 * cosi' le rose di tutte le squadre stanno in uno schermo solo — un proiettore non
 * si scorre. Ogni riga prende la stessa parte di altezza (flex-1), quindi le
 * colonne restano allineate riga per riga da una squadra all'altra.
 */
const LINE = 'flex min-h-0 flex-1 items-center gap-2 text-[clamp(0.75rem,1.6vh,1.4rem)] leading-none';

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
 * e' fresco, la nota accanto dice se il canale e' vivo. React Query lascia
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
  // I posti per ruolo di ogni squadra: servono a disegnare anche quelli ancora
  // vuoti, cosi' si vede quanto manca e le colonne restano allineate.
  const state = useAuctionState();
  function slotsOf(participantId: string): Partial<Record<Role, number>> {
    return state.data?.participants.find((p) => p.id === participantId)?.slotsByRole ?? {};
  }

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
      // Il vincolo permanente della proiezione (zero pulsanti, zero caselle di
      // testo) si estende alla navigazione che AppShell offre alle altre
      // schermate: e' una seconda schermata su un proiettore, senza nessun
      // controllo, nemmeno un link.
      chrome="none"
      slotStatus={
        <div className="flex items-center gap-4">
          {/* Il canale con la finestra dell'asta, detto in un angolo e non in una
              fascia gialla a tutta larghezza: sul proiettore lo legge tutta la
              lega, e un avviso tecnico grande quanto un titolo rubava la scena
              alle rose. Resta vero e resta visibile a chi regge l'asta. Non dice
              niente sulla freschezza dei tabelloni: quella e' di ConnectionStatus. */}
          {!canReceive ? (
            <span className="text-sm text-muted-foreground">
              Il giocatore all'asta non compare su questo schermo
            </span>
          ) : null}
          <ConnectionStatus
            updatedAt={board.dataUpdatedAt || undefined}
            isError={board.isError}
            now={now}
          />
        </div>
      }
    >
      {/* Nascosto alla vista, non dall'albero di accessibilita': una schermata con
          contenuto vero deve avere un h1 che chi ascolta puo' raggiungere, anche se
          chi guarda il proiettore non ha bisogno di leggere la parola "Proiezione". */}
      <h1 className="sr-only">Proiezione</h1>

      {/* Un lotto sentito ma non piu' fresco non si mostra: sarebbe la stessa
          schermata ferma che finge di essere aggiornata, contro cui il messaggio
          qui sopra sta avvisando nello stesso momento. */}
      {canReceive && bidding ? <PublicBidderDialog bid={bidding} player={player.data} /> : null}

      {/* Alta quanto la finestra meno la testata: il tabellone si divide lo spazio
          che resta invece di allungare la pagina. Se c'e' un lotto aperto, il
          lotto prende il suo posto in cima e il tabellone si stringe. */}
      <section
        aria-labelledby="projection-board-heading"
        className={`flex min-h-0 flex-col ${bidding && canReceive ? 'mt-4 h-[calc(100dvh-26rem)]' : 'h-[calc(100dvh-6.5rem)]'}`}
      >
        <h2 id="projection-board-heading" className="sr-only">Tabelloni</h2>
        {board.isLoading ? (
          <p className="panel rounded-xl p-5 text-lg text-muted-foreground">Carico i tabelloni…</p>
        ) : board.isError ? (
          // role="alert": puntuale su questa sezione, non una seconda live
          // region ambientale. L'unica di quel tipo nell'app resta AuctionAnnouncer.
          <p role="alert" className="panel rounded-xl p-5 text-lg text-destructive">
            Non riesco a caricare i tabelloni.
          </p>
        ) : (board.data?.columns.length ?? 0) === 0 ? (
          <EmptyState>Nessun partecipante in questa lega.</EmptyState>
        ) : (
          // Tutte le squadre in una fila sola, qualunque sia il loro numero: con
          // tre colonne per riga se ne vedevano tre su otto.
          <div
            className="grid min-h-0 flex-1 gap-3"
            style={{ gridTemplateColumns: `repeat(${board.data!.columns.length}, minmax(0, 1fr))` }}
          >
            {board.data!.columns.map((c) => (
              <BoardTeam key={c.participantId} column={c} slots={slotsOf(c.participantId)} />
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}

/**
 * La colonna di una squadra: nome e crediti in testa, poi per ogni ruolo una fascia
 * sottile col conto dei posti e una riga per posto, pieno o ancora vuoto.
 */
function BoardTeam({ column: c, slots }: {
  column: BoardColumn;
  slots: Partial<Record<Role, number>>;
}) {
  const headingId = `board-col-${c.participantId}`;
  return (
    <section
      aria-labelledby={headingId}
      className={`flex min-h-0 min-w-0 flex-col rounded-xl border bg-surface px-3 py-2 ${c.me ? 'border-accent' : 'border-panel-border'}`}
    >
      <header className="flex shrink-0 items-baseline justify-between gap-2 border-b border-line-strong pb-2">
        <h3 id={headingId} className="w-exp truncate text-[clamp(1rem,2.4vh,2rem)] font-extrabold">
          {c.participantName}
        </h3>
        <p className="flex shrink-0 flex-col items-end leading-none">
          <span className={`tnum w-exp text-[clamp(1rem,2.4vh,2rem)] font-extrabold ${c.me ? 'text-accent' : ''}`}>
            {c.budgetRemaining}
          </span>
          <span className="text-[clamp(0.6rem,1.1vh,0.9rem)] text-muted-foreground">crediti</span>
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        {ROLE_ORDER.map((r) => {
          const bought = c.byRole[r];
          const total = Math.max(slots[r] ?? 0, bought.length);
          const empty = total - bought.length;
          return (
            <Fragment key={r}>
              <div className={`${LINE} mt-1 border-l-4 pl-2 font-extrabold ${ROLE_BORDER[r]}`}>
                <span aria-hidden="true" className={ROLE_TEXT[r]}>{r}</span>
                <span className="sr-only">{ROLE_NAME[r]}</span>
                <span className="tnum ml-auto text-muted-foreground">{`${bought.length} di ${total}`}</span>
              </div>
              {bought.map((s) => (
                <div key={s.seq} className={`${LINE} border-b border-line`}>
                  <span className="min-w-0 flex-1 truncate">{s.playerName}</span>
                  <span className="tnum shrink-0 text-muted-foreground">
                    {`${s.price} `}
                    <span className="sr-only">crediti</span>
                  </span>
                </div>
              ))}
              {Array.from({ length: empty }, (_, i) => (
                // Un posto ancora libero: decorazione, il conto l'ha gia' detto.
                <div key={`vuoto-${i}`} aria-hidden="true" className={`${LINE} border-b border-dashed border-line text-muted-foreground/50`}>
                  —
                </div>
              ))}
            </Fragment>
          );
        })}
      </div>
    </section>
  );
}
