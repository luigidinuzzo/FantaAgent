import type { Role } from '../api/types';

const NOME: Record<Role, string> = {
  P: 'portieri', D: 'difensori', C: 'centrocampisti', A: 'attaccanti',
};

/**
 * Il cambio fase, che fino a ieri stava sulla schermata proiettata.
 *
 * <p>La fase corrente non e' segnalata dal solo colore: il nome accessibile la dice.
 * E' il vizio che questa migrazione ha gia' corretto sei volte — un segnale che
 * raggiunge solo chi guarda lo schermo.
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
    <nav aria-label="Fase dell'asta" className="flex gap-1">
      {phases.map((role) => {
        const isCurrent = role === current;
        return (
          <button
            key={role}
            type="button"
            disabled={pending || isCurrent}
            aria-label={isCurrent ? `${NOME[role]}, fase corrente` : NOME[role]}
            onClick={() => onChange(role)}
            className={`min-h-11 px-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
              isCurrent ? 'bg-accent font-bold text-on-accent' : 'border border-line text-muted-foreground'
            }`}
          >
            {role}
          </button>
        );
      })}
    </nav>
  );
}
