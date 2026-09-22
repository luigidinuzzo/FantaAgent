import type { ParticipantView, Role } from '../api/types';

/**
 * Quanto puo' offrire al massimo una squadra: i suoi crediti meno uno per ogni
 * altro posto che deve ancora riempire, perche' ogni giocatore costa almeno uno.
 * E' la regola che al tavolo si conta a mente, e su cui si litiga.
 */
export function maxAffordable(p: ParticipantView): number {
  return p.budgetRemaining - Math.max(0, p.slotsRemaining - 1);
}

/** Vero se la squadra ha gia' tutti i posti di quel ruolo: non puo' comprarne altri. */
export function roleFull(p: ParticipantView, role: Role): boolean {
  const total = p.slotsByRole[role] ?? 0;
  return total > 0 && (p.filledByRole[role] ?? 0) >= total;
}
