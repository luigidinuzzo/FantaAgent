import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BidBroadcast } from '../domain/bidChannel';
import { subscribeBid } from '../domain/bidChannel';
import { HEARTBEAT_INTERVAL_MS, useIdleHeartbeat } from './useIdleHeartbeat';

/**
 * Revisione finale, finding H: questo file era instabile (~1 volta su 290 in
 * tutta la suite, mai in isolamento) con la versione precedente, che aspettava
 * la consegna del BroadcastChannel con un {@code setImmediate} FINTO — sostituito
 * da {@code vi.useFakeTimers}, quindi smaltito non da un vero giro del loop degli
 * eventi ma da un intervallo REALE separato che {@code shouldAdvanceTime}
 * installa in background per far avanzare l'orologio finto. Sono due orologi
 * indipendenti (quello del BroadcastChannel, reale e non governato da vitest;
 * quello del flush, finto ma smaltito da un poll reale a cadenza propria):
 * quando la macchina e' sotto carico (l'intera suite, non un file isolato) il
 * poll di background puo' smaltire l'immediate finto prima che la consegna
 * reale del messaggio sia arrivata, e l'assert legge un array ancora vuoto.
 * Non e' un timer finto scelto male ne' un intervallo reale che si potesse
 * "aumentare": e' una corsa fra un timer controllato e uno che questo progetto
 * non controlla (la consegna nativa del BroadcastChannel).
 *
 * <p>Il fix non alza nessuna soglia: usa il VERO {@code setTimeout}, catturato
 * qui PRIMA che {@code vi.useFakeTimers} sostituisca il riferimento globale, e
 * aspetta a ripetizione (non una volta sola) finche' la condizione non e'
 * osservata o un tetto largo scade — lo stesso idioma di {@code waitFor}, senza
 * introdurre quella dipendenza. Un giro reale del loop degli eventi lascia
 * correre la consegna nativa insieme a tutto il resto che il sistema sta
 * facendo, invece di scommettere sulla cadenza di un poll di background.
 */
const realSetTimeout = globalThis.setTimeout.bind(globalThis);

function realTick(): Promise<void> {
  return new Promise((resolve) => { realSetTimeout(resolve, 0); });
}

/**
 * Aspetta che `predicate` sia vera su `seen`, con tick REALI (non governati
 * dall'orologio finto) fra un controllo e l'altro. 40 tentativi sono un tetto
 * di sicurezza contro un blocco vero, non una soglia tarata per far passare
 * questo test: la consegna osservata richiede quasi sempre un solo tick,
 * raramente un paio.
 */
async function waitForBroadcast(
  seen: BidBroadcast[],
  predicate: (messages: BidBroadcast[]) => boolean,
  attempts = 40,
): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (predicate(seen)) return;
    await realTick();
  }
}

describe('useIdleHeartbeat', () => {
  afterEach(() => vi.useRealTimers());

  it('pubblica un battito subito al montaggio, senza aspettare il primo intervallo', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const seen: BidBroadcast[] = [];
    const unsubscribe = subscribeBid((m) => seen.push(m));

    renderHook(() => useIdleHeartbeat(false));
    await waitForBroadcast(seen, (m) => m.some((x) => x.kind === 'idle'));

    expect(seen.some((m) => m.kind === 'idle')).toBe(true);
    unsubscribe();
  });

  it('resta muto mentre suppress e vero', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const seen: BidBroadcast[] = [];
    const unsubscribe = subscribeBid((m) => seen.push(m));

    // Nessuna corsa da vincere qui: con suppress=true useIdleHeartbeat non
    // chiama mai publishBid (vedi il suo `if (suppress) return;`), quindi non
    // c'e' nessuna consegna reale in volo da aspettare. Un paio di tick reali
    // bastano a dare a un'eventuale (erronea) pubblicazione la possibilita' di
    // arrivare, prima di affermarne l'assenza.
    renderHook(() => useIdleHeartbeat(true));
    await realTick();
    await realTick();

    expect(seen).toHaveLength(0);
    unsubscribe();
  });

  it('continua a battere sull intervallo dopo il primo battito', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const seen: BidBroadcast[] = [];
    const unsubscribe = subscribeBid((m) => seen.push(m));

    renderHook(() => useIdleHeartbeat(false));
    await waitForBroadcast(seen, (m) => m.some((x) => x.kind === 'idle'));
    const afterMount = seen.length;

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
    await waitForBroadcast(seen, (m) => m.length > afterMount);

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
    // Stessa assenza di corsa del test "resta muto" sopra: suppress=true non
    // pubblica niente, quindi niente da aspettare prima di questo assert.
    await realTick();
    expect(seen).toHaveLength(0);

    rerender({ suppress: false });
    await waitForBroadcast(seen, (m) => m.some((x) => x.kind === 'idle'));

    expect(seen.some((m) => m.kind === 'idle')).toBe(true);
    unsubscribe();
  });
});
