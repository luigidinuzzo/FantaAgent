import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlayerSearch } from './usePlayerSearch';

const calls: string[] = [];
let resolvers: Array<(rows: unknown[]) => void> = [];

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  calls.length = 0;
  resolvers = [];
  vi.stubGlobal('fetch', (input: string) => {
    calls.push(input);
    return new Promise((resolve) => {
      resolvers.push((rows) =>
        resolve(new Response(JSON.stringify(rows), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })));
    });
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('usePlayerSearch', () => {
  it('non interroga il server finche la digitazione non si ferma', async () => {
    const { rerender } = renderHook(({ q }) => usePlayerSearch(q, null), {
      wrapper,
      initialProps: { q: 'm' },
    });
    rerender({ q: 'ma' });
    rerender({ q: 'mar' });

    // Prima che l'attesa scada: nessuna richiesta. Tre tasti in rapida
    // successione sono una richiesta, non tre.
    expect(calls).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(300);
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toContain('q=mar');
  });

  /**
   * La rete consegna la risposta di "mar" DOPO quella di "martinez". Mostrare "mar"
   * significherebbe sostituire il risultato giusto con uno vecchio, e chi cerca
   * vedrebbe l'elenco tornare indietro sotto le dita.
   *
   * La guardia non e' scritta a mano: la chiave di query CONTIENE la domanda, quindi
   * una risposta per "mar" non puo' finire nella casella di "martinez". Questo test
   * esiste per impedire che una rifattorizzazione futura tolga la domanda dalla
   * chiave — il momento in cui la guardia sparirebbe senza che nulla diventi rosso.
   */
  it('scarta una risposta arrivata dopo una richiesta piu recente', async () => {
    const { result, rerender } = renderHook(({ q }) => usePlayerSearch(q, null), {
      wrapper,
      initialProps: { q: 'mar' },
    });
    await vi.advanceTimersByTimeAsync(300);
    await waitFor(() => expect(calls).toHaveLength(1));

    rerender({ q: 'martinez' });
    await vi.advanceTimersByTimeAsync(300);
    await waitFor(() => expect(calls).toHaveLength(2));

    // Prima la seconda risposta, poi — in ritardo — la prima.
    resolvers[1]([{ id: 'a1', name: 'Martinez', team: 'Inter', role: 'A', listPrice: 30 }]);
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    resolvers[0]([{ id: 'x9', name: 'Mario', team: 'Roma', role: 'C', listPrice: 5 }]);
    await vi.advanceTimersByTimeAsync(50);

    expect(result.current.data?.[0]?.name).toBe('Martinez');
  });

  it('con query vuota non interroga affatto', async () => {
    renderHook(() => usePlayerSearch('   ', null), { wrapper });
    await vi.advanceTimersByTimeAsync(300);

    // Il server risponde con un elenco vuoto per una query in bianco: chiederglielo
    // sarebbe una richiesta di rete per un risultato gia' noto.
    expect(calls).toHaveLength(0);
  });
});
