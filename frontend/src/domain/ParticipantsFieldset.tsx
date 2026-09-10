import { useId } from 'react';
import type { ParticipantSettings } from '../api/types';
import { SectionErrors } from './SectionErrors';

/**
 * I partecipanti alla serata.
 *
 * <p>L'iniziale ha un campo suo e non si deduce dal nome: e' quella che il comando
 * "giocatore prezzo iniziale" usa per riconoscere l'acquirente, e due Anna nella stessa
 * lega devono poter scegliere lettere diverse.
 */
export function ParticipantsFieldset({
  value,
  onChange,
  errors,
}: {
  value: ParticipantSettings[];
  onChange: (next: ParticipantSettings[]) => void;
  errors: string[];
}) {
  const errorsId = useId();

  function update(index: number, patch: Partial<ParticipantSettings>) {
    onChange(value.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  return (
    <fieldset
      className="border border-line p-4"
      aria-describedby={errors.length > 0 ? errorsId : undefined}
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
          {value.map((p, i) => (
            <tr key={p.id}>
              <td className="py-1">
                <label className="sr-only" htmlFor={`name-${p.id}`}>Nome del partecipante</label>
                <input
                  id={`name-${p.id}`}
                  value={p.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  className="min-h-11 w-full border border-line bg-transparent px-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                />
              </td>
              <td className="py-1">
                <label className="sr-only" htmlFor={`initial-${p.id}`}>Iniziale di {p.name}</label>
                <input
                  id={`initial-${p.id}`}
                  value={p.initial}
                  maxLength={1}
                  onChange={(e) => update(i, { initial: e.target.value.toUpperCase() })}
                  className="tnum min-h-11 min-w-11 w-14 border border-line bg-transparent px-2 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                />
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
                  Togli<span className="sr-only"> {p.name}</span>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button
        type="button"
        onClick={() =>
          onChange([
            ...value,
            { id: crypto.randomUUID(), name: '', initial: '', me: value.length === 0 },
          ])
        }
        className="mt-3 min-h-11 border border-line px-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        Aggiungi partecipante
      </button>

      <SectionErrors id={errorsId} errors={errors} />
    </fieldset>
  );
}
