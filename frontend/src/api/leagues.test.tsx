import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LEAGUE_KEYS, useCreateAuction, useRenameLeague, useSaveSeats } from './leagues';

function setup(body: unknown) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(LEAGUE_KEYS.all, []);
  client.setQueryData(LEAGUE_KEYS.myAuctions, []);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), {
    status: 200, headers: { 'content-type': 'application/json' },
  })));
  const wrapper = ({ children }: { children: ReactNode }) =>
    <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const stale = (key: readonly unknown[]) => client.getQueryState(key)?.isInvalidated;
  return { wrapper, stale };
}

describe('mutazioni delle leghe: cosa rileggono', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('rinominare la lega rilegge anche le tue aste, che ne mostrano il nome', async () => {
    const { wrapper, stale } = setup({ id: 'l1', name: 'Nuovo' });
    const { result } = renderHook(() => useRenameLeague('l1'), { wrapper });
    result.current.mutate('Nuovo');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(stale(LEAGUE_KEYS.myAuctions)).toBe(true);
    expect(stale(LEAGUE_KEYS.all)).toBe(true);
  });

  it('salvare i posti rilegge anche le tue aste', async () => {
    const { wrapper, stale } = setup({ seats: [] });
    const { result } = renderHook(() => useSaveSeats('l1', 'a1'), { wrapper });
    result.current.mutate([]);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(stale(LEAGUE_KEYS.myAuctions)).toBe(true);
  });

  it("creare un'asta rilegge anche l'elenco delle leghe", async () => {
    const { wrapper, stale } = setup({ id: 'a2', name: 'Riparazione' });
    const { result } = renderHook(() => useCreateAuction('l1'), { wrapper });
    result.current.mutate('Riparazione');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(stale(LEAGUE_KEYS.all)).toBe(true);
    expect(stale(LEAGUE_KEYS.myAuctions)).toBe(true);
  });
});
