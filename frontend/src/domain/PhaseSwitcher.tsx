import type { Role } from '../api/types';
import { RoleBadge } from './RoleBadge';
import { ROLE_NAME_PLURAL } from './roles';

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
    <>
      {/* Il controllo segmentato: una pillola sola che contiene le quattro
          fasi, non quattro bottoni sciolti. RoleBadge porta il colore del
          ruolo dentro ognuna — lo stesso che colora la tabella di fase e la
          ricerca — cosi' la fase corrente non e' segnalata solo dal riquadro
          chiaro dietro, che il colore da solo non basterebbe a dire. */}
      <nav aria-label="Fase dell'asta" className="flex gap-1 rounded-full border border-line p-1">
        {phases.map((role) => {
          const isCurrent = role === current;
          return (
            <button
              key={role}
              type="button"
              disabled={pending || isCurrent}
              aria-label={isCurrent ? `${ROLE_NAME_PLURAL[role]}, fase corrente` : ROLE_NAME_PLURAL[role]}
              onClick={() => onChange(role)}
              className={`flex min-h-11 min-w-11 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                isCurrent ? 'bg-surface' : ''
              }`}
            >
              <RoleBadge role={role} filled={isCurrent} />
            </button>
          );
        })}
      </nav>
    </>
  );
}
