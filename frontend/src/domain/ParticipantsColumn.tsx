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
 * <p>Da schermo largo le squadre sono righe di un pannello solo, e il nome va
 * su due righe invece di troncarsi.
 */
export function ParticipantsColumn({ participants, phase, className = '' }: {
  participants: ParticipantView[];
  /**
   * Il ruolo che si sta chiamando. Assente ad asta conclusa, dove non c'e'
   * nessuna fase in corso e la riga resta nome e crediti.
   */
  phase?: Role;
  /** Il posto nella griglia di chi la monta (righe e colonne dell'asta). */
  className?: string;
}) {
  return (
    // Scorre dentro: una lega da dodici squadre non deve allungare la riga in
    // cui vive, come non la allungano i consigli. min-h-0 perche' un figlio che
    // scorre, dentro un contenitore flex, senza quello si allunga comunque fino
    // al proprio contenuto.
    <section
      aria-label="Crediti delle squadre"
      className={`panel flex min-h-0 min-w-0 flex-col max-lg:p-3 lg:overflow-hidden ${className}`}
    >
      <div aria-hidden="true" className="flex justify-between px-3 text-meta font-medium text-muted-foreground max-lg:mb-2 lg:shrink-0 lg:min-h-11 lg:items-center lg:border-b lg:border-line lg:px-4">
        <span>Squadra</span>
        <span>Crediti</span>
      </div>
      {/* Sul telefono una fila che scorre di lato, alta una riga, come prima. Da
          schermo largo una colonna di righe che si dividono l'altezza del pannello:
          con otto squadre ognuna prende un ottavo, con dodici la lista scorre. */}
      <ul className="relative flex min-h-0 flex-1 gap-1.5 overflow-x-auto pb-1 max-lg:flex-row lg:flex-col lg:gap-0 lg:overflow-y-auto lg:overflow-x-visible lg:pb-0">
        {participants.map((p) => (
          <li
            key={p.id}
            data-testid={`manager-${p.id}`}
            data-me={p.me}
            className={`flex flex-col gap-0.5 max-lg:shrink-0 max-lg:rounded-lg max-lg:border max-lg:px-3 max-lg:py-2 lg:min-h-16 lg:flex-1 lg:justify-center lg:border-b lg:border-l-[3px] lg:border-b-line lg:px-4 lg:last:border-b-0 ${
              p.me
                ? 'bg-surface-raised max-lg:border-accent lg:border-l-accent'
                : 'max-lg:border-panel-border lg:border-l-transparent'
            }`}
          >
            <span className="flex items-baseline justify-between gap-3 lg:items-start">
              <span data-testid="team-name" className="font-medium max-lg:truncate lg:line-clamp-2 lg:leading-tight">
                {p.name}
                {p.me ? <span className="sr-only">, sei tu</span> : null}
              </span>
              <span
                data-testid={`budget-${p.id}`}
                className={`tnum shrink-0 font-medium lg:text-lg lg:font-semibold ${p.me ? 'text-accent' : 'text-muted-foreground lg:text-foreground'}`}
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
