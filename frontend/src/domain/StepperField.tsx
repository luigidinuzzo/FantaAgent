import { NumberField } from './NumberField';

const STEP_BUTTON =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line-strong text-xl font-bold hover:bg-line disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent';

/**
 * Un numero con − e + ai lati: si regola senza tastiera, a passi, dentro limiti che
 * rispecchiano quelli del validatore lato server. Il campo resta scrivibile; i
 * bottoni si fermano ai limiti invece di superarli.
 */
export function StepperField({
  id, value, onChange, min, max, step = 1, decreaseLabel, increaseLabel,
  disabled = false, describedBy, invalid = false,
}: {
  id: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  decreaseLabel: string;
  increaseLabel: string;
  disabled?: boolean;
  describedBy?: string;
  invalid?: boolean;
}) {
  const set = (next: number) => onChange(Math.min(max, Math.max(min, next)));
  return (
    <div className="mt-1 flex items-center gap-2">
      <button type="button" aria-label={decreaseLabel} disabled={disabled || value <= min}
        onClick={() => set(value - step)} className={STEP_BUTTON}>
        <span aria-hidden="true">−</span>
      </button>
      <NumberField
        id={id}
        value={value}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onChange={onChange}
        className="tnum block min-h-11 w-full min-w-0 flex-1 rounded-full border border-line-strong bg-transparent px-4 text-center font-bold disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      />
      <button type="button" aria-label={increaseLabel} disabled={disabled || value >= max}
        onClick={() => set(value + step)} className={STEP_BUTTON}>
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}
