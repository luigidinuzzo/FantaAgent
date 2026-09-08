import type { ParticipantView, Role } from '../api/types';

const ORDER: Role[] = ['P', 'D', 'C', 'A'];

const SEGMENT: Record<Role, string> = {
  P: 'bg-accent',
  D: 'bg-positive',
  C: 'bg-[color-mix(in_oklch,var(--color-foreground)_45%,transparent)]',
  A: 'bg-[color-mix(in_oklch,var(--color-accent)_55%,transparent)]',
};

const NOUN: Record<Role, [string, string]> = {
  P: ['portiere', 'portieri'],
  D: ['difensore', 'difensori'],
  C: ['centrocampista', 'centrocampisti'],
  A: ['attaccante', 'attaccanti'],
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

export function LeagueBoard({ participants }: { participants: ParticipantView[] }) {
  return (
    <section aria-labelledby="board-heading">
      <h2 id="board-heading" className="mb-3 text-sm text-muted-foreground">
        Chi ha cosa
      </h2>
      <ul className="space-y-2">
        {participants.map((p) => {
          // I posti totali si contano sulla mappa di QUESTO partecipante, non
          // su quella di un altro preso a caso dall'array: le regole della
          // lega sono un'unica istanza condivisa per l'asta (StateDtos.view
          // le legge da state.rules(), non dal singolo partecipante), quindi
          // in pratica ogni mappa coincide con le altre — ma la barra di
          // Bruno non deve dipendere da un elemento che non e' la sua riga.
          const totalSlots = ORDER.reduce((sum, r) => sum + (p.slotsByRole[r] ?? 0), 0);
          return (
            <li
              key={p.id}
              data-testid={`manager-${p.id}`}
              data-me={p.me}
              className={`border p-3 ${p.me ? 'border-accent' : 'border-line'}`}
            >
              <div className="flex items-baseline justify-between">
                <span className="font-bold">{p.name}</span>
                {p.me ? (
                  // Il bordo e il colore del budget distinguono "questo sei
                  // tu" solo per chi vede quello schermo — ed e' il fatto
                  // piu' importante della riga. data-me non basta: e' un
                  // data-*, non entra nell'albero di accessibilita'.
                  <span className="sr-only">, sei tu</span>
                ) : null}
                <span
                  data-testid={`budget-${p.id}`}
                  className={`tnum w-exp font-bold ${p.me ? 'text-accent' : 'text-muted-foreground'}`}
                >
                  {p.budgetRemaining}
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
            </li>
          );
        })}
      </ul>
    </section>
  );
}
