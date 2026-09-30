import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useRegister, useResendVerification } from '../api/auth';
import { fieldErrors, userMessage } from '../api/client';
import { useKnownPath } from './knownPath';
import { AuthLayout, PRIMARY_BUTTON, TEXT_LINK, TextField, safeAfter } from '../domain/AuthForm';

export function RegisterRoute() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const register = useRegister();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const after = safeAfter(params.get('dopo'), useKnownPath());
  const errors = fieldErrors(register.error);
  const hasFieldErrors = Object.keys(errors).length > 0;
  const loginHref = after === '/' ? '/accedi' : `/accedi?dopo=${encodeURIComponent(after)}`;

  if (register.isSuccess) {
    return (
      <CheckYourMail email={register.data.email} toLeagues={after === '/'}
        onContinue={() => navigate(after, { replace: true })} />
    );
  }

  return (
    <AuthLayout title="Crea il tuo account">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          register.mutate({ displayName, email, password });
        }}
      >
        <TextField id="register-name" label="Il tuo nome" autoComplete="name"
          value={displayName} onChange={setDisplayName} errors={errors.displayName} />
        <TextField id="register-email" label="Email" type="email" autoComplete="email"
          value={email} onChange={setEmail} errors={errors.email}
          hint="Ti scriviamo per confermarla: serve se un giorno dimentichi la password." />
        <TextField id="register-password" label="Password" type="password" autoComplete="new-password"
          value={password} onChange={setPassword} errors={errors.password}
          hint="Almeno 10 caratteri. Una frase lunga va benissimo." />
        {register.isError ? (
          <p role="alert" className="mt-4 text-sm font-medium text-destructive">
            {hasFieldErrors
              ? 'Controlla i campi segnati.'
              : userMessage(register.error, 'Registrazione non riuscita. Riprova fra poco.')}
          </p>
        ) : null}
        <button type="submit" disabled={register.isPending} className={PRIMARY_BUTTON}>
          {register.isPending ? 'Creo l\'account…' : 'Crea l\'account'}
        </button>
      </form>
      <p className="mt-4 text-sm">
        Hai già un account? <Link to={loginHref} className={TEXT_LINK}>Accedi</Link>
      </p>
    </AuthLayout>
  );
}

/**
 * Dopo la registrazione: l'email di conferma e' partita. Si puo' gia' entrare, come
 * vuole la specifica (la sera dell'asta nessuno resta fuori perche' il messaggio e'
 * finito nello spam), ma chi si e' appena registrato deve sapere che il messaggio
 * c'e' e a cosa serve.
 */
function CheckYourMail({ email, toLeagues, onContinue }: {
  email: string;
  /** Si torna all'inizio, e non a un invito o a un'asta da cui si era partiti. */
  toLeagues: boolean;
  onContinue: () => void;
}) {
  const resend = useResendVerification();
  return (
    <AuthLayout title="Controlla la posta">
      <p>
        Ti abbiamo scritto a <strong className="font-semibold">{email}</strong>. Apri il messaggio e
        segui il link per confermare l&apos;indirizzo.
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        Intanto puoi già entrare: la conferma serve se un giorno dimentichi la password. Se il
        messaggio non arriva, guarda nella cartella della posta indesiderata.
      </p>
      <button type="button" onClick={onContinue} className={PRIMARY_BUTTON}>
        {toLeagues ? 'Vai alle tue leghe' : 'Continua'}
      </button>
      <p className="mt-4 text-sm">
        {resend.isError ? (
          <span role="alert" className="font-medium text-destructive">
            Non sono riuscito a rimandarla. Riprova fra poco.
          </span>
        ) : (
          <button type="button" disabled={resend.isPending || resend.isSuccess}
            onClick={() => resend.mutate()} className={`${TEXT_LINK} disabled:no-underline disabled:opacity-70`}>
            {resend.isSuccess ? 'Email inviata di nuovo' : 'Mandami di nuovo la conferma'}
          </button>
        )}
      </p>
    </AuthLayout>
  );
}
