import { useCallback, useEffect, useId, useState } from 'react';
import type { ParticipantView, ValuationResponse } from '../api/types';
import { publishBid } from './bidChannel';
import { BID_CONTROL_H, BID_RADIUS } from './controls';
import { signed } from './PlayerDecisionCard';
import { RoleBadge } from './RoleBadge';
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
  const [participantId, setParticipantId] = useState(
    participants.find((p) => p.me)?.id ?? participants[0]?.id ?? '',
  );
  // Chi ha rilanciato per ultimo da QUESTA postazione. Finche' l'asta e' una
  // sola persona al portatile, ogni rilancio e' suo: cliccare «Rilancia» e non
  // vedere comparire la propria squadra in testa direbbe il falso al contrario
  // — che nessuno sta vincendo un'offerta che si e' appena fatta. La prop
  // `leader` vince su questo stato: quando le offerte arriveranno da piu'
  // postazioni sara' il tabellone a dire chi e' in testa, non questa card.
  const [localLeader, setLocalLeader] = useState<string | null>(null);
  const myTeam = participants.find((p) => p.me) ?? participants[0] ?? null;
  const shownLeader = leader?.name ?? localLeader;

  const hintId = useId();
  const customBidId = useId();
  const buyerId = useId();
  const countdown = useBidCountdown({
    seconds: timerSeconds,
    beepEnabled,
    onExpire: () => setExpired(true),
  });

  // Un rilancio solo, da qualunque gesto arrivi: barra spaziatrice, i tre
  // passi, l'offerta diretta. Tre copie di "alza, fai ripartire il conto,
  // passa in testa" divergono alla prima modifica fatta su una sola delle tre.
  const raiseTo = useCallback((next: (current: number) => number) => {
    setPrice(next);
    setLocalLeader(myTeam?.name ?? null);
    countdown.start();
  }, [countdown, myTeam?.name]);

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
    });
  }, [valuation.playerId, price, countdown.remaining]);

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
      });
    }, POST_EXPIRY_REPUBLISH_MS);
    return () => clearInterval(id);
  }, [expired, valuation.playerId, price]);

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
    // che porta gia' bordo, fondo e titolo. Prima ne disegnava una seconda
    // dentro la prima — e ci rendeva dentro nome e tetto una seconda volta,
    // perche' era montata DENTRO la card di decisione. Ora la sostituisce:
    // mentre il conto alla rovescia corre, in pagina c'e' una card sola.
    <section
      data-testid="bidder-dialog"
      data-over-ceiling={overCeiling}
      aria-labelledby="bidder-name"
      className="flex h-full flex-col"
    >
      <header className="flex items-baseline gap-3">
        <h2 id="bidder-name" className="w-exp text-xl font-extrabold">{valuation.name}</h2>
        {/* La pillola al posto della parola: e' lo stesso segno che marca il
            ruolo nella tabella di fase e nei risultati della ricerca, quindi il
            giocatore sul banco si riconosce con lo stesso colpo d'occhio. Il
            ruolo per esteso non se ne va — RoleBadge lo porta in sr-only, che
            e' come lo riceve chi ascolta. */}
        {/* self-center: l'intestazione allinea per la linea di base (nome e
            squadra devono poggiare sulla stessa riga), ma una pillola tonda su
            quella linea si appoggia con la lettera che ha dentro e il cerchio
            finisce fuori squadra. Si centra sull'altezza del nome, e basta. */}
        <span className="flex self-center">
          <RoleBadge role={valuation.role} />
        </span>
        <p className="text-sm text-muted-foreground">{valuation.team}</p>
      </header>

      {/* Il corpo respira nello spazio che ha: il riquadro del battitore e'
          alto quanto la colonna, e con i margini fissi tutto restava appeso in
          cima con mezza card di verde sotto. Una colonna che centra quello che
          contiene distribuisce l'altezza invece di ammucchiare il contenuto a
          un'estremita'. */}
      <div className="flex flex-1 flex-col justify-center gap-6">
      {/* Il banco: a sinistra i due numeri che si guardano — quanto tempo
          resta e a quanto siamo — a destra i controlli che si toccano. Due
          zone separate, perche' sono due gesti diversi: uno si legge da
          lontano, l'altro si colpisce senza mirare. */}
      <div className="flex flex-wrap items-start gap-x-10 gap-y-6">
        {/* Incolonnati da una griglia: numeri nella prima riga, etichette nella
            seconda, la barra nella terza. Con due colonne impilate a mano i due
            numeri si disallineavano — la colonna con la barra sotto e' piu'
            alta, e allineandole per il fondo le cifre finivano a quote diverse. */}
        <div className="grid w-fit grid-cols-[auto_auto_auto] items-baseline gap-x-8">
          {/* Le icone sono self-center e cosi' NON partecipano all'allineamento
              per linea di base: la base della cella e' quella della cifra, ed
              e' per questo che due numeri di corpo diverso poggiano sulla
              stessa riga invece di galleggiare uno sopra l'altro. */}
          <div className="col-start-1 row-start-1 flex items-baseline gap-3">
            <span className="flex self-center">
              <HourglassIcon urgent={urgent} />
            </span>
            <span
              data-testid="bidder-remaining"
              className={`tnum w-exp text-[92px] font-extrabold leading-none ${
                urgent ? 'text-destructive' : ''
              }`}
            >
              {secondsLeft}
            </span>
          </div>
          <div className="col-start-2 row-start-1 flex items-baseline gap-3">
            <span className="flex self-center">
              <CoinIcon />
            </span>
            <span
              data-testid="bidder-price"
              className={`tnum w-exp text-[56px] font-extrabold leading-none ${
                overCeiling ? 'text-destructive' : 'text-accent'
              }`}
            >
              {price}
            </span>
          </div>

          {/* Chi e' in testa: la TERZA lettura, nella stessa griglia delle altre
              due e non piu' un riquadro bordato a se' stante, centrato per conto
              suo accanto a una colonna alta il doppio. Era quello a far sembrare
              storta l'intera riga. Qui condivide la linea di base con i numeri e
              l'etichetta con le altre etichette. Senza offerte da altre
              postazioni non finge una squadra: dice che non c'e' nessuno, che e'
              la verita' finche' a battere e' una persona sola per tutto il
              tavolo. */}
          <div className="col-start-3 row-start-1 flex items-baseline gap-3">
            <span className="flex self-center">
              <LeadIcon muted={!shownLeader} />
            </span>
            {/* Troncato: il nome di una squadra lo scrive chi crea la lega e puo'
                essere lungo quanto vuole. Senza un limite, le letture si
                allargavano fino a spingere i bottoni a capo — un salto del
                blocco dei rilanci deciso da quanto e' lungo il nome di chi ha
                appena rilanciato. I puntini sono solo visivi: nell'albero di
                accessibilita' il nome resta intero. */}
            <span
              data-testid="bidder-leader"
              className={`w-exp max-w-[14rem] truncate text-3xl font-extrabold leading-none ${
                shownLeader ? '' : 'text-muted-foreground'
              }`}
            >
              {shownLeader ?? 'Nessuno'}
            </span>
          </div>

          <span className="col-start-1 row-start-2 mt-2 text-sm text-muted-foreground">
            {secondsLeft === 1 ? 'secondo' : 'secondi'}
          </span>
          <span className="col-start-2 row-start-2 mt-2 text-sm text-muted-foreground">offerta</span>
          <span className="col-start-3 row-start-2 mt-2 text-sm text-muted-foreground">in testa</span>

          {/* aria-hidden: e' il numero sopra a portare il dato. Una barra che si
              svuota dieci volte al secondo, annunciata, sarebbe rumore. */}
          <div
            aria-hidden
            className="col-start-1 row-start-3 mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line"
          >
            <div
              data-testid="bidder-remaining-bar"
              className={`h-full rounded-full ${urgent ? 'bg-destructive' : 'bg-accent'}`}
              style={{ width: `${fraction * 100}%` }}
            />
          </div>
        </div>

        {/* I rilanci a portata di clic: la barra spaziatrice resta il gesto per
            chi guarda il tavolo, ma alza di uno alla volta — e a un'asta si
            rilancia anche di cinque o dieci. Bersagli grandi apposta: si
            colpiscono di fretta, guardando il tavolo e non lo schermo. Ogni
            rilancio fa ripartire il conto, esattamente come lo spazio. */}
        {expired ? null : (
          // Il rilancio di uno in cima, a tutta larghezza: e' il gesto piu'
          // frequente della serata e va colpito senza mirare, quindi prende
          // l'intera riga invece di contendersela con gli altri. Sotto, i due
          // salti fissi e il prezzo gridato — varianti dello stesso gesto, e si
          // leggono di riflesso.
          //
          // max-w: sugli schermi larghi la zona controlli riempiva tutto lo
          // spazio avanzato e la barra arrivava a ~740px — un bersaglio molto
          // piu' largo del necessario, e con lei il campo dell'offerta diretta
          // che le sta sotto. Un terzo in meno. Il minimo resta: sotto quella
          // soglia i quattro controlli della riga inferiore non ci starebbero
          // piu' affiancati.
          //
          // ml-auto: il blocco si appoggia al bordo destro del riquadro, non
          // resta appiccicato alle letture. Lo spazio avanzato finisce in mezzo,
          // e le due zone — cio' che si legge e cio' che si tocca — si separano
          // davvero. Quando la riga va a capo il blocco riempie la sua linea da
          // solo: senza spazio libero da assorbire, il margine automatico non fa
          // nulla e i controlli restano a sinistra, dove devono stare.
          //
          // Larghezza FISSA, non flex-1: i bersagli non devono spostarsi di un
          // pixel mentre si rilancia. Con una larghezza elastica il blocco
          // dipendeva dalle letture a sinistra, e quelle cambiano larghezza da
          // sole — basta che «Nessuno» diventi il nome di chi ha appena
          // rilanciato perche' i bottoni scivolino di lato proprio nel momento
          // in cui si sta per colpirli. max-w-full lo tiene dentro il riquadro
          // sugli schermi stretti, dove va a capo per conto suo.
          <div className="ml-auto flex w-[31rem] max-w-full flex-none flex-col gap-3">
            <button
              type="button"
              onClick={() => raiseTo((p) => p + PRIMARY_RAISE)}
              className={`tnum w-full ${BID_CONTROL_H} ${BID_RADIUS} bg-accent text-2xl font-extrabold text-on-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground`}
            >
              Rilancia +{PRIMARY_RAISE}
              <span className="sr-only"> crediti</span>
            </button>

            <div className="flex flex-wrap items-center gap-3">
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

              {/* Al tavolo non si rilancia solo di uno, cinque o dieci: si grida
                  un prezzo. Questo campo e' quel gesto — porta l'offerta al numero
                  scritto, non ci somma nulla, ed e' il motivo per cui il bottone
                  dice «Offri» e non «Rilancia». */}
              <form
                className="flex min-w-0 flex-1 items-center gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const wanted = Number(customBid);
                  if (!Number.isInteger(wanted) || wanted < 1) return;
                  raiseTo(() => wanted);
                  setCustomBid('');
                }}
              >
                {/* L'etichetta sta DENTRO il campo e sparisce appena si scrive.
                    Fuori occupava larghezza in una riga che ne ha poca, e sopra
                    alzava la scatola disallineando il gruppo dai bottoni.
                    Resta comunque un'etichetta vera, solo non visibile: un
                    segnaposto non e' un nome accessibile — sparendo mentre si
                    digita lascerebbe il campo muto proprio a chi non lo vede. */}
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
          </div>
        )}
      </div>

      {/* La riga di riferimento: gli stessi numeri della scheda di decisione,
          alla dimensione che meritano mentre si rilancia — si consultano, non
          si guardano. */}
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm text-muted-foreground">
        <dl className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <div className="flex gap-2">
            <dt>tetto</dt>
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
      </div>

      {overCeiling ? (
        // Statico, non una live region: la pagina ne ha una sola (AuctionAnnouncer)
        // e una seconda competerebbe con quella. Il colore del bordo e del testo
        // e' il segnale per chi vede; questa frase, incontrata leggendo il
        // dialogo, e' lo stesso segnale per chi ascolta.
        <p className="text-sm font-bold text-destructive">
          Sei oltre il tuo tetto di {price - valuation.maxBid}.
          <span className="sr-only"> Questa offerta supera il prezzo massimo consigliato.</span>
        </p>
      ) : null}

      {error ? (
        // role="alert", non un secondo role="status": stessa disciplina
        // dell'avviso di scadenza qui sotto e dell'errore in BidPanel — un
        // controllo puntuale, non l'unica live region ambientale dell'app
        // (che resta AuctionAnnouncer). Senza questo, un'aggiudicazione
        // fallita qui (a differenza di BidPanel) non avrebbe alcun modo di
        // arrivare a chi ascolta: il form resta in vista, il countdown e'
        // gia' scaduto, e nulla direbbe che l'invio non e' riuscito.
        <p role="alert" className="text-sm font-bold text-destructive">
          {error}
        </p>
      ) : null}

      {expired ? (
        <>
          {/* role="alert", non un secondo role="status": l'unica live region
              ambientale dell'app resta AuctionAnnouncer. Questa e' puntuale
              e legata a questo controllo — allo scadere il form Aggiudica
              compare ed e' ovvio a chi vede; senza questa riga chi ascolta
              (col beep disattivato, che e' un'opzione del chiamante) non
              saprebbe che il countdown e' finito e si puo' aggiudicare. */}
          <p role="alert" className="text-base font-bold">
            Tempo scaduto: puoi aggiudicare.
          </p>
          {/* Allo scadere questa e' l'unica cosa da fare in pagina, e ne ha la
              taglia: il menu e i due bottoni sono alti quanto i rilanci che
              hanno appena lasciato il posto, non piu' un form da modulo
              stretto in un angolo. */}
          {/* Stessa riga, stesse misure dei rilanci che hanno appena lasciato
              il posto: etichetta accanto e non sopra, e i tre controlli tutti
              alla stessa altezza. Prima il menu portava l'etichetta in cima e
              sporgeva sopra i due bottoni. */}
          <form
            className="mt-3 flex flex-wrap items-center gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              onAssign({ participantId, price });
            }}
          >
            <label htmlFor={buyerId} className="text-sm text-muted-foreground">
              Aggiudica a
            </label>
            <select
              id={buyerId}
              value={participantId}
              onChange={(e) => setParticipantId(e.target.value)}
              className={`${BID_CONTROL_H} ${BID_RADIUS} border border-line-strong bg-transparent px-4 text-lg font-bold text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent`}
            >
              {participants.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={disabled || pending}
              aria-describedby={disabledReason ? hintId : undefined}
              className={`${BID_CONTROL_H} ${BID_RADIUS} bg-accent px-8 text-lg font-extrabold text-on-accent transition-opacity duration-200 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground`}
            >
              {pending ? 'Aggiudico…' : 'Aggiudica'}
            </button>
            {/* La via di ritorno: il tempo e' scaduto ma qualcuno al tavolo
                rilancia lo stesso, e senza questo bottone l'unico modo di
                riaprire le offerte era chiudere il battitore e riaprirlo,
                perdendo il prezzo a cui si era arrivati. Riparte da li', non
                da uno. type="button": sta dentro il form ma non lo invia. */}
            <button
              type="button"
              onClick={() => { setExpired(false); countdown.start(); }}
              className={`inline-flex ${BID_CONTROL_H} ${BID_RADIUS} items-center gap-2 border border-line-strong px-6 text-lg font-bold hover:bg-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent`}
            >
              <ReopenIcon />
              Riprendi le offerte
            </button>
            {disabledReason ? (
              // Statico, non una live region: l'unica di quel tipo nella pagina
              // resta AuctionAnnouncer.
              <span id={hintId} className="sr-only">
                {disabledReason}
              </span>
            ) : null}
          </form>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Barra spaziatrice per rilanciare. Allo scadere si aggiudica.
        </p>
      )}
      </div>
    </section>
  );
}
