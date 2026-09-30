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
      {/* Senza bordo ne' padding attorno ai bottoni: il fondo appena piu' chiaro
          basta a farne una pillola sola, e la pillola resta alta quanto i suoi
          bottoni (44px). Con la cornice era 54px, e alzava la barra dell'asta
          sopra quella delle altre pagine, coprendo piu' campo. */}
      {/* Senza il suo contenitore a pillola: la fase corrente si stacca da sola,
          e una pillola attorno a quattro pastiglie ne disegnava una quinta. */}
      <nav aria-label="Fase dell'asta" className="flex items-center gap-1">
        {/* La parola, accanto alle quattro lettere: senza, erano quattro tondi
            colorati di cui non si capiva il compito. Per chi ascolta c'e' gia' il
            nome della navigazione. */}
        <span aria-hidden="true" className="pl-3 pr-1 text-sm font-medium text-muted-foreground max-sm:hidden">Fase</span>
        {phases.map((role) => {
          const isCurrent = role === current;
          return (
            <button
              key={role}
              type="button"
              disabled={pending || isCurrent}
              aria-label={isCurrent ? `${ROLE_NAME_PLURAL[role]}, fase corrente` : ROLE_NAME_PLURAL[role]}
              onClick={() => onChange(role)}
              // Le fasi non correnti arretrano per TAGLIA, mai per opacita'.
              // Misurato con il metodo di contrast.test.ts: smorzate al 40% le
              // quattro lettere scendono fra 2,1 e 2,6 contro 1 sul fondo, dove
              // la soglia e' 4,5 — e anche al 70% gli attaccanti restano sotto.
              // Un elemento che arretra non e' un elemento che si smette di poter
              // leggere, e qui dentro ci sono le lettere con cui si cambia fase.
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              <RoleBadge role={role} filled={isCurrent} size={isCurrent ? 'lg' : 'md'} />
            </button>
          );
        })}
      </nav>
    </>
  );
}
