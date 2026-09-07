import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useState } from 'react';

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
            refetchInterval: 5_000,
            refetchOnWindowFocus: true,
            retry: 1,
          },
          // Nessun tentativo automatico sulle scritture: un acquisto ripetuto
          // dalla libreria e' un acquisto che l'utente non ha chiesto. La chiave
          // di idempotenza protegge dai doppi invii voluti, non e' un permesso
          // di inviare due volte.
          mutations: { retry: 0 },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
