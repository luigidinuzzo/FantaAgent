import { Outlet } from 'react-router-dom';
import { PitchGrass } from './domain/PitchGrass';

/**
 * La cornice dell'applicazione: il fondo, l'erba, e dentro la pagina.
 *
 * <p>Sta in una rotta di livello superiore e non dentro AppShell perche' non deve
 * essere ricostruita a ogni cambio di pagina: cambiando rotta React smonta la
 * vecchia e monta la nuova, e con lei si rifaceva anche lo sfondo. Qui resta
 * montato: a cambiare e' solo cio' che sta dentro.
 *
 * <p>L'erba comincia sotto la barra ({@code --header-h}), che ogni pagina disegna
 * per conto suo dentro {@code AppShell}.
 */
export function AppFrame() {
  return (
    <div className="min-h-dvh bg-background text-foreground font-sans">
      <PitchGrass className="inset-x-0 bottom-0 top-[var(--header-h)]" />
      <Outlet />
    </div>
  );
}
