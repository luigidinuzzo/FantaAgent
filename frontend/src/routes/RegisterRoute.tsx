import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useRegister } from '../api/auth';
import { fieldErrors, userMessage } from '../api/client';
import { AuthLayout, PRIMARY_BUTTON, TEXT_LINK, TextField, safeAfter } from '../domain/AuthForm';

export function RegisterRoute() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const register = useRegister();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const after = safeAfter(params.get('dopo'));
  const errors = fieldErrors(register.error);
  const hasFieldErrors = Object.keys(errors).length > 0;
  const loginHref = after === '/' ? '/accedi' : `/accedi?dopo=${encodeURIComponent(after)}`;

  return (
    <AuthLayout title="Crea il tuo account">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          register.mutate({ displayName, email, password },
            { onSuccess: () => navigate(after, { replace: true }) });
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
