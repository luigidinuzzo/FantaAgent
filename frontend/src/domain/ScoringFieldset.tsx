import { useId } from 'react';
import type { ScoringSection } from '../api/types';
import { FieldErrors } from './FieldErrors';
import { NumberField } from './NumberField';
import { RoleBadge } from './RoleBadge';
import { ROLES } from './roles';
import { ThresholdsTable, type ThresholdsTableDisabledReason } from './ThresholdsTable';

/**
 * I bonus e i malus con cui si calcola quanto rende un giocatore.
 *
 * <p>I campi numerici si rendono in ciclo su un elenco di coppie chiave-etichetta, non
 * scritti a mano diciassette volte: sono lo stesso controllo diciassette volte, e
 * ripeterne il markup significherebbe diciassette posti in cui sbagliare una classe.
 *
 * <p>Le soglie del modificatore di difesa ({@code value.thresholds}) hanno la loro
 * interfaccia in {@link ThresholdsTable} (task 18: righe che si aggiungono e si
 * tolgono, ordine crescente, bonus non decrescente — mostrati, non imposti). Questo
 * componente si limita a passargliele con lo spread, come ogni altro campo. Il
 * checkbox che accende e spegne il modificatore ({@code defenceModifierEnabled})
 * vive qui accanto alla tabella che governa — prima di questo task esisteva solo
 * sotto {@code /legacy} — ed e' lui stesso, non la tabella, a restare modificabile
 * quando la tabella non lo e' piu' perche' il motore la ignora: altrimenti un
 * modificatore spento per errore non si potrebbe piu' riaccendere da qui.
 */
const NUMERIC: Array<{ key: keyof ScoringSection; label: string }> = [
  { key: 'assist', label: 'Assist' },
  { key: 'penaltyScored', label: 'Rigore segnato' },
  { key: 'penaltyMissed', label: 'Rigore sbagliato' },
  { key: 'penaltySaved', label: 'Rigore parato' },
  { key: 'yellowCard', label: 'Ammonizione' },
  { key: 'redCard', label: 'Espulsione' },
  { key: 'goalConceded', label: 'Gol subito' },
  { key: 'cleanSheet', label: 'Porta inviolata' },
];

/**
 * {@code thresholds} e {@code thresholds[N]} non sono piu' generiche (task 18):
 * {@link ThresholdsTable} le legge dal suo stesso oggetto {@code errors} e le mostra
 * accanto alla riga giusta, quindi non devono anche finire nell'elenco di questo
 * fieldset — ci finirebbero due volte. {@code scoring} resta l'unica chiave
 * davvero sintetica: la scrive {@code SettingsApi} quando l'intera sezione
 * punteggio manca dal corpo, e nessun validatore la conosce.
 */
function isGeneralKey(key: string): boolean {
  return key === 'scoring';
}

function errorsFor(errors: Record<string, string[]>, key: string): string[] {
  return errors[key] ?? [];
}

export function ScoringFieldset({
  value,
  onChange,
  errors,
  disabled,
}: {
  value: ScoringSection;
  onChange: (next: ScoringSection) => void;
  errors: Record<string, string[]>;
  disabled: boolean;
}) {
  const baseId = useId();
  const groupErrorsId = `${baseId}-group`;
  const lockId = `${baseId}-lock`;
  // Le due cause sono distinte apposta (non un OR appiattito in un booleano):
  // ThresholdsTable deve poter dire ALLA PERSONA quale delle due si applica.
  // "Asta in corso" vince quando entrambe valgono, stessa priorita' degli altri
  // campi qui sotto (disabled ? lockId : ...): e' la causa che disabilita anche
  // il checkbox del modificatore, quindi e' anche la piu' "esterna" delle due.
  const thresholdsDisabledReason: ThresholdsTableDisabledReason | null = disabled
    ? 'auction-open'
    : !value.defenceModifierEnabled
      ? 'modifier-off'
      : null;

  // La sola chiave davvero sintetica (vedi il commento su isGeneralKey) si
  // accumula in questo elenco unico e resta descritta dal fieldset, non da un
  // controllo.
  const generalErrors = Object.entries(errors)
    .filter(([key]) => isGeneralKey(key))
    .flatMap(([, messages]) => messages);

  return (
    <fieldset
      className="rounded-2xl border border-line-strong p-4"
      aria-describedby={generalErrors.length > 0 ? groupErrorsId : undefined}
    >
      {/* La <legend> fornisce il NOME accessibile del fieldset: e' il <fieldset>
          stesso — un group — che supporta una descrizione, non la legend. */}
      <legend className="px-2 font-bold">Punteggio</legend>

      {disabled ? (
        <p id={lockId} className="mb-3 text-sm text-muted-foreground">
          Asta in corso: i parametri di punteggio sono bloccati, perché cambiarli
          riscriverebbe i numeri con cui una rosa già pagata era stata valutata.
        </p>
      ) : null}

      {/*
        Ogni campo e' un <div>, non un <label>: FieldErrors sta FUORI dal <label>
        apposta. Un <label> che avvolge implicitamente il suo <input> presta
        all'input il proprio intero contenuto testuale come nome accessibile —
        se l'elenco degli errori vivesse dentro, il nome diventerebbe "Assist" +
        il messaggio d'errore concatenati, non piu' semplicemente "Assist". Il
        <div> tiene comunque etichetta, controllo ed errori insieme nella stessa
        cella della grid.
      */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="text-sm">
            Difensori conteggiati
            <NumberField
              value={value.defendersCounted}
              disabled={disabled}
              aria-invalid={!disabled && errorsFor(errors, 'defendersCounted').length > 0}
              aria-describedby={
                disabled
                  ? lockId
                  : errorsFor(errors, 'defendersCounted').length > 0
                    ? `${baseId}-defendersCounted`
                    : undefined
              }
              onChange={(defendersCounted) => onChange({ ...value, defendersCounted })}
              className="tnum mt-1 block min-h-11 w-full rounded-full border border-line-strong bg-transparent px-3 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            />
          </label>
          <FieldErrors
            id={`${baseId}-defendersCounted`}
            errors={errorsFor(errors, 'defendersCounted')}
          />
        </div>

        {NUMERIC.map(({ key, label }) => (
          <div key={key}>
            <label className="text-sm">
              {label}
              <NumberField
                step="0.5"
                value={value[key] as number}
                disabled={disabled}
                aria-invalid={!disabled && errorsFor(errors, key).length > 0}
                aria-describedby={
                  disabled
                    ? lockId
                    : errorsFor(errors, key).length > 0
                      ? `${baseId}-${key}`
                      : undefined
                }
                onChange={(next) => onChange({ ...value, [key]: next })}
                className="tnum mt-1 block min-h-11 w-full rounded-full border border-line-strong bg-transparent px-3 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              />
            </label>
            <FieldErrors id={`${baseId}-${key}`} errors={errorsFor(errors, key)} />
          </div>
        ))}

        {ROLES.map((role) => {
          const key = `goalBonus[${role}]`;
          return (
            <div key={role}>
              <label className="text-sm">
                <span className="flex items-center gap-1.5">
                  Gol segnato <RoleBadge role={role} />
                </span>
                <NumberField
                  step="0.5"
                  value={value.goalBonus[role]}
                  disabled={disabled}
                  aria-invalid={!disabled && errorsFor(errors, key).length > 0}
                  aria-describedby={
                    disabled
                      ? lockId
                      : errorsFor(errors, key).length > 0
                        ? `${baseId}-${key}`
                        : undefined
                  }
                  onChange={(next) =>
                    onChange({
                      ...value,
                      goalBonus: { ...value.goalBonus, [role]: next },
                    })
                  }
                  className="tnum mt-1 block min-h-11 w-full rounded-full border border-line-strong bg-transparent px-3 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                />
              </label>
              <FieldErrors id={`${baseId}-${key}`} errors={errorsFor(errors, key)} />
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        {/* Il checkbox resta interagibile anche a modificatore spento — solo
            "asta in corso" lo blocca, come ogni altro campo qui — perche' e'
            lui stesso l'unico modo di riaccenderlo: se lo disabilitassimo
            insieme alla tabella, un modificatore spento non si potrebbe piu'
            riaccendere da questa schermata. */}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.defenceModifierEnabled}
            disabled={disabled}
            aria-describedby={disabled ? lockId : undefined}
            onChange={(e) => onChange({ ...value, defenceModifierEnabled: e.target.checked })}
            className="h-11 w-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          />
          Modificatore di difesa attivo
        </label>

        <div className="mt-2">
          <ThresholdsTable
            value={value.thresholds}
            onChange={(thresholds) => onChange({ ...value, thresholds })}
            disabledReason={thresholdsDisabledReason}
            errors={errors}
          />
        </div>
      </div>

      <FieldErrors id={groupErrorsId} errors={generalErrors} />
    </fieldset>
  );
}
