import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useVerifyEmail } from '../api/auth';
import { userMessage } from '../api/client';
import { AuthLayout, TEXT_LINK } from '../domain/AuthForm';

/**
 * Si apre dal link dell'email e conferma da sola. Il ref impedisce il secondo invio
 * che StrictMode provoca rieseguendo l'effetto: il link vale una volta, e il secondo
 * tentativo risponderebbe "non valido" sopra a un "confermato" appena mostrato.
 */
export function VerifyEmailRoute() {
  const [params] = useSearchParams();
  const verify = useVerifyEmail();
  const sent = useRef(false);
  const token = params.get('token') ?? '';

  useEffect(() => {
    if (sent.current || !token) return;
    sent.current = true;
    verify.mutate(token);
  }, [token, verify]);

  return (
    <AuthLayout title="Conferma dell'indirizzo">
      {verify.isSuccess ? <p role="status" className="text-sm">Indirizzo confermato.</p> : null}
      {verify.isError || !token ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {token ? userMessage(verify.error, 'Conferma non riuscita. Riprova fra poco.')
            : 'Il link non è valido o è scaduto.'}
        </p>
      ) : null}
      {verify.isPending ? <p className="text-sm">Confermo…</p> : null}
      <p className="mt-4 text-sm"><Link to="/" className={TEXT_LINK}>Vai alle tue leghe</Link></p>
    </AuthLayout>
  );
}
