import type { ReactNode } from 'react';
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
 * <p>L'erba copre tutta la finestra. Sulle pagine con la barra ({@code AppShell})
 * la barra e' piena e ferma in cima, e la copre; le pagine d'ingresso non hanno
 * barra, e partire da sotto di essa lasciava una fascia senza strisce in alto.
 */
/**
 * <p>{@code children} al posto della rotta: la pagina d'errore del router, che
 * sostituisce la cornice intera e senza questo resterebbe senza erba.
 */
export function AppFrame({ children }: { children?: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground font-sans">
      <PitchGrass className="inset-0" />
      {children ?? <Outlet />}
    </div>
  );
}
