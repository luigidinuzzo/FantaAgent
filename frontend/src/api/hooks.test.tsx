import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setAuctionContext } from './client';
import { useAssign, useAuctionState, useChangePhase, useUndoLast } from './hooks';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const STATE = {
  auctionId: 'a1',
  auctionName: 'Prova',
  currentPhase: 'D',
  phases: ['P', 'D', 'C', 'A'],
  soldInPhase: 1,
  myParticipantId: 'anna',
  canUndo: true,
  participants: [],
};

describe('hook', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('useAuctionState legge lo stato', async () => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(STATE), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    const { result } = renderHook(() => useAuctionState(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.currentPhase).toBe('D');
  });

  it('useAssign genera una chiave di idempotenza diversa per ogni invio', async () => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ seq: 1, playerId: 'd1', participantId: 'anna', price: 47 }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAssign(), { wrapper });

    result.current.mutate({ playerId: 'd1', playerName: 'Uno', participantId: 'anna', price: 47 });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const first = JSON.parse(fetchMock.mock.calls[0][1].body).requestId;

    result.current.mutate({ playerId: 'd2', playerName: 'Due', participantId: 'anna', price: 12 });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const second = JSON.parse(fetchMock.mock.calls[1][1].body).requestId;

    expect(first).toBeTruthy();
    expect(second).not.toBe(first);

    // playerName sta nell'input della mutazione per chi annuncia l'esito, non
    // per il server: l'API vuole identificativi, e spedirle un campo che non
    // conosce significa farle ricevere un corpo che non ha mai promesso di
    // accettare.
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty('playerName');
  });

  it('useAssign non scrive in cache prima della conferma del server (nessun optimistic update)', async () => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });

    // Client locale, non quello di `wrapper`: serve poterlo interrogare
    // direttamente per vedere cosa c'e' in cache mentre la mutazione e' in volo.
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    client.setQueryData(['state'], STATE);

    function localWrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }

    // Una promise che risolviamo a mano: serve una vera finestra di attesa da
    // osservare, non un mock che risolve subito e non lascia nulla da vedere.
    let resolveFetch!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(pending);
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAssign(), { wrapper: localWrapper });

    result.current.mutate({ playerId: 'd1', playerName: 'Uno', participantId: 'anna', price: 47 });
    await waitFor(() => expect(result.current.isPending).toBe(true));

    // Il fetch e' ancora appeso: se ci fosse un optimistic update, la cache
    // sarebbe gia' cambiata qui, prima che il server abbia confermato nulla.
    expect(client.getQueryData(['state'])).toEqual(STATE);

    await act(async () => {
      resolveFetch(
        new Response(
          JSON.stringify({ seq: 2, playerId: 'd1', participantId: 'anna', price: 47 }),
          { status: 201, headers: { 'content-type': 'application/json' } },
        ),
      );
      await pending;
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // Solo dopo la conferma: invalidateQueries segna la query da rileggere.
    expect(client.getQueryState(['state'])?.isInvalidated).toBe(true);
  });

  it('useChangePhase invia il ruolo scelto a /phase', async () => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useChangePhase(), { wrapper });
    result.current.mutate('C');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [calledUrl, init] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).toContain('/phase');
    expect(JSON.parse(init.body)).toEqual({ role: 'C' });
  });

  it('useUndoLast invia una richiesta senza corpo a /purchases/void-last', async () => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useUndoLast(), { wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [calledUrl] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).toContain('/purchases/void-last');
  });
});
