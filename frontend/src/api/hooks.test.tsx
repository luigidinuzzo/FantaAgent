import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setAuctionContext } from './client';
import { useAssign, useAuctionState } from './hooks';

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

    result.current.mutate({ playerId: 'd1', participantId: 'anna', price: 47 });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const first = JSON.parse(fetchMock.mock.calls[0][1].body).requestId;

    result.current.mutate({ playerId: 'd2', participantId: 'anna', price: 12 });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const second = JSON.parse(fetchMock.mock.calls[1][1].body).requestId;

    expect(first).toBeTruthy();
    expect(second).not.toBe(first);
  });
});
