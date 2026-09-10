import { useEffect, useId, useState } from 'react';
import type { ParticipantView, ValuationResponse } from '../api/types';
import { publishBid } from './bidChannel';
import { useBidCountdown } from './useBidCountdown';

/**
 * Vero per il bottone Chiudi, per il select "Aggiudica a" e per qualunque
 * altro controllo che usa la barra spaziatrice per attivarsi da solo — uno
 * spazio con il focus li' sopra e' un tentativo di usare QUEL controllo, non
 * il gesto del rilancio.
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

export function BidderDialog({
  valuation,
  participants,
  timerSeconds,
  beepEnabled,
  error,
  disabled = false,
  pending = false,
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
  onAssign: (input: { participantId: string; price: number }) => void;
  onClose: () => void;
}) {
  const [price, setPrice] = useState(1);
  const [expired, setExpired] = useState(false);
  const [participantId, setParticipantId] = useState(
    participants.find((p) => p.me)?.id ?? participants[0]?.id ?? '',
  );
  const hintId = useId();
  const countdown = useBidCountdown({
    seconds: timerSeconds,
    beepEnabled,
    onExpire: () => setExpired(true),
  });

  // Stessa disciplina di BidPanel: un bottone disabilitato e' annunciato
  // come "non disponibile" e basta, chi ascolta non deduce il perche' dal
  // bordo della scheda o dalla testata. Le due ragioni non sono la stessa
  // situazione: l'attesa si scioglie da sola, lo stantio no.
  const disabledReason = pending
    ? 'Invio in corso: attendi la conferma del server.'
    : disabled
      ? 'Aggiudica non disponibile: i valori mostrati non sono aggiornati.'
      : null;

  const overCeiling = valuation.maxBid > 0 && price > valuation.maxBid;

  // La barra spaziatrice e' il gesto: si rilancia guardando il tavolo, non la tastiera.
  useEffect(() => {
    if (expired) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== ' ' && e.code !== 'Space') return;
      // Chi ha tabulato fino a Chiudi e preme spazio vuole chiudere, non
      // rilanciare: e' il modo normale del browser di attivare un bottone
      // focalizzato. Senza questo controllo lo spazio veniva intercettato
      // qui prima di arrivare al bottone, e la richiesta di chiudere si
      // trasformava in un rilancio.
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      setPrice((p) => p + 1);
      countdown.start();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expired, countdown]);

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

  return (
    <section
      data-testid="bidder-dialog"
      data-over-ceiling={overCeiling}
      aria-labelledby="bidder-name"
      className={`border p-5 ${overCeiling ? 'border-destructive' : 'border-line-strong'}`}
    >
      <header className="flex items-baseline gap-3">
        <h2 id="bidder-name" className="w-exp text-xl font-extrabold">{valuation.name}</h2>
        <p className="text-sm text-muted-foreground">{valuation.team}</p>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto min-h-11 px-3 text-sm text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          Chiudi
        </button>
      </header>

      <div className="mt-4 flex flex-wrap items-end gap-8">
        <p>
          <span data-testid="bidder-price" className="tnum w-exp block text-[64px] font-extrabold leading-none">
            {price}
          </span>
          <span className="mt-1 block text-sm text-muted-foreground">offerta</span>
        </p>
        <p>
          <span data-testid="bidder-ceiling" className="tnum w-exp block text-2xl font-bold text-accent">
            {valuation.maxBid}
          </span>
          <span className="mt-1 block text-sm text-muted-foreground">il tuo tetto</span>
        </p>
        <p className="tnum pb-2 text-2xl text-muted-foreground">
          {Math.ceil(countdown.remaining / 1000)}s
        </p>
      </div>

      {overCeiling ? (
        // Statico, non una live region: la pagina ne ha una sola (AuctionAnnouncer)
        // e una seconda competerebbe con quella. Il colore del bordo e del testo
        // e' il segnale per chi vede; questa frase, incontrata leggendo il
        // dialogo, e' lo stesso segnale per chi ascolta.
        <p className="mt-3 text-sm font-bold text-destructive">
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
        <p role="alert" className="mt-3 text-sm font-bold text-destructive">
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
          <p role="alert" className="mt-5 text-sm font-bold">
            Tempo scaduto: puoi aggiudicare.
          </p>
          <form
            className="mt-3 flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              onAssign({ participantId, price });
            }}
          >
            <label className="text-sm text-muted-foreground">
              Aggiudica a
              <select
                value={participantId}
                onChange={(e) => setParticipantId(e.target.value)}
                className="mt-1 block min-h-11 border border-line bg-transparent px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={disabled || pending}
              aria-describedby={disabledReason ? hintId : undefined}
              className="min-h-11 bg-accent px-5 font-bold text-on-accent transition-opacity duration-200 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground"
            >
              {pending ? 'Aggiudico…' : 'Aggiudica'}
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
        <p className="mt-5 text-sm text-muted-foreground">
          Barra spaziatrice per rilanciare. Allo scadere si aggiudica.
        </p>
      )}
    </section>
  );
}
