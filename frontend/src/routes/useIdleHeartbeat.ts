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
 * <p>`suppress` va passato true per l'INTERA durata in cui {@code BidderDialog} e'
 * montato, non solo mentre il countdown corre: quel dialogo pubblica da conto suo per
 * tutto il tempo che resta aperto — 'bidding' dieci volte al secondo mentre il
 * countdown corre, poi lo stesso lotto congelato a un ritmo piu' basso dopo la scadenza
 * (si veda {@code POST_EXPIRY_REPUBLISH_MS} in BidderDialog) — e pubblica 'idle' da
 * solo al proprio smontaggio. Sospendere qui SOLO durante il countdown e riprendere a
 * "aperto ma scaduto" sembrerebbe innocuo ma non lo e': questo battito parla solo in
 * 'idle', e 'idle' mentre un lotto e' ancora in attesa di aggiudicazione farebbe
 * sparire il prezzo dalla proiezione nell'istante esatto in cui la sala lo guarda per
 * scegliere l'acquirente — un falso "nessun lotto aperto" al posto del falso allarme di
 * disconnessione che questo fix voleva togliere. 'idle' deve restare univoco: "nessun
 * lotto e' aperto", non "il countdown si e' fermato".
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
