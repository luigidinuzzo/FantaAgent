import { useId } from 'react';
import type { Role, RulesSection } from '../api/types';
import { FieldErrors } from './FieldErrors';
import { RoleBadge } from './RoleBadge';
import { ROLES, ROLE_NAME_PLURAL } from './roles';
import { StepperField } from './StepperField';

/** I minimi e il massimo degli slot sono quelli di LeagueRulesValidator. */
const MIN_BUDGET = 1;
/** Solo dell'interfaccia: il server non ha un massimo, ma il + deve fermarsi da qualche parte. */
const MAX_BUDGET = 9999;
const MIN_SLOTS = 1;
const MAX_SLOTS = 30;

const LOCK_TEXT =
  'Asta in corso: crediti, slot e numero di squadre sono bloccati, perché cambiarli ricalcolerebbe budget e rose già pagate.';

/**
 * Le regole della lega per l'asta che si sta creando. Le squadre non sono qui: sono i
 * partecipanti, e il loro numero si legge sotto la sezione che li elenca.
 */
export function LeagueRulesFieldset({
  value, onChange, errors, disabled,
}: {
  value: RulesSection;
  onChange: (next: RulesSection) => void;
  errors: Record<string, string[]>;
  disabled: boolean;
}) {
  const baseId = useId();
  const lockId = `${baseId}-lock`;
  const describe = (key: string) =>
    disabled ? lockId : (errors[key]?.length ?? 0) > 0 ? `${baseId}-${key}` : undefined;

  return (
    // Cornice e titolo come «Partecipanti» e «Punteggio»: sono le tre sezioni del
    // modulo, e questa si leggeva come una riga qualunque fra i campi del battitore.
    <fieldset className="space-y-3 rounded-2xl border border-line-strong p-4">
      <legend className="px-2 text-base font-bold">Regole della lega</legend>
      {disabled ? <p id={lockId} className="text-base text-muted-foreground">{LOCK_TEXT}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label htmlFor={`${baseId}-budget`} className="block text-base">Crediti per squadra</label>
          <StepperField
            id={`${baseId}-budget`}
            value={value.budget}
            onChange={(budget) => onChange({ ...value, budget })}
            min={MIN_BUDGET}
            max={MAX_BUDGET}
            step={10}
            decreaseLabel="Dieci crediti in meno"
            increaseLabel="Dieci crediti in più"
            disabled={disabled}
            describedBy={describe('budget')}
            invalid={!disabled && (errors.budget?.length ?? 0) > 0}
          />
          <FieldErrors id={`${baseId}-budget`} errors={errors.budget ?? []} />
        </div>

        {ROLES.map((role: Role) => {
          const key = `slots[${role}]`;
          const name = ROLE_NAME_PLURAL[role];
          return (
            <div key={role}>
              <label htmlFor={`${baseId}-${role}`} className="flex min-h-6 items-center gap-1.5 text-base">
                {/* Due forme della stessa etichetta: la lettera colorata per chi guarda,
                    «Slot portieri» per chi ascolta — un solo nodo di testo, perche' lo
                    spazio fra due nodi separati si perde nel nome accessibile. */}
                <span aria-hidden="true">Slot</span>
                <span aria-hidden="true"><RoleBadge role={role} /></span>
                <span className="sr-only">{`Slot ${name}`}</span>
              </label>
              <StepperField
                id={`${baseId}-${role}`}
                value={value.slots[role]}
                onChange={(n) => onChange({ ...value, slots: { ...value.slots, [role]: n } })}
                min={MIN_SLOTS}
                max={MAX_SLOTS}
                decreaseLabel={`Uno slot in meno: ${name}`}
                increaseLabel={`Uno slot in più: ${name}`}
                disabled={disabled}
                describedBy={describe(key)}
                invalid={!disabled && (errors[key]?.length ?? 0) > 0}
              />
              <FieldErrors id={`${baseId}-${key}`} errors={errors[key] ?? []} />
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
