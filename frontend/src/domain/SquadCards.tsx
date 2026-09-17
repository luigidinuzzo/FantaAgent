import type { ParticipantView, Role } from '../api/types';
import { RoleBadge } from './RoleBadge';
import { BG_ROLE_CLASS, ROLE_NAME_PLURAL, ROLE_NAME_SINGULAR, ROLES } from './roles';

const ORDER = ROLES;

const SEGMENT = BG_ROLE_CLASS;

// Tupla singolare/plurale, non una quinta copia delle stesse parole: qui
// serve scegliere fra le due forme in base al conteggio ("1 portiere" contro
// "3 portieri"), quindi la coppia si compone dalle due mappe canoniche
// invece di ripetere le stringhe.
const NOUN: Record<Role, [string, string]> = {
  P: [ROLE_NAME_SINGULAR.P, ROLE_NAME_PLURAL.P],
  D: [ROLE_NAME_SINGULAR.D, ROLE_NAME_PLURAL.D],
  C: [ROLE_NAME_SINGULAR.C, ROLE_NAME_PLURAL.C],
  A: [ROLE_NAME_SINGULAR.A, ROLE_NAME_PLURAL.A],
};

/**
 * La barra dice a colpo d'occhio quanto e come una rosa e' piena. Il testo
 * equivalente non e' un ripiego per i lettori di schermo: e' la stessa
 * informazione detta a parole, ed e' cio' che permette di togliere la stringa
 * "1P 3D 0C 0A" dallo schermo senza perderla.
 *
 * Il `?? 0` non e' difesa contro un caso che il tipo esclude: il tipo
 * garantisce Record<Role, number> completo, ma quel che arriva sul filo e'
 * JSON, e una chiave assente diventerebbe "undefined" in questa frase invece
 * che uno zero leggibile.
 */
function compositionText(p: ParticipantView): string {
  return ORDER.map((role) => {
    const filled = p.filledByRole[role] ?? 0;
    const total = p.slotsByRole[role] ?? 0;
    const [one, many] = NOUN[role];
    return `${filled} ${filled === 1 ? one : many} su ${total}`;
  }).join(', ');
}

/**
 * La fila di card squadra: chi ha quanto, a colpo d'occhio, sopra la griglia
 * delle rose. Sostituisce l'elenco verticale di {@code LeagueBoard} — stessa
 * garanzia di composizione parlata, stessa distinzione di "sei tu" a parole,
 * in una forma che scorre in orizzontale sotto la ricerca.
 */
export function SquadCards({ participants }: { participants: ParticipantView[] }) {
  return (
    <section aria-label="Chi ha cosa" className="relative overflow-x-auto">
      <ul className="flex gap-3 pb-1">
        {participants.map((p) => {
          // I posti totali (e quelli occupati) si contano sulla mappa di
          // QUESTO partecipante, non su quella di un altro preso a caso
          // dall'array: le regole della lega sono un'unica istanza condivisa
          // per l'asta (StateDtos.view le legge da state.rules(), non dal
          // singolo partecipante), quindi in pratica ogni mappa coincide con
          // le altre — ma la card di Bruno non deve dipendere da un elemento
          // che non e' la sua.
          const totalSlots = ORDER.reduce((sum, r) => sum + (p.slotsByRole[r] ?? 0), 0);
          const filledSlots = ORDER.reduce((sum, r) => sum + (p.filledByRole[r] ?? 0), 0);
          return (
            <li
              key={p.id}
              data-testid={`manager-${p.id}`}
              data-me={p.me}
              className={`w-56 shrink-0 rounded-xl border bg-surface p-3 ${p.me ? 'border-accent' : 'border-panel-border'}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate font-bold">
                  {p.name}
                  {p.me ? (
                    // Il bordo e il colore del budget distinguono "questo sei
                    // tu" solo per chi vede quello schermo — ed e' il fatto
                    // piu' importante della card. data-me non basta: e' un
                    // data-*, non entra nell'albero di accessibilita'.
                    <span className="sr-only">, sei tu</span>
                  ) : null}
                </span>
                <span
                  data-testid={`budget-${p.id}`}
                  className={`tnum w-exp shrink-0 font-bold ${p.me ? 'text-accent' : 'text-muted-foreground'}`}
                >
                  {p.budgetRemaining}
                  <span className="sr-only"> crediti</span>
                </span>
              </div>

              <div
                data-testid={`composition-${p.id}`}
                role="img"
                aria-label={compositionText(p)}
                className="mt-2 flex h-2 gap-0.5 bg-[color-mix(in_oklch,var(--color-foreground)_8%,transparent)]"
              >
                {ORDER.map((role) => (
                  <span
                    key={role}
                    data-role={role}
                    className={SEGMENT[role]}
                    style={{
                      width: totalSlots
                        ? `${((p.filledByRole[role] ?? 0) / totalSlots) * 100}%`
                        : '0%',
                    }}
                  />
                ))}
              </div>

              <div className="mt-1 flex items-baseline justify-between text-xs text-muted-foreground">
                <span>slot</span>
                <span className="tnum">
                  {filledSlots}/{totalSlots}
                </span>
              </div>

              {/* Nessun "MAX": il massimo offribile non arriva dall'API, e
                  ricavarlo qui metterebbe una regola di lega nel browser. */}
              <div className="mt-2 flex items-center gap-2">
                {ORDER.map((role) => (
                  <span key={role} className="flex items-center gap-0.5">
                    <RoleBadge role={role} />
                    <span className="tnum text-xs">{p.filledByRole[role] ?? 0}</span>
                  </span>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
