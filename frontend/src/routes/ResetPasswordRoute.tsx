import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useResetPassword } from '../api/auth';
import { fieldErrors, userMessage } from '../api/client';
import { AuthLayout, PRIMARY_BUTTON, TEXT_LINK, TextField } from '../domain/AuthForm';

export function ResetPasswordRoute() {
  const [params] = useSearchParams();
  const reset = useResetPassword();
  const [password, setPassword] = useState('');
  const token = params.get('token') ?? '';
  const errors = fieldErrors(reset.error);

  return (
    <AuthLayout title="Nuova password">
      {reset.isSuccess ? (
        <p role="status" className="text-sm">
          Password cambiata. Per sicurezza sei uscito da tutti i dispositivi:{' '}
          <Link to="/accedi" className={TEXT_LINK}>accedi</Link> con la nuova password.
        </p>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); reset.mutate({ token, password }); }}>
          <TextField id="reset-password" label="Nuova password" type="password"
            autoComplete="new-password" value={password} onChange={setPassword}
            errors={errors.password} hint="Almeno 10 caratteri. Una frase lunga va benissimo." />
          {reset.isError && !errors.password ? (
            <p role="alert" className="mt-4 text-sm font-medium text-destructive">
              {userMessage(reset.error, 'Non sono riuscito a cambiare la password. Riprova fra poco.')}
            </p>
          ) : null}
          <button type="submit" disabled={reset.isPending || !token} className={PRIMARY_BUTTON}>
            {reset.isPending ? 'Salvo…' : 'Salva la nuova password'}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
