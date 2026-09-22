import { Fragment, useId } from 'react';
import type { ScoringStep } from '../api/types';
import { FieldErrors } from './FieldErrors';
import { NumberField } from './NumberField';
import { RemoveIcon } from './RemoveIcon';

function errorsFor(errors: Record<string, string[]>, key: string): string[] {
  return errors[key] ?? [];
}

/**
 * Perche' la tabella e' disattivata. Resta una sola causa, l'asta in corso: a
 * modificatore spento la tabella non e' piu' disattivata ma non viene mostrata
 * affatto (vedi ScoringFieldset).
 */
export type ThresholdsTableDisabledReason = 'auction-open';

const REASON_TEXT: Record<ThresholdsTableDisabledReason, string> = {
  'auction-open':
    'Asta in corso: le soglie sono bloccate, perché cambiarle riscriverebbe i numeri con cui una rosa già pagata era stata valutata.',
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
 * causa quando non lo e'. Non e' un booleano piu' un motivo separato — che
 * potrebbe disaccordarsi (disabilitata ma senza motivo, o viceversa) — e' l'UNICA
 * fonte di verita' per entrambi: {@code disabled = disabledReason !== null}.
 */
/** Uguale alla caption della tabella: un solo posto dove il nome del gruppo e' scritto. */
const GROUP_LABEL = 'Modificatore di difesa: da questa media in su, questo bonus';

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
    //
    // A differenza del <fieldset>/<legend> che questo idioma copia, un
    // role="group" non ha un nome accessibile finche' non gliene si da' uno:
    // uno screen reader comunemente non annuncia nemmeno il confine di un
    // gruppo senza nome, e allora l'aria-describedby qui sopra potrebbe non
    // raggiungere mai nessuno che ascolta — non basta che il testo sia
    // collegato, il gruppo che lo porta deve prima essere trovabile.
    // aria-label ripete la caption invece di puntarci con aria-labelledby: la
    // caption resta il nome accessibile della TABELLA, un ruolo diverso da
    // quello del gruppo che la contiene, e i due non devono condividere
    // l'id di un singolo elemento.
    <div
      role="group"
      aria-label={GROUP_LABEL}
      aria-describedby={tableErrors.length > 0 ? tableErrorsId : undefined}
    >
      {disabledReason !== null ? (
        <p id={lockId} className="mb-2 text-sm text-muted-foreground">
          {REASON_TEXT[disabledReason]}
        </p>
      ) : null}

      <table className="w-auto table-fixed text-base">
        <caption className="mb-2 text-left text-base font-bold">
          {GROUP_LABEL}
        </caption>
        <thead>
          <tr className="text-left text-muted-foreground">
            <th scope="col" className="w-36 py-1 pr-3">Da media</th>
            <th scope="col" className="w-36 py-1 pr-3">Bonus</th>
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
                  <td className="py-1 pr-3">
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
                      className="tnum min-h-12 w-full rounded-full border border-line-strong bg-transparent px-3 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                    />
                  </td>
                  <td className="py-1 pr-3">
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
                      className="tnum min-h-12 w-full rounded-full border border-line-strong bg-transparent px-3 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                    />
                  </td>
                  <td className="py-1 text-right">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onChange(value.filter((_, j) => j !== i))}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-line hover:text-foreground disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      <RemoveIcon />
                      <span className="sr-only">Togli riga {i + 1}</span>
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
        className="mt-4 min-h-12 rounded-full border border-line-strong px-5 text-base disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        Aggiungi soglia
      </button>

      <FieldErrors id={tableErrorsId} errors={tableErrors} />
    </div>
  );
}
