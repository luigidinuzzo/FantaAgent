import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Il countdown del rilancio, e nient'altro.
 *
 * <p>Non sa niente di valutazioni ed e' deliberato: e' l'unica cosa che i due dialoghi
 * — quello privato col tetto e quello proiettato senza — possono condividere senza che
 * un dato riservato attraversi il confine. Condividere il comportamento e' sicuro;
 * condividere i dati no.
 */
export interface BidCountdown {
  /** Millisecondi rimasti, arrotondati ai 100 ms del tick. */
  remaining: number;
  running: boolean;
  /** Azzera e avvia. */
  start: () => void;
  /** Ferma senza far scadere. */
  stop: () => void;
  /** Riporta al valore pieno lasciando il countdown in corsa: e' un rilancio. */
  reset: () => void;
}

export function useBidCountdown({
  seconds,
  beepEnabled,
  onExpire,
}: {
  seconds: number;
  beepEnabled: boolean;
  onExpire: () => void;
}): BidCountdown {
  const total = seconds * 1000;
  const [remaining, setRemaining] = useState(total);
  const [running, setRunning] = useState(false);
  const deadline = useRef<number>(0);
  // onExpire viene da chi ci usa e cambia identita' a ogni render: tenerlo in un ref
  // evita che l'intervallo si ricrei di continuo, che e' il modo classico di far
  // saltare un tick proprio nell'ultimo secondo.
  const expire = useRef(onExpire);
  useEffect(() => { expire.current = onExpire; }, [onExpire]);

  useEffect(() => {
    if (!running) return;
    // Si legge l'orologio a ogni tick invece di sottrarre 100: setInterval salta e
    // ritarda quando la scheda perde il fuoco, e un countdown che conta i propri tick
    // finisce indietro proprio mentre qualcuno rilancia.
    const id = window.setInterval(() => {
      const left = Math.max(0, deadline.current - Date.now());
      setRemaining(left);
      if (left === 0) {
        // setRunning(false) da solo non basta: non ha effetto fino al prossimo
        // render, e con i timer finti di un test un solo advanceTimersByTime
        // esegue tutti i tick in sospeso senza mai passare da un render. Va
        // fermato l'intervallo qui, nello stesso tick, o onExpire scatterebbe
        // una volta per ogni tick rimasto invece che una sola.
        window.clearInterval(id);
        setRunning(false);
        if (beepEnabled) beep();
        expire.current();
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [running, beepEnabled]);

  const start = useCallback(() => {
    deadline.current = Date.now() + total;
    setRemaining(total);
    setRunning(true);
  }, [total]);

  const stop = useCallback(() => setRunning(false), []);

  const reset = useCallback(() => {
    deadline.current = Date.now() + total;
    setRemaining(total);
  }, [total]);

  return { remaining, running, start, stop, reset };
}

/**
 * Sintetizzato, non caricato: il vincolo "nessuna risorsa esterna a runtime" vale
 * anche per un file audio, e la stanza dell'asta puo' essere senza rete.
 */
function beep(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as {
      webkitAudioContext?: typeof AudioContext;
    }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.1;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
    osc.onended = () => void ctx.close();
  } catch {
    // Un browser che rifiuta l'audio senza un gesto dell'utente non deve fermare il
    // countdown: il numero che scende e' l'informazione, il beep e' un di piu'.
  }
}
