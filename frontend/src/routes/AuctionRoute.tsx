import { useEffect, useState } from 'react';
import { AppShell } from '../AppShell';
import { ProblemError } from '../api/client';
import { useAssign, useAuctionState, usePhasePlayers, useValuation } from '../api/hooks';
import { AuctionAnnouncer, purchaseMessage } from '../domain/AuctionAnnouncer';
import { BidPanel } from '../domain/BidPanel';
import { ConnectionStatus, isStale } from '../domain/ConnectionStatus';
import { LeagueBoard } from '../domain/LeagueBoard';
import { PlayerDecisionCard } from '../domain/PlayerDecisionCard';
import { PlayerTable } from '../domain/PlayerTable';

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
        playerName: valuation.data?.name ?? last.playerId,
        buyerName: buyer.name,
        price: last.price,
        myBudgetRemaining: me.budgetRemaining,
        mySlotsRemaining: me.slotsRemaining,
      }),
    );
  }, [assign.data, state.data, valuation.data?.name]);

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
                onAssign={({ participantId, price }) =>
                  assign.mutate({ playerId: valuation.data!.playerId, participantId, price })
                }
              />
            </PlayerDecisionCard>
          ) : (
            <p className="border border-dashed border-line p-6 text-sm text-muted-foreground">
              Scegli un giocatore dalla tabella per vedere quanto conviene spendere.
            </p>
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
