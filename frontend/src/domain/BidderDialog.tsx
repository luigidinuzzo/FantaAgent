import { useCallback, useEffect, useId, useState } from 'react';
import type { ParticipantView, ValuationResponse } from '../api/types';
import { publishBid } from './bidChannel';
import { maxAffordable, roleFull } from './bidRules';
import { BID_CONTROL_H, BID_RADIUS } from './controls';
import { signed } from './PlayerDecisionCard';
import { RoleBadge } from './RoleBadge';
import { ROLE_NAME_PLURAL } from './roles';
import { useBidCountdown } from './useBidCountdown';

/**
 * Vero per i bottoni di rilancio, per il campo dell'offerta diretta, per il
 * select "Aggiudica a" e per qualunque altro controllo che usa la barra
 * spaziatrice per attivarsi da solo — uno spazio con il focus li' sopra e' un
 * tentativo di usare QUEL controllo, non il gesto del rilancio.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ['BUTTON', 'SELECT', 'INPUT', 'TEXTAREA'].includes(target.tagName);
}

/**
 * Il battitore che sta sul portatile: mostra il tetto, e avverte quando lo superi.
 *
 * <p>E' un file separato da {@code PublicBidderDialog}, con un tipo separato, e non lo
 * stesso componente con un interruttore. La ragione e' scritta nel sorgente Java che
 * questa migrazione ricalca: un flag si dimentica, un campo assente no. Il countdown, la
 * tastiera e l'audio arrivano da un hook condiviso perche' non toccano valutazioni.
 */

// Il ritmo con cui il dialogo continua a ripubblicare il lotto DOPO la
// scadenza, mentre resta aperto in attesa dell'aggiudicazione. Non deriva
// da STALE_AFTER_MS (ConnectionStatus) per lo stesso motivo per cui
// HEARTBEAT_INTERVAL_MS (useIdleHeartbeat) non ne deriva: sono timing
// indipendenti, e farne dipendere l'uno dall'altro per divisione li
// accoppierebbe in silenzio se quella soglia cambiasse. Il valore e' scelto
// per stare comodamente dentro quella soglia (15 s) — qui coincide con
// HEARTBEAT_INTERVAL_MS per coerenza fra i due, non perche' uno derivi
// dall'altro. Piu' spesso non servirebbe: dopo la scadenza il prezzo non
// cambia piu', a differenza di mentre il countdown corre (li' i dieci al
// secondo servono a far scendere il numero sull'altra finestra).
const POST_EXPIRY_REPUBLISH_MS = 5_000;

/**
 * Il rilancio di uno: lo stesso gesto della barra spaziatrice, e il piu'
 * frequente della serata. Ha la barra tutta per se' in cima ai controlli.
 */
const PRIMARY_RAISE = 1;

/** I due salti rapidi sotto la barra: a voce si grida «venti!», e con un tasto
 *  solo costerebbero cinque o dieci pressioni della barra spaziatrice. */
const QUICK_RAISES = [5, 10] as const;

/** La clessidra del conto alla rovescia: tratto vettoriale, mai un'emoji. */
function HourglassIcon({ urgent }: { urgent: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`h-8 w-8 shrink-0 ${urgent ? 'text-destructive' : 'text-muted-foreground'}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 3h10M7 21h10" />
      <path d="M8 3v3.5c0 1.5 4 3.8 4 5.5s-4 4-4 5.5V21" />
      <path d="M16 3v3.5c0 1.5-4 3.8-4 5.5s4 4 4 5.5V21" />
    </svg>
  );
}

/** Il fascione di chi e' in testa: tratto vettoriale, mai un'emoji. */
function LeadIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`h-6 w-6 shrink-0 ${muted ? 'text-muted-foreground' : 'text-accent'}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5H4.5v1.5A3.5 3.5 0 0 0 8 10M17 5h2.5v1.5A3.5 3.5 0 0 1 16 10" />
      <path d="M12 14v3M9 20h6" />
    </svg>
  );
}

/** La freccia che torna indietro: si riaprono le offerte. Tratto vettoriale. */
function ReopenIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 2.6-6.4" />
      <path d="M3 4.5V10h5.5" />
    </svg>
  );
}

/** Il gettone dei crediti: tratto vettoriale, mai un'emoji. */
function CoinIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-8 w-8 shrink-0 text-accent"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M14.5 9.2A3 3 0 0 0 12 8c-1.7 0-2.6.8-2.6 1.8 0 2.4 5.2 1.2 5.2 3.7 0 1.1-1 2-2.6 2a3 3 0 0 1-2.5-1.2" />
      <path d="M12 6.6v1.2M12 16.2v1.2" />
    </svg>
  );
}

export function BidderDialog({
  valuation,
  participants,
  timerSeconds,
  beepEnabled,
  error,
  disabled = false,
  pending = false,
  leader = null,
  onAssign,
  onClose,
}: {
  valuation: ValuationResponse;
  participants: ParticipantView[];
  timerSeconds: number;
  beepEnabled: boolean;
  /**
   * L'esito di un onAssign fallito (budget esaurito, slot pieno, fase
   * cambiata a meta' rilancio). Il countdown e' gia' scaduto quando si
   * arriva a inviare: senza mostrarlo qui, chi ha appena rilanciato non
   * saprebbe se aggiudicare e' andata a buon fine o no, e potrebbe
   * reinviare alla cieca.
   */
  error: string | null;
  /**
   * Vero quando i dati mostrati (budget, tetto) non sono aggiornati.
   * Stessa guardia che BidPanel applica da tappa 3: senza, un lotto poteva
   * essere aggiudicato mentre la testata mostra "Connessione persa" e i
   * numeri sullo schermo sono vecchi — il battitore non erediterebbe una
   * protezione che BidPanel ha gia'.
   */
  disabled?: boolean;
  /**
   * Vero mentre l'invio precedente e' ancora in volo. Senza, un secondo
   * clic su Aggiudica manda una seconda POST /purchases con un requestId
   * nuovo (la chiave protegge dal doppio invio della STESSA richiesta, non
   * da un secondo clic deliberato): il registro rifiuta il duplicato, ma
   * l'operatore vede un errore subito dopo un'aggiudicazione riuscita.
   */
  pending?: boolean;
  /**
   * Chi e' in testa adesso: l'ultima squadra che ha rilanciato. Resta null
   * finche' l'asta e' una sola persona al portatile che batte per il tavolo —
   * li' nessuno "sta vincendo", si sta solo chiamando un prezzo. Diventa una
   * squadra vera quando le offerte arrivano da piu' postazioni.
   */
  leader?: { name: string } | null;
  onAssign: (input: { participantId: string; price: number }) => void;
  onClose: () => void;
}) {
  const [price, setPrice] = useState(1);
  // Il campo dell'offerta diretta resta una stringa: un numero obbligherebbe a
  // decidere cosa vale il campo vuoto, e ogni scelta (0? NaN?) finisce prima o
  // poi nel prezzo. Si converte al momento dell'invio, e un valore che non sia
  // un intero da 1 in su non fa nulla.
  const [customBid, setCustomBid] = useState('');
  const [expired, setExpired] = useState(false);
  // Chi e' in testa: la squadra che ha fatto l'ultima offerta, segnata
  // dall'operatore toccandola. Prima ogni rilancio premuto al portatile metteva
  // in testa la propria squadra — ma chi batte al portatile di solito chiama i
  // prezzi per tutto il tavolo, e allo scadere si proponeva di aggiudicare a se'
  // un giocatore vinto da un altro. Ora parte da nessuno, e lo dice.
  const [leaderId, setLeaderId] = useState<string | null>(null);
  // L'acquirente allo scadere: chi e' in testa, se c'e'; altrimenti va scelto.
  // null finche' l'operatore non lo tocca: segue il leader.
  const [buyerChoice, setBuyerChoice] = useState<string | null>(null);
  const localLeader = participants.find((p) => p.id === leaderId) ?? null;
  const shownLeader = leader?.name ?? localLeader?.name ?? null;
  const participantId = buyerChoice ?? leaderId ?? '';

  const hintId = useId();
  const customBidId = useId();
  const buyerId = useId();
  const countdown = useBidCountdown({
    seconds: timerSeconds,
    beepEnabled,
    onExpire: () => setExpired(true),
  });

  // Un rilancio solo, da qualunque gesto arrivi: barra spaziatrice, i passi,
  // l'offerta diretta, le squadre. Tante copie di "alza e fai ripartire il conto"
  // divergono alla prima modifica fatta su una sola.
  const raiseTo = useCallback((next: (current: number) => number) => {
    setPrice(next);
    countdown.start();
  }, [countdown]);

  // Una squadra fa un'offerta. Se nessuno e' ancora in testa prende il prezzo
  // d'apertura com'e' (la prima voce al tavolo e' «uno!»); altrimenti rilancia di
  // uno. In entrambi i casi va in testa e il conto riparte.
  const teamBids = useCallback((id: string) => {
    if (leaderId === null) {
      countdown.start();
    } else {
      setPrice((p) => p + PRIMARY_RAISE);
      countdown.start();
    }
    setLeaderId(id);
    setBuyerChoice(null);
  }, [countdown, leaderId]);

  // Il prezzo che una squadra dovrebbe offrire toccandola adesso.
  const nextPriceFor = leaderId === null ? price : price + PRIMARY_RAISE;
  function canBid(p: ParticipantView): boolean {
    return !roleFull(p, valuation.role) && maxAffordable(p) >= nextPriceFor;
  }

  // Stessa disciplina di BidPanel: un bottone disabilitato e' annunciato
  // come "non disponibile" e basta, chi ascolta non deduce il perche' dal
  // bordo della scheda o dalla testata. Le due ragioni non sono la stessa
  // situazione: l'attesa si scioglie da sola, lo stantio no.
  const disabledReason = pending
    ? 'Invio in corso: attendi la conferma.'
    : disabled
      ? 'Aggiudica non disponibile: i valori mostrati non sono aggiornati.'
      : null;

  const overCeiling = valuation.maxBid > 0 && price > valuation.maxBid;
  // Quanto manca al tuo tetto, o di quanto lo si e' passato: detto accanto
  // all'offerta, dove si guarda mentre sale, e non in piccolo in fondo al riquadro.
  const toCeiling = valuation.maxBid - price;
  const buyer = participants.find((p) => p.id === participantId) ?? null;
  const buyerCannotPay = buyer !== null && (maxAffordable(buyer) < price || roleFull(buyer, valuation.role));

  // Il conto parte all'apertura, non al primo rilancio. Prima il battitore si
  // apriva col numero pieno e fermo: sembrava avviato e non lo era, e il tempo
  // cominciava a scorrere solo quando qualcuno rilanciava — cioe' quando si
  // apre un lotto che nessuno contende, mai. Aprire il battitore E' il gesto
  // che manda il lotto all'asta.
  useEffect(() => {
    countdown.start();
    // Solo all'apertura (e se cambia la durata, che a dialogo aperto oggi non
    // succede): `start` e' stabile finche' lo e' `timerSeconds`.
  }, [countdown.start]);

  // Esc chiude il conto alla rovescia e lascia il giocatore sul banco. Prima
  // era un bottone «Chiudi» nell'intestazione: accanto a «Togli dal battitore»
  // sembrava il suo doppione, e occupava un posto in vista per un gesto che si
  // fa di rado. La via di ritorno resta — senza, per tornare all'aggiudicazione
  // diretta bisognerebbe togliere il giocatore dal banco e riselezionarlo.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // La barra spaziatrice e' il gesto: si rilancia guardando il tavolo, non la tastiera.
  useEffect(() => {
    if (expired) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== ' ' && e.code !== 'Space') return;
      // Chi ha tabulato fino a un bottone e preme spazio vuole QUEL bottone,
      // non un rilancio al volo: e' il modo normale del browser di attivare un
      // controllo focalizzato. Senza questo controllo lo spazio veniva
      // intercettato qui prima di arrivare al bottone, e un «Offri» diventava
      // un rilancio di uno.
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      raiseTo((p) => p + 1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expired, raiseTo]);

  // I tasti da 1 a 9: la squadra in quella posizione fa un'offerta, senza
  // staccare gli occhi dal tavolo. Solo le squadre che possono permettersela.
  useEffect(() => {
    if (expired) return;
    function onKey(e: KeyboardEvent) {
      if (!/^[1-9]$/.test(e.key) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target) && (e.target as HTMLElement).tagName !== 'BUTTON') return;
      const team = participants[Number(e.key) - 1];
      if (!team || !canBid(team)) return;
      e.preventDefault();
      teamBids(team.id);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Quello che l'altra finestra puo' mostrare e' esattamente quello che le mandiamo:
  // il tetto non e' fra questi campi e il tipo del messaggio non lo prevede.
  //
  // countdown.remaining E' nelle dipendenze, e ripubblica dieci volte al secondo
  // mentre il countdown corre (il tick dell'hook e' ogni 100 ms): apre e chiude un
  // BroadcastChannel a ogni tick, e il costo e' reale. Ma il dialogo proiettato
  // (Task 6) mostra il tempo che resta leggendo bid.remainingMs, e non ha un
  // altro orologio: senza questo tick il numero sull'altra finestra si
  // fermerebbe al valore dell'ultimo rilancio e ci resterebbe, immobile, mentre
  // qui il tempo scade per davvero. Uno schermo proiettato che sembra vivo e
  // non lo e' e' precisamente il difetto che questa migrazione vuole evitare
  // — peggio di uno schermo che dichiara di non ricevere piu' nulla. Dieci
  // BroadcastChannel al secondo, solo mentre un lotto e' aperto, e' il prezzo
  // giusto per un conto alla rovescia che sull'altra finestra scende davvero.
  useEffect(() => {
    publishBid({
      kind: 'bidding',
      playerId: valuation.playerId,
      price,
      remainingMs: countdown.remaining,
      ...(shownLeader ? { leaderName: shownLeader } : {}),
    });
  }, [valuation.playerId, price, countdown.remaining, shownLeader]);

  // Dopo la scadenza il countdown non ripubblica piu' (countdown.remaining
  // resta fermo a 0, e l'effetto sopra non ha altro da cui ripartire), ma
  // il dialogo resta aperto ben oltre — spesso piu' dei 15 s di soglia,
  // mentre il tavolo discute chi ha vinto. Senza continuare a pubblicare,
  // la proiezione smetterebbe di sentire qualcosa e o darebbe un falso
  // allarme di disconnessione, o (se la route rispondesse con un battito
  // 'idle' proprio) perderebbe il lotto nell'istante esatto in cui la sala
  // guarda il prezzo. Si ripubblica lo STESSO lotto, congelato — e' la
  // verita': il prezzo non cambia piu' finche' non si aggiudica — a un
  // ritmo basso apposta (POST_EXPIRY_REPUBLISH_MS), perche' niente cambia
  // fra un ciclo e l'altro. 'idle' resta riservato a quando il dialogo
  // chiude per davvero (l'effetto di cleanup qui sotto): pubblicarlo
  // mentre un lotto e' ancora in attesa di aggiudicazione gli farebbe
  // significare due cose diverse.
  useEffect(() => {
    if (!expired) return;
    const id = setInterval(() => {
      publishBid({
        kind: 'bidding',
        playerId: valuation.playerId,
        price,
        remainingMs: 0,
        ...(shownLeader ? { leaderName: shownLeader } : {}),
      });
    }, POST_EXPIRY_REPUBLISH_MS);
    return () => clearInterval(id);
  }, [expired, valuation.playerId, price, shownLeader]);

  useEffect(() => () => publishBid({ kind: 'idle' }), []);

  // I secondi che restano, e quanto ne resta in proporzione: il numero e' il
  // dato, la barra e' la stessa cosa detta a colpo d'occhio, per chi sta
  // guardando il tavolo e non lo schermo.
  const secondsLeft = Math.ceil(countdown.remaining / 1000);
  const total = timerSeconds * 1000;
  const fraction = total > 0 ? Math.max(0, Math.min(1, countdown.remaining / total)) : 0;
  // Sotto i tre secondi si decide in fretta: il numero e la barra passano al
  // rosso. Mai il colore da solo — il numero che scende e la barra che si
  // svuota dicono la stessa cosa a chi il rosso non lo distingue.
  const urgent = !expired && countdown.remaining <= 3_000;

  return (
    // Senza cornice propria: questa card sta dentro il riquadro «Battitore»,
    // che porta gia' bordo, fondo e titolo. Mentre il conto alla rovescia corre,
    // in pagina c'e' una card sola.
    <section
      data-testid="bidder-dialog"
      data-over-ceiling={overCeiling}
      aria-labelledby="bidder-name"
      className="flex h-full flex-col gap-3"
    >
      <header className="flex items-baseline gap-3">
        <h2 id="bidder-name" className="w-exp text-xl font-extrabold">{valuation.name}</h2>
        {/* La pillola del ruolo, centrata sull'altezza del nome: sulla linea di
            base il cerchio finirebbe fuori squadra. Il ruolo per esteso resta in
            sr-only dentro RoleBadge. */}
        <span className="flex self-center">
          <RoleBadge role={valuation.role} />
        </span>
        <p className="text-sm text-muted-foreground">{valuation.team}</p>
      </header>

      {/* Le tre letture — tempo, offerta, chi e' in testa — incolonnate da una
          griglia: numeri nella prima riga, etichette nella seconda. Le icone sono
          self-center e non partecipano alla linea di base, cosi' due numeri di
          corpo diverso poggiano sulla stessa riga. */}
      <div className="grid w-fit grid-cols-[auto_auto_auto] items-baseline gap-x-8 max-sm:gap-x-5">
        <div className="col-start-1 row-start-1 flex items-baseline gap-3">
          <span className="flex self-center max-sm:hidden">
            <HourglassIcon urgent={urgent} />
          </span>
          {/* Negli ultimi tre secondi il numero passa al rosso e pulsa: non il
              colore da solo, che chi non distingue il rosso non vede. Con la
              riduzione del movimento la pulsazione si spegne (regola globale),
              e restano il colore e la parola «ultimi» qui sotto. */}
          <span
            data-testid="bidder-remaining"
            className={`tnum w-exp text-[80px] font-extrabold leading-none max-sm:text-6xl ${
              urgent ? 'animate-pulse text-destructive' : ''
            }`}
          >
            {secondsLeft}
          </span>
        </div>
        <div className="col-start-2 row-start-1 flex items-baseline gap-3">
          <span className="flex self-center max-sm:hidden">
            <CoinIcon />
          </span>
          <span
            data-testid="bidder-price"
            className={`tnum w-exp text-[56px] font-extrabold leading-none max-sm:text-5xl ${
              overCeiling ? 'text-destructive' : 'text-accent'
            }`}
          >
            {price}
          </span>
        </div>
        {/* Troncato: il nome di una squadra puo' essere lungo quanto vuole, e
            allargandosi spingerebbe il resto. Nell'albero di accessibilita' resta
            intero. Senza offerte segnate dice «Nessuno»: e' la verita'. */}
        <div className="col-start-3 row-start-1 flex min-w-0 items-baseline gap-3">
          <span className="flex self-center max-sm:hidden">
            <LeadIcon muted={!shownLeader} />
          </span>
          <span
            data-testid="bidder-leader"
            className={`w-exp max-w-[14rem] truncate text-3xl font-extrabold leading-none max-sm:max-w-[7rem] max-sm:text-2xl ${
              shownLeader ? '' : 'text-muted-foreground'
            }`}
          >
            {shownLeader ?? 'Nessuno'}
          </span>
        </div>

        <span className={`col-start-1 row-start-2 mt-2 text-sm ${urgent ? 'font-bold text-destructive' : 'text-muted-foreground'}`}>
          {urgent ? 'ultimi secondi' : secondsLeft === 1 ? 'secondo' : 'secondi'}
        </span>
        <span className="col-start-2 row-start-2 mt-2 text-sm text-muted-foreground">offerta</span>
        <span className="col-start-3 row-start-2 mt-2 text-sm text-muted-foreground">in testa</span>
        {/* La distanza dal tuo tetto, sotto l'offerta: prima il tetto stava in
            piccolo in fondo al riquadro, lontano dal numero che sale. Detta come
            distanza, non come secondo numero da confrontare a mente. */}
        {valuation.maxBid > 0 ? (
          <span
            data-testid="bidder-ceiling-distance"
            className={`col-start-2 row-start-3 text-sm font-bold ${
              overCeiling ? 'text-destructive' : toCeiling === 0 ? 'text-accent' : 'text-positive'
            }`}
          >
            {overCeiling
              ? `${-toCeiling} oltre il tuo tetto`
              : toCeiling === 0 ? 'al tuo tetto' : `${toCeiling} sotto il tuo tetto`}
          </span>
        ) : null}
      </div>

      {/* Il tempo che resta, a tutta larghezza del riquadro: si legge con la coda
          dell'occhio guardando il tavolo. aria-hidden: il dato lo porta il numero,
          e una barra che si svuota dieci volte al secondo, annunciata, sarebbe
          rumore. */}
      <div aria-hidden className={`w-full overflow-hidden rounded-full bg-line ${urgent ? 'h-3' : 'h-2'}`}>
        <div
          data-testid="bidder-remaining-bar"
          className={`h-full rounded-full ${urgent ? 'bg-destructive' : 'bg-accent'}`}
          style={{ width: `${fraction * 100}%` }}
        />
      </div>

      {expired ? null : (
        <>
          {/* Chi fa l'offerta: una squadra per bottone. Toccarla la mette in testa
              (e, se qualcuno era gia' in testa, rilancia di uno). Chi non puo'
              permettersi l'offerta successiva — crediti meno uno per ogni altro
              posto da riempire — o ha gia' pieni i posti del ruolo resta spento,
              col motivo scritto: al tavolo e' la domanda su cui si litiga. */}
          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-2 text-sm font-bold text-muted-foreground">
              Chi fa l'offerta
              <span className="font-normal"> — tocca la squadra, o premi il suo numero</span>
            </legend>
            {/* Tante colonne quante ne entrano, da 8rem: otto squadre stanno su due
                righe anche nel riquadro stretto, e il battitore non si allunga. */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(8rem,1fr))]">
              {participants.map((p, i) => {
                const able = canBid(p);
                const isLeader = p.id === leaderId;
                const reason = roleFull(p, valuation.role)
                  ? `posti ${ROLE_NAME_PLURAL[valuation.role]} pieni`
                  : `max ${Math.max(0, maxAffordable(p))}`;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!able}
                    aria-pressed={isLeader}
                    onClick={() => teamBids(p.id)}
                    className={`relative flex min-h-12 min-w-0 flex-col items-start justify-center rounded-xl border px-3 py-1 text-left disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground ${
                      isLeader ? 'border-accent bg-accent text-on-accent' : 'border-line-strong hover:bg-line'
                    }`}
                  >
                    <span className="flex w-full items-baseline gap-2">
                      <span className="truncate font-extrabold">{p.name}</span>
                      {i < 9 ? (
                        <span aria-hidden="true" className={`tnum ml-auto text-xs ${isLeader ? '' : 'text-muted-foreground'}`}>{i + 1}</span>
                      ) : null}
                    </span>
                    <span className={`tnum text-xs ${isLeader ? '' : 'text-muted-foreground'}`}>
                      {isLeader ? 'in testa' : reason}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* I rilanci di chi e' in testa: +1 (anche con la barra spaziatrice),
              +5, +10, o un prezzo gridato. Bersagli grandi, a larghezza fissa: non
              devono spostarsi di un pixel mentre si rilancia. Sul telefono il
              campo dell'offerta va su una riga sua: accanto ai bottoni si
              schiacciava a zero. */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => raiseTo((p) => p + PRIMARY_RAISE)}
              className={`tnum ${BID_CONTROL_H} ${BID_RADIUS} flex-1 basis-40 bg-accent px-6 text-2xl font-extrabold text-on-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground`}
            >
              Rilancia +{PRIMARY_RAISE}
              <span className="sr-only"> crediti</span>
            </button>
            {QUICK_RAISES.map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => raiseTo((p) => p + step)}
                className={`tnum ${BID_CONTROL_H} ${BID_RADIUS} min-w-20 border border-line-strong px-6 text-2xl font-extrabold text-foreground hover:bg-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground`}
              >
                +{step}
                <span className="sr-only"> crediti</span>
              </button>
            ))}
            {/* Al tavolo si grida anche un prezzo: questo campo porta l'offerta al
                numero scritto, non ci somma nulla — per questo dice «Offri». */}
            <form
              className="flex min-w-0 basis-full items-center gap-3 sm:basis-64 sm:flex-1"
              onSubmit={(e) => {
                e.preventDefault();
                const wanted = Number(customBid);
                if (!Number.isInteger(wanted) || wanted < 1) return;
                raiseTo(() => wanted);
                setCustomBid('');
              }}
            >
              <label htmlFor={customBidId} className="sr-only">
                Offerta diretta
              </label>
              <input
                id={customBidId}
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                placeholder="Offerta diretta"
                value={customBid}
                onChange={(e) => setCustomBid(e.target.value)}
                className={`tnum ${BID_CONTROL_H} ${BID_RADIUS} w-full min-w-0 border border-line-strong bg-transparent px-4 text-2xl font-extrabold placeholder:text-base placeholder:font-normal placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent`}
              />
              <button
                type="submit"
                className={`${BID_CONTROL_H} ${BID_RADIUS} shrink-0 border border-line-strong px-6 text-2xl font-extrabold hover:bg-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent`}
              >
                Offri
              </button>
            </form>
          </div>
        </>
      )}

      {/* La riga di riferimento: gli stessi numeri della scheda di decisione, da
          consultare, non da guardare. */}
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm text-muted-foreground">
        <dl className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <div className="flex gap-2">
            <dt>il tuo tetto</dt>
            <dd data-testid="bidder-ceiling" className="tnum font-bold text-accent">
              {valuation.maxBid}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt>mercato</dt>
            <dd className="tnum text-foreground">{valuation.expectedPrice}</dd>
          </div>
          <div className="flex gap-2">
            <dt>margine</dt>
            <dd className={`tnum ${valuation.worthPursuing ? 'text-positive' : 'text-destructive'}`}>
              {signed(valuation.margin)}
            </dd>
          </div>
        </dl>
        <p className={`font-bold ${valuation.worthPursuing ? 'text-positive' : 'text-destructive'}`}>
          {valuation.worthPursuing ? 'Prendi' : 'Lascia'}
        </p>
        {/* L'aiuto della tastiera sulla stessa riga, in fondo a destra: una riga
            in meno nel riquadro, che ha un'altezza fissa. */}
        {expired ? null : (
          <p className="sm:ml-auto">
            Spazio: +1 a chi è in testa · Esc chiude · allo scadere scegli a chi va
          </p>
        )}
      </div>

      {overCeiling ? (
        // Per chi ascolta: il colore e la riga sotto l'offerta lo dicono a chi
        // guarda. Statico, non una live region: la pagina ne ha una sola.
        <p className="sr-only">
          Sei oltre il tuo tetto di {price - valuation.maxBid}. Questa offerta supera il prezzo massimo consigliato.
        </p>
      ) : null}

      {error ? (
        // role="alert": un controllo puntuale, non la live region ambientale
        // (che resta AuctionAnnouncer). Senza, un'aggiudicazione fallita non
        // arriverebbe a chi ascolta.
        <p role="alert" className="text-sm font-bold text-destructive">
          {error}
        </p>
      ) : null}

      {expired ? (
        <>
          {/* role="alert": allo scadere il form compare ed e' ovvio a chi vede;
              senza questa riga chi ascolta (col beep spento) non saprebbe che si
              puo' aggiudicare. */}
          <p role="alert" className="text-base font-bold">
            {shownLeader
              ? `Tempo scaduto: ${shownLeader} è in testa a ${price}.`
              : 'Tempo scaduto: scegli a chi va.'}
          </p>
          {/* L'acquirente proposto e' chi e' in testa. Senza nessuno in testa va
              scelto: «Aggiudica» resta spento finche' non lo si sceglie, invece di
              proporre la propria squadra per un giocatore vinto da un altro. */}
          <form
            className="flex flex-wrap items-center gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!participantId) return;
              onAssign({ participantId, price });
            }}
          >
            <label htmlFor={buyerId} className="text-sm text-muted-foreground">
              Aggiudica a
            </label>
            <select
              id={buyerId}
              value={participantId}
              onChange={(e) => setBuyerChoice(e.target.value)}
              className={`${BID_CONTROL_H} ${BID_RADIUS} border border-line-strong bg-surface px-4 text-lg font-bold text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent`}
            >
              {participantId === '' ? <option value="" disabled>Scegli la squadra</option> : null}
              {participants.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={disabled || pending || participantId === ''}
              aria-describedby={disabledReason ? hintId : undefined}
              className={`${BID_CONTROL_H} ${BID_RADIUS} bg-accent px-8 text-lg font-extrabold text-on-accent transition-opacity duration-200 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground`}
            >
              {pending ? 'Aggiudico…' : `Aggiudica a ${price}`}
            </button>
            {/* La via di ritorno: il tempo e' scaduto ma qualcuno rilancia lo
                stesso. Riparte dal prezzo raggiunto, non da uno. */}
            <button
              type="button"
              onClick={() => { setExpired(false); countdown.start(); }}
              className={`inline-flex ${BID_CONTROL_H} ${BID_RADIUS} items-center gap-2 border border-line-strong px-6 text-lg font-bold hover:bg-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent`}
            >
              <ReopenIcon />
              Riprendi le offerte
            </button>
            {disabledReason ? (
              <span id={hintId} className="sr-only">
                {disabledReason}
              </span>
            ) : null}
          </form>
          {/* Il server rifiuterebbe comunque: dirlo prima evita un «Aggiudica»
              che torna indietro con un errore. */}
          {buyerCannotPay ? (
            <p className="text-sm font-bold text-destructive">
              {`${buyer!.name} non può comprarlo a ${price}: `}
              {roleFull(buyer!, valuation.role)
                ? `ha già tutti i posti ${ROLE_NAME_PLURAL[valuation.role]}.`
                : `può offrire al massimo ${Math.max(0, maxAffordable(buyer!))}.`}
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
