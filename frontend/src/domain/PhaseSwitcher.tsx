import type { Role } from '../api/types';

/** Esportato: {@link AuctionAnnouncer} lo riusa per comporre l'annuncio del
 * cambio fase — una sola mappa nome/ruolo, non due copie che possono divergere. */
export const ROLE_LABEL: Record<Role, string> = {
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
  phases, current, onChange, pending, error,
}: {
  phases: Role[];
  current: Role;
  onChange: (role: Role) => void;
  pending: boolean;
  /**
   * Un cambio fase rifiutato dal server. Senza mostrarlo, il bottone si
   * riattiva e nulla — visivo o parlato — dice che il tentativo non e'
   * andato a buon fine.
   */
  error?: string | null;
}) {
  return (
    <>
      <nav aria-label="Fase dell'asta" className="flex gap-1">
        {phases.map((role) => {
          const isCurrent = role === current;
          return (
            <button
              key={role}
              type="button"
              disabled={pending || isCurrent}
              aria-label={isCurrent ? `${ROLE_LABEL[role]}, fase corrente` : ROLE_LABEL[role]}
              onClick={() => onChange(role)}
              className={`min-h-11 min-w-11 px-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                isCurrent ? 'bg-accent font-bold text-on-accent' : 'border border-line text-muted-foreground'
              }`}
            >
              {role}
            </button>
          );
        })}
      </nav>
      {error ? (
        // role="alert", non un secondo role="status": l'unica live region
        // ambientale della pagina resta AuctionAnnouncer.
        <p role="alert" className="mt-1 text-sm font-bold text-destructive">
          {error}
        </p>
      ) : null}
    </>
  );
}
