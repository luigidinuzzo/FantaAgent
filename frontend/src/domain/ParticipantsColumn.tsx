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
 */
export function ParticipantsColumn({ participants, phase }: {
  participants: ParticipantView[];
  /**
   * Il ruolo che si sta chiamando. Assente ad asta conclusa, dove non c'e'
   * nessuna fase in corso e la riga resta nome e crediti.
   */
  phase?: Role;
}) {
  return (
    // Scorre dentro: una lega da dodici squadre non deve allungare la riga in
    // cui vive, come non la allungano i consigli. min-h-0 perche' un figlio che
    // scorre, dentro un contenitore flex, senza quello si allunga comunque fino
    // al proprio contenuto.
    <section
      aria-label="Crediti delle squadre"
      className="panel flex min-h-0 min-w-0 flex-col p-3"
    >
      {/* Cosa misura il numero, detto una volta in testa alla colonna: prima era
          un numero nudo accanto al nome, e si capiva solo sapendolo gia'. */}
      <div aria-hidden="true" className="mb-2 flex justify-between px-3 text-meta font-medium text-muted-foreground">
        <span>Squadra</span>
        <span>Crediti</span>
      </div>
      {/* Sul telefono una fila che scorre di lato, alta una riga: in colonna, otto
          squadre occupavano il primo schermo intero prima della ricerca. relative:
          i testi sr-only delle righe sono position:absolute, e senza un
          riferimento qui dentro sfuggivano alla fila e allargavano la pagina. */}
      <ul className="relative flex min-h-0 flex-1 gap-1.5 overflow-x-auto pb-1 max-lg:flex-row lg:flex-col lg:overflow-y-auto lg:overflow-x-visible lg:pb-0 lg:pr-1">
        {participants.map((p) => (
          <li
            key={p.id}
            data-testid={`manager-${p.id}`}
            data-me={p.me}
            className={`flex flex-col gap-0.5 rounded-lg border px-3 py-2 max-lg:shrink-0 ${
              p.me ? 'border-accent bg-surface-raised' : 'border-panel-border'
            }`}
          >
            <span className="flex items-baseline justify-between gap-3">
              <span className="truncate font-medium">
                {p.name}
                {p.me ? <span className="sr-only">, sei tu</span> : null}
              </span>
              <span
                data-testid={`budget-${p.id}`}
                className={`tnum shrink-0 font-medium ${p.me ? 'text-accent' : 'text-muted-foreground'}`}
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
