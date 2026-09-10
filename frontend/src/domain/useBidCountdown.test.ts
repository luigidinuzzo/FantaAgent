import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBidCountdown } from './useBidCountdown';

describe('useBidCountdown', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('parte fermo, sul valore pieno', () => {
    const { result } = renderHook(() =>
      useBidCountdown({ seconds: 5, beepEnabled: false, onExpire: () => {} }),
    );
    expect(result.current.running).toBe(false);
    expect(result.current.remaining).toBe(5000);
  });

  it('scende col tempo reale, non col numero di tick', () => {
    const { result } = renderHook(() =>
      useBidCountdown({ seconds: 5, beepEnabled: false, onExpire: () => {} }),
    );
    act(() => result.current.start());
    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.remaining).toBe(3000);
  });

  it('chiama onExpire una volta sola allo scadere', () => {
    const onExpire = vi.fn();
    const { result } = renderHook(() =>
      useBidCountdown({ seconds: 1, beepEnabled: false, onExpire }),
    );
    act(() => result.current.start());
    act(() => { vi.advanceTimersByTime(3000); });
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(result.current.remaining).toBe(0);
    expect(result.current.running).toBe(false);
  });

});
