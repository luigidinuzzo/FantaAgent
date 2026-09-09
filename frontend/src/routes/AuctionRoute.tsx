import { useEffect, useState } from 'react';
import { AppShell } from '../AppShell';
import { ProblemError } from '../api/client';
import {
  useAssign,
  useAuctionState,
  useChangePhase,
  usePhasePlayers,
  useUndoLast,
  useValuation,
} from '../api/hooks';
import { AuctionAnnouncer, purchaseMessage } from '../domain/AuctionAnnouncer';
import { BidPanel } from '../domain/BidPanel';
import { ConnectionStatus, isStale } from '../domain/ConnectionStatus';
import { EmptyState } from '../domain/EmptyState';
import { LeagueBoard } from '../domain/LeagueBoard';
import { PhaseSwitcher } from '../domain/PhaseSwitcher';
import { PlayerDecisionCard } from '../domain/PlayerDecisionCard';
import { PlayerTable } from '../domain/PlayerTable';
import { UndoLastButton } from '../domain/UndoLastButton';

export function AuctionRoute() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

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
              <BidPanel
                key={valuation.data.playerId}
                suggestedPrice={valuation.data.maxBid}
                participants={state.data?.participants ?? []}
                disabled={stale}
                pending={assign.isPending}
                error={assignError}
                onAssign={({ participantId, price }) => {
                  // Un invio NUOVO azzera l'annuncio del precedente qui, nello
                  // stesso gesto dell'utente — non in un effetto agganciato a
                  // assign.isPending: quella transizione passa per un
                  // aggiornamento dello store di react-query che React puo'
                  // raggruppare con quello immediatamente successivo (verificato:
                  // un tentativo fallito abbastanza in fretta puo' non produrre
                  // mai un render con isPending true da solo osservabile). La
                  // mutazione non pulisce mai `data` da sola finche' non arriva
                  // un esito nuovo: senza questo, un vecchio "aggiudicato"
                  // resterebbe nella status region mentre un secondo tentativo,
                  // appena fallito, apre l'alert di BidPanel — le due live
                  // region si contraddirebbero nello stesso istante, proprio il
                  // caso che l'alternanza data/error di useAssign() dovrebbe
                  // escludere.
                  setAnnouncement(null);
                  assign.mutate({
                    playerId: valuation.data!.playerId,
                    playerName: valuation.data!.name,
                    participantId,
                    price,
                  });
                }}
              />
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
