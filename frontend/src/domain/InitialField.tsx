import { FieldErrors } from './FieldErrors';

/**
 * L'iniziale: una lettera, maiuscola, unica nella lega. Il controllo di unicita' si
 * fa gia' qui con le iniziali note, cosi' che il pulsante resti spento invece di
 * mandare una richiesta che tornerebbe indietro; il server lo rifa' comunque.
 */
export function InitialField({
  id, value, onChange, taken = [], errors = [],
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  taken?: string[];
  errors?: string[];
}) {
  const upper = value.toUpperCase();
  const clash = upper !== '' && taken.includes(upper) ? [`La ${upper} è già di un altro membro.`] : [];
  const all = [...clash, ...errors];
  return (
    <div className="mt-4">
      <label htmlFor={id} className="block text-sm font-medium">La tua iniziale</label>
      <input
        id={id}
        value={upper}
        maxLength={1}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value.slice(-1).toUpperCase())}
        aria-invalid={all.length > 0 ? 'true' : undefined}
        aria-describedby={`${id}-hint${all.length > 0 ? ` ${id}-errors` : ''}`}
        className="mt-2 min-h-11 w-16 rounded-xl border border-line-strong bg-surface px-4 text-center text-base font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      />
      <p id={`${id}-hint`} className="mt-1 text-sm text-muted-foreground">
        La lettera con cui il banditore ti chiama.
      </p>
      <FieldErrors id={`${id}-errors`} errors={all} />
    </div>
  );
}

export function initialTaken(value: string, taken: string[]): boolean {
  return value !== '' && taken.includes(value.toUpperCase());
}
