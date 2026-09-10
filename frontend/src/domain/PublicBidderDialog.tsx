import type { PublicBidderResponse } from '../api/types';
import type { BidBroadcast } from './bidChannel';

type Bidding = Extract<BidBroadcast, { kind: 'bidding' }>;

/**
 * Il battitore sullo schermo che guardano tutti.
 *
 * <p>Prende due cose, entrambe incapaci di portare un tetto: un {@link BidBroadcast},
 * il cui tipo non ha quel campo, e un {@code PublicBidderResponse}, che viene
 * dall'endpoint sotto la regola ArchUnit. Qui non esiste un posto in cui un prezzo
 * consigliato possa arrivare, nemmeno per un errore di chi scrive il chiamante.
 *
 * <p>Il vivo — prezzo e secondi — arriva dal canale perche' non esiste sul server;
 * nome e squadra arrivano dal server perche' sono dati di dominio e il browser non e'
 * la loro fonte.
 */
export function PublicBidderDialog({
  bid,
  player,
}: {
  bid: Bidding;
  player: PublicBidderResponse | undefined;
}) {
  return (
    <section aria-labelledby="public-bidder-name" className="border border-line-strong p-8">
      <header className="flex items-baseline gap-4">
        <h2 id="public-bidder-name" className="w-exp text-4xl font-extrabold">
          {player?.name ?? '…'}
        </h2>
        <p className="text-xl text-muted-foreground">{player?.team ?? ''}</p>
      </header>
      <div className="mt-6 flex items-end gap-12">
        <p>
          <span data-testid="public-price" className="tnum w-exp block text-[96px] font-extrabold leading-none text-accent">
            {bid.price}
          </span>
          <span className="mt-2 block text-lg text-muted-foreground">offerta</span>
        </p>
        <p data-testid="public-clock" className="tnum pb-3 text-6xl">
          {Math.ceil(bid.remainingMs / 1000)}s
        </p>
      </div>
    </section>
  );
}
