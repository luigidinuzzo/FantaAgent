import { useId } from 'react';
import type { ScoringSection } from '../api/types';
import { FieldErrors } from './FieldErrors';
import { NumberField } from './NumberField';

/**
 * I bonus e i malus con cui si calcola quanto rende un giocatore.
 *
 * <p>I campi numerici si rendono in ciclo su un elenco di coppie chiave-etichetta, non
 * scritti a mano diciassette volte: sono lo stesso controllo diciassette volte, e
 * ripeterne il markup significherebbe diciassette posti in cui sbagliare una classe.
 *
 * <p>Le soglie del modificatore di difesa ({@code value.thresholds}) non hanno un
 * editor qui: hanno un'interfaccia propria (righe che si aggiungono, ordine
 * crescente, bonus non decrescente) rimandata a un'altra tappa. Questo componente
 * non le legge né le scrive — {@code onChange} passa sempre l'oggetto {@code value}
 * completo con lo spread, quindi {@code thresholds} attraversa il modulo invariato
 * fino al salvataggio. I loro errori (chiavi {@code "thresholds"} e
 * {@code "thresholds[N]"}) restano percio' a livello di fieldset — non c'e' un
 * campo preciso a cui accostarli — invece che su un controllo che non esiste.
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
 * Non "chiavi che il validatore non conosce": {@code thresholds} e
 * {@code thresholds[N]} sono chiavi che ScoringSettingsValidator nomina
 * precisamente (task 16). Restano qui, a livello di fieldset, per la ragione
 * gia' detta nel docstring della classe — le soglie non hanno un editor in
 * questa tappa, quindi non c'e' un controllo a cui accostare il loro errore.
 * {@code scoring} invece e' davvero sintetica: la scrive {@code SettingsApi}
 * quando l'intera sezione punteggio manca dal corpo, e nessun validatore la
 * conosce.
 */
function isGeneralKey(key: string): boolean {
  return key === 'thresholds' || key.startsWith('thresholds[') || key === 'scoring';
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

  // Le soglie non hanno un campo qui (vedi il commento sulla classe): i loro errori,
  // e quelli dell'intera sezione se il corpo la omettesse del tutto, si accumulano
  // in questo elenco unico e restano descritti dal fieldset, non da un controllo.
  const generalErrors = Object.entries(errors)
    .filter(([key]) => isGeneralKey(key))
    .flatMap(([, messages]) => messages);

  return (
    <fieldset
      className="border border-line p-4"
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
              className="tnum mt-1 block min-h-11 w-full border border-line bg-transparent px-2 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
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
                className="tnum mt-1 block min-h-11 w-full border border-line bg-transparent px-2 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              />
            </label>
            <FieldErrors id={`${baseId}-${key}`} errors={errorsFor(errors, key)} />
          </div>
        ))}

        {(['P', 'D', 'C', 'A'] as const).map((role) => {
          const key = `goalBonus[${role}]`;
          return (
            <div key={role}>
              <label className="text-sm">
                Gol segnato — {role}
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
                  className="tnum mt-1 block min-h-11 w-full border border-line bg-transparent px-2 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                />
              </label>
              <FieldErrors id={`${baseId}-${key}`} errors={errorsFor(errors, key)} />
            </div>
          );
        })}
      </div>

      <FieldErrors id={groupErrorsId} errors={generalErrors} />
    </fieldset>
  );
}
