import type { ReactNode } from 'react';

/**
 * Il contenitore delle pagine dell'app: largo al massimo 96rem, centrato, alto
 * almeno quanto la finestra sotto la barra, cosi' chi sta dentro puo' riempirla o
 * centrarsi.
 *
 * <p>Era il perimetro in gesso di un campo, con gli archi d'angolo. Il campo non
 * incornicia piu' le pagine: resta nella meta' campo delle pagine d'ingresso.
 */
export function PageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-var(--header-h)-2rem)] w-full max-w-[96rem] flex-col md:min-h-[calc(100dvh-var(--header-h)-3rem)]">
      {children}
    </div>
  );
}
