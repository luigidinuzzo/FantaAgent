import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForgotPassword } from '../api/auth';
import { userMessage } from '../api/client';
import { AuthLayout, PRIMARY_BUTTON, TEXT_LINK, TextField } from '../domain/AuthForm';

/**
 * La conferma e' la stessa che l'indirizzo sia iscritto o no: questa pagina non deve
 * diventare un modo per scoprire chi usa FantaAgent.
 */
export function ForgotPasswordRoute() {
  const forgot = useForgotPassword();
  const [email, setEmail] = useState('');

  return (
    <AuthLayout title="Password dimenticata">
      {forgot.isSuccess ? (
        <p role="status" className="text-sm">
          Se l'indirizzo è registrato e confermato, ti abbiamo scritto un link per scegliere
          una nuova password. Vale un'ora: controlla anche lo spam.
        </p>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); forgot.mutate(email); }}>
          <TextField id="forgot-email" label="Email" type="email" autoComplete="email"
            value={email} onChange={setEmail} />
          {forgot.isError ? (
            <p role="alert" className="mt-4 text-sm font-medium text-destructive">
              {userMessage(forgot.error, 'Richiesta non riuscita. Riprova fra poco.')}
            </p>
          ) : null}
          <button type="submit" disabled={forgot.isPending} className={PRIMARY_BUTTON}>
            {forgot.isPending ? 'Invio…' : 'Mandami il link'}
          </button>
        </form>
      )}
      <p className="mt-4 text-sm"><Link to="/accedi" className={TEXT_LINK}>Torna all'accesso</Link></p>
    </AuthLayout>
  );
}
