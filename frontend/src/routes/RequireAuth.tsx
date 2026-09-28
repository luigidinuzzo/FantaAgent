import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useMe } from '../api/auth';
import { ProblemError, userMessage } from '../api/client';

/**
 * Le pagine dietro l'accesso. Senza sessione si va all'accesso, portandosi dietro
 * l'indirizzo: un link d'asta aperto dal telefono deve riportare a quell'asta, non
 * all'inizio.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const me = useMe();
  const location = useLocation();

  if (me.isPending) {
    return <p className="p-6 text-sm text-muted-foreground">Un attimo…</p>;
  }
  if (me.isError) {
    if (me.error instanceof ProblemError && me.error.status === 401) {
      const back = encodeURIComponent(location.pathname + location.search);
      return <Navigate to={`/accedi?dopo=${back}`} replace />;
    }
    return (
      <p role="alert" className="panel m-6 rounded-xl p-4 text-sm font-medium text-destructive">
        {userMessage(me.error, 'Non riesco a caricare il tuo profilo. Riprova fra poco.')}
      </p>
    );
  }
  return <>{children}</>;
}
