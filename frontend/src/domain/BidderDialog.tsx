import { useEffect, useState } from 'react';
import type { ParticipantView, ValuationResponse } from '../api/types';
import { publishBid } from './bidChannel';
import { useBidCountdown } from './useBidCountdown';

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
  onAssign,
  onClose,
}: {
  valuation: ValuationResponse;
  participants: ParticipantView[];
  timerSeconds: number;
  beepEnabled: boolean;
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
  // Le dipendenze NON includono countdown.remaining, che avanza cento volte al
  // secondo mentre il countdown corre: se lo facessero, ogni tick aprirebbe e
  // chiuderebbe un BroadcastChannel dieci volte al secondo per niente. Un
  // rilancio azzera sempre il countdown (countdown.start() qui sopra), quindi
  // "remaining" e' gia' tornato al pieno nello stesso render in cui "price"
  // cambia: leggerlo nel corpo dell'effetto, senza elencarlo come dipendenza,
  // da' comunque il valore giusto. Il conto alla rovescia visibile sull'altra
  // finestra non viene dai tick di questo canale: viene dallo stesso hook
  // (Task 4) avviato in sincronia, che e' il comportamento condiviso di cui
  // parla il commento di useBidCountdown — i dati non attraversano il
  // confine, il comportamento si'.
  useEffect(() => {
    publishBid({
      kind: 'bidding',
      playerId: valuation.playerId,
      price,
      remainingMs: countdown.remaining,
      totalMs: timerSeconds * 1000,
    });
  }, [valuation.playerId, price, timerSeconds]);

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

      {expired ? (
        <form
          className="mt-5 flex flex-wrap items-end gap-2"
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
      ) : (
        <p className="mt-5 text-sm text-muted-foreground">
          Barra spaziatrice per rilanciare. Allo scadere si aggiudica.
        </p>
      )}
    </section>
  );
}
