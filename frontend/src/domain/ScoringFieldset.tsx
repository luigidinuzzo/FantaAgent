import { useId } from 'react';
import type { ScoringSection } from '../api/types';
import { NumberField } from './NumberField';
import { SectionErrors } from './SectionErrors';

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
 * fino al salvataggio.
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

export function ScoringFieldset({
  value,
  onChange,
  errors,
  disabled,
}: {
  value: ScoringSection;
  onChange: (next: ScoringSection) => void;
  errors: string[];
  disabled: boolean;
}) {
  const errorsId = useId();
  const lockId = useId();

  return (
    <fieldset
      className="border border-line p-4"
      aria-describedby={errors.length > 0 ? errorsId : undefined}
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">
          Difensori conteggiati
          <NumberField
            value={value.defendersCounted}
            disabled={disabled}
            aria-describedby={disabled ? lockId : undefined}
            onChange={(defendersCounted) => onChange({ ...value, defendersCounted })}
            className="tnum mt-1 block min-h-11 w-full border border-line bg-transparent px-2 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          />
        </label>

        {NUMERIC.map(({ key, label }) => (
          <label key={key} className="text-sm">
            {label}
            <NumberField
              step="0.5"
              value={value[key] as number}
              disabled={disabled}
              aria-describedby={disabled ? lockId : undefined}
              onChange={(next) => onChange({ ...value, [key]: next })}
              className="tnum mt-1 block min-h-11 w-full border border-line bg-transparent px-2 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            />
          </label>
        ))}

        {(['P', 'D', 'C', 'A'] as const).map((role) => (
          <label key={role} className="text-sm">
            Gol segnato — {role}
            <NumberField
              step="0.5"
              value={value.goalBonus[role]}
              disabled={disabled}
              aria-describedby={disabled ? lockId : undefined}
              onChange={(next) =>
                onChange({
                  ...value,
                  goalBonus: { ...value.goalBonus, [role]: next },
                })
              }
              className="tnum mt-1 block min-h-11 w-full border border-line bg-transparent px-2 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            />
          </label>
        ))}
      </div>

      <SectionErrors id={errorsId} errors={errors} />
    </fieldset>
  );
}
