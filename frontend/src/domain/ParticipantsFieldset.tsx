import { useId } from 'react';
import type { ParticipantSettings } from '../api/types';
import { FieldErrors } from './FieldErrors';

/**
 * Un identificativo nuovo per un partecipante appena aggiunto, con ripiego.
 *
 * <p>{@code crypto.randomUUID()} esiste solo in un contesto sicuro (HTTPS o
 * localhost): su un semplice {@code http://} da un tablet in LAN — plausibile la
 * sera dell'asta, prima che qualcuno pensi al certificato — e' `undefined`, e
 * chiamarlo lancerebbe un TypeError che "Aggiungi partecipante" non si aspetta. Il
 * ripiego non deve essere crittograficamente robusto: serve solo a distinguere le
 * righe del modulo fra loro, non a proteggere niente.
 */
function newParticipantId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function errorsFor(errors: Record<string, string[]>, key: string): string[] {
  return errors[key] ?? [];
}

/**
 * I partecipanti alla serata.
 *
 * <p>L'iniziale ha un campo suo e non si deduce dal nome: e' quella che il comando
 * "giocatore prezzo iniziale" usa per riconoscere l'acquirente, e due Anna nella stessa
 * lega devono poter scegliere lettere diverse.
 *
 * <p>Le chiavi sono di campo (task 16): {@code "participants[<id>].name"} e
 * {@code "participants[<id>].initial"} riguardano una riga precisa e stanno accanto
 * al suo input; {@code "participants"} — l'insieme vuoto, l'iniziale duplicata, chi
 * e' segnato come «tu» — riguarda piu' di una riga (o nessuna) e resta a livello di
 * fieldset, com'era prima di questo task.
 */
export function ParticipantsFieldset({
  value,
  onChange,
  errors,
}: {
  value: ParticipantSettings[];
  onChange: (next: ParticipantSettings[]) => void;
  errors: Record<string, string[]>;
}) {
  const baseId = useId();
  const groupErrorsId = `${baseId}-group`;
  const groupErrors = errorsFor(errors, 'participants');

  function update(index: number, patch: Partial<ParticipantSettings>) {
    onChange(value.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  return (
    <fieldset
      className="border border-line p-4"
      aria-describedby={groupErrors.length > 0 ? groupErrorsId : undefined}
    >
      {/* La <legend> fornisce il NOME accessibile del fieldset: e' il <fieldset>
          stesso — un group — che supporta una descrizione, non la legend. */}
      <legend className="px-2 font-bold">Partecipanti</legend>

      <table className="w-full text-sm">
        <caption className="sr-only">
          Nome, iniziale e chi sei tu, per ogni partecipante alla lega
        </caption>
        <thead>
          <tr className="text-left text-muted-foreground">
            <th scope="col" className="py-1">Nome</th>
            <th scope="col" className="py-1">Iniziale</th>
            <th scope="col" className="py-1">Sei tu</th>
            <th scope="col" className="py-1"><span className="sr-only">Azioni</span></th>
          </tr>
        </thead>
        <tbody>
          {value.map((p, i) => {
            const nameErrors = errorsFor(errors, `participants[${p.id}].name`);
            const initialErrors = errorsFor(errors, `participants[${p.id}].initial`);
            const nameErrorsId = `${baseId}-name-${p.id}`;
            const initialErrorsId = `${baseId}-initial-${p.id}`;
            return (
              <tr key={p.id}>
                <td className="py-1">
                  <label className="sr-only" htmlFor={`name-${p.id}`}>Nome del partecipante</label>
                  <input
                    id={`name-${p.id}`}
                    value={p.name}
                    aria-invalid={nameErrors.length > 0}
                    aria-describedby={nameErrors.length > 0 ? nameErrorsId : undefined}
                    onChange={(e) => update(i, { name: e.target.value })}
                    className="min-h-11 w-full border border-line bg-transparent px-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                  />
                  <FieldErrors id={nameErrorsId} errors={nameErrors} />
                </td>
                <td className="py-1">
                  <label className="sr-only" htmlFor={`initial-${p.id}`}>Iniziale di {p.name}</label>
                  <input
                    id={`initial-${p.id}`}
                    value={p.initial}
                    maxLength={1}
                    aria-invalid={initialErrors.length > 0}
                    aria-describedby={initialErrors.length > 0 ? initialErrorsId : undefined}
                    onChange={(e) => update(i, { initial: e.target.value.toUpperCase() })}
                    className="tnum min-h-11 min-w-11 w-14 border border-line bg-transparent px-2 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                  />
                  <FieldErrors id={initialErrorsId} errors={initialErrors} />
                </td>
                <td className="py-1">
                  <label className="sr-only" htmlFor={`me-${p.id}`}>Sei tu: {p.name}</label>
                  <input
                    id={`me-${p.id}`}
                    type="radio"
                    name="me"
                    checked={p.me}
                    onChange={() => onChange(value.map((q, j) => ({ ...q, me: j === i })))}
                    className="h-11 w-11 accent-[color:var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                  />
                </td>
                <td className="py-1 text-right">
                  <button
                    type="button"
                    onClick={() => onChange(value.filter((_, j) => j !== i))}
                    className="min-h-11 min-w-11 px-2 text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    Togli <span className="sr-only">{p.name}</span>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <button
        type="button"
        onClick={() =>
          onChange([
            ...value,
            { id: newParticipantId(), name: '', initial: '', me: value.length === 0 },
          ])
        }
        className="mt-3 min-h-11 border border-line px-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        Aggiungi partecipante
      </button>

      <FieldErrors id={groupErrorsId} errors={groupErrors} />
    </fieldset>
  );
}
