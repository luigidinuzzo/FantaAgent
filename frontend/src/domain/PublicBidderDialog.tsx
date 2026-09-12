import type { PublicBidderResponse } from '../api/types';
import type { BidBroadcast } from './bidChannel';
import { RoleBadge } from './RoleBadge';

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
 * nome, squadra e ruolo arrivano dal server perche' sono dati di dominio e il
 * browser non e' la loro fonte.
 *
 * <p>Tipografia sovradimensionata apposta: questa scheda vive su un proiettore,
 * letta da lontano, non su uno schermo che si tiene in mano.
 */
export function PublicBidderDialog({
  bid,
  player,
}: {
  bid: Bidding;
  player: PublicBidderResponse | undefined;
}) {
  return (
    <section aria-labelledby="public-bidder-name" className="rounded-xl border border-line-strong p-10">
      <header className="flex flex-wrap items-center gap-6">
        {/* scale-150: RoleBadge resta la pillola compatta usata ovunque nel
            resto dell'app (contrasto verificato a quella taglia in
            contrast.test.ts); qui la si ingrandisce per farsi vedere da
            lontano senza toccare il componente condiviso. */}
        {player ? (
          <span className="inline-block origin-left scale-150">
            <RoleBadge role={player.role} filled />
          </span>
        ) : null}
        <h2 id="public-bidder-name" className="w-exp text-6xl font-extrabold">
          {player?.name ?? '…'}
        </h2>
        <p className="text-3xl text-muted-foreground">{player?.team ?? ''}</p>
      </header>
      <div className="mt-10 flex flex-wrap items-end gap-16">
        <p>
          <span data-testid="public-price" className="tnum w-exp block text-[140px] font-extrabold leading-none text-accent">
            {bid.price}
          </span>
          <span className="mt-2 block text-2xl text-muted-foreground">offerta</span>
        </p>
        <p data-testid="public-clock" className="tnum pb-4 text-8xl font-extrabold">
          {Math.ceil(bid.remainingMs / 1000)}s
        </p>
      </div>
    </section>
  );
}
