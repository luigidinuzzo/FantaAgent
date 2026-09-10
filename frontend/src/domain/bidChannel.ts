/**
 * Cio' che la schermata privata dice a quella proiettata.
 *
 * <p>Porta solo i fatti che non esistono altrove: quale giocatore e' all'asta, a che
 * prezzo, quanto manca. Nome, squadra e ruolo NON viaggiano qui — quelli sono dati di
 * dominio, e farli attraversare un canale fra finestre significherebbe creare una
 * seconda verita' accanto al server, che e' precisamente cio' che questo progetto
 * vieta. La proiezione li chiede all'endpoint del tabellone, che e' autoritativo.
 *
 * <p>Il tetto NON e' fra questi campi, e non e' una dimenticanza: questo tipo e' il
 * terzo posto in cui la garanzia deve reggere. In Java {@code PublicBidder} non ha il
 * campo, in TypeScript {@code PublicBidderResponse} non ce l'ha, e qui non ce l'ha il
 * messaggio — perche' cio' che si trasmette e' esattamente cio' che l'altra finestra
 * puo' mostrare. Chi aggiunge un campo qui lo sta proiettando sullo schermo che
 * guardano tutti.
 */
export type BidBroadcast =
  | { kind: 'idle' }
  | {
      kind: 'bidding';
      /** Solo l'identificativo: nome, squadra e ruolo li chiede il server. */
      playerId: string;
      price: number;
      remainingMs: number;
    };

const NAME = 'fantaagent-bid';

/**
 * Un canale per chiamata invece di uno condiviso: aprirlo e chiuderlo subito costa
 * niente ed evita di tenere una risorsa viva in una scheda che nessuno guarda.
 */
function channel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  return new BroadcastChannel(NAME);
}

export function publishBid(message: BidBroadcast): void {
  const ch = channel();
  if (!ch) return;
  ch.postMessage(message);
  ch.close();
}

export function subscribeBid(onMessage: (message: BidBroadcast) => void): () => void {
  const ch = channel();
  if (!ch) return () => {};
  const listener = (e: MessageEvent<BidBroadcast>) => onMessage(e.data);
  ch.addEventListener('message', listener);
  return () => {
    ch.removeEventListener('message', listener);
    ch.close();
  };
}
