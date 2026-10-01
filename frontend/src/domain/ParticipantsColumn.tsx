import type { ParticipantView, Role } from '../api/types';
import { ROLE_NAME_PLURAL, ROLE_NAME_SINGULAR } from './roles';

/**
 * La colonna delle squadre: chi c'e' e quanto gli resta, sempre in vista a sinistra
 * mentre si cerca e si aggiudica.
 *
 * <p>Nome, crediti, e quanti posti del ruolo in corso le restano. I crediti da soli
 * rispondevano a meta' della domanda: chi ha i posti del ruolo pieni non rilancera'
 * mai su questa chiamata, per quanti crediti abbia, e leggerne solo il budget
 * faceva sopravvalutare la concorrenza a ogni lotto. La rosa per intero — tutti e
 * quattro i ruoli, i giocatori comprati — resta nella scheda «Rose squadre» in
 * fondo alla pagina, dove c'e' lo spazio per leggerla davvero: qui c'e' il ruolo
 * che si sta chiamando adesso, e basta quello.
 *
 * <p>Chi guarda riconosce la propria riga dal bordo e dal colore dei crediti; chi
 * ascolta la riconosce dal testo, perche' un colore non entra nell'albero di
 * accessibilita' e {@code data-me} e' un data-*, non un attributo ARIA.
 *
 * <p>Le squadre sono righe di un pannello solo a ogni misura, e il nome va su due
 * righe invece di troncarsi.
 */
export function ParticipantsColumn({ participants, phase, className = '', id }: {
  participants: ParticipantView[];
  /**
   * Il ruolo che si sta chiamando. Assente ad asta conclusa, dove non c'e'
   * nessuna fase in corso e la riga resta nome e crediti.
   */
  phase?: Role;
  /** Il posto nella griglia di chi la monta (righe e colonne dell'asta). */
  className?: string;
  /** Per chi la indica con aria-controls (la barra delle viste del telefono). */
  id?: string;
}) {
  return (
    // Scorre dentro: una lega da dodici squadre non deve allungare la riga in
    // cui vive, come non la allungano i consigli. min-h-0 perche' un figlio che
    // scorre, dentro un contenitore flex, senza quello si allunga comunque fino
    // al proprio contenuto.
    <section
      id={id}
      aria-label="Crediti delle squadre"
      className={`panel flex min-h-0 min-w-0 flex-col overflow-hidden ${className}`}
    >
      <div aria-hidden="true" className="flex shrink-0 min-h-11 items-center justify-between border-b border-line px-4 text-meta font-medium text-muted-foreground">
        <span>Squadra</span>
        <span>Crediti</span>
      </div>
      {/* Una colonna di righe a ogni misura (sul telefono le squadre hanno una
          vista tutta loro): si dividono l'altezza del pannello, con otto squadre
          ognuna prende un ottavo, con dodici la lista scorre. */}
      <ul className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-visible">
        {participants.map((p) => (
          <li
            key={p.id}
            data-testid={`manager-${p.id}`}
            data-me={p.me}
            className={`flex min-h-16 flex-1 flex-col justify-center gap-0.5 border-b border-l-[3px] border-b-line px-4 last:border-b-0 ${
              p.me
                ? 'bg-surface-raised border-l-accent'
                : 'border-l-transparent'
            }`}
          >
            <span className="flex items-baseline items-start justify-between gap-3">
              <span data-testid="team-name" className="font-medium line-clamp-2 leading-tight">
                {p.name}
                {p.me ? <span className="sr-only">, sei tu</span> : null}
              </span>
              <span
                data-testid={`budget-${p.id}`}
                className={`tnum shrink-0 text-lg font-semibold ${p.me ? 'text-accent' : 'text-foreground'}`}
              >
                {p.budgetRemaining}
                <span className="sr-only"> crediti</span>
              </span>
            </span>
            {/* Risalta chi CERCA ancora, invece di smorzare chi e' al completo:
                sono i rivali di questa chiamata, e il contrasto va speso su di
                loro. Smorzare l'altra meta' con un'opacita' portava la scritta
                sotto la soglia di leggibilita' — la prova sul contrasto dei token
                lo ha rifiutato, ed e' la risposta giusta: e' testo che informa,
                non decorazione. */}
            {phase ? (
              <span className={`tnum truncate text-meta ${needed(p, phase) === 0 ? 'text-muted-foreground' : 'font-medium text-foreground'}`}>
                {needed(p, phase) === 0
                  ? `${ROLE_NAME_PLURAL[phase]} al completo`
                  : `cerca ${needed(p, phase)} ${needed(p, phase) === 1 ? ROLE_NAME_SINGULAR[phase] : ROLE_NAME_PLURAL[phase]}`}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** I posti del ruolo che questa squadra deve ancora riempire. Mai negativo. */
function needed(p: ParticipantView, role: Role): number {
  return Math.max(0, (p.slotsByRole[role] ?? 0) - (p.filledByRole[role] ?? 0));
}
