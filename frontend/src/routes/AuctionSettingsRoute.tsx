import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { AppShell } from '../AppShell';
import { PageFrame } from '../domain/PageFrame';
import { fieldErrors, userMessage } from '../api/client';
import { useLeague, useLeagueAuctions, useSaveSeats, useSeats, useUpdateAuction } from '../api/leagues';
import type { SeatInput, SeatsView } from '../api/types';
import { StepperField } from '../domain/StepperField';
import { BUTTON_SECONDARY, FOCUS_RING } from '../domain/controls';
import { SaveBar } from '../domain/SaveBar';
import { SettingsLayout, type SettingsSection } from '../domain/SettingsLayout';

const BUTTON = `min-w-11 ${BUTTON_SECONDARY}`;
/** Le frecce del turno: 44px per lato, la freccia sola dentro. */
const ARROW = `${BUTTON_SECONDARY} size-11 px-0`;

const SECTIONS: SettingsSection[] = [
  { id: 'sezione-turno', label: 'Turno di chiamata', shortLabel: 'Turno' },
  { id: 'sezione-banditore', label: 'Banditore' },
];
/** Chi non amministra legge solo il turno: il banditore non lo riguarda. */
const READ_ONLY_SECTIONS = SECTIONS.slice(0, 1);

const CONTEXT = "Impostazioni dell'asta";

/** Lo spazio sopra una sezione quando ci porta l'indice, come nelle regole della lega. */
const ANCHOR = 'scroll-mt-[calc(var(--header-h)+4rem)]';

/** Una sezione: riquadro, titolo, e l'ancora dell'indice. */
function SettingsPanel({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-titolo`} className={`panel ${ANCHOR} p-5 md:p-6`}>
      <h2 id={`${id}-titolo`} className="w-exp text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

const toInputs = (view: SeatsView): SeatInput[] =>
  view.seats.map((s) => ({ userId: s.userId, teamName: s.teamName, initial: s.initial }));

const sameOrder = (a: SeatInput[], b: SeatInput[]) => JSON.stringify(a) === JSON.stringify(b);

type Outcome = PromiseSettledResult<unknown>;

/**
 * Il motivo di un rifiuto, se e' scritto per chi gioca: gli errori dei campi, o la
 * frase del problema. Null quando non c'e' niente di utile da dire.
 */
function reasonOf(reason: unknown): string | null {
  return Object.values(fieldErrors(reason)).flat().join(' ') || userMessage(reason, '') || null;
}

/**
 * Quale scrittura non e' andata, e perche', per la barra. Senza un motivo da dire
 * resta la frase di ripiego su quale delle due.
 */
function failureMessage(seats: Outcome, bidder: Outcome): string | null {
  const seatsReason = seats.status === 'rejected' ? reasonOf(seats.reason) : null;
  const bidderReason = bidder.status === 'rejected' ? reasonOf(bidder.reason) : null;
  if (seats.status === 'rejected' && bidder.status === 'rejected') {
    if (!seatsReason && !bidderReason) return 'Turno e banditore non sono stati salvati. Riprova.';
    return [seatsReason ?? 'Il turno non è stato salvato. Riprova.',
      bidderReason ?? 'Il banditore non è stato salvato. Riprova.'].join(' ');
  }
  if (seats.status === 'rejected') return seatsReason ?? 'Il turno non è stato salvato. Riprova.';
  if (bidder.status === 'rejected') return bidderReason ?? 'Il banditore non è stato salvato. Riprova.';
  return null;
}

/**
 * Le impostazioni di un'asta: il turno di chiamata e il banditore.
 *
 * <p>Si modifica tutto in bozza e parte con un solo «Salva» nella barra in fondo:
 * salva cio' che e' cambiato, il turno, il banditore o entrambi, e se una delle due
 * scritture non va la barra dice quale. Il turno arriva al server nell'ordine a
 * schermo, e o lo accetta intero o lo rifiuta. Finche' l'asta non e' iniziata si
 * cambiano anche squadre, iniziali e chi ha un posto; dal primo acquisto solo
 * l'ordine, perche' una rosa pagata appartiene a quel posto.
 *
 * <p>Chi non e' amministratore vede il turno in sola lettura, senza barra: e' utile
 * sapere quando tocca a sé chiamare.
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
  const [saveError, setSaveError] = useState<string | null>(null);
  // Le frecce del turno, per riga. Uno spostamento che porta la riga in cima o in
  // fondo spegne la freccia premuta: il fuoco passa all'altra della stessa riga.
  const arrows = useRef(new Map<string, HTMLButtonElement>());
  const focusArrow = useRef<string | null>(null);
  useEffect(() => {
    if (!focusArrow.current) return;
    arrows.current.get(focusArrow.current)?.focus();
    focusArrow.current = null;
  });

  const card = auctions.data?.find((a) => a.id === auctionId);
  const trail = [
    { label: 'Le mie leghe', to: '/' },
    { label: league.data?.name ?? 'Lega', to: `/leghe/${leagueId}` },
    { label: card?.name ?? 'Asta', to: `/leghe/${leagueId}/aste/${auctionId}` },
    { label: 'Impostazioni' },
  ];

  if (league.isError || auctions.isError || seats.isError || (auctions.data && !card)) {
    return (
      <AppShell chrome="top" trail={trail}>
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
    // La stessa cornice della schermata pronta, con la frase nella prima sezione:
    // un attimo dopo si riempie, non cambia forma.
    return (
      <AppShell chrome="top" trail={trail}>
      <PageFrame>
        <SettingsLayout title={card?.name ?? 'Asta'} context={CONTEXT} sections={SECTIONS} ready={false}>
          <SettingsPanel id={SECTIONS[0].id} title={SECTIONS[0].label}>
            <p className="mt-4 flex min-h-48 items-center text-sm text-muted-foreground">Carico il turno di chiamata…</p>
          </SettingsPanel>
          <SettingsPanel id={SECTIONS[1].id} title={SECTIONS[1].label}><div className="mt-4 min-h-24" /></SettingsPanel>
        </SettingsLayout>
      </PageFrame>
      </AppShell>
    );
  }

  const admin = league.data.admin;
  const locked = seats.data.locked;
  const saved = toInputs(seats.data);
  const order = draft ?? saved;
  const members = league.data.members;
  const seatedIds = new Set(order.map((s) => s.userId));
  const missing = members.filter((m) => !seatedIds.has(m.userId));
  const nameOf = (userId: string) => members.find((m) => m.userId === userId)?.displayName ?? '';
  const seconds = timer ?? card.bidder.bidTimerSeconds;
  const beepOn = beep ?? card.bidder.beepEnabled;
  // Un valore riportato com'era non e' una modifica: si confronta con quanto e' salvato.
  const orderDirty = draft !== null && !sameOrder(draft, saved);
  const bidderDirty = seconds !== card.bidder.bidTimerSeconds || beepOn !== card.bidder.beepEnabled;
  const pending = save.isPending || update.isPending;

  function change(next: SeatInput[]) {
    setDraft(next);
    setSaveError(null);
  }

  function move(index: number, by: -1 | 1) {
    const next = [...order];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item);
    change(next);
    if (index + by === 0) focusArrow.current = `${item.userId}:giu`;
    else if (index + by === next.length - 1) focusArrow.current = `${item.userId}:su`;
  }

  function edit(index: number, patch: Partial<SeatInput>) {
    change(order.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function reset() {
    setDraft(null);
    setTimer(null);
    setBeep(null);
    setSaveError(null);
  }

  // Le due scritture partono insieme; ciascuna, se va, toglie la propria bozza, e
  // quella che non va resta da salvare.
  async function submit() {
    setSaveError(null);
    const writeSeats = orderDirty
      ? save.mutateAsync(order).then(() => setDraft(null)) : null;
    const writeBidder = bidderDirty
      ? update.mutateAsync({ auctionId, bidder: { bidTimerSeconds: seconds, beepEnabled: beepOn } })
        .then(() => { setTimer(null); setBeep(null); })
      : null;
    const [seatsResult, bidderResult] = await Promise.allSettled([writeSeats, writeBidder]);
    setSaveError(failureMessage(seatsResult, bidderResult));
  }

  return (
    <AppShell chrome="top" trail={trail}>
      <PageFrame>
        <SettingsLayout
          title={card.name}
          context={CONTEXT}
          sections={admin ? SECTIONS : READ_ONLY_SECTIONS}
          ready
          saveBar={admin ? (
            <SaveBar dirty={orderDirty || bidderDirty} pending={pending} error={saveError} saveLabel="Salva"
              onSave={() => void submit()} onReset={reset} />
          ) : undefined}
        >
          <SettingsPanel id="sezione-turno" title="Turno di chiamata">
            {admin && locked ? (
              <p className="mt-2 text-sm text-muted-foreground">
                L'asta è iniziata: si può cambiare solo il turno di chiamata.
              </p>
            ) : null}
            <ol aria-label="Turno di chiamata" className="mt-4 divide-y divide-line">
              {order.map((s, i) => (
                <li key={s.userId} className="flex min-h-14 flex-wrap items-center gap-3 py-2">
                  <span className="w-6 text-right font-semibold tabular-nums">{i + 1}</span>
                  {admin && !locked ? (
                    <>
                      <input aria-label={`Nome della squadra di ${nameOf(s.userId)}`} value={s.teamName}
                        onChange={(e) => edit(i, { teamName: e.target.value })}
                        className={`min-h-11 min-w-40 flex-1 rounded-lg border border-control-border bg-surface px-3 ${FOCUS_RING}`} />
                      <input aria-label={`Iniziale di ${nameOf(s.userId)}`} value={s.initial} maxLength={1}
                        onChange={(e) => edit(i, { initial: e.target.value.toUpperCase().slice(-1) })}
                        className={`min-h-11 w-14 rounded-lg border border-control-border bg-surface text-center font-semibold ${FOCUS_RING}`} />
                    </>
                  ) : (
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-medium">{s.teamName}</span>
                      <span className="text-sm text-muted-foreground">{s.initial} · {nameOf(s.userId)}</span>
                    </span>
                  )}
                  {admin ? (
                    <span className="flex gap-2">
                      <button type="button" className={ARROW} disabled={i === 0} onClick={() => move(i, -1)}
                        ref={(el) => { if (el) arrows.current.set(`${s.userId}:su`, el); else arrows.current.delete(`${s.userId}:su`); }}
                        aria-label={`Sposta su ${s.teamName}`}><span aria-hidden="true">↑</span></button>
                      <button type="button" className={ARROW} disabled={i === order.length - 1}
                        ref={(el) => { if (el) arrows.current.set(`${s.userId}:giu`, el); else arrows.current.delete(`${s.userId}:giu`); }}
                        onClick={() => move(i, 1)} aria-label={`Sposta giù ${s.teamName}`}>
                        <span aria-hidden="true">↓</span>
                      </button>
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
                    <li key={m.userId} className="flex min-h-14 items-center justify-between gap-3 py-2">
                      <span>{m.teamName} <span className="text-sm text-muted-foreground">· {m.displayName}</span></span>
                      <button type="button" className={BUTTON}
                        onClick={() => change([...order, { userId: m.userId, teamName: m.teamName, initial: m.initial }])}
                        aria-label={`Aggiungi ${m.teamName}`}>Aggiungi</button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </SettingsPanel>
          {admin ? (
            <SettingsPanel id="sezione-banditore" title="Banditore">
              <div className="mt-4 grid gap-4 sm:grid-cols-2 sm:items-end">
                <div>
                  <label htmlFor="bidder-seconds" className="block text-base">
                    Secondi del conto alla rovescia
                  </label>
                  <StepperField id="bidder-seconds" value={seconds} min={1} max={120}
                    onChange={(v) => { setTimer(v); setSaveError(null); }}
                    decreaseLabel="Un secondo in meno" increaseLabel="Un secondo in più" />
                </div>
                <label className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-lg border border-control-border px-4 text-base">
                  <input type="checkbox" checked={beepOn}
                    onChange={(e) => { setBeep(e.target.checked); setSaveError(null); }}
                    className={`h-5 w-5 shrink-0 accent-accent ${FOCUS_RING}`} />
                  Avviso sonoro allo scadere
                </label>
              </div>
            </SettingsPanel>
          ) : null}
        </SettingsLayout>
      </PageFrame>
    </AppShell>
  );
}
