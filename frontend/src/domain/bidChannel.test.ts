import { afterEach, describe, expect, it, vi } from 'vitest';
import { setAuctionContext } from '../api/client';
import { publishBid, subscribeBid } from './bidChannel';

describe('bidChannel', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('consegna un messaggio ai sottoscrittori', async () => {
    const seen: unknown[] = [];
    const unsubscribe = subscribeBid((m) => seen.push(m));

    publishBid({ kind: 'idle' });
    await vi.waitFor(() => expect(seen).toHaveLength(1));

    expect(seen[0]).toEqual({ kind: 'idle' });
    unsubscribe();
  });

  it("dopo l'annullamento non consegna piu' niente", async () => {
    const seen: unknown[] = [];
    subscribeBid((m) => seen.push(m))();

    publishBid({ kind: 'idle' });
    await new Promise((r) => setTimeout(r, 20));

    expect(seen).toHaveLength(0);
  });

  it('non esplode dove BroadcastChannel non esiste', () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    expect(() => publishBid({ kind: 'idle' })).not.toThrow();
    expect(() => subscribeBid(() => {})()).not.toThrow();
  });

  // Il canale vero consegna in modo asincrono: si aspetta prima di chiudere, o il
  // caso passerebbe anche con un nome di canale unico per tutte le aste.
  it('ogni asta ha il suo canale', async () => {
    setAuctionContext({ leagueId: 'l1', auctionId: 'a1' });
    const received: unknown[] = [];
    const stop = subscribeBid((m) => received.push(m));
    setAuctionContext({ leagueId: 'l1', auctionId: 'a2' });
    publishBid({ kind: 'idle' });
    await new Promise((r) => setTimeout(r, 20));
    stop();
    expect(received).toEqual([]);
  });

  it("sulla stessa asta il messaggio arriva", async () => {
    setAuctionContext({ leagueId: 'l1', auctionId: 'a1' });
    const received: unknown[] = [];
    const stop = subscribeBid((m) => received.push(m));
    publishBid({ kind: 'idle' });
    await vi.waitFor(() => expect(received).toHaveLength(1));
    stop();
  });
});
