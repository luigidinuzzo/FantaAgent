import type { Role } from '../api/types';
import { BG_ROLE_CLASS, ROLE_NAME_PLURAL, ROLE_NAME_PLURAL_CAPITALIZED } from './roles';

// Il filetto sotto la fase corrente, nel colore del suo ruolo. Scritte per intero:
// Tailwind trova le classi leggendo il sorgente.
const UNDERLINE: Record<Role, string> = {
  P: 'shadow-[inset_0_-2px_0_var(--color-role-p)]',
  D: 'shadow-[inset_0_-2px_0_var(--color-role-d)]',
  C: 'shadow-[inset_0_-2px_0_var(--color-role-c)]',
  A: 'shadow-[inset_0_-2px_0_var(--color-role-a)]',
};

/**
 * Il cambio fase, che fino a ieri stava sulla schermata proiettata.
 *
 * <p>La fase corrente non e' segnalata dal solo colore: il nome accessibile la dice.
 * E' il vizio che questa migrazione ha gia' corretto sei volte — un segnale che
 * raggiunge solo chi guarda lo schermo.
 *
 * <p>Un cambio fase rifiutato dal server non ha piu' un {@code role="alert"} qui:
 * lo rende {@code AuctionRoute}, in un canale solo condiviso con l'annullamento
 * (stessa barra, stessa schermata), con la precedenza al gesto piu' recente — due
 * bottoni che rendessero ciascuno il proprio alert potrebbero restare vivi insieme
 * per il resto dell'asta, uno per ogni errore mai azzerato.
 */
export function PhaseSwitcher({
  phases, current, onChange, pending,
}: {
  phases: Role[];
  current: Role;
  onChange: (role: Role) => void;
  pending: boolean;
}) {
  return (
    // Un controllo segmentato: un contenitore solo con le quattro fasi dentro. La
    // corrente ha il fondo rialzato e il filetto del suo ruolo sotto; le altre
    // restano leggibili, mai smorzate con un'opacita'. Il nome per esteso da xl in
    // su: fra lg e xl la barra dei comandi non ha posto per quattro parole e tre
    // comandi scritti, e restano le lettere.
    <nav aria-label="Fase dell'asta" className="flex items-center gap-0.5 rounded-lg border border-panel-border bg-surface p-0.5">
      {phases.map((role) => {
        const isCurrent = role === current;
        return (
          <button
            key={role}
            type="button"
            disabled={pending || isCurrent}
            aria-label={isCurrent ? `${ROLE_NAME_PLURAL[role]}, fase corrente` : ROLE_NAME_PLURAL[role]}
            onClick={() => onChange(role)}
            className={`flex min-h-10 min-w-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
              isCurrent ? `bg-surface-raised text-foreground ${UNDERLINE[role]}` : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {/* Il pallino del ruolo: e' uno stato (quale fase), per questo tondo. */}
            <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${BG_ROLE_CLASS[role]}`} />
            <span aria-hidden="true" className="xl:hidden">{role}</span>
            <span aria-hidden="true" className="max-xl:hidden">{ROLE_NAME_PLURAL_CAPITALIZED[role]}</span>
          </button>
        );
      })}
    </nav>
  );
}
