import { useEffect } from 'react';
import { publishBid } from '../domain/bidChannel';

/**
 * Il ritmo del battito di vita fra le due finestre.
 *
 * <p>Non e' derivato da {@code STALE_AFTER_MS} (ConnectionStatus) — quel numero e' il
 * budget di staleness del POLL al server, il triplo dei 5 s con cui la schermata si
 * riaggiorna. Oggi vale 5 s anche per questo battito, ma per coincidenza, non per
 * costruzione: sono due timing indipendenti che condividono un numero solo perche'
 * STALE_AFTER_MS e' definito come il triplo di un poll a 5 s. Se il poll cambiasse
 * (tappa 5), questo battito non deve muoversi con lui in silenzio — per questo ha una
 * costante propria, non una frazione dell'altra.
 */
export const HEARTBEAT_INTERVAL_MS = 5_000;

/**
 * Il battito di vita che questa finestra manda alla proiezione (Task 6) quando non ha
 * niente altro da dire sul canale.
 *
 * <p>Senza un battito, la proiezione non puo' distinguere "non connesso" da "nessun
 * lotto aperto (o un lotto in attesa di aggiudicazione)": in entrambi i casi il canale
 * resterebbe silenzioso, e la proiezione dichiarerebbe di non ricevere anche durante
 * una pausa perfettamente sana.
 *
 * <p>`suppress` va passato true SOLO mentre qualcun altro sta gia' pubblicando
 * abbastanza spesso da conto suo — {@code BidderDialog} pubblica 'bidding' dieci volte
 * al secondo mentre il countdown corre. Non basta che il dialogo sia aperto: quella
 * pubblicazione si ferma nell'istante in cui il countdown scade (i suoi valori si
 * congelano), ma il dialogo resta aperto ben oltre, in attesa che si scelga
 * l'acquirente. Il chiamante deve quindi passare "il dialogo e' aperto E il countdown
 * non e' scaduto", non il solo "il dialogo e' aperto": altrimenti, per tutta la durata
 * dell'aggiudicazione — spesso piu' dei 15 s di soglia, mentre il tavolo discute —
 * nessuno pubblica niente, la proiezione dichiara "non ricevo" e il lotto sparisce
 * dallo schermo condiviso nel momento esatto in cui conta di piu' mostrarlo.
 *
 * <p>Pubblica anche UNA VOLTA subito, non solo sull'intervallo: senza, una proiezione
 * aperta (o riportata da `suppress: true` a `false`) proprio in quell'istante
 * aspetterebbe fino a {@link HEARTBEAT_INTERVAL_MS} prima di sentire qualcosa, e per
 * tutto quel tempo direbbe "non ricevo" senza motivo.
 */
export function useIdleHeartbeat(suppress: boolean): void {
  useEffect(() => {
    if (suppress) return;
    publishBid({ kind: 'idle' });
    const id = setInterval(() => publishBid({ kind: 'idle' }), HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [suppress]);
}
