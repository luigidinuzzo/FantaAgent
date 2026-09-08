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

export function purchaseMessage(a: PurchaseAnnouncement): string {
  // "ad Anna" ma "a Bruno": l'eufonica va davanti a vocale. Un annuncio letto
  // ad alta voce e' testo parlato, e va scritto come si parla.
  const preposition = /^[aeiou]/i.test(a.buyerName) ? 'ad' : 'a';
  return (
    `${a.playerName} aggiudicato ${preposition} ${a.buyerName} per ` +
    `${plural(a.price, 'credito', 'crediti')}. Ti restano ` +
    `${plural(a.myBudgetRemaining, 'credito', 'crediti')} e ` +
    `${plural(a.mySlotsRemaining, 'slot', 'slot')}.`
  );
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
