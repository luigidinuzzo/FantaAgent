import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLogin } from '../api/auth';
import { userMessage } from '../api/client';
import { AuthLayout, PRIMARY_BUTTON, TEXT_LINK, TextField, safeAfter } from '../domain/AuthForm';

export function LoginRoute() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const after = safeAfter(params.get('dopo'));
  const registerHref = after === '/' ? '/registrati' : `/registrati?dopo=${encodeURIComponent(after)}`;

  return (
    <AuthLayout title="Accedi">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          login.mutate({ email, password }, { onSuccess: () => navigate(after, { replace: true }) });
        }}
      >
        <TextField id="login-email" label="Email" type="email" autoComplete="email"
          value={email} onChange={setEmail} />
        <TextField id="login-password" label="Password" type="password" autoComplete="current-password"
          value={password} onChange={setPassword} />
        {login.isError ? (
          <p role="alert" className="mt-4 text-sm font-medium text-destructive">
            {userMessage(login.error, 'Accesso non riuscito. Riprova fra poco.')}
          </p>
        ) : null}
        <button type="submit" disabled={login.isPending} className={PRIMARY_BUTTON}>
          {login.isPending ? 'Entro…' : 'Accedi'}
        </button>
      </form>
      <p className="mt-4 text-sm">
        <Link to="/password-dimenticata" className={TEXT_LINK}>Password dimenticata?</Link>
      </p>
      <p className="mt-2 text-sm">
        Non hai un account? <Link to={registerHref} className={TEXT_LINK}>Registrati</Link>
      </p>
    </AuthLayout>
  );
}
