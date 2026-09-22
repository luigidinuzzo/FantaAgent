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
      className="panel flex min-h-0 min-w-0 flex-col rounded-2xl p-3"
    >
      {/* Cosa misura il numero, detto una volta in testa alla colonna: prima era
          un numero nudo accanto al nome, e si capiva solo sapendolo gia'. */}
      <div aria-hidden="true" className="mb-2 flex justify-between px-3 text-xs font-bold text-muted-foreground">
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
            className={`flex items-baseline justify-between gap-3 rounded-xl border px-3 py-2 max-lg:shrink-0 ${
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
