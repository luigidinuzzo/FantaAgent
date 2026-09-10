import { afterEach, describe, expect, it, vi } from 'vitest';
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
});
