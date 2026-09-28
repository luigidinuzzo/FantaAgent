import type { ReactNode } from 'react';
import { Wordmark } from './Wordmark';
import { FieldErrors } from './FieldErrors';

/**
 * Il ritorno dopo l'accesso, solo se e' un percorso di questa app. "//altro.it" e'
 * un indirizzo assoluto per il browser: lo si scarta, e si torna all'inizio.
 */
export function safeAfter(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

/** La pagina delle schermate d'ingresso: un pannello solo, al centro, col marchio sopra. */
export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main role="main" className="relative z-10 flex min-h-dvh items-center justify-center p-4">
      <div className="panel w-[min(28rem,100%)] rounded-2xl p-6">
        <Wordmark size="md" />
        <h1 className="w-exp mt-4 text-xl font-semibold">{title}</h1>
        <div className="mt-4">{children}</div>
      </div>
    </main>
  );
}

export function TextField({
  id, label, type = 'text', autoComplete, value, onChange, errors = [], hint,
}: {
  id: string;
  label: string;
  type?: 'text' | 'email' | 'password';
  autoComplete?: string;
  value: string;
  onChange: (value: string) => void;
  errors?: string[];
  hint?: string;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorsId = errors.length > 0 ? `${id}-errors` : undefined;
  const describedBy = [hintId, errorsId].filter(Boolean).join(' ') || undefined;
  return (
    <div className="mt-4 first:mt-0">
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={errors.length > 0 ? 'true' : undefined}
        aria-describedby={describedBy}
        className="mt-2 min-h-11 w-full rounded-xl border border-line-strong bg-surface px-4 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      />
      {hint ? <p id={hintId} className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
      <FieldErrors id={`${id}-errors`} errors={errors} />
    </div>
  );
}

export const PRIMARY_BUTTON =
  'mt-6 min-h-11 w-full rounded-full bg-accent px-5 font-semibold text-on-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground';

export const TEXT_LINK =
  'font-medium underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent';
