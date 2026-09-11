import { Fragment, useId } from 'react';
import type { ScoringStep } from '../api/types';
import { FieldErrors } from './FieldErrors';
import { NumberField } from './NumberField';

function errorsFor(errors: Record<string, string[]>, key: string): string[] {
  return errors[key] ?? [];
}

/**
 * La tabella del modificatore di difesa: da questa media in su, questo bonus.
 *
 * <p>Il validatore ({@code ScoringSettingsValidator}, task 16) impone due regole su
 * queste righe — le medie in ordine CRESCENTE, il bonus che non puo' CALARE salendo
 * di media, perche' un reparto migliore non puo' rendere meno — ma questo componente
 * non le fa rispettare a forza: le mostra. Un "Aggiungi soglia" che rifiutasse una
 * riga fuori ordine, o un campo che non accettasse un numero piu' piccolo del
 * precedente, impedirebbe anche la correzione temporanea (spostare due righe richiede
 * per forza di passare da uno stato provvisorio non ordinato). Le regole restano
 * quindi solo visibili — accanto alla riga sbagliata, con la chiave di campo
 * {@code "thresholds[N]"} del task 16 — non imposte, e la scoperta avviene qui invece
 * che al salvataggio.
 *
 * <p>Entrambe le colonne usano {@link NumberField} e non un {@code <input type="number">}
 * controllato a mano: la media e' tipicamente un decimale ("6,75") e il bonus della prima
 * riga puo' essere negativo, gli stessi due casi per cui NumberField esiste (vedi il suo
 * docstring).
 */
export function ThresholdsTable({
  value,
  onChange,
  disabled,
  errors,
}: {
  value: ScoringStep[];
  onChange: (next: ScoringStep[]) => void;
  disabled: boolean;
  errors: Record<string, string[]>;
}) {
  const baseId = useId();
  const lockId = `${baseId}-lock`;
  const tableErrorsId = `${baseId}-table`;
  const tableErrors = errorsFor(errors, 'thresholds');

  function updateRow(index: number, patch: Partial<ScoringStep>) {
    onChange(value.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  }

  return (
    <div>
      {disabled ? (
        // Il "perche'" e' un fatto sempre vero indipendentemente dalla causa
        // effettiva: ScoringFieldset appiattisce "asta in corso" e "modificatore
        // spento" in questo solo booleano prima di passarlo (a differenza dei
        // suoi altri campi, disabilitati per la sola causa "asta in corso").
        // Il testo non punta quindi a UNA causa specifica, che sarebbe falsa
        // nell'altro caso.
        <p id={lockId} className="mb-2 text-sm text-muted-foreground">
          Le soglie contano solo quando il modificatore di difesa è attivo, e non si
          possono modificare a asta aperta: qui non hanno effetto immediato.
        </p>
      ) : null}

      <table className="w-full text-sm">
        <caption className="mb-2 text-left text-sm font-bold">
          Modificatore di difesa: da questa media in su, questo bonus
        </caption>
        <thead>
          <tr className="text-left text-muted-foreground">
            <th scope="col" className="py-1">Da media</th>
            <th scope="col" className="py-1">Bonus</th>
            <th scope="col" className="py-1"><span className="sr-only">Azioni</span></th>
          </tr>
        </thead>
        <tbody>
          {value.map((step, i) => {
            const rowErrors = errorsFor(errors, `thresholds[${i}]`);
            const rowErrorsId = `${baseId}-row-${i}`;
            const describedBy = disabled ? lockId : rowErrors.length > 0 ? rowErrorsId : undefined;
            return (
              <Fragment key={i}>
                <tr>
                  <td className="py-1">
                    <label className="sr-only" htmlFor={`${baseId}-min-${i}`}>
                      Soglia da media, riga {i + 1}
                    </label>
                    <NumberField
                      id={`${baseId}-min-${i}`}
                      value={step.minAverage}
                      step="0.01"
                      disabled={disabled}
                      aria-invalid={!disabled && rowErrors.length > 0}
                      aria-describedby={describedBy}
                      onChange={(minAverage) => updateRow(i, { minAverage })}
                      className="tnum min-h-11 w-24 border border-line bg-transparent px-2 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                    />
                  </td>
                  <td className="py-1">
                    <label className="sr-only" htmlFor={`${baseId}-bonus-${i}`}>
                      Bonus, riga {i + 1}
                    </label>
                    <NumberField
                      id={`${baseId}-bonus-${i}`}
                      value={step.bonus}
                      step="0.01"
                      disabled={disabled}
                      aria-invalid={!disabled && rowErrors.length > 0}
                      aria-describedby={describedBy}
                      onChange={(bonus) => updateRow(i, { bonus })}
                      className="tnum min-h-11 w-24 border border-line bg-transparent px-2 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                    />
                  </td>
                  <td className="py-1 text-right">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onChange(value.filter((_, j) => j !== i))}
                      className="min-h-11 min-w-11 px-2 text-muted-foreground disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      Togli <span className="sr-only">riga {i + 1}</span>
                    </button>
                  </td>
                </tr>
                {/* L'errore di riga sta qui, in una riga propria che segue quella
                    che l'ha causata, non in un elenco unico in coda alla tabella:
                    e' cosi' che resta "accanto" a chi ha guardato quella riga. */}
                {rowErrors.length > 0 ? (
                  <tr>
                    <td colSpan={3} className="pb-2">
                      <FieldErrors id={rowErrorsId} errors={rowErrors} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange([...value, { minAverage: 0, bonus: 0 }])}
        className="mt-3 min-h-11 border border-line px-4 text-sm disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        Aggiungi soglia
      </button>

      <FieldErrors id={tableErrorsId} errors={tableErrors} />
    </div>
  );
}
