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
import { AuctionAnnouncer, purchaseMessage } from '../domain/AuctionAnnouncer';
import { publishBid } from '../domain/bidChannel';
import { BidderDialog } from '../domain/BidderDialog';
import { BidPanel } from '../domain/BidPanel';
import { ConnectionStatus, isStale, STALE_AFTER_MS } from '../domain/ConnectionStatus';
import { EmptyState } from '../domain/EmptyState';
import { LeagueBoard } from '../domain/LeagueBoard';
import { PhaseSwitcher } from '../domain/PhaseSwitcher';
import { PlayerDecisionCard } from '../domain/PlayerDecisionCard';
import { PlayerTable } from '../domain/PlayerTable';
import { UndoLastButton } from '../domain/UndoLastButton';

// Un terzo della soglia di staleness che la proiezione (ConnectionStatus,
// Task 6) usa per decidere se il canale fra le finestre e' vivo: lo stesso
// margine con cui quella soglia e' il triplo del ritmo di aggiornamento
// dello stato (5 s). "Comodamente piu' breve" qui significa questo rapporto,
// non un numero scelto a caso — letto da STALE_AFTER_MS, non duplicato.
const HEARTBEAT_INTERVAL_MS = STALE_AFTER_MS / 3;

export function AuctionRoute() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [bidderOpen, setBidderOpen] = useState(false);
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

  // Battito di vita per la proiezione. Finche' nessun lotto e' aperto sul
  // battitore privato, questa finestra pubblica comunque qualcosa a
  // intervalli regolari: senza, ConnectionStatus/isStale della proiezione
  // (Task 6) non potrebbe distinguere "non connesso" da "nessun lotto
  // aperto" — in entrambi i casi il canale resterebbe silenzioso, e il
  // messaggio "non ricevo dalla finestra privata" comparirebbe anche durante
  // una pausa perfettamente sana.
  //
  // Si ferma mentre il battitore e' aperto: BidderDialog pubblica gia'
  // 'bidding' dieci volte al secondo, e un 'idle' pubblicato in parallelo da
  // un intervallo indipendente oscurerebbe a intermittenza il lotto corrente
  // sull'altra finestra, un fotogramma su due.
  useEffect(() => {
    if (bidderOpen) return;
    const id = setInterval(() => publishBid({ kind: 'idle' }), HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [bidderOpen]);

  const stale = isStale({
    updatedAt: state.dataUpdatedAt || undefined,
    isError: state.isError,
    now,
  });

  const assignError =
    assign.error instanceof ProblemError ? assign.error.detail : null;

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
  }, [assign.data, assign.variables?.playerName, state.data]);

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

  return (
    <AppShell
      slotStatus={
        <ConnectionStatus
          updatedAt={state.dataUpdatedAt || undefined}
          isError={state.isError}
          now={now}
        />
      }
    >
      <AuctionAnnouncer message={announcement} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <PhaseSwitcher
          phases={state.data?.phases ?? []}
          current={state.data?.currentPhase ?? 'P'}
          onChange={(role) => changePhase.mutate(role)}
          pending={changePhase.isPending}
        />
        <UndoLastButton
          canUndo={state.data?.canUndo ?? false}
          onUndo={() => undoLast.mutate()}
          pending={undoLast.isPending}
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
                  onAssign={assignPlayer}
                  onClose={() => setBidderOpen(false)}
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
            <PlayerTable
              rows={phase.data?.rows ?? []}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
        </div>

        <LeagueBoard participants={state.data?.participants ?? []} />
      </div>
    </AppShell>
  );
}
