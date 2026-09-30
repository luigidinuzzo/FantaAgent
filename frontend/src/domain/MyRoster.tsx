import type { BoardColumn, ParticipantView } from '../api/types';
import { RoleBadge } from './RoleBadge';
import { ROLES } from './roles';

/**
 * La tua rosa in quattro righe, un ruolo per riga: quanti posti hai occupato su
 * quanti ne hai, e chi hai preso a quanto. A riposo, sotto le occasioni: e' la
 * domanda che viene subito dopo «chi conviene» — «e a me cosa manca».
 *
 * <p>Solo dati che la schermata legge gia': i posti per ruolo da /state, i
 * giocatori dalla tua colonna di /board. Nessun calcolo: il conto dei presi e' la
 * lunghezza dell'elenco.
 */
export function MyRoster({ me, column }: { me: ParticipantView; column: BoardColumn | undefined }) {
  return (
    <section aria-labelledby="my-roster-title" className="shrink-0">
      <h3 id="my-roster-title" className="text-meta font-semibold text-muted-foreground">La tua rosa</h3>
      <ul className="mt-1 divide-y divide-line">
        {ROLES.map((role) => {
          const bought = column?.byRole[role] ?? [];
          // Mai meno dei presi: una correzione a meta' asta non deve far leggere «4 di 3».
          const total = Math.max(me.slotsByRole[role] ?? 0, bought.length);
          return (
            <li key={role} className="flex min-h-14 items-center gap-3 py-2">
              <RoleBadge role={role} />
              <span className="min-w-0 flex-1">
                <span className="tnum block font-semibold">{`${bought.length} di ${total}`}</span>
                <span className="line-clamp-2 text-meta text-muted-foreground">
                  {bought.length === 0
                    ? 'ancora nessuno'
                    : bought.map((s) => `${s.playerName} ${s.price}`).join(' · ')}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
