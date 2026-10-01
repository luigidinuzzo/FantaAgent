import type { ReactNode, Ref } from 'react';
import { HalfPitch } from './HalfPitch';
import { Wordmark } from './Wordmark';
import { FieldErrors } from './FieldErrors';
import { BUTTON_PRIMARY, FIELD } from './controls';

/**
 * Il ritorno dopo l'accesso, solo se e' un percorso di questa app. "//altro.it" e'
 * un indirizzo assoluto per il browser: lo si scarta, e si torna all'inizio.
 *
 * <p>Si scarta anche un percorso che nessuna pagina riconosce ({@code isKnown}): un
 * link della versione vecchia ("/asta") portava all'accesso chiedendo di tornare li',
 * e dopo la registrazione si finiva su una pagina che non c'e' piu'.
 */
export function safeAfter(value: string | null, isKnown: (path: string) => boolean = () => true): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  return isKnown(value.split(/[?#]/)[0]!) ? value : '/';
}

/**
 * La pagina delle schermate d'ingresso.
 *
 * <p>Sul computer il modulo sta in un pannello a tutta altezza sul lato sinistro, e
 * accanto c'e' la meta' campo ({@link HalfPitch}) con il marchio e due righe su che
 * cos'e' FantaAgent: chi arriva da un invito spesso non l'ha mai visto.
 *
 * <p>Sul telefono le tre parti si impilano: marchio, modulo, descrizione. Un solo
 * marchio nella pagina, spostato dalla griglia: niente copie nascoste.
 */
export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main
      role="main"
      className="relative z-10 grid min-h-dvh content-center justify-items-center gap-6 px-4 py-8 lg:grid-cols-[30rem_1fr] lg:content-stretch lg:gap-0 lg:p-0 xl:grid-cols-[36rem_1fr]"
    >
      <section
        aria-labelledby="auth-title"
        className="order-2 w-full max-w-[28rem] rounded-lg border border-panel-border bg-surface p-6 lg:col-start-1 lg:row-start-1 lg:flex lg:max-w-none lg:flex-col lg:justify-center lg:rounded-none lg:border-0 lg:border-r lg:px-12 lg:py-12 xl:px-16"
      >
        <div className="lg:mx-auto lg:w-full lg:max-w-sm">
          <h1 id="auth-title" className="w-exp text-2xl font-bold lg:text-3xl">{title}</h1>
          <div className="mt-6">{children}</div>
        </div>
      </section>
      <HalfPitch>
        <div className="order-1">
          <Wordmark size="hero" outlined />
        </div>
        <p className="order-3 w-full max-w-[28rem] rounded-lg border border-panel-border bg-surface p-5 text-sm text-muted-foreground lg:max-w-[40rem] lg:p-[clamp(0.875rem,2.4cqw,1.5rem)] lg:text-[clamp(0.8125rem,2cqw,1.125rem)] lg:leading-snug">
          <span className="block font-semibold text-foreground">
            L&apos;asta del fantacalcio della tua lega, tutti collegati insieme.
          </span>
          <span className="mt-2 block lg:mt-1.5">
            Ogni acquisto compare sulle rose di tutti mentre l&apos;asta va avanti. Quanto
            conviene spendere per un giocatore lo vedi solo tu.
          </span>
        </p>
      </HalfPitch>
    </main>
  );
}

export function TextField({
  id, label, type = 'text', autoComplete, value, onChange, errors = [], hint, ref,
}: {
  id: string;
  label: string;
  type?: 'text' | 'email' | 'password';
  autoComplete?: string;
  value: string;
  onChange: (value: string) => void;
  errors?: string[];
  hint?: string;
  /** Per chi deve dargli il fuoco, come la finestra che si apre. */
  ref?: Ref<HTMLInputElement>;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorsId = errors.length > 0 ? `${id}-errors` : undefined;
  const describedBy = [hintId, errorsId].filter(Boolean).join(' ') || undefined;
  return (
    <div className="mt-4 first:mt-0">
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <input
        ref={ref}
        id={id}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={errors.length > 0 ? 'true' : undefined}
        aria-describedby={describedBy}
        className={`mt-2 ${FIELD}`}
      />
      {hint ? <p id={hintId} className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
      <FieldErrors id={`${id}-errors`} errors={errors} />
    </div>
  );
}

export const PRIMARY_BUTTON = `mt-6 w-full ${BUTTON_PRIMARY}`;

export const TEXT_LINK =
  'font-medium underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent';
