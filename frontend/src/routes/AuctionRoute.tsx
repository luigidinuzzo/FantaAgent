import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
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
import { AnalysisPanel } from '../domain/AnalysisPanel';
import { AuctionAnnouncer, phaseChangedMessage, purchaseMessage, undoMessage } from '../domain/AuctionAnnouncer';
import { BidderDialog } from '../domain/BidderDialog';
import { BidPanel } from '../domain/BidPanel';
import { ConnectionStatus, isStale } from '../domain/ConnectionStatus';
import { EmptyState } from '../domain/EmptyState';
import { PhaseSwitcher } from '../domain/PhaseSwitcher';
import { PhasePager } from '../domain/PhasePager';
import { PlayerDecisionCard } from '../domain/PlayerDecisionCard';
import { PlayerSearchBox } from '../domain/PlayerSearchBox';
import { PlayerTable } from '../domain/PlayerTable';
import { RosterGrid } from '../domain/RosterGrid';
import { SquadCards } from '../domain/SquadCards';
import { UndoLastButton } from '../domain/UndoLastButton';
import { useIdleHeartbeat } from './useIdleHeartbeat';

/** Il monitor del secondo schermo: tratto vettoriale, mai un'emoji. */
function ProjectionIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

/** L'ingranaggio delle impostazioni: tratto vettoriale, mai un'emoji. */
function SettingsIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M3 12h3M18 12h3M4.9 19.1l2.1-2.1M17 7l2.1-2.1" />
    </svg>
  );
}

// Bersaglio 44x44 garantito (min-h-11 min-w-11, non dedotto dall'auto-layout),
// condiviso dai due link icona della barra superiore.
const ICON_LINK =
  'flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line-strong'
  + ' focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent';

type TabKey = 'fase' | 'rose';

// Due schede, non due sezioni sempre in vista: la fila di card squadra basta a
// sapere chi ha quanto, e la griglia intera delle rose — otto colonne per
// venticinque righe — spingerebbe la card del lotto fuori dallo schermo proprio
// mentre si sta aggiudicando. "Fase corrente" resta la scheda predefinita: e' il
// percorso di selezione del giocatore, il piu' usato durante l'asta.
const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'fase', label: 'Fase corrente' },
  { key: 'rose', label: 'Rose squadre' },
];

export function AuctionRoute() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [bidderOpen, setBidderOpen] = useState(false);
  const [pageOffset, setPageOffset] = useState(0);
  const [activeTab, setActiveTab] = useState<TabKey>('fase');
  const bidderHintId = useId();
  // Un bottone per chiave, per spostare il focus DAVVERO quando la freccia
  // cambia scheda: senza, la selezione si sposterebbe ma il focus della
  // tastiera resterebbe indietro sul bottone precedente, che e' esattamente il
  // difetto di un gruppo che si dichiara scheda senza comportarsi da scheda.
  const tabRefs = useRef<Record<TabKey, HTMLButtonElement | null>>({ fase: null, rose: null });

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, key: TabKey) {
    const index = TABS.findIndex((t) => t.key === key);
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % TABS.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + TABS.length) % TABS.length;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = TABS[nextIndex];
    setActiveTab(next.key);
    tabRefs.current[next.key]?.focus();
  }

  // Un tick al secondo: serve solo a far invecchiare il "da quanto tempo".
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  const state = useAuctionState();
  const currentPhase = state.data?.currentPhase;
  // Un cambio fase riparte da pagina 1: l'offset della fase precedente non ha
  // alcun significato in quella nuova, e senza questo effetto un salto a una
  // pagina profonda (es. offset 75 nei portieri) resterebbe impostato entrando
  // nei difensori, che magari non arrivano nemmeno a 75 giocatori — la tabella
  // apparirebbe vuota senza che nulla lo spieghi. Non tocca selectedId: la
  // selezione (e il battitore) sono un'altra fase concettualmente, e restano
  // intatti finche' non e' l'utente a chiuderli.
  useEffect(() => {
    setPageOffset(0);
  }, [currentPhase]);

  const phase = usePhasePlayers(pageOffset);
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
  // perche' e il come). Si ferma per tutta la durata in cui il battitore
  // e' aperto, scaduto o non: BidderDialog pubblica da conto suo per
  // l'intera durata del dialogo — 'bidding' dieci volte al secondo mentre
  // il countdown corre, poi lo stesso lotto congelato a un ritmo piu' basso
  // dopo la scadenza — e pubblica 'idle' da solo quando smonta. Un 'idle'
  // pubblicato qui in parallelo, PRIMA che il dialogo chiuda per davvero,
  // farebbe sparire il lotto dalla proiezione durante l'aggiudicazione:
  // 'idle' deve significare una cosa sola, "nessun lotto aperto".
  useIdleHeartbeat(bidderOpen);

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

  // Un solo alert, mai due insieme: stessa disciplina di HomeRoute
  // (mutationErrorMessage ?? loadErrorMessage). Le tre mutazioni che questa
  // rotta possiede — assign, changePhase, undoLast — condividono la stessa
  // schermata, quindi al massimo una delle tre puo' avere un errore vivo in
  // un dato momento: ogni gesto (assignPlayer/changePhaseTo/undo) azzera le
  // ALTRE due mutazioni prima di partire, cosi' la precedenza va sempre al
  // gesto piu' recente e non a un ordine fisso fra le tre. assignError resta
  // renderizzato da BidPanel/BidderDialog (il suo posto attuale, dentro la
  // card di decisione); barAlertMessage e' il canale per le due mutazioni
  // della barra, che non rendono piu' un role="alert" proprio.
  const barAlertMessage = changePhaseError ?? undoError;

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
    // Azzera gli errori delle altre due mutazioni: senza, un cambio fase o un
    // annullamento rifiutato prima resterebbe visibile insieme a un nuovo
    // errore di aggiudicazione (o al suo successo), violando "un solo alert".
    changePhase.reset();
    undoLast.reset();
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
    // Stesso azzeramento incrociato di assignPlayer, verso le altre due
    // mutazioni: un errore di aggiudicazione o di annullamento rimasto
    // appeso non deve restare in scena insieme all'esito di questo gesto.
    assign.reset();
    undoLast.reset();
    changePhase.mutate(role, {
      onSuccess: () => setAnnouncement(phaseChangedMessage(role)),
    });
  }

  function undo() {
    assign.reset();
    changePhase.reset();
    undoLast.mutate(undefined, {
      onSuccess: () => setAnnouncement(undoMessage()),
    });
  }

  return (
    <AppShell
      chrome="top"
      title={state.data?.auctionName}
      slotActions={
        <>
          <PhaseSwitcher
            phases={state.data?.phases ?? []}
            current={state.data?.currentPhase ?? 'P'}
            onChange={changePhaseTo}
            pending={changePhase.isPending}
          />
          {/* Product gap (revisione finale): non esisteva nessun modo di
              raggiungere /proiezione dall'applicazione — bisognava digitare
              l'indirizzo a mano. target="_blank": va aperta in una seconda
              finestra, sul secondo schermo, non al posto di questa. */}
          <a href="/proiezione" target="_blank" rel="noopener noreferrer" className={ICON_LINK}>
            <ProjectionIcon />
            <span className="sr-only">Apri la proiezione sul secondo schermo</span>
          </a>
          <UndoLastButton
            canUndo={state.data?.canUndo ?? false}
            onUndo={undo}
            pending={undoLast.isPending}
          />
          <Link to="/impostazioni" className={ICON_LINK}>
            <SettingsIcon />
            <span className="sr-only">Vai alle impostazioni</span>
          </Link>
        </>
      }
      slotStatus={
        <ConnectionStatus
          updatedAt={state.dataUpdatedAt || undefined}
          isError={state.isError}
          now={now}
        />
      }
    >
      {/* Nascosto alla vista, non dall'albero di accessibilita': come su
          /proiezione, chi ascolta deve avere un h1 da cui partire anche se
          chi guarda il portatile non ha bisogno di leggere la parola "Asta". */}
      <h1 className="sr-only">Asta</h1>
      <AuctionAnnouncer message={announcement} />
      {barAlertMessage ? (
        // Canale unico per changePhase e undoLast (vedi barAlertMessage
        // sopra): al massimo un role="alert" da queste due fonti, non uno
        // per bottone. role="alert", non un secondo role="status": l'unica
        // live region ambientale della pagina resta AuctionAnnouncer.
        <p role="alert" className="panel mb-4 rounded-xl p-4 text-sm font-bold text-destructive">
          {barAlertMessage}
        </p>
      ) : null}
      {/* La stessa selezione della tabella di fase, non un secondo percorso:
          un giocatore scelto qui passa per setSelectedId esattamente come una
          riga cliccata, quindi valutazione, battitore e aggiudicazione si
          comportano in tutto allo stesso modo. */}
      <div className="panel rounded-2xl p-4">
        <PlayerSearchBox onSelect={setSelectedId} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_22rem]">
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
            Cerca un giocatore o scegline uno dalla tabella per vedere quanto conviene spendere.
          </EmptyState>
        )}

        {/* AnalysisPanel mostra maxBid, hardCap e i driver: e' esattamente la
            classe di componenti che la proiezione non puo' importare (vedi
            no-restricted-imports in .oxlintrc.json). Compare solo insieme a
            una valutazione: senza, non c'e' alcun prezzo da spiegare. */}
        {valuation.data ? <AnalysisPanel valuation={valuation.data} /> : null}
      </div>

      {/* La fila di card squadra: chi ha quanto, a colpo d'occhio, senza
          bisogno di aprire la scheda "Rose squadre" sotto. */}
      <div className="mt-5">
        <SquadCards participants={state.data?.participants ?? []} />
      </div>

      <div className="panel mt-4 rounded-2xl p-4">
        {/* Le schede sono rese sul serio, non un gruppo di bottoni che si
            limita a somigliarci: ruolo, stato e frecce sinistra/destra per
            spostare la selezione, come da WAI-ARIA Authoring Practices. */}
        <div
          role="tablist"
          aria-label="Sezioni dell'asta"
          className="flex gap-1 border-b border-line"
        >
          {TABS.map((tab) => (
            <button
              key={tab.key}
              ref={(el) => { tabRefs.current[tab.key] = el; }}
              type="button"
              role="tab"
              id={`tab-${tab.key}`}
              aria-selected={activeTab === tab.key}
              aria-controls={`tabpanel-${tab.key}`}
              tabIndex={activeTab === tab.key ? 0 : -1}
              onClick={() => setActiveTab(tab.key)}
              onKeyDown={(e) => handleTabKeyDown(e, tab.key)}
              className={`min-h-11 border-b-2 px-3 font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                activeTab === tab.key
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id="tabpanel-fase"
          aria-labelledby="tab-fase"
          hidden={activeTab !== 'fase'}
          className="mt-4"
        >
          {activeTab === 'fase' ? (
            <>
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
              {/* Cambiare pagina non tocca selectedId: un giocatore scelto in
                  una pagina precedente resta scelto (valutazione e battitore
                  intatti, se aperto) anche se la sua riga scorre fuori vista
                  sfogliando. */}
              {phase.data ? (
                <PhasePager
                  offset={phase.data.offset}
                  pageSize={phase.data.pageSize}
                  total={phase.data.total}
                  hasPrevious={phase.data.hasPrevious}
                  hasNext={phase.data.hasNext}
                  onPrevious={() => setPageOffset((o) => Math.max(0, o - phase.data!.pageSize))}
                  onNext={() => setPageOffset((o) => o + phase.data!.pageSize)}
                />
              ) : null}
            </>
          ) : null}
        </div>

        <div
          role="tabpanel"
          id="tabpanel-rose"
          aria-labelledby="tab-rose"
          hidden={activeTab !== 'rose'}
          className="mt-4"
        >
          {/* Montata solo quando la scheda e' quella attiva: legge /board (e
              le capacita' per ruolo da /state) da se', e non c'e' motivo di
              farlo mentre e' "Fase corrente" a essere in vista.
              Caso residuo dichiarato: RosterGrid porta un suo role="alert"
              (voidPurchase/board), separato da barAlertMessage sopra. Non e'
              una violazione dell'invariante "un solo alert alla volta": vive
              dentro il pannello della sua scheda, visibile solo quando questa
              e' quella attiva, quindi al massimo compaiono insieme un alert
              della barra (sempre visibile) e uno delle rose (visibile solo
              qui) — non due dalla stessa fonte, non due dallo stesso posto. */}
          {activeTab === 'rose' ? <RosterGrid /> : null}
        </div>
      </div>
    </AppShell>
  );
}
