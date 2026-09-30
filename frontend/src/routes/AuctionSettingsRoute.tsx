import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { AppShell } from '../AppShell';
import { BackLink } from '../domain/BackLink';
import { PageFrame } from '../domain/PageFrame';
import { userMessage } from '../api/client';
import { useLeague, useLeagueAuctions, useSaveSeats, useSeats, useUpdateAuction } from '../api/leagues';
import type { SeatInput, SeatsView } from '../api/types';
import { StepperField } from '../domain/StepperField';
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from '../domain/controls';

const BUTTON = `min-w-11 ${BUTTON_SECONDARY}`;
const PRIMARY = BUTTON_PRIMARY;

const toInputs = (view: SeatsView): SeatInput[] =>
  view.seats.map((s) => ({ userId: s.userId, teamName: s.teamName, initial: s.initial }));

/**
 * Le impostazioni di un'asta: il turno di chiamata e il banditore.
 *
 * <p>Il turno si modifica tutto in bozza e parte con un solo «Salva il turno»: il
 * server riceve l'elenco nell'ordine a schermo, e o lo accetta intero o lo rifiuta.
 * Finche' l'asta non e' iniziata si cambiano anche squadre, iniziali e chi ha un
 * posto; dal primo acquisto solo l'ordine, perche' una rosa pagata appartiene a quel
 * posto.
 *
 * <p>Chi non e' amministratore vede il turno in sola lettura: e' utile sapere quando
 * tocca a sé chiamare.
 */
export function AuctionSettingsRoute() {
  const { leagueId = '', auctionId = '' } = useParams();
  const league = useLeague(leagueId);
  const auctions = useLeagueAuctions(leagueId);
  const seats = useSeats(leagueId, auctionId);
  const save = useSaveSeats(leagueId, auctionId);
  const update = useUpdateAuction(leagueId);
  // La bozza nasce alla prima modifica: fino ad allora si mostra quanto dice il server.
  const [draft, setDraft] = useState<SeatInput[] | null>(null);
  const [timer, setTimer] = useState<number | null>(null);
  const [beep, setBeep] = useState<boolean | null>(null);

  const card = auctions.data?.find((a) => a.id === auctionId);

  if (league.isError || auctions.isError || seats.isError || (auctions.data && !card)) {
    return (
      <AppShell chrome="top">
      <PageFrame>
        <p role="alert" className="panel mx-auto max-w-xl p-4 text-sm font-medium text-destructive">
          {userMessage(league.error ?? seats.error ?? auctions.error,
            'Quest\'asta non esiste, o non fai parte della sua lega.')}
        </p>
      </PageFrame>
      </AppShell>
    );
  }
  if (!league.data || !seats.data || !card) {
    return <AppShell chrome="top"><PageFrame><span /></PageFrame></AppShell>;
  }

  const admin = league.data.admin;
  const locked = seats.data.locked;
  const order = draft ?? toInputs(seats.data);
  const members = league.data.members;
  const seatedIds = new Set(order.map((s) => s.userId));
  const missing = members.filter((m) => !seatedIds.has(m.userId));
  const nameOf = (userId: string) => members.find((m) => m.userId === userId)?.displayName ?? '';
  const seconds = timer ?? card.bidder.bidTimerSeconds;
  const beepOn = beep ?? card.bidder.beepEnabled;

  function change(next: SeatInput[]) {
    setDraft(next);
    save.reset();
  }

  function move(index: number, by: -1 | 1) {
    const next = [...order];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item);
    change(next);
  }

  function edit(index: number, patch: Partial<SeatInput>) {
    change(order.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  const saveMessage = save.isError
    ? userMessage(save.error, 'Non sono riuscito a salvare il turno. Riprova.')
    : null;
  const bidderMessage = update.isError
    ? userMessage(update.error, 'Non sono riuscito a salvare il banditore. Riprova.')
    : null;

  return (
    <AppShell chrome="top">
      <PageFrame>
      {/* Una colonna sola, turno sopra e banditore sotto: affiancato, il banditore
          (tre controlli) lasciava una colonna mezza vuota accanto al turno. */}
      <div className="mx-auto w-full max-w-3xl">
        {/* Testata in un pannello, come nelle altre pagine. */}
        <section className="panel flex items-center gap-4 p-5 md:p-6">
          <BackLink to={`/leghe/${leagueId}/aste/${auctionId}`} label="Torna all'asta" />
          <div className="min-w-0">
            <h1 className="w-exp truncate text-2xl font-semibold">{card.name}</h1>
            <p className="text-sm text-muted-foreground">Impostazioni dell&apos;asta</p>
          </div>
        </section>
        <div className="mt-4 grid gap-4">
          <section aria-labelledby="order-title" className="panel p-6">
            <h2 id="order-title" className="w-exp text-lg font-semibold">Turno di chiamata</h2>
            {admin && locked ? (
              <p className="mt-2 text-sm text-muted-foreground">
                L'asta è iniziata: si può cambiare solo il turno di chiamata.
              </p>
            ) : null}
            <ol aria-label="Turno di chiamata" className="mt-4 divide-y divide-line">
              {order.map((s, i) => (
                <li key={s.userId} className="flex flex-wrap items-center gap-3 py-2">
                  <span className="w-6 text-right font-semibold tabular-nums">{i + 1}</span>
                  {admin && !locked ? (
                    <>
                      <input aria-label={`Nome della squadra di ${nameOf(s.userId)}`} value={s.teamName}
                        onChange={(e) => edit(i, { teamName: e.target.value })}
                        className="min-h-11 min-w-40 flex-1 rounded-lg border border-control-border bg-surface px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" />
                      <input aria-label={`Iniziale di ${nameOf(s.userId)}`} value={s.initial} maxLength={1}
                        onChange={(e) => edit(i, { initial: e.target.value.toUpperCase().slice(-1) })}
                        className="min-h-11 w-14 rounded-lg border border-control-border bg-surface text-center font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" />
                    </>
                  ) : (
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-medium">{s.teamName}</span>
                      <span className="text-sm text-muted-foreground">{s.initial} · {nameOf(s.userId)}</span>
                    </span>
                  )}
                  {admin ? (
                    <span className="flex gap-2">
                      <button type="button" className={BUTTON} disabled={i === 0} onClick={() => move(i, -1)}
                        aria-label={`Sposta su ${s.teamName}`}>↑</button>
                      <button type="button" className={BUTTON} disabled={i === order.length - 1}
                        onClick={() => move(i, 1)} aria-label={`Sposta giù ${s.teamName}`}>↓</button>
                      {!locked ? (
                        <button type="button" className={BUTTON}
                          onClick={() => change(order.filter((x) => x.userId !== s.userId))}
                          aria-label={`Togli ${s.teamName}`}>Togli</button>
                      ) : null}
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
            {admin && !locked && missing.length > 0 ? (
              <>
                <h3 className="mt-6 text-sm font-semibold">Membri senza posto</h3>
                <ul aria-label="Membri senza posto" className="mt-2 divide-y divide-line">
                  {missing.map((m) => (
                    <li key={m.userId} className="flex min-h-11 items-center justify-between gap-3 py-2">
                      <span>{m.teamName} <span className="text-sm text-muted-foreground">· {m.displayName}</span></span>
                      <button type="button" className={BUTTON}
                        onClick={() => change([...order, { userId: m.userId, teamName: m.teamName, initial: m.initial }])}
                        aria-label={`Aggiungi ${m.teamName}`}>Aggiungi</button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {admin ? (
              <button type="button" className={`mt-6 ${PRIMARY}`} disabled={save.isPending}
                onClick={() => save.mutate(order, { onSuccess: () => setDraft(null) })}>
                {save.isPending ? 'Salvo…' : 'Salva il turno'}
              </button>
            ) : null}
            {saveMessage ? (
              <p role="alert" className="mt-4 text-sm font-medium text-destructive">{saveMessage}</p>
            ) : save.isSuccess ? (
              <p role="status" className="mt-2 text-sm">Turno salvato.</p>
            ) : null}
          </section>
          {admin ? (
            <section aria-labelledby="bidder-title" className="panel p-6">
              <h2 id="bidder-title" className="w-exp text-lg font-semibold">Banditore</h2>
              <label htmlFor="bidder-seconds" className="mt-4 block text-sm font-medium">
                Secondi del conto alla rovescia
              </label>
              <div className="mt-2 max-w-xs">
                <StepperField id="bidder-seconds" value={seconds} min={1} max={120}
                  onChange={(v) => { setTimer(v); update.reset(); }}
                  decreaseLabel="Un secondo in meno" increaseLabel="Un secondo in più" />
              </div>
              <label className="mt-4 flex min-h-11 items-center gap-3 text-sm font-medium">
                <input type="checkbox" checked={beepOn}
                  onChange={(e) => { setBeep(e.target.checked); update.reset(); }}
                  className="size-5" />
                Avviso sonoro allo scadere
              </label>
              <button type="button" className={`mt-6 ${PRIMARY}`} disabled={update.isPending}
                onClick={() => update.mutate({ auctionId, bidder: { bidTimerSeconds: seconds, beepEnabled: beepOn } })}>
                {update.isPending ? 'Salvo…' : 'Salva il banditore'}
              </button>
              {/* Un solo role="alert" per schermata: se anche il turno e' fallito, il
                  suo avviso ha gia' parlato e questo resta visibile senza ripetersi. */}
              {bidderMessage ? (
                <p role={saveMessage ? undefined : 'alert'} className="mt-4 text-sm font-medium text-destructive">
                  {bidderMessage}
                </p>
              ) : update.isSuccess ? (
                <p role="status" className="mt-2 text-sm">Salvato.</p>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
      </PageFrame>
    </AppShell>
  );
}
