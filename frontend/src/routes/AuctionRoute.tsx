import { useEffect, useId, useState } from 'react';
import { AppShell } from '../AppShell';
import { ProblemError } from '../api/client';
import {
  useAssign,
  useAuctionState,
  useChangePhase,
  usePhasePlayers,
  usePublicBidder,
  useUndoLast,
  useValuation,
} from '../api/hooks';
import type { Role } from '../api/types';
import { AuctionAnnouncer, phaseChangedMessage, purchaseMessage, undoMessage } from '../domain/AuctionAnnouncer';
import { BidderDialog } from '../domain/BidderDialog';
import { BidPanel } from '../domain/BidPanel';
import { ConnectionStatus, isStale } from '../domain/ConnectionStatus';
import { EmptyState } from '../domain/EmptyState';
import { LeagueBoard } from '../domain/LeagueBoard';
import { PhaseSwitcher } from '../domain/PhaseSwitcher';
import { PlayerDecisionCard } from '../domain/PlayerDecisionCard';
import { PlayerTable } from '../domain/PlayerTable';
import { UndoLastButton } from '../domain/UndoLastButton';
import { useIdleHeartbeat } from './useIdleHeartbeat';

export function AuctionRoute() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [bidderOpen, setBidderOpen] = useState(false);
  // Vero dal momento in cui il countdown del battitore scade fino alla
  // chiusura del dialogo: serve SOLO a far ripartire il battito di vita
  // (si veda useIdleHeartbeat) mentre l'aggiudicazione e' ancora in corso.
  const [dialogExpired, setDialogExpired] = useState(false);
  const bidderHintId = useId();

  // Un tick al secondo: serve solo a far invecchiare il "da quanto tempo".
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  const state = useAuctionState();
  const phase = usePhasePlayers(0);
  const valuation = useValuation(selectedId);
  const assign = useAssign();
  const changePhase = useChangePhase();
  const undoLast = useUndoLast();
  // timerSeconds e beepEnabled sono preferenze dell'asta, non della
  // valutazione: oggi l'unico endpoint che le espone e' /board/bidder/{id}
  // (Task 3), costruito per la proiezione. E' un prestito, non la sede
  // definitiva — quando la tappa 5 porta l'endpoint delle impostazioni,
  // questa lettura deve spostarsi li'.
  const bidderSettings = usePublicBidder(selectedId);

  // Battito di vita per la proiezione (si veda useIdleHeartbeat per il
  // perche' e il come). Si ferma SOLO mentre BidderDialog sta gia'
  // pubblicando da conto suo: dialogo aperto e countdown non ancora scaduto.
  // Appena il countdown scade il dialogo smette di pubblicare ma resta
  // aperto in attesa dell'aggiudicazione — e' per questo che la condizione
  // e' "aperto E non scaduto", non il solo "aperto".
  useIdleHeartbeat(bidderOpen && !dialogExpired);

  const stale = isStale({
    updatedAt: state.dataUpdatedAt || undefined,
    isError: state.isError,
    now,
  });

  const assignError =
    assign.error instanceof ProblemError ? assign.error.detail : null;
  const changePhaseError =
    changePhase.error instanceof ProblemError ? changePhase.error.detail : null;
  const undoError =
    undoLast.error instanceof ProblemError ? undoLast.error.detail : null;

  // L'annuncio si compone DOPO la conferma del server, dallo stato appena
  // riletto: e' la stessa disciplina del bottone, detta a parole. Comporlo dai
  // valori inviati direbbe cosa si e' chiesto, non cosa e' successo.
  const [announcement, setAnnouncement] = useState<string | null>(null);
  useEffect(() => {
    const last = assign.data;
    if (!last || !state.data) return;
    const me = state.data.participants.find((p) => p.me);
    const buyer = state.data.participants.find((p) => p.id === last.participantId);
    if (!me || !buyer) return;
    setAnnouncement(
      purchaseMessage({
        // Il nome viene dall'input della mutazione, non dalla valutazione
        // selezionata: quella e' del giocatore su cui si sta guardando ADESSO,
        // che puo' essere gia' un altro se si e' cliccata un'altra riga mentre
        // l'aggiudicazione era in volo — si annuncerebbe il nome sbagliato per
        // l'acquisto giusto. E se la valutazione non e' ancora risolta si
        // finiva ad annunciare un identificativo numerico nudo.
        playerName: assign.variables?.playerName ?? last.playerId,
        buyerName: buyer.name,
        price: last.price,
        myBudgetRemaining: me.budgetRemaining,
        mySlotsRemaining: me.slotsRemaining,
      }),
    );
    // Un'aggiudicazione riuscita chiude il battitore: senza, il dialogo
    // resta in scena col prezzo vinto e un bottone Aggiudica ancora attivo,
    // e l'unica conferma per chi vede sarebbe AuctionAnnouncer — sr-only,
    // meno riscontro di quanto ne riceve chi ascolta. No-op se si stava
    // aggiudicando da BidPanel (bidderOpen e' gia' false).
    setBidderOpen(false);
    setDialogExpired(false);
  }, [assign.data, assign.variables?.playerName, state.data]);

  // Azzera l'errore (e il risultato) della mutazione condivisa quando cambia
  // il giocatore selezionato o si apre il battitore: senza, l'errore di
  // un'aggiudicazione fallita per UN giocatore resta appeso in useAssign()
  // finche' un'altra mutate() non si risolve, e riaprendo il battitore per
  // un giocatore diverso lampeggia per un istante il fallimento del
  // precedente — un difetto preesistente in BidPanel, non nuovo qui.
  useEffect(() => {
    assign.reset();
    // `assign` (l'intero oggetto della mutazione, non solo `.reset`) e'
    // deliberatamente FUORI dalle dipendenze: e' un riferimento nuovo a ogni
    // render di useMutation, e includerlo farebbe girare questo effetto a
    // ogni render invece che solo al cambio di giocatore o all'apertura del
    // battitore, che e' l'unico momento in cui deve azzerare l'errore.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, bidderOpen]);

  // Condiviso fra BidPanel e BidderDialog: due controlli per raggiungere LA
  // STESSA mutazione, non due percorsi di aggiudicazione. Un invio nuovo
  // azzera qui l'annuncio del precedente, nello stesso gesto dell'utente —
  // si veda il commento originale su useAssign per il perche' non basta un
  // effetto agganciato a isPending.
  function assignPlayer({ participantId, price }: { participantId: string; price: number }) {
    setAnnouncement(null);
    assign.mutate({
      playerId: valuation.data!.playerId,
      playerName: valuation.data!.name,
      participantId,
      price,
    });
  }

  // Il cambio fase e l'annullamento non hanno numeri da riportare dopo
  // un'attesa (a differenza del budget di un'aggiudicazione): l'annuncio
  // qui puo' comporsi subito nel callback della singola chiamata, senza la
  // stessa attesa "dallo stato appena riletto" che serve invece ad
  // assignPlayer.
  function changePhaseTo(role: Role) {
    changePhase.mutate(role, {
      onSuccess: () => setAnnouncement(phaseChangedMessage(role)),
    });
  }

  function undo() {
    undoLast.mutate(undefined, {
      onSuccess: () => setAnnouncement(undoMessage()),
    });
  }

  return (
    <AppShell
      slotStatus={
        <>
          {/* Product gap (revisione finale): non esisteva nessun modo di
              raggiungere /proiezione dall'applicazione — bisognava digitare
              l'indirizzo a mano. target="_blank": va aperta in una seconda
              finestra, sul secondo schermo, non al posto di questa. */}
          <a
            href="/proiezione"
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center text-sm font-bold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            Apri la proiezione sul secondo schermo
          </a>
          <ConnectionStatus
            updatedAt={state.dataUpdatedAt || undefined}
            isError={state.isError}
            now={now}
          />
        </>
      }
    >
      {/* Nascosto alla vista, non dall'albero di accessibilita': come su
          /proiezione, chi ascolta deve avere un h1 da cui partire anche se
          chi guarda il portatile non ha bisogno di leggere la parola "Asta". */}
      <h1 className="sr-only">Asta</h1>
      <AuctionAnnouncer message={announcement} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <PhaseSwitcher
          phases={state.data?.phases ?? []}
          current={state.data?.currentPhase ?? 'P'}
          onChange={changePhaseTo}
          pending={changePhase.isPending}
          error={changePhaseError}
        />
        <UndoLastButton
          canUndo={state.data?.canUndo ?? false}
          onUndo={undo}
          pending={undoLast.isPending}
          error={undoError}
        />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_16rem]">
        <div>
          {valuation.data ? (
            <PlayerDecisionCard valuation={valuation.data} stale={stale}>
              {/* key: un giocatore nuovo deve azzerare il campo prezzo. La
                  reattivita' interna di BidPanel a suggestedPrice serve per
                  la rivalutazione dello STESSO giocatore (un'offerta altrui
                  che sposta il tetto) e deliberatamente non tocca un campo
                  gia' toccato dall'utente — senza remount, cambiando
                  giocatore il prezzo digitato per il precedente resterebbe
                  nel campo. Le due cose sono complementari, non alternative. */}
              {bidderOpen && bidderSettings.data ? (
                <BidderDialog
                  key={valuation.data.playerId}
                  valuation={valuation.data}
                  participants={state.data?.participants ?? []}
                  timerSeconds={bidderSettings.data.timerSeconds}
                  beepEnabled={bidderSettings.data.beepEnabled}
                  error={assignError}
                  disabled={stale}
                  pending={assign.isPending}
                  onAssign={assignPlayer}
                  onClose={() => {
                    setBidderOpen(false);
                    setDialogExpired(false);
                  }}
                  onExpire={() => setDialogExpired(true)}
                />
              ) : (
                <>
                  {/* Apre il battitore per il lotto conteso: BidPanel resta
                      la via diretta per un giocatore che nessuno contende,
                      questo e' l'altra via alla STESSA mutazione (assignPlayer),
                      non una seconda. Disabilitato finche' le preferenze vere
                      non sono arrivate: aprire subito significherebbe mostrare
                      un timer finto, e questa migrazione non finge mai un dato
                      che non ha ancora. */}
                  <button
                    type="button"
                    onClick={() => setBidderOpen(true)}
                    disabled={!bidderSettings.data}
                    aria-describedby={!bidderSettings.data ? bidderHintId : undefined}
                    className="mb-3 min-h-11 border border-line-strong px-4 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
                  >
                    Apri il battitore per {valuation.data.name}
                  </button>
                  {!bidderSettings.data ? (
                    <span id={bidderHintId} className="sr-only">
                      Le preferenze del battitore non sono disponibili.
                    </span>
                  ) : null}
                  <BidPanel
                    key={valuation.data.playerId}
                    suggestedPrice={valuation.data.maxBid}
                    participants={state.data?.participants ?? []}
                    disabled={stale}
                    pending={assign.isPending}
                    error={assignError}
                    onAssign={assignPlayer}
                  />
                </>
              )}
            </PlayerDecisionCard>
          ) : (
            <EmptyState>
              Scegli un giocatore dalla tabella per vedere quanto conviene spendere.
            </EmptyState>
          )}

          <div className="mt-5">
            {/* Bloccata mentre il battitore e' aperto: un lotto alla volta.
                Cambiare selezione con un rilancio in corso rimonterebbe
                BidderDialog (keyed sul playerId) su un altro giocatore,
                buttando via countdown, prezzo e beep senza preavviso.
                Abbandonare un lotto resta un gesto deliberato — si chiude
                il battitore, che e' il controllo che gia' esiste per farlo. */}
            <PlayerTable
              rows={phase.data?.rows ?? []}
              selectedId={selectedId}
              onSelect={setSelectedId}
              disabled={bidderOpen}
            />
          </div>
        </div>

        <LeagueBoard participants={state.data?.participants ?? []} />
      </div>
    </AppShell>
  );
}
