import type { ParticipantView } from '../api/types';

/**
 * La colonna delle squadre: chi c'e' e quanto gli resta, sempre in vista a sinistra
 * mentre si cerca e si aggiudica.
 *
 * <p>Nome e crediti, e nient'altro: durante il rilancio la domanda e' «quanto puo'
 * ancora spendere chi mi sta sopra», non la composizione della sua rosa. Quella —
 * slot per ruolo, giocatori comprati — vive nella scheda «Rose squadre» in fondo
 * alla pagina, dove c'e' lo spazio per leggerla davvero.
 *
 * <p>Chi guarda riconosce la propria riga dal bordo e dal colore dei crediti; chi
 * ascolta la riconosce dal testo, perche' un colore non entra nell'albero di
 * accessibilita' e {@code data-me} e' un data-*, non un attributo ARIA.
 */
export function ParticipantsColumn({ participants }: { participants: ParticipantView[] }) {
  return (
    // Scorre dentro: una lega da dodici squadre non deve allungare la riga in
    // cui vive, come non la allungano i consigli. min-h-0 perche' un figlio che
    // scorre, dentro un contenitore flex, senza quello si allunga comunque fino
    // al proprio contenuto.
    <section
      aria-label="Crediti delle squadre"
      className="panel flex min-h-0 flex-col rounded-2xl p-3"
    >
      <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
        {participants.map((p) => (
          <li
            key={p.id}
            data-testid={`manager-${p.id}`}
            data-me={p.me}
            className={`flex items-baseline justify-between gap-2 rounded-xl border px-3 py-2 ${
              p.me ? 'border-accent bg-surface-raised' : 'border-panel-border'
            }`}
          >
            <span className="truncate font-bold">
              {p.name}
              {p.me ? <span className="sr-only">, sei tu</span> : null}
            </span>
            <span
              data-testid={`budget-${p.id}`}
              className={`tnum shrink-0 font-bold ${p.me ? 'text-accent' : 'text-muted-foreground'}`}
            >
              {p.budgetRemaining}
              <span className="sr-only"> crediti</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
