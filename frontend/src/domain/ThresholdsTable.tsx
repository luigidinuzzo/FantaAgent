import { Fragment, useId } from 'react';
import type { ScoringStep } from '../api/types';
import { FieldErrors } from './FieldErrors';
import { NumberField } from './NumberField';

function errorsFor(errors: Record<string, string[]>, key: string): string[] {
  return errors[key] ?? [];
}

/**
 * Perche' la tabella e' disattivata — le due cause sono distinte apposta, non
 * un solo booleano: chi ascolta merita di sapere QUALE si applica, non solo che
 * una delle due si applica (vedi {@code REASON_TEXT} sotto).
 */
export type ThresholdsTableDisabledReason = 'auction-open' | 'modifier-off';

const REASON_TEXT: Record<ThresholdsTableDisabledReason, string> = {
  'auction-open':
    'Asta in corso: le soglie sono bloccate, perché cambiarle riscriverebbe i numeri con cui una rosa già pagata era stata valutata.',
  'modifier-off':
    'Il modificatore di difesa non è attivo: queste soglie non hanno alcun effetto sul calcolo, quindi non si possono modificare da qui.',
};

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
 * controllato a mano: la media e' tipicamente un decimale ("6,75") e il bonus di
 * QUALUNQUE riga puo' essere negativo (il validatore vincola solo l'ordine relativo
 * fra righe, non il segno), gli stessi due casi per cui NumberField esiste (vedi il
 * suo docstring).
 *
 * <p>{@code disabledReason} e' {@code null} quando la tabella e' modificabile, o una
 * delle due cause quando non lo e'. Non e' un booleano piu' un motivo separato — che
 * potrebbe disaccordarsi (disabilitata ma senza motivo, o viceversa) — e' l'UNICA
 * fonte di verita' per entrambi: {@code disabled = disabledReason !== null}.
 */
export function ThresholdsTable({
  value,
  onChange,
  disabledReason,
  errors,
}: {
  value: ScoringStep[];
  onChange: (next: ScoringStep[]) => void;
  disabledReason: ThresholdsTableDisabledReason | null;
  errors: Record<string, string[]>;
}) {
  const disabled = disabledReason !== null;
  const baseId = useId();
  const lockId = `${baseId}-lock`;
  const tableErrorsId = `${baseId}-table`;
  const tableErrors = errorsFor(errors, 'thresholds');

  function updateRow(index: number, patch: Partial<ScoringStep>) {
    onChange(value.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  }

  return (
    // role="group" + aria-describedby e' lo stesso idioma del <fieldset> di
    // ParticipantsFieldset per il suo errore d'insieme ("participants"): qui
    // non c'e' un <fieldset> proprio (questo componente vive dentro quello di
    // ScoringFieldset), ma "thresholds" e' comunque un errore SENZA un
    // controllo a cui accostarsi, e senza questo aria-describedby il testo
    // sarebbe leggibile solo a schermo — nessun controllo lo referenzierebbe,
    // quindi chi ascolta tabulando i controlli non lo incontrerebbe mai.
    <div role="group" aria-describedby={tableErrors.length > 0 ? tableErrorsId : undefined}>
      {disabledReason !== null ? (
        <p id={lockId} className="mb-2 text-sm text-muted-foreground">
          {REASON_TEXT[disabledReason]}
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
