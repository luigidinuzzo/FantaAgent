import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../AppShell';
import { auctionContext, isNotFound, userMessage } from '../api/client';
import { useLeagueName } from '../api/leagues';
import {
  useAssign,
  useAuctionState,
  useBoard,
  useChangePhase,
  usePhasePlayers,
  usePublicBidder,
  useTargets,
  useUndoLast,
  useValuation,
  useVoidPurchase,
} from '../api/hooks';
import type { PhaseSort, PublicBidderResponse, Role, SortDir, ValuationResponse } from '../api/types';
import { AdviceColumn } from '../domain/AdviceColumn';
import { AuctionRecap } from '../domain/AuctionRecap';
import { TEXT_LINK } from '../domain/AuthForm';
import { MyTeamSummary } from '../domain/MyTeamSummary';
import type { SoldPlayer } from '../domain/PlayerSearchBox';
import { AuctionAnnouncer, phaseChangedMessage, purchaseMessage, undoMessage } from '../domain/AuctionAnnouncer';
import { BidderDialog } from '../domain/BidderDialog';
import { BidPanel } from '../domain/BidPanel';
import { CommandsMenu } from '../domain/CommandsMenu';
import { ConnectionStatus, isStale } from '../domain/ConnectionStatus';
import { BUTTON_SECONDARY, CONTROL_H } from '../domain/controls';
import { PhaseSwitcher } from '../domain/PhaseSwitcher';
import { PhasePager } from '../domain/PhasePager';
import { PhoneViewBar } from '../domain/PhoneViewBar';
import type { PhoneView } from '../domain/PhoneViewBar';
import { PlayerDecisionCard } from '../domain/PlayerDecisionCard';
import { PlayerSearchBox } from '../domain/PlayerSearchBox';
import { ParticipantsColumn } from '../domain/ParticipantsColumn';
import { PlayerTable } from '../domain/PlayerTable';
import { RemoveIcon } from '../domain/RemoveIcon';
import { RoleBadge } from '../domain/RoleBadge';
import { RosterGrid } from '../domain/RosterGrid';
import { ROLE_NAME_PLURAL, ROLE_NAME_PLURAL_CAPITALIZED } from '../domain/roles';
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

/**
 * L'ingranaggio delle impostazioni: tratto vettoriale, mai un'emoji.
 *
 * <p>Una ruota dentata vera, con i denti sul contorno. Il disegno precedente —
 * un cerchio con otto raggi dritti attorno — si leggeva come un sole, non come
 * un ingranaggio: l'icona diceva «luce», non «impostazioni».
 */
function SettingsIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.076.124l1.217-.456a1.125 1.125 0 0 1 1.369.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.004.827c-.292.24-.437.613-.43.992a7.7 7.7 0 0 1 0 .255c-.007.378.138.75.43.99l1.004.828c.424.35.534.954.26 1.43l-1.296 2.247a1.125 1.125 0 0 1-1.37.491l-1.216-.456c-.356-.133-.751-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.332.183-.582.495-.645.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.93 6.93 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// Bersaglio 44x44 garantito, condiviso dai due collegamenti della barra dei
// comandi. Da tablet in su portano il nome accanto all'icona: tre tondi uguali
// non dicevano quale fosse la proiezione e quale le impostazioni.
const ICON_LINK =
  'flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-control-border font-medium hover:bg-line md:px-4'
  + ' focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent';

// I margini della pagina, al posto di quelli di AppShell (bleed): sotto lg gli
// stessi di sempre, da lg 16px in alto e in basso invece di 24: sono i 16px che
// la tabella sotto il banco guadagna in altezza a 1440x900.
const PAGE_PADDING = 'p-4 md:p-6 lg:px-5 lg:py-4';

type TabKey = 'fase' | 'rose';

/** Quanto resta in vista l'avviso di un acquisto, con il suo «Annulla». */
const SALE_TOAST_MS = 8_000;

// Due schede, non due sezioni sempre in vista: la fila di card squadra basta a
// sapere chi ha quanto, e la griglia intera delle rose — otto colonne per
// venticinque righe — spingerebbe la card del lotto fuori dallo schermo proprio
// mentre si sta aggiudicando. "Fase corrente" resta la scheda predefinita: e' il
// percorso di selezione del giocatore, il piu' usato durante l'asta.
const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'fase', label: 'Fase corrente' },
  { key: 'rose', label: 'Rose squadre' },
];

/**
 * Il lotto dai soli dati pubblici del giocatore, nella forma che il conto alla
 * rovescia legge. I numeri dei consigli sono a zero ma non si mostrano:
 * {@code BidderDialog} con {@code advice} falso non li rende.
 */
function lotWithoutAdvice(p: PublicBidderResponse): ValuationResponse {
  return {
    playerId: p.playerId, name: p.name, team: p.team, role: p.role, listPrice: p.listPrice,
    expectedPrice: 0, maxBid: 0, hardCap: 0, margin: 0, walkAwayReason: '',
    worthPursuing: true, confidenceStars: 0, drivers: [],
  };
}

export function AuctionRoute() {
  // Lega e asta dell'indirizzo: le ha appena fissate WithAuctionContext, nello
  // stesso render, dai parametri della rotta.
  const { leagueId, auctionId } = auctionContext();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [bidderOpen, setBidderOpen] = useState(false);
  // "Si sta cercando": lo dichiara PlayerSearchBox (c'e' del testo nel campo, o
  // un ruolo scelto) e serve qui per una cosa sola — cedere ai risultati il
  // posto del banco, invece di spingerlo giu' a ogni lettera digitata.
  const [searchActive, setSearchActive] = useState(false);
  const [pageOffset, setPageOffset] = useState(0);
  // L'ordine della tabella di fase. Lo esegue il server: colonna e verso viaggiano
  // nella richiesta, perche' una pagina e' venticinque righe su una fase che ne ha
  // centinaia, e rimetterle in fila qui direbbe una bugia su tutte le altre.
  const [sort, setSort] = useState<PhaseSort>('quotazione');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [activeTab, setActiveTab] = useState<TabKey>('fase');
  // Sotto lg la pagina e' in quattro viste, una alla volta, scelte dalla barra in
  // basso: la griglia del computer messa in colonna era alta piu' di tremila pixel.
  // Da lg la vista non conta: ogni sezione e' sempre in vista.
  const [phoneView, setPhoneView] = useState<PhoneView>('banco');
  // L'aggiudicazione diretta e' aperta per QUESTO giocatore: cambiando giocatore
  // si richiude, e il prossimo parte di nuovo dal conto alla rovescia.
  const [directFor, setDirectFor] = useState<string | null>(null);
  // «Togli dal banco» col conto aperto chiede conferma: vero dopo il primo clic.
  const [confirmRemove, setConfirmRemove] = useState(false);
  // L'ultimo acquisto confermato, mostrato in basso per qualche secondo con la
  // possibilita' di annullarlo. null quando non c'e' niente da mostrare. Porta
  // l'asta e il numero dell'acquisto: «Annulla» revoca QUELLO, non l'ultimo.
  const [sale, setSale] = useState<
    { auctionId: string; seq: number; player: string; buyer: string; price: number } | null>(null);
  const bidderHintId = useId();
  const bidderPanelId = useId();
  const bancoPrefixId = useId();
  const bancoId = useId();
  const searchId = useId();
  const teamsId = useId();
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

  // L'avviso dell'acquisto se ne va da solo dopo qualche secondo: e' una conferma,
  // non un messaggio da chiudere a mano mentre si chiama il giocatore successivo.
  useEffect(() => {
    if (!sale) return;
    const id = setTimeout(() => setSale(null), SALE_TOAST_MS);
    return () => clearTimeout(id);
  }, [sale]);

  // Un tick al secondo: serve solo a far invecchiare il "da quanto tempo".
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  const state = useAuctionState();
  const leagueName = useLeagueName(leagueId);
  const trail = [
    { label: 'Le mie leghe', to: '/' },
    { label: leagueName ?? 'Lega', to: `/leghe/${leagueId}` },
    { label: state.data?.auctionName ?? 'Asta' },
  ];
  // Solo l'amministratore scrive nel registro; gli altri seguono l'asta e vedono i
  // propri consigli. Finche' lo stato non e' arrivato, niente comandi: meglio un
  // istante senza pulsanti che un pulsante che risponde "non puoi".
  const admin = state.data?.admin ?? false;
  const projectionHref = `/leghe/${leagueId}/aste/${auctionId}/proiezione`;
  const gear = admin
    ? { to: `/leghe/${leagueId}/aste/${auctionId}/impostazioni`, label: 'Impostazioni dell\'asta' }
    : { to: `/leghe/${leagueId}`, label: 'Vai alla lega' };
  // Tre valori, non due: finche' lo stato non e' arrivato il posto non e' noto, e
  // i consigli aspettano — chiederli prima vorrebbe dire farsi rispondere no-seat
  // da chi un posto non ce l'ha. La frase per chi non ce l'ha aspetta anche lei.
  const seated = state.data ? state.data.myParticipantId !== null : null;
  const advised = seated === true;
  // Le viste del telefono sono per chi ha un posto. L'amministratore senza posto
  // ha solo squadre, ricerca e banco: restano in colonna, senza barra.
  const phoneViews = seated !== false;
  // La classe che nasconde, sotto lg, una sezione che non e' della vista scelta.
  const shownOnPhone = (...views: PhoneView[]) =>
    (!phoneViews || views.includes(phoneView) ? '' : 'max-lg:hidden');
  // Un giocatore scelto con un gesto — dalla ricerca, dalla tabella, dai consigli —
  // va sul banco, e sul telefono si torna a guardarlo: restare sulla tabella
  // lascerebbe il lotto in una vista nascosta.
  function selectPlayer(id: string) {
    setSelectedId(id);
    setPhoneView('banco');
  }
  function changePhoneView(view: PhoneView) {
    setPhoneView(view);
    // La barra in basso sceglie anche la scheda: sotto lg la riga delle schede
    // non c'e'.
    if (view === 'giocatori') setActiveTab('fase');
    else if (view === 'rose') setActiveTab('rose');
  }
  const currentPhase = state.data?.currentPhase;
  // Un cambio fase riparte da pagina 1: l'offset della fase precedente non ha
  // alcun significato in quella nuova, e senza questo effetto un salto a una
  // pagina profonda (es. offset 75 nei portieri) resterebbe impostato entrando
  // nei difensori, che magari non arrivano nemmeno a 75 giocatori — la tabella
  // apparirebbe vuota senza che nulla lo spieghi. Non tocca selectedId: la
  // selezione (e il banco) sono un'altra fase concettualmente, e restano
  // intatti finche' non e' l'utente a chiuderli.
  useEffect(() => {
    setPageOffset(0);
  }, [currentPhase]);

  const participants = state.data?.participants ?? [];
  const me = participants.find((p) => p.me);
  // Conclusa: ogni squadra ha la rosa piena. Da qui in poi non c'e' piu' niente da
  // battere, e la schermata diventa il riepilogo invece di restare quella della
  // serata con i tetti a zero.
  const concluded = participants.length > 0 && participants.every((p) => p.slotsRemaining === 0);
  const board = useBoard();
  // I comprati, letti dal tabellone: alla ricerca servono per dire «e' di Diego, 80»
  // invece di «Nessun giocatore trovato» quando si cerca un nome gia' preso.
  const sold: SoldPlayer[] = (board.data?.columns ?? []).flatMap((c) =>
    (Object.keys(c.byRole) as Role[]).flatMap((role) =>
      c.byRole[role].map((slot) => ({
        key: `${slot.seq}`, name: slot.playerName, role, buyer: c.participantName, price: slot.price,
      }))),
  );
  // Non piu' solo a banco vuoto: con un lotto aperto le stesse occasioni sono la
  // via d'uscita — «invece di lui, questi» — e stanno nella colonna dei consigli,
  // accanto al banco. Spente solo ad asta finita, dove non c'e' piu' niente da scegliere.
  const targets = useTargets(!concluded && advised);
  // L'acquisto dell'avviso non e' piu' sul tabellone: e' stato annullato altrove
  // (dalle rose, da un'altra finestra). L'avviso se ne va con lui: il suo «Annulla»
  // non avrebbe piu' niente da revocare.
  useEffect(() => {
    if (!sale || !board.data) return;
    const present = board.data.columns.some((c) =>
      (Object.keys(c.byRole) as Role[]).some((role) => c.byRole[role].some((slot) => slot.seq === sale.seq)));
    if (!present) setSale(null);
  }, [board.data, sale]);

  // Senza un posto i consigli non esistono: il server risponderebbe no-seat, e
  // la schermata lo dice gia' a parole invece di chiederli.
  const phase = usePhasePlayers(pageOffset, sort, sortDir, advised);
  const valuation = useValuation(selectedId, advised);
  const assign = useAssign();
  const changePhase = useChangePhase();
  const undoLast = useUndoLast();
  const voidSale = useVoidPurchase();
  // timerSeconds e beepEnabled sono preferenze dell'asta, non della
  // valutazione: oggi l'unico endpoint che le espone e' /board/bidder/{id}
  // (Task 3), costruito per la proiezione. E' un prestito, non la sede
  // definitiva — quando la tappa 5 porta l'endpoint delle impostazioni,
  // questa lettura deve spostarsi li'.
  // Servono solo al conto alla rovescia, che e' dell'amministratore.
  const bidderSettings = usePublicBidder(admin ? selectedId : null);
  // Il giocatore sul banco. Con i consigli e' la valutazione; per l'amministratore
  // che batte un'asta senza avervi un posto, i dati pubblici del giocatore — il
  // lotto va registrato anche se nessuno qui ha consigli da dargli.
  const lot = valuation.data
    ?? (seated === false && admin && bidderSettings.data?.playerId === selectedId && bidderSettings.data
      ? lotWithoutAdvice(bidderSettings.data)
      : null);
  // Il titolo del pannello centrale senza lotto: la tua squadra, o il nome del
  // posto, perche' un titolo il pannello deve sempre averlo. Col lotto il titolo
  // e' la testata del giocatore (piu' sotto).
  const panelTitle = me ? `La tua squadra, ${me.name}` : 'Sul banco';

  // Battito di vita per la proiezione (si veda useIdleHeartbeat per il
  // perche' e il come). Si ferma per tutta la durata in cui il conto alla rovescia
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

  const assignError = assign.error
    ? userMessage(assign.error, "L'aggiudicazione non è riuscita. Riprova.")
    : null;
  const changePhaseError = changePhase.error
    ? userMessage(changePhase.error, 'Il cambio di fase non è riuscito. Riprova.')
    : null;
  const undoError = undoLast.error
    ? userMessage(undoLast.error, "L'annullamento non è riuscito. Riprova.")
    : null;
  const voidSaleError = voidSale.error
    ? userMessage(voidSale.error, "L'annullamento non è riuscito. Riprova.")
    : null;

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
  // L'annullamento dall'avviso dell'acquisto e' un quarto gesto della stessa
  // famiglia, e passa dallo stesso canale.
  const barAlertMessage = changePhaseError ?? undoError ?? voidSaleError;

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
    // Cosa succede DOPO un'aggiudicazione riuscita non sta qui ma nel callback
    // della mutazione (si veda assignPlayer): questo effetto gira anche a ogni
    // rilettura dello stato, e chiudere il banco da qui significherebbe
    // richiuderlo sotto le mani di chi nel frattempo ha gia' scelto il lotto
    // successivo. Qui si compone solo l'annuncio, che dipende dallo stato appena
    // riletto.
  }, [assign.data, assign.variables?.playerName, state.data]);

  // Azzera l'errore (e il risultato) della mutazione condivisa quando cambia
  // il giocatore selezionato o si avvia il conto alla rovescia: senza, l'errore di
  // un'aggiudicazione fallita per UN giocatore resta appeso in useAssign()
  // finche' un'altra mutate() non si risolve, e riavviando il conto alla rovescia per
  // un giocatore diverso lampeggia per un istante il fallimento del
  // precedente — un difetto preesistente in BidPanel, non nuovo qui.
  useEffect(() => {
    assign.reset();
    // `assign` (l'intero oggetto della mutazione, non solo `.reset`) e'
    // deliberatamente FUORI dalle dipendenze: e' un riferimento nuovo a ogni
    // render di useMutation, e includerlo farebbe girare questo effetto a
    // ogni render invece che solo al cambio di giocatore o all'apertura del
    // conto alla rovescia, che e' l'unico momento in cui deve azzerare l'errore.
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
    voidSale.reset();
    assign.mutate(
      {
        playerId: lot!.playerId,
        playerName: lot!.name,
        participantId,
        price,
      },
      {
        // L'avviso visibile nasce dalla conferma del server, una volta sola per
        // acquisto: non da un effetto che si ripete a ogni rilettura dello stato.
        onSuccess: (done, sent) => {
          if (!done) return;
          const buyer = participants.find((p) => p.id === done.participantId);
          setSale({
            auctionId, seq: done.seq, player: sent.playerName, buyer: buyer?.name ?? '', price: done.price,
          });
          // Il lotto e' chiuso: lascia il banco. Senza questo il giocatore
          // restava in scena come scheda di decisione anche dopo essere stato
          // venduto, con «Avvia il conto alla rovescia» ancora acceso — un gesto
          // che il server rifiuterebbe («giocatore gia' venduto»), offerto
          // dall'interfaccia. Il banco torna al suo stato a riposo, che e' dove
          // si guarda per chiamare il prossimo.
          //
          // Qui e non in un effetto: questo succede UNA volta, alla conferma del
          // server. Un effetto legato ad assign.data gira anche a ogni rilettura
          // dello stato, e azzererebbe la selezione di un lotto scelto nel
          // frattempo.
          setBidderOpen(false);
          setSelectedId(null);
          setDirectFor(null);
        },
      },
    );
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
    voidSale.reset();
    changePhase.mutate(role, {
      onSuccess: () => setAnnouncement(phaseChangedMessage(role)),
    });
  }

  function undo() {
    assign.reset();
    changePhase.reset();
    voidSale.reset();
    // L'ultimo acquisto puo' essere proprio quello dell'avviso: l'avviso se ne va,
    // o il suo «Annulla» resterebbe in vista per un acquisto gia' revocato.
    setSale(null);
    undoLast.mutate(undefined, {
      onSuccess: () => setAnnouncement(undoMessage()),
    });
  }

  // «Annulla» sull'avviso revoca l'acquisto dell'avviso, per numero: void-last
  // revocherebbe l'ultimo ANCORA VALIDO, che — se quello dell'avviso e' gia' stato
  // annullato — e' un altro acquisto, e il registro non si riscrive. Se nel
  // frattempo e' stato revocato, il server risponde purchase-already-revoked.
  function voidSaleNow(target: { auctionId: string; seq: number }) {
    assign.reset();
    changePhase.reset();
    undoLast.reset();
    setSale(null);
    voidSale.mutate(target, {
      onSuccess: () => setAnnouncement(undoMessage()),
    });
  }

  // I gesti del banco — il conto alla rovescia e l'aggiudicazione diretta — sono
  // dell'amministratore, e sono gli stessi con o senza consigli: stanno sotto la
  // scheda di decisione quando c'e', soli sotto la testata del banco quando chi
  // batte l'asta non vi ha un posto.
  const lotControls = lot && admin ? (
  <div className="flex flex-wrap items-center gap-3">
  {/* Avvia il conto alla rovescia per il lotto conteso: BidPanel resta
      la via diretta per un giocatore che nessuno contende,
      questo e' l'altra via alla STESSA mutazione (assignPlayer),
      non una seconda. Disabilitato finche' le preferenze vere
      non sono arrivate: aprire subito significherebbe mostrare
      un timer finto, e questa migrazione non finge mai un dato
      che non ha ancora. */}
  {/* Sulla stessa riga dell'aggiudicazione diretta, alla stessa altezza
      (56px, CONTROL_H): e' l'oro e la larghezza a dire quale dei due gesti
      si usa di piu', non la statura del bottone. Battere un lotto E' il
      prodotto, quindi resta il pieno, il colore e il posto migliore nella riga. */}
  <button
    type="button"
    onClick={() => setBidderOpen(true)}
    disabled={!bidderSettings.data}
    aria-describedby={!bidderSettings.data ? bidderHintId : undefined}
    className={`${CONTROL_H} min-w-[16rem] max-w-[28rem] flex-1 rounded-lg bg-accent px-8 text-lg font-semibold text-on-accent transition-opacity duration-200 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground`}
  >
    Avvia il conto alla rovescia
  </button>
  {!bidderSettings.data ? (
    <span id={bidderHintId} className="sr-only">
      Le preferenze del banditore non sono disponibili.
    </span>
  ) : null}
  {/* L'aggiudicazione diretta, dietro un bottone: e' la via per
      un giocatore che nessuno contende. Il nome non contiene
      «conto alla rovescia»: chi cerca quel bottone a voce o per
      nome ne troverebbe due. Sempre in vista, con
      prezzo e squadra precompilati, un clic sbagliato registrava
      un acquisto vero; ora si apre solo se la si chiede, e non
      propone niente. key: un giocatore nuovo riparte da campi
      vuoti. Sulla stessa riga del bottone d'oro, alla stessa altezza
      (56px): e' il contorno, non il colore, a dire che si usa meno spesso.
      BidPanel, che prende il suo posto, va a capo da solo per flex-wrap. */}
  {directFor === lot.playerId ? (
    <BidPanel
      key={lot.playerId}
      participants={participants}
      role={lot.role}
      disabled={stale}
      pending={assign.isPending}
      error={assignError}
      onAssign={assignPlayer}
    />
  ) : (
    <button
      type="button"
      aria-expanded={false}
      onClick={() => setDirectFor(lot.playerId)}
      className={`${CONTROL_H} ${BUTTON_SECONDARY} px-5 text-muted-foreground hover:text-foreground`}
    >
      Aggiudica direttamente
    </button>
  )}
  </div>
  ) : null;

  // Dopo tutti gli hook: un 404 dallo stato vuol dire che l'asta non c'e' piu', o che
  // chi guarda non fa (piu') parte della lega. Lo scheletro con «Connessione persa»
  // direbbe una cosa falsa — la connessione c'e', e' la risposta a essere definitiva.
  if (isNotFound(state.error)) {
    return (
      <AppShell chrome="top" trail={trail} bleed>
        <div className={PAGE_PADDING}>
          <div className="panel mx-auto max-w-xl p-4">
            <p role="alert" className="text-sm font-medium text-destructive">
              Questa lega non esiste, o non ne fai parte.
            </p>
            <p className="mt-3 text-sm"><Link to="/" className={TEXT_LINK}>Vai alle tue leghe</Link></p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      chrome="top"
      trail={trail}
      bleed
      // Sotto lg i comandi stanno nel menu «Comandi» della testata.
      actionsFromLg
      slotActions={
        <>
          {admin ? (
            <PhaseSwitcher
              phases={state.data?.phases ?? []}
              current={state.data?.currentPhase ?? 'P'}
              onChange={changePhaseTo}
              pending={changePhase.isPending}
            />
          ) : state.data ? (
            // La fase si legge, non si cambia: la cambia chi batte l'asta. Solo
            // quando lo stato e' arrivato: prima non c'e' una fase da dire, e
            // «portieri» di ripiego sarebbe un dato inventato.
            <span className="flex min-h-11 items-center rounded-lg border border-control-border px-4 font-medium">
              Fase: {ROLE_NAME_PLURAL[state.data.currentPhase]}
            </span>
          ) : null}
          <span className="flex items-center gap-2 sm:ml-auto">
            {/* Product gap (revisione finale): non esisteva nessun modo di
                raggiungere /proiezione dall'applicazione — bisognava digitare
                l'indirizzo a mano. target="_blank": va aperta in una seconda
                finestra, sul secondo schermo, non al posto di questa. */}
            <a
              href={projectionHref}
              target="_blank"
              rel="noopener noreferrer"
              className={ICON_LINK}
            >
              <ProjectionIcon />
              {/* Lo spazio sta fra i due span, nello stesso sottoalbero di entrambi:
                  messo in testa al secondo, il calcolo del nome accessibile lo
                  rifila e le due parti si saldano. */}
              <span>
                <span className="max-md:sr-only">Apri la proiezione</span>
                {' '}
                <span className="sr-only">sul secondo schermo</span>
              </span>
            </a>
            {admin ? (
              <UndoLastButton
                canUndo={state.data?.canUndo ?? false}
                onUndo={undo}
                pending={undoLast.isPending}
              />
            ) : null}
            {/* L'ingranaggio porta dove si cambia qualcosa: per l'amministratore le
                impostazioni di quest'asta, per gli altri la lega. */}
            <Link to={gear.to} className={ICON_LINK}>
              <SettingsIcon />
              <span className="max-md:sr-only">{gear.label}</span>
            </Link>
          </span>
        </>
      }
      slotStatus={
        <div className="flex items-center gap-2">
          <ConnectionStatus
            compact
            updatedAt={state.dataUpdatedAt || undefined}
            isError={state.isError}
            now={now}
          />
          {admin ? (
            // Sul telefono la barra dei comandi non c'e': fase, annullamento,
            // proiezione e impostazioni stanno qui, con gli stessi gestori.
            <span className="lg:hidden">
              <CommandsMenu
                phases={state.data?.phases ?? []}
                current={state.data?.currentPhase ?? 'P'}
                onChangePhase={changePhaseTo}
                phasePending={changePhase.isPending}
                canUndo={state.data?.canUndo ?? false}
                onUndo={undo}
                undoPending={undoLast.isPending}
                projectionHref={projectionHref}
                settingsHref={gear.to}
              />
            </span>
          ) : null}
        </div>
      }
    >
      <div className={PAGE_PADDING}>
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
        <p role="alert" className="panel mb-4 p-4 text-sm font-medium text-destructive">
          {barAlertMessage}
        </p>
      ) : null}
      {/* Tre colonne, come si sta al tavolo: a sinistra chi ha quanto, al centro
          il giocatore su cui si decide e sotto di lui le due schede — fase
          corrente e rose —, a destra i consigli: a riposo le occasioni della
          fase e la tua rosa, col lotto il perche' del prezzo e le alternative. Una griglia sola, i
          figli messi a posto per riga e colonna: nel documento restano
          nell'ordine crediti, ricerca, banco, consigli, schede. Sotto lg ogni
          sezione appartiene a una delle viste del telefono e le altre sono
          nascoste: si vede la ricerca, poi le sezioni della vista scelta,
          nell'ordine del documento. */}
      {concluded ? (
        <>
          <AuctionRecap participants={participants} board={board.data} />
          {/* Le rose complete, subito: e' quello che si viene a guardare ad asta
              finita. Senza schede, perche' la fase corrente non c'e' piu'. */}
          <div className="panel mt-4 p-4">
            <RosterGrid />
          </div>
        </>
      ) : seated === false && !admin ? (
        // Senza un posto non c'e' niente da consigliare ne' da scegliere: la
        // ricerca, il banco e la tabella di fase portano tutti ai consigli. Resta
        // cio' che serve a seguire l'asta — le rose, con i crediti di ognuno in
        // testa alla colonna — e la frase che dice perche', una volta sola, nel
        // posto della tabella. Senza la colonna delle squadre: accanto alle rose,
        // alte quanto venticinque posti, restava vuota per due terzi, e i crediti
        // li dicono gia' le intestazioni delle rose.
        <>
          <p className="panel mb-4 p-4 text-sm">
            Non hai un posto in quest'asta: puoi seguirla, ma i consigli non sono disponibili.
          </p>
          <div className="panel min-w-0 p-4">
            <RosterGrid />
          </div>
        </>
      ) : (
      <>
      {me && state.data ? (
        // Sul telefono, sempre in vista: cosa si sta chiamando e quanto ti resta.
        // Da lg lo dicono la barra dei comandi e la colonna delle squadre.
        <div data-testid="phone-strip" className="mb-3 flex items-center justify-between gap-3 text-sm lg:hidden">
          <span className="flex items-center gap-2 font-semibold">
            <RoleBadge role={state.data.currentPhase} />
            {ROLE_NAME_PLURAL_CAPITALIZED[state.data.currentPhase]}
          </span>
          <span className="tnum text-muted-foreground">
            <span className="font-semibold text-accent">{me.budgetRemaining}</span>
            {` crediti · ${me.slotsRemaining} posti`}
          </span>
        </div>
      ) : null}
      {/* grid-cols-1 e non la colonna implicita: quella si allarga fino al
          contenuto piu' largo, e la pagina intera scorreva di lato. */}
      {/* Da lg la riga e' alta quanto la finestra, decisa in anticipo e non dedotta
          dal contenuto. A 1440x900: navigazione 56 + comandi 59 + margini 32 =
          147, restano 753. Nella colonna centrale ricerca 48 + 16 + banco 384 +
          16 = 464; la tabella prende i 289 che restano: la riga delle schede
          (44), l'intestazione (44) e quattro righe e mezza. Sotto ricerca + banco
          + 14,75rem di tabella + i due spazi (il calc qui sotto) scorre la
          pagina, non le colonne.
          L'altezza del banco e' --banco-h in index.css, l'unico posto in cui
          cambiarla; le colonne laterali scorrono dentro di se'. Senza posto non
          c'e' tabella di fase: la riga resta alta quanto il banco, e le rose
          stanno sotto a pagina intera. */}
      {seated === false ? (
        // L'amministratore senza posto: batte l'asta, ma consigli per lui non ce
        // ne sono. La frase una volta sola, sopra; la colonna dei consigli non
        // c'e' — tenuta in piedi per una frase, restava vuota per tutta l'altezza
        // — e il banco prende il suo spazio.
        <p className="panel mb-4 p-4 text-sm">
          Non hai un posto in quest'asta: puoi seguirla, ma i consigli non sono disponibili.
        </p>
      ) : null}
      {/* gap-5 sotto lg: lo spazio fra la ricerca e le sezioni della vista. */}
      <div
        data-testid="auction-row"
        className={`grid grid-cols-1 gap-5 lg:gap-4 ${
          seated === false
            ? 'lg:grid-cols-[14.5rem_minmax(0,1fr)] lg:grid-rows-[3rem_var(--banco-h)]'
            : 'lg:h-[max(calc(var(--banco-h)+19.75rem),calc(100dvh-var(--header-h)-var(--commands-h)-2rem))] lg:grid-cols-[14.5rem_minmax(0,1fr)_20.5rem] lg:grid-rows-[3rem_var(--banco-h)_minmax(14.75rem,1fr)]'
        }`}
      >
        <ParticipantsColumn
          id={teamsId}
          participants={participants}
          phase={state.data?.currentPhase}
          className={`lg:col-start-1 lg:row-start-1 ${seated === false ? 'lg:row-span-2' : 'lg:row-span-3'} ${shownOnPhone('squadre')}`}
        />

        {/* La stessa selezione della tabella di fase, non un secondo percorso:
            un giocatore scelto qui passa per selectPlayer esattamente come una
            riga cliccata, quindi valutazione, banco e aggiudicazione si
            comportano in tutto allo stesso modo.

            Nessun riquadro attorno alla barra: il bordo del campo e' gia' un
            contorno, e un pannello attorno ne disegnava un secondo. */}
        {/* Mentre si cerca i risultati prendono il posto del banco: il pannello
            occupa le righe della ricerca e del banco insieme, e la tabella
            resta dov'e'. A riposo resta alto quanto la barra. */}
        {/* Sempre in vista, in ogni vista del telefono: si cerca da ovunque. */}
        <div
          id={searchId}
          className={`min-h-0 lg:col-start-2 lg:row-start-1 ${
            searchActive ? 'flex flex-1 flex-col lg:row-span-2' : ''
          }`}
        >
          <PlayerSearchBox onSelect={selectPlayer} onActiveChange={setSearchActive} sold={sold} />
        </div>

        {/* Il banco e' un posto fisso in pagina, non un riquadro che appare e
            scompare: sta sempre sotto la ricerca, vuoto finche' nessuno e' sul
            banco e pieno appena si sceglie un giocatore.

            L'unica eccezione e' mentre si cerca: i nomi prendono il suo posto,
            cosi' crescono sotto la barra invece di spingere giu' mezza pagina a
            ogni lettera. Nascosto, non svuotato — selectedId resta intatto, e
            uscendo dalla ricerca si ritrova il lotto com'era. */}
        {searchActive ? null : (
        <section
          id={bancoId}
          data-testid="banco"
          // Col lotto il nome accessibile e' «Sul banco · nome»: il prefisso e'
          // solo per chi ascolta, a chi guarda lo dice il riquadro stesso.
          aria-labelledby={lot ? `${bancoPrefixId} ${bidderPanelId}` : bidderPanelId}
          className={`panel flex min-h-0 flex-1 flex-col p-4 lg:col-start-2 lg:row-start-2 ${shownOnPhone('banco')}`}
        >
          <div data-testid="banco-header" className="flex min-h-11 items-center justify-between gap-3">
            {/* UN titolo solo, che dice cosa c'e' dentro adesso. A riposo dentro
                c'e' la tua squadra, e il titolo e' il suo: chiamarlo «banco»
                annuncerebbe — anche a chi ascolta, via aria-labelledby — una cosa
                che non c'e', e la prima riga di contenuto lo smentirebbe subito.
                Col lotto sul banco il titolo e' la testata del giocatore — nome,
                ruolo, squadra e quotazione — una volta sola: la scheda e il conto
                alla rovescia qui sotto non la ripetono. Prima il banco diceva
                «Sul banco · nome» e la scheda ripeteva nome e squadra una riga
                sotto: il nome due volte, e un'altezza che al banco mancava. */}
            {lot ? (
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                <span id={bancoPrefixId} className="sr-only">Sul banco ·</span>
                <h2 id={bidderPanelId} className="w-exp min-w-0 truncate text-2xl font-semibold">
                  {lot.name}
                </h2>
                {/* La pillola centrata sull'altezza del nome: sulla linea di base
                    il cerchio finirebbe fuori squadra. Il ruolo per esteso resta
                    in sr-only dentro RoleBadge. */}
                <span className="flex shrink-0 self-center"><RoleBadge role={lot.role} /></span>
                <p className="text-sm text-muted-foreground">
                  <span>{lot.team}</span> · quotazione{' '}
                  <span data-testid="list-price" className="tnum">{lot.listPrice}</span>
                </p>
              </div>
            ) : (
              <h2 id={bidderPanelId} className="text-lg font-medium">
                {panelTitle}
              </h2>
            )}
            {lot ? (
              // Toglie il giocatore dal banco: chiude anche il conto alla rovescia,
              // se e' aperto — lasciarlo acceso su un lotto che non c'e' piu'
              // continuerebbe a suonare per nessuno.
              // Mentre il conto corre toglierlo butta via offerta e tempo: il
              // primo clic chiede conferma, il secondo toglie. Senza il conto
              // aperto non c'e' niente da perdere, e basta un clic.
              <button
                type="button"
                onClick={() => {
                  if (bidderOpen && !confirmRemove) {
                    setConfirmRemove(true);
                    return;
                  }
                  setConfirmRemove(false);
                  setBidderOpen(false);
                  setSelectedId(null);
                }}
                onBlur={() => setConfirmRemove(false)}
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-4 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                  confirmRemove ? 'border-destructive bg-destructive text-on-accent' : 'border-control-border hover:bg-line'
                }`}
              >
                <RemoveIcon />
                {confirmRemove ? "Conferma: il lotto si perde" : 'Togli dal banco'}
              </button>
            ) : null}
          </div>

          {/* flex-1: la card dentro riceve un'altezza vera da riempire, ed
              e' cosi' che distribuisce il contenuto invece di ammucchiarlo
              in cima al riquadro. */}
          {/* overflow-y-auto e' una valvola, non il modo normale di leggere
              il banco: la sua altezza (--banco-h) e' tagliata sul suo stato piu'
              alto e in condizioni normali non scorre mai. Serve a non TAGLIARE il
              contenuto se qualcosa esce dalle misure previste — un ingrandimento
              del browser al 150%, un carattere di sistema piu' grande. */}
          <div data-testid="banco-content" className="mt-3 flex min-h-0 flex-1 flex-col overflow-y-auto">
            {lot ? (
              // shrink-0: il lotto prende l'altezza che gli serve e non di
              // piu'. Senza, il flex-shrink di default lo comprimerebbe per
              // farlo entrare nell'altezza fissa del riquadro invece di
              // lasciare scorrere il contenuto — che e' cio' che
              // overflow-y-auto sul contenitore qui sopra serve a fare.
              <div className="shrink-0">
              {admin && bidderOpen && bidderSettings.data ? (
                // Il conto alla rovescia SOSTITUISCE la scheda di decisione, non ci sta
                // dentro: montato come suo figlio, rendeva nome e tetto una
                // seconda volta, dentro una seconda cornice. Mentre il conto
                // alla rovescia corre la card e' una sola, e porta i due
                // numeri che cambiano davvero — offerta e secondi.
                // key: un giocatore nuovo riparte da un conto alla rovescia
                // nuovo, non da quello del precedente.
                <BidderDialog
                  key={lot.playerId}
                  valuation={lot}
                  hideHeader
                  advice={valuation.data !== undefined}
                  participants={participants}
                  timerSeconds={bidderSettings.data.timerSeconds}
                  beepEnabled={bidderSettings.data.beepEnabled}
                  error={assignError}
                  disabled={stale}
                  pending={assign.isPending}
                  onAssign={assignPlayer}
                  onClose={() => setBidderOpen(false)}
                />
              ) : !valuation.data ? (
                // Senza consigli restano i gesti del banco: chi e', di che
                // squadra e quanto quota lo dice gia' la testata del banco.
                lotControls
              ) : (
                <PlayerDecisionCard valuation={valuation.data} stale={stale} bare hideHeader me={me}>
                  {/* Il modo di aggiudicarlo e' dell'amministratore: gli altri
                      vedono la scheda, non i gesti del banco. */}
                  {/* I due gesti su una riga sola, alla stessa altezza: a
                      sinistra, in oro e piu' largo, il conto alla rovescia, che
                      e' quello che si usa di piu'; accanto l'aggiudicazione
                      diretta, per il giocatore che nessuno contende. */}
                  {lotControls}
                </PlayerDecisionCard>
              )}
              </div>
            ) : me ? (
              // A riposo la tua squadra in numeri: crediti, posti, media per
              // posto. Prima era una frase sola al centro di mezza pagina.
              <MyTeamSummary
                me={me}
                participants={participants}
                phase={currentPhase}
                freeInPhase={phase.data?.total}
                board={board.data}
              />
            ) : (
              <p className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
                {seated === false
                  ? 'Nessuno sul banco. Cercalo qui sopra per registrarne l’acquisto.'
                  : 'Nessuno sul banco. Cercalo qui sopra o scegline uno dalla tabella.'}
              </p>
            )}
          </div>
        </section>
        )}

        {/* La colonna dei consigli: a riposo porta le occasioni della fase e la tua
            rosa, col lotto il perche' del prezzo e le alternative. Tutto cio' che
            mostra e' cio' che la proiezione non puo' mostrare (vedi
            no-restricted-imports in .oxlintrc.json) — resta lo stesso pannello, con
            lo stesso titolo, sia a riposo sia col lotto sul banco. */}
        {seated === false ? null : (
          <AdviceColumn
            phase={currentPhase}
            targets={targets.data ?? []}
            targetsLoading={targets.isLoading}
            targetsFailed={targets.isError}
            selectedId={selectedId}
            valuation={valuation.data ?? null}
            bidderOpen={bidderOpen}
            onSelect={selectPlayer}
            me={me}
            myColumn={board.data?.columns.find((c) => c.me)}
            className={`lg:col-start-3 lg:row-span-3 lg:row-start-1 ${shownOnPhone('banco')}`}
          />
        )}

        {/* Le schede, nella colonna centrale sotto il banco: prendono l'altezza che
            il banco lascia, e la tabella scorre dentro di se' con l'intestazione
            ferma. Nell'ordine del documento vengono dopo i consigli. Sul
            telefono sono le viste Giocatori e Rose, e la scheda la sceglie la
            barra in basso.

            Da lg il pannello e' una piccola griglia: in alto le schede, la legenda
            (da xl sulla stessa riga, sotto xl a capo) e le pagine; sotto, il filo
            e la scheda aperta. Nel documento l'ordine e' lo stesso che si vede —
            schede, legenda, pagine, tabella —: chi usa la tastiera o ascolta
            raggiunge le pagine prima di attraversare la tabella. -mt-1 sotto
            lg: 16px sotto la ricerca invece dei 20 dello spazio della riga. */}
        {seated === false ? null : (
          <div className={`panel min-h-0 max-lg:-mt-1 max-lg:p-4 ${shownOnPhone('giocatori', 'rose')} lg:col-start-2 lg:row-start-3 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:grid-rows-[auto_auto_minmax(0,1fr)] lg:overflow-hidden`}>
            {/* Le schede sono rese sul serio, non un gruppo di bottoni che si
                limita a somigliarci: ruolo, stato e frecce sinistra/destra per
                spostare la selezione, come da WAI-ARIA Authoring Practices.
                Sotto lg la riga non c'e': la scheda la sceglie la barra delle viste. */}
            <div
              role="tablist"
              aria-label="Sezioni dell'asta"
              className="flex gap-1 max-lg:hidden border-b border-line lg:col-start-1 lg:row-start-1 lg:border-b-0 lg:px-2"
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
                    className={`min-h-11 border-b-2 px-3 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                      activeTab === tab.key
                        ? 'border-accent text-accent'
                        : 'border-transparent text-muted-foreground'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
            </div>

            {activeTab === 'fase' && phase.data ? (
              <>
                {/* Sotto lg non c'e': la legenda la dice per intero la didascalia
                    della tabella, che da lg e' solo per chi ascolta. */}
                <span className="max-lg:hidden lg:col-span-3 lg:row-start-2 lg:px-4 lg:pb-2 lg:text-meta lg:text-muted-foreground xl:col-span-1 xl:col-start-2 xl:row-start-1 xl:self-center xl:px-0 xl:pb-0">
                  in <span className="font-medium text-destructive">rosso</span> i tetti che il mercato supera
                </span>
                {/* Cambiare pagina non tocca selectedId: un giocatore scelto in
                    una pagina precedente resta scelto (valutazione e banco
                    intatti, se aperto) anche se la sua riga scorre fuori vista
                    sfogliando. */}
                <div className="lg:col-start-3 lg:row-start-1 lg:flex lg:items-center lg:pl-3 lg:pr-2 lg:text-muted-foreground">
                  <PhasePager
                    compact
                    offset={phase.data.offset}
                    pageSize={phase.data.pageSize}
                    total={phase.data.total}
                    hasPrevious={phase.data.hasPrevious}
                    hasNext={phase.data.hasNext}
                    onPrevious={() => setPageOffset((o) => Math.max(0, o - phase.data!.pageSize))}
                    onNext={() => setPageOffset((o) => o + phase.data!.pageSize)}
                  />
                </div>
              </>
            ) : null}

            <div
              role="tabpanel"
              id="tabpanel-fase"
              aria-labelledby="tab-fase"
              hidden={activeTab !== 'fase'}
              className="max-lg:mt-4 lg:col-span-3 lg:row-start-3 lg:min-h-0 lg:border-t lg:border-line"
            >
              {activeTab === 'fase' ? (
                <>
                  {/* Bloccata mentre il conto alla rovescia corre: un lotto alla volta.
                      Cambiare selezione con un rilancio in corso rimonterebbe
                      BidderDialog (keyed sul playerId) su un altro giocatore,
                      buttando via countdown, prezzo e beep senza preavviso.
                      Abbandonare un lotto resta un gesto deliberato — si chiude
                      il conto alla rovescia, che e' il controllo che gia' esiste per farlo. */}
                  <PlayerTable
                    fill
                    sort={sort}
                    dir={sortDir}
                    // Cambiando ordine si torna alla prima pagina: restare alla terza
                    // pagina di un ordine che non esiste piu' non vuol dire niente.
                    onSort={(next, dir) => { setSort(next); setSortDir(dir); setPageOffset(0); }}
                    rows={phase.data?.rows ?? []}
                    selectedId={selectedId}
                    onSelect={selectPlayer}
                    disabled={bidderOpen}
                  />
                </>
              ) : null}
            </div>

            <div
              role="tabpanel"
              id="tabpanel-rose"
              aria-labelledby="tab-rose"
              hidden={activeTab !== 'rose'}
              className="max-lg:mt-4 lg:col-span-3 lg:row-start-3 lg:min-h-0 lg:border-t lg:border-line lg:p-3"
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
              {activeTab === 'rose' ? <RosterGrid fill /> : null}
            </div>
          </div>
        )}
      </div>

      {phoneViews ? (
        <PhoneViewBar
          view={phoneView}
          onChange={changePhoneView}
          controls={{
            // Mentre si cerca il banco non c'e': al suo posto i risultati.
            banco: searchActive ? searchId : bancoId,
            giocatori: 'tabpanel-fase',
            squadre: teamsId,
            rose: 'tabpanel-rose',
          }}
        />
      ) : null}

      {seated === false ? (
        // Senza posto la tabella di fase non c'e' (sono consigli: il tetto e'
        // il tuo): restano le rose, che per chi batte l'asta sono il registro
        // da correggere.
        <div className="panel mt-4 p-4">
          <RosterGrid />
        </div>
      ) : null}
      </>
      )}

      {/* La conferma visibile di un'aggiudicazione, in basso al centro: prima il
          riquadro tornava a riposo e basta, e l'unica conferma era l'annuncio per
          chi ascolta. Qui chi guarda legge cosa e' stato registrato e, se era
          sbagliato, lo annulla subito. Non e' una live region: l'annuncio c'e' gia'
          (AuctionAnnouncer), e due voci si sovrapporrebbero. */}
      {sale ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 max-lg:bottom-20 z-40 flex justify-center px-4">
          <div className="pointer-events-auto flex max-w-full flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-positive bg-surface px-5 py-3 shadow-[0_12px_32px_rgb(0_0_0/0.45)]">
            <p className="text-base">
              <span className="font-medium">{sale.player}</span>
              {` a ${sale.buyer} per `}
              <span className="tnum font-medium text-accent">{sale.price}</span>
            </p>
            <button
              type="button"
              onClick={() => voidSaleNow(sale)}
              disabled={voidSale.isPending || undoLast.isPending}
              className="min-h-11 rounded-lg border border-control-border px-4 font-medium hover:bg-line disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              Annulla
            </button>
          </div>
        </div>
      ) : null}
      </div>
    </AppShell>
  );
}
