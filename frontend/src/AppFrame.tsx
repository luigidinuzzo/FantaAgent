import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';

/**
 * La cornice dell'applicazione: il fondo, e dentro la pagina.
 *
 * <p>Sta in una rotta di livello superiore e non dentro AppShell perche' non deve
 * essere ricostruita a ogni cambio di pagina: cambiando rotta React smonta la
 * vecchia e monta la nuova, e qui resta montato cio' che non cambia.
 *
 * <p>Il fondo e' uniforme. L'erba a strisce, che prima copriva tutta la finestra,
 * vive solo nella meta' campo delle pagine d'ingresso ({@code HalfPitch}).
 *
 * <p>{@code children} al posto della rotta: la pagina d'errore del router, che
 * sostituisce la cornice intera.
 */
export function AppFrame({ children }: { children?: ReactNode }) {
  return (
    <div data-testid="app-frame" className="min-h-dvh bg-background font-sans text-foreground">
      {children ?? <Outlet />}
    </div>
  );
}
