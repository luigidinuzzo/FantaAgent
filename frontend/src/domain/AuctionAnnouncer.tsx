import type { Role } from '../api/types';
import { ROLE_LABEL } from './PhaseSwitcher';

export interface PurchaseAnnouncement {
  playerName: string;
  buyerName: string;
  price: number;
  myBudgetRemaining: number;
  mySlotsRemaining: number;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

// La regola eufonica riguarda il SUONO iniziale, non il set ASCII a-e-i-o-u:
// "Emile" e "Émile" iniziano con lo stesso suono, ma solo il primo passava il
// vecchio test /^[aeiou]/i, producendo "aggiudicato a Émile" (sbagliato, va
// "ad") ogni volta che il nome comincia con una vocale accentata. La forma NFD
// scompone la lettera accentata in lettera base + segno diacritico separato
// (É -> E + ́); togliendo i segni (categoria Unicode "Mark", qualunque essi
// siano: non li si enumera a mano, o il prossimo segno non previsto romperebbe
// la regola in silenzio) resta la lettera base, su cui la regola ASCII torna
// valida. Non risolve la pronuncia (una H iniziale muta in italiano ma aspirata
// in un nome straniero, es. "Hugo", resta fuori discussione): risolve solo il
// caso della lettera-vocale, incluse le accentate.
function startsWithVowelSound(name: string): boolean {
  const base = name.normalize('NFD').replace(/\p{Mark}/gu, '');
  return /^[aeiou]/i.test(base);
}

export function purchaseMessage(a: PurchaseAnnouncement): string {
  // "ad Anna" ma "a Bruno": l'eufonica va davanti a vocale. Un annuncio letto
  // ad alta voce e' testo parlato, e va scritto come si parla.
  const preposition = startsWithVowelSound(a.buyerName) ? 'ad' : 'a';
  return (
    `${a.playerName} aggiudicato ${preposition} ${a.buyerName} per ` +
    `${plural(a.price, 'credito', 'crediti')}. Ti restano ` +
    `${plural(a.myBudgetRemaining, 'credito', 'crediti')} e ` +
    `${plural(a.mySlotsRemaining, 'slot', 'slot')}.`
  );
}

/**
 * Il cambio fase e l'annullamento (Task 7) tornano alla schermata privata dopo essere
 * stati rimossi come codice morto nelle tappe 1-3: entrambi cambiano visibilmente il
 * tabellone, ma senza una frase qui chi ascolta non avrebbe modo di saperlo — il
 * bottone si limiterebbe a riattivarsi.
 */
export function phaseChangedMessage(role: Role): string {
  return `Fase cambiata: ora si contendono i ${ROLE_LABEL[role]}.`;
}

export function undoMessage(): string {
  return "L'ultimo acquisto e' stato annullato.";
}

/**
 * L'unica live region della schermata d'asta.
 *
 * <p>Una aggiudicazione cambia budget, slot, composizione della rosa e
 * disponibilita' del giocatore nello stesso istante. Annunciarli separatamente
 * darebbe quattro frasi in competizione, di cui nessuna comprensibile; un
 * badge che annuncia il numero nudo "265" e' anche peggio. Qui esce una frase
 * sola, e completa.
 */
export function AuctionAnnouncer({ message }: { message: string | null }) {
  return (
    <p role="status" aria-atomic="true" className="sr-only">
      {message ?? ''}
    </p>
  );
}
