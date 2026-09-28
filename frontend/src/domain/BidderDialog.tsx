import { useCallback, useEffect, useId, useState } from 'react';
import type { ReactNode } from 'react';
import type { ParticipantView, ValuationResponse } from '../api/types';
import { publishBid } from './bidChannel';
import { maxAffordable, roleFull } from './bidRules';
import { BID_CONTROL_H, BID_RADIUS } from './controls';
import { signed } from './PlayerDecisionCard';
import { RoleBadge } from './RoleBadge';
import { ROLE_NAME_PLURAL } from './roles';
import { useBidCountdown } from './useBidCountdown';

/**
 * Vero per i bottoni di rilancio, per il campo dell'offerta diretta, per i
 * bottoni delle squadre e per qualunque altro controllo che usa la barra
 * spaziatrice per attivarsi da solo — uno spazio con il focus li' sopra e' un
 * tentativo di usare QUEL controllo, non il gesto del rilancio.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ['BUTTON', 'SELECT', 'INPUT', 'TEXTAREA'].includes(target.tagName);
}

/**
 * Il conto alla rovescia che sta sul portatile: mostra il tetto, e avverte quando lo superi.
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

/**
 * Il tasto disegnato come un tasto: bordo, fondo appena staccato, cifre
 * tabellari. Vive in una costante perche' i tre tasti devono restare identici —
 * tre copie della stessa riga di classi divergono alla prima modifica.
 */
const KEY_CAP =
  'tnum rounded-md border border-line-strong bg-surface-raised px-2 py-0.5 text-xs font-medium text-foreground';

/** I due salti rapidi sotto la barra: a voce si grida «venti!», e con un tasto
 *  solo costerebbero cinque o dieci pressioni della barra spaziatrice. */
const QUICK_RAISES = [5, 10] as const;

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

/**
 * Una cella del tabellone: il valore grande sopra, l'etichetta sotto, e — dove
 * serve — una riga di contesto in fondo (la distanza dal tetto, «sei tu»).
 *
 * <p>Vive come componente e non come tre copie di classi perche' e' esattamente
 * il punto: celle della stessa riga hanno la stessa altezza per costruzione, e
 * tre blocchi affiancati a mano no. Il difetto che questo chiude era proprio
 * quello — chi era in testa stava in un riquadro con un'allineamento tutto suo.
 *
 * <p>{@code data-cell} serve alle prove per chiedere «in quale cella sta questo
 * numero» senza dipendere dall'ordine delle colonne.
 */
function Cell({ label, children, note, testId, highlighted = false, first = false, urgentLabel = false }: {
  label: string;
  children: ReactNode;
  /** La riga di contesto sotto l'etichetta. */
  note?: ReactNode;
  testId?: string;
  /** La cella si accende: oggi solo «in testa», quando sei tu. */
  highlighted?: boolean;
  /** La prima cella della riga non porta il filetto a sinistra. */
  first?: boolean;
  urgentLabel?: boolean;
}) {
  return (
    <div
      data-cell
      data-testid={testId}
      className={`flex min-w-0 flex-col items-center justify-center gap-1.5 px-4 py-5 text-center ${
        first ? '' : 'border-l border-line max-sm:[&:nth-child(odd)]:border-l-0'
      } ${highlighted ? 'bg-accent text-on-accent' : ''}`}
    >
      {children}
      <span
        className={`text-sm ${
          highlighted ? 'text-on-accent' : urgentLabel ? 'font-medium text-destructive' : 'text-muted-foreground'
        }`}
      >
        {label}
      </span>
      {note}
    </div>
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
   * numeri sullo schermo sono vecchi — il conto alla rovescia non erediterebbe una
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
  // L'acquirente allo scadere, se lo si corregge a mano. null vuol dire «chi e'
  // in testa»: al tavolo e' quasi sempre quello, e chiederlo ogni volta
  // significherebbe far dichiarare l'ovvio.
  const [buyerChoice, setBuyerChoice] = useState<string | null>(null);

  /**
   * La tua squadra. Da questa schermata si offre per se' e basta: ogni squadra
   * sta alla propria postazione, e i bottoni per offrire al posto di un altro —
   * il modo di battere per tutto il tavolo da un portatile solo — non ci sono
   * piu' mentre il conto corre.
   */
  const me = participants.find((p) => p.me) ?? null;

  /**
   * Chi e' in testa adesso. Se il server segnala un'offerta da un'altra
   * postazione e' quella; altrimenti sei tu, perche' mettere un giocatore sul
   * banco E' chiamarlo a uno — se nessun altro rilancia, se lo prende chi l'ha
   * chiamato. Prima qui c'era scritto «Nessuno» e allo scadere non veniva
   * proposto nessun acquirente per un lotto che era gia' tuo.
   */
  const shownLeader = leader?.name ?? me?.name ?? null;
  // Sei tu a essere in testa: il server non segnala nessun altro.
  const leadingMyself = leader === null && me !== null;
  // Il leader del server porta un nome, non un identificativo: l'unico modo di
  // risalire alla squadra e' il nome, che nella lega e' unico. Se non combacia
  // (una lega rinominata a meta' asta) non si propone nessuno, invece di
  // proporre la squadra sbagliata.
  const leaderId = leader
    ? participants.find((p) => p.name === leader.name)?.id ?? null
    : me?.id ?? null;
  const participantId = buyerChoice ?? leaderId ?? '';

  const hintId = useId();
  const customBidId = useId();
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

  // Il conto parte all'apertura, non al primo rilancio. Prima il conto alla rovescia si
  // apriva col numero pieno e fermo: sembrava avviato e non lo era, e il tempo
  // cominciava a scorrere solo quando qualcuno rilanciava — cioe' quando si
  // apre un lotto che nessuno contende, mai. Avviarlo E' il gesto
  // che manda il lotto all'asta.
  useEffect(() => {
    countdown.start();
    // Solo all'apertura (e se cambia la durata, che a dialogo aperto oggi non
    // succede): `start` e' stabile finche' lo e' `timerSeconds`.
  }, [countdown.start]);

  // Esc chiude il conto alla rovescia e lascia il giocatore sul banco. Prima
  // era un bottone «Chiudi» nell'intestazione: accanto a «Togli dal banco»
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

  // I tasti da 1 a 9, SOLO a tempo scaduto: dicono a chi va il lotto, e sono la
  // scorciatoia dei bottoni squadra qui sotto. Mentre il conto corre non fanno
  // niente, perche' da questa schermata non si offre per un'altra squadra:
  // offrire e' «Rilancia», e vale per la tua.
  useEffect(() => {
    if (!expired) return;
    function onKey(e: KeyboardEvent) {
      if (!/^[1-9]$/.test(e.key) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target) && (e.target as HTMLElement).tagName !== 'BUTTON') return;
      const team = participants[Number(e.key) - 1];
      if (!team) return;
      e.preventDefault();
      setBuyerChoice(team.id);
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
  // I tasti che corrispondono davvero a una squadra: con quattro squadre al
  // tavolo, annunciare «1–9» manderebbe a premere cinque tasti che non fanno
  // niente. Nove e' il massimo, perche' i tasti sono quelli.
  const keyCount = Math.min(participants.length, 9);
  const keyRange = keyCount > 1 ? `1–${keyCount}` : '1';

  const secondsLeft = Math.ceil(countdown.remaining / 1000);
  const total = timerSeconds * 1000;
  const fraction = total > 0 ? Math.max(0, Math.min(1, countdown.remaining / total)) : 0;
  // Sotto i tre secondi si decide in fretta: il numero e la barra passano al
  // rosso. Mai il colore da solo — il numero che scende e la barra che si
  // svuota dicono la stessa cosa a chi il rosso non lo distingue.
  const urgent = !expired && countdown.remaining <= 3_000;

  return (
    // Senza cornice propria: questa card sta dentro il riquadro del banco,
    // che porta gia' bordo, fondo e titolo. Mentre il conto alla rovescia corre,
    // in pagina c'e' una card sola.
    <section
      data-testid="bidder-dialog"
      data-over-ceiling={overCeiling}
      aria-labelledby="bidder-name"
      // Altezza naturale, non h-full: sotto, dentro lo stesso riquadro del banco,
      // vivono le alternative, e prendendosi tutto il riquadro questo non ne
      // lasciava nessuna.
      className="flex flex-col gap-3"
    >
      <header className="flex items-baseline gap-3">
        <h2 id="bidder-name" className="w-exp text-xl font-semibold">{valuation.name}</h2>
        {/* La pillola del ruolo, centrata sull'altezza del nome: sulla linea di
            base il cerchio finirebbe fuori squadra. Il ruolo per esteso resta in
            sr-only dentro RoleBadge. */}
        <span className="flex self-center">
          <RoleBadge role={valuation.role} />
        </span>
        <p className="text-sm text-muted-foreground">{valuation.team}</p>
      </header>

      {/* Il TABELLONE: le quattro letture su cui si decide, celle di una riga
          sola — quanto tempo resta, a quanto siamo, dove ti fermi, chi e' in
          testa — e la barra del tempo come sua base.

          Celle e non elementi affiancati a mano: due altezze diverse non possono
          nascere da celle della stessa riga. Prima chi era in testa stava in un
          riquadro accanto alla griglia, con un'allineamento tutto suo — partiva
          con le cifre e finiva a meta' delle etichette — e si vedeva.

          I tre numeri hanno lo stesso corpo. In un tabellone le celle si leggono
          come un insieme, e tre taglie diverse le farebbero sembrare tre cose
          scollegate: l'urgenza la porta il colore, non una cifra piu' grande.

          Niente icone accanto ai numeri: la clessidra, il gettone e il fascione
          erano tre segni decorativi in un momento a zero tolleranza. */}
      <div
        data-testid="bidder-scoreboard"
        className="overflow-hidden rounded-2xl border border-line-strong"
      >
        <div
          data-testid="bidder-cells"
          className={`grid ${expired ? 'grid-cols-3' : 'grid-cols-4'} max-sm:grid-cols-2`}
        >
          {expired ? null : (
            <Cell label={urgent ? 'ultimi secondi' : secondsLeft === 1 ? 'secondo' : 'secondi'} urgentLabel={urgent}>
              {/* Negli ultimi tre secondi il numero passa al rosso, e NON pulsa.
                  La pulsazione faceva oscillare l'opacita' fra 1 e 0,5: misurata
                  col metodo di contrast.test.ts, portava il numero da 5,21:1 a
                  2,25:1 — sotto la soglia di 4,5 per meta' del tempo, sul dato che
                  in quel momento conta di piu'. E' la stessa ragione per cui le
                  fasi non correnti non si smorzano.

                  Il colore non resta solo: l'etichetta qui sotto diventa «ultimi
                  secondi», la barra passa al rosso, e il numero scende da se'. Chi
                  non distingue il rosso ha comunque tre segnali. */}
              <span
                data-testid="bidder-remaining"
                className={`tnum text-[56px] font-extrabold leading-none max-sm:text-5xl ${
                  urgent ? 'text-destructive' : ''
                }`}
              >
                {secondsLeft}
              </span>
            </Cell>
          )}

          <Cell label="offerta" first={expired}>
            <span
              data-testid="bidder-price"
              className={`tnum text-[56px] font-extrabold leading-none max-sm:text-5xl ${
                overCeiling ? 'text-destructive' : 'text-accent'
              }`}
            >
              {price}
            </span>
          </Cell>

          {/* Il tetto non prende l'oro: l'oro e' il colore di cio' che succede —
              l'offerta che sale, il bottone che rilancia — e il tetto e' il
              riferimento fermo accanto. Il colore qui lo porta la distanza, che e'
              l'unica cosa che cambia. */}
          <Cell
            label="il tuo tetto"
            note={valuation.maxBid > 0 ? (
              <span
                data-testid="bidder-ceiling-distance"
                className={`text-sm font-medium ${
                  overCeiling ? 'text-destructive' : toCeiling === 0 ? 'text-accent' : 'text-positive'
                }`}
              >
                {overCeiling ? `${-toCeiling} oltre` : toCeiling === 0 ? 'ci sei' : `${toCeiling} sotto`}
              </span>
            ) : null}
          >
            <span
              data-testid="bidder-ceiling"
              className={`tnum font-extrabold leading-none ${
                // Tetto zero non e' un prezzo basso: e' l'assenza di un prezzo, la
                // stessa cosa che la tabella di fase dice con la stessa parola. In
                // riga con i secondi e l'offerta uno zero si leggerebbe come una
                // cifra, e per giunta come la piu' conveniente della serata.
                valuation.maxBid > 0 ? 'text-[56px] max-sm:text-5xl' : 'text-3xl text-muted-foreground'
              }`}
            >
              {valuation.maxBid > 0 ? valuation.maxBid : 'nessuno'}
            </span>
          </Cell>

          {/* Chi e' in testa: LA domanda del rilancio dal vivo — sto vincendo io o
              no. La cella si accende quando sei tu, e lo dice anche a parole: il
              colore da solo non e' informazione. */}
          <Cell
            testId="bidder-leader"
            label="in testa"
            note={leadingMyself ? <span className="text-sm">sei tu</span> : null}
            highlighted={leadingMyself}
          >
            {/* Troncato: il nome di una squadra puo' essere lungo quanto vuole, e
                allargandosi sformerebbe la cella. Nell'albero di accessibilita'
                resta intero. */}
            <span className="max-w-full truncate text-3xl font-semibold leading-none max-sm:text-2xl">
              {shownLeader ?? '—'}
            </span>
          </Cell>
        </div>

        {/* La base del tabellone: il tempo che resta, a tutta la sua larghezza.
            Galleggiava sotto, staccata, e si leggeva come un separatore invece
            che come i secondi della prima cella che si consumano.

            aria-hidden: il dato lo porta il numero, e una barra che si svuota
            dieci volte al secondo, annunciata, sarebbe rumore. */}
        {/* Il filetto sopra non e' decorazione: la cella di chi e' in testa si
            accende d'oro e arriva fino a qui, e senza una linea la barra — anch'essa
            oro — le si fondeva contro, lasciando in vista solo il pezzo di binario
            grigio sotto la cella accesa, che si leggeva come un guasto. */}
        <div aria-hidden className={`w-full border-t border-line-strong bg-line ${urgent ? 'h-2.5' : 'h-2'}`}>
          {/* Non oro. Dentro il tabellone l'oro dice gia' due cose — l'offerta che
              sale, la cella accesa di chi e' in testa — e la barra ci passa sotto:
              piena, si fondeva contro quella cella e non si capiva dove finisse
              l'una e cominciasse l'altra. Il tempo non e' una cosa su cui si
              agisce, e' una condizione, e prende il colore con cui l'applicazione
              disegna le strutture. Negli ultimi secondi passa al rosso: li' il
              tempo smette di essere una condizione e diventa la cosa da guardare. */}
          <div
            data-testid="bidder-remaining-bar"
            className={`h-full ${urgent ? 'bg-destructive' : 'bg-panel-border'}`}
            style={{ width: `${fraction * 100}%` }}
          />
        </div>
      </div>

      {/* Le squadre, una per bottone — SOLO a tempo scaduto.

          Mentre il conto correva c'erano anche li', ed erano il modo di battere
          per tutto il tavolo da un portatile solo: si toccava la squadra che
          aveva gridato. Nell'asta dal vivo ogni squadra sta alla propria
          postazione e rilancia per se', quindi offrire al posto di un altro non
          e' un gesto che esiste — e otto bottoni in piu' riempivano il riquadro
          proprio dove servono tre numeri e nient'altro.

          Qui invece non sono un'offerta: sono l'esito. Il lotto e' proposto a chi
          e' in testa, e questi bottoni servono a correggere quando al tavolo se
          l'e' preso un altro. Nessuno e' spento: se il tavolo ha aggiudicato, lo
          si deve poter registrare, e il perche' non si puo' e' scritto sotto.

          Il giorno in cui il server sapra' chi e' in testa, questa fila sparisce
          e il lotto va al vincitore da solo. */}
      {expired ? (
      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend className="mb-2 text-sm font-medium text-muted-foreground">
          A chi va
          <span className="font-normal"> — se l’ha preso un altro, tocca la sua squadra o premi il suo numero</span>
        </legend>
        {/* Tante colonne quante ne entrano, da 8rem: otto squadre stanno su due
            righe anche nel riquadro stretto, e il banco non si allunga. */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(8rem,1fr))]">
          {participants.map((p, i) => {
            const picked = p.id === participantId;
            const full = roleFull(p, valuation.role);
            // Il numero nudo: «max 476» ripetuto otto volte era rumore, e cosa
            // sia lo dice la legenda una volta sola.
            const note = full
              ? `posti ${ROLE_NAME_PLURAL[valuation.role]} pieni`
              : `${Math.max(0, maxAffordable(p))}`;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={picked}
                onClick={() => setBuyerChoice(p.id)}
                className={`relative flex min-h-12 min-w-0 flex-col items-start justify-center rounded-xl border px-3 py-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground ${
                  picked ? 'border-accent bg-accent text-on-accent' : 'border-line-strong hover:bg-line'
                }`}
              >
                <span className="flex w-full items-baseline gap-2">
                  <span className="truncate font-semibold">{p.name}</span>
                  {i < 9 ? (
                    <span aria-hidden="true" className={`tnum ml-auto text-xs ${picked ? '' : 'text-muted-foreground'}`}>{i + 1}</span>
                  ) : null}
                </span>
                <span className={`tnum text-xs ${picked ? '' : 'text-muted-foreground'}`}>
                  {picked ? 'se lo prende' : note}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>
      ) : null}

      {/* «Se lo prendi»: la domanda che ogni rilancio fa nascere e a cui
          l'applicazione non rispondeva — quanto mi resta, se lo pago questo. Sono
          i numeri della colonna di sinistra proiettati dopo l'acquisto, non una
          stima nuova: crediti meno il prezzo, un posto in meno, e la media che ne
          esce.

          Solo mentre il conto corre: a tempo scaduto il prezzo non cambia piu', e
          il riquadro dell'aggiudicazione ha bisogno di quell'altezza. */}
      {!expired && me ? (
        <div
          data-testid="bidder-after"
          className="flex flex-wrap items-baseline gap-x-8 gap-y-2 rounded-xl border border-line px-4 py-3"
        >
          <span className="text-sm font-medium text-muted-foreground">{`Se lo prendi a ${price}`}</span>
          <span className="tnum text-sm">
            <span className="font-semibold">{Math.max(0, me.budgetRemaining - price)}</span>
            <span className="text-muted-foreground"> crediti</span>
          </span>
          <span className="tnum text-sm">
            <span className="font-semibold">{Math.max(0, me.slotsRemaining - 1)}</span>
            <span className="text-muted-foreground"> posti da riempire</span>
          </span>
          {me.slotsRemaining - 1 > 0 ? (
            <span className="tnum text-sm">
              <span className="font-semibold">
                {Math.floor(Math.max(0, me.budgetRemaining - price) / (me.slotsRemaining - 1))}
              </span>
              <span className="text-muted-foreground"> di media per posto</span>
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Il perche' lasciare, mentre il conto corre: spariva proprio quando parte
          il tempo, cioe' nel momento in cui la tentazione di sforare il tetto e'
          massima. A tempo scaduto non si rende piu' — li' si registra un esito,
          non si decide se spingere — e il riquadro dell'aggiudicazione ha bisogno
          di quell'altezza. */}
      {!expired && !valuation.worthPursuing && valuation.walkAwayReason ? (
        <p className="max-w-[80ch] text-sm text-muted-foreground">
          {valuation.walkAwayReason}
        </p>
      ) : null}

      {expired ? null : (
        <>

          {/* I rilanci di chi e' in testa: +1 (anche con la barra spaziatrice),
              +5, +10, o un prezzo gridato. Bersagli grandi, a larghezza fissa: non
              devono spostarsi di un pixel mentre si rilancia. Sul telefono il
              campo dell'offerta va su una riga sua: accanto ai bottoni si
              schiacciava a zero. */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => raiseTo((p) => p + PRIMARY_RAISE)}
              className={`tnum ${BID_CONTROL_H} ${BID_RADIUS} flex-1 basis-40 bg-accent px-6 text-2xl font-semibold text-on-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground`}
            >
              Rilancia +{PRIMARY_RAISE}
              <span className="sr-only"> crediti</span>
            </button>
            {QUICK_RAISES.map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => raiseTo((p) => p + step)}
                className={`tnum ${BID_CONTROL_H} ${BID_RADIUS} min-w-20 border border-line-strong px-6 text-2xl font-semibold text-foreground hover:bg-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground`}
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
                className={`tnum ${BID_CONTROL_H} ${BID_RADIUS} w-full min-w-0 border border-line-strong bg-transparent px-4 text-2xl font-semibold placeholder:text-base placeholder:font-normal placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent`}
              />
              <button
                type="submit"
                className={`${BID_CONTROL_H} ${BID_RADIUS} shrink-0 border border-line-strong px-6 text-2xl font-semibold hover:bg-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent`}
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
          {/* Il tetto non e' piu' qui: e' salito fra i numeri della riga. Lo
              stesso numero a due corpi diversi, in due punti del riquadro, e'
              due numeri per chi legge di fretta. */}
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
        <p className={`font-medium ${valuation.worthPursuing ? 'text-positive' : 'text-destructive'}`}>
          {valuation.worthPursuing ? 'Prendi' : 'Lascia'}
        </p>
        {/* L'aiuto della tastiera sulla stessa riga, in fondo a destra: una riga
            in meno nel riquadro, che ha un'altezza fissa. */}
        {/* Le scorciatoie sono il vantaggio di questo riquadro su chi batte
            l'asta a mano, ed erano scritte nel corpo meno leggibile dello
            schermo: una riga grigia unita dai punti medi, in fondo a destra.
            Rese come tasti si trovano senza leggerle. */}
        <p data-testid="bidder-shortcuts" className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:ml-auto">
          {/* Scaduto il tempo lo spazio non rilancia piu' — l'ascolto si spegne —
              e continuare a offrirlo istruirebbe a un gesto che non fa niente. */}
          {expired ? null : (
            <span className="flex items-center gap-2">
              <kbd className={KEY_CAP}>Spazio</kbd> rilancia di uno
            </span>
          )}
          {/* I tasti delle squadre valgono solo a tempo scaduto: mentre il conto
              corre da qui si offre per la propria squadra e basta. */}
          {expired ? (
            <span className="flex items-center gap-2">
              <kbd className={KEY_CAP}>{keyRange}</kbd> a chi va
            </span>
          ) : null}
          <span className="flex items-center gap-2">
            <kbd className={KEY_CAP}>Esc</kbd> chiude
          </span>
        </p>
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
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      {expired ? (
        <>
          {/* Solo per chi ascolta. Allo scadere il modulo compare ed e' ovvio a
              chi vede; senza questa riga chi ascolta — col beep spento — non
              saprebbe che si puo' aggiudicare, e nemmeno a chi.

              A schermo invece era la quarta copia dello stesso nome nello stesso
              riquadro: lo dicono gia' il riquadro di chi e' in testa, il bottone
              squadra acceso e il bottone «Aggiudica a …». role="alert" resta:
              sr-only nasconde alla vista, non all'albero di accessibilita'. */}
          <p role="alert" className="sr-only">
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
            <button
              type="submit"
              disabled={disabled || pending || participantId === ''}
              aria-describedby={disabledReason ? hintId : undefined}
              className={`${BID_CONTROL_H} ${BID_RADIUS} bg-accent px-8 text-lg font-semibold text-on-accent transition-opacity duration-200 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground`}
            >
              {/* «Aggiudica a 3» si leggeva «alla squadra numero 3»: i bottoni
                  squadra qui sopra sono numerati da 1 in su, e il numero del
                  prezzo cadeva esattamente in quella lettura. Ora la squadra si
                  chiama per nome e il prezzo si introduce con «per». */}
              {pending ? 'Aggiudico…' : buyer ? `Aggiudica a ${buyer.name} per ${price}` : `Aggiudica per ${price}`}
            </button>
            {/* La via di ritorno: il tempo e' scaduto ma qualcuno rilancia lo
                stesso. Riparte dal prezzo raggiunto, non da uno. */}
            <button
              type="button"
              onClick={() => { setExpired(false); countdown.start(); }}
              className={`inline-flex ${BID_CONTROL_H} ${BID_RADIUS} items-center gap-2 border border-line-strong px-6 text-lg font-medium hover:bg-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent`}
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
            <p className="text-sm font-medium text-destructive">
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
