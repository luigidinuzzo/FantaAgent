import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { isNotFound, ProblemError } from './client';

/** Le pagine dove un 401 e' la normalita', non una sessione scaduta. */
const PUBLIC_PATHS = ['/accedi', '/registrati', '/password-dimenticata', '/nuova-password',
  '/verifica-email', '/invito/'];

/**
 * Sessione scaduta a meta' serata: si va all'accesso e poi si torna esattamente dove
 * si era. La domanda {@code me} e' esclusa perche' la gestisce {@code RequireAuth},
 * che fa lo stesso senza ricaricare la pagina.
 */
function onUnauthenticated(error: unknown, queryKey?: readonly unknown[]) {
  if (!(error instanceof ProblemError) || error.slug !== 'unauthenticated') return;
  if (queryKey && queryKey[0] === 'me') return;
  const { pathname, search } = window.location;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return;
  window.location.assign(`/accedi?dopo=${encodeURIComponent(pathname + search)}`);
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Cinque secondi: l'asta cambia quando qualcuno aggiudica, non di
            // continuo, e un intervallo piu' fitto interrogherebbe il server
            // senza che nulla sia successo.
            staleTime: 5_000,
            // Un 404 non cambia fra cinque secondi: la lega o l'asta non c'e', o
            // non se ne fa parte. Continuare a chiedere terrebbe la schermata a
            // interrogare il server per sempre, senza che nulla possa cambiare.
            refetchInterval: (query) => (isNotFound(query.state.error) ? false : 5_000),
            refetchOnWindowFocus: true,
            retry: (failures, error) => !isNotFound(error) && failures < 1,
          },
          // Nessun tentativo automatico sulle scritture: un acquisto ripetuto
          // dalla libreria e' un acquisto che l'utente non ha chiesto. La chiave
          // di idempotenza protegge dai doppi invii voluti, non e' un permesso
          // di inviare due volte. E qui non basterebbe comunque: la chiave si
          // genera a ogni invocazione di mutationFn, quindi un retry
          // automatico ne genererebbe una nuova e produrrebbe un secondo
          // acquisto vero, non uno deduplicato.
          mutations: { retry: 0 },
        },
        queryCache: new QueryCache({ onError: (error, query) => onUnauthenticated(error, query.queryKey) }),
        mutationCache: new MutationCache({ onError: (error) => onUnauthenticated(error) }),
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
