import { useEffect, useState } from 'react';
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
export function BidderDialog({
  valuation,
  participants,
  timerSeconds,
  beepEnabled,
  error,
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
  onAssign: (input: { participantId: string; price: number }) => void;
  onClose: () => void;
}) {
  const [price, setPrice] = useState(1);
  const [expired, setExpired] = useState(false);
  const [participantId, setParticipantId] = useState(
    participants.find((p) => p.me)?.id ?? participants[0]?.id ?? '',
  );
  const countdown = useBidCountdown({
    seconds: timerSeconds,
    beepEnabled,
    onExpire: () => setExpired(true),
  });

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
      totalMs: timerSeconds * 1000,
    });
  }, [valuation.playerId, price, timerSeconds, countdown.remaining]);

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
              className="min-h-11 bg-accent px-5 font-bold text-on-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground"
            >
              Aggiudica
            </button>
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
