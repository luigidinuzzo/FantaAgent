import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BidBroadcast } from '../domain/bidChannel';
import { subscribeBid } from '../domain/bidChannel';
import { HEARTBEAT_INTERVAL_MS, useIdleHeartbeat } from './useIdleHeartbeat';

// setImmediate finto ma smaltito da vi.useFakeTimers({ shouldAdvanceTime:
// true }), stesso meccanismo usato in BidderDialog.test.tsx per far arrivare
// i messaggi del BroadcastChannel sotto orologio finto.
function flushChannel() {
  return new Promise<void>((resolve) => setImmediate(resolve));
}

describe('useIdleHeartbeat', () => {
  afterEach(() => vi.useRealTimers());

  it('pubblica un battito subito al montaggio, senza aspettare il primo intervallo', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const seen: BidBroadcast[] = [];
    const unsubscribe = subscribeBid((m) => seen.push(m));

    renderHook(() => useIdleHeartbeat(false));
    await flushChannel();

    expect(seen.some((m) => m.kind === 'idle')).toBe(true);
    unsubscribe();
  });

  it('resta muto mentre suppress e vero', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const seen: BidBroadcast[] = [];
    const unsubscribe = subscribeBid((m) => seen.push(m));

    renderHook(() => useIdleHeartbeat(true));
    await flushChannel();

    expect(seen).toHaveLength(0);
    unsubscribe();
  });

  it('continua a battere sull intervallo dopo il primo battito', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const seen: BidBroadcast[] = [];
    const unsubscribe = subscribeBid((m) => seen.push(m));

    renderHook(() => useIdleHeartbeat(false));
    await flushChannel();
    const afterMount = seen.length;

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
    await flushChannel();

    expect(seen.length).toBeGreaterThan(afterMount);
    unsubscribe();
  });

  it('riprende a battere subito quando suppress torna falso, senza aspettare un intervallo intero', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const seen: BidBroadcast[] = [];
    const unsubscribe = subscribeBid((m) => seen.push(m));

    const { rerender } = renderHook(({ suppress }) => useIdleHeartbeat(suppress), {
      initialProps: { suppress: true },
    });
    await flushChannel();
    expect(seen).toHaveLength(0);

    rerender({ suppress: false });
    await flushChannel();

    expect(seen.some((m) => m.kind === 'idle')).toBe(true);
    unsubscribe();
  });
});
