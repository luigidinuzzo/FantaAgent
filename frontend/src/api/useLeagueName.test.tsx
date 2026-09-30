import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LEAGUE_KEYS, useLeagueName } from './leagues';

function wrapperWith(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useLeagueName', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('legge il nome dalla pagina della lega gia caricata', () => {
    const client = new QueryClient();
    client.setQueryData(LEAGUE_KEYS.one('l1'), { id: 'l1', name: 'Lega del Bar', admin: true, members: [] });
    const { result } = renderHook(() => useLeagueName('l1'), { wrapper: wrapperWith(client) });
    expect(result.current).toBe('Lega del Bar');
  });

  it('ripiega sull elenco delle leghe', () => {
    const client = new QueryClient();
    client.setQueryData(LEAGUE_KEYS.all, [{ id: 'l1', name: 'Lega del Bar' }, { id: 'l2', name: 'Altra' }]);
    const { result } = renderHook(() => useLeagueName('l1'), { wrapper: wrapperWith(client) });
    expect(result.current).toBe('Lega del Bar');
  });

  // Serve al percorso nella barra: un'etichetta non vale una chiamata in piu'.
  it('senza niente in cache non sa il nome, e non lo chiede', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useLeagueName('l1'), { wrapper: wrapperWith(new QueryClient()) });
    expect(result.current).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
