import type { ReactNode } from 'react';

/*
 * Il campo delle pagine divise in due meta': «Le mie leghe» e la pagina di una lega.
 * Le due pagine usano la stessa cornice apposta: passando dall'una all'altra le
 * righe restano ferme, e cambia solo cio' che sta dentro.
 */

/**
 * Il perimetro del campo attorno alla pagina, con gli archi d'angolo.
 *
 * <p>Le righe erano state spente perche' un campo disegnato dietro i pannelli ne
 * lasciava affiorare dei pezzi fra l'uno e l'altro, e si leggevano come un difetto.
 * Qui il campo non sta dietro: e' la cornice, da un bordo all'altro della finestra
 * (il contenuto dentro si ferma a 96rem, centrato). Cresce con la pagina invece di restare
 * ferma nella finestra, e il contenuto la riempie con un margine, cosi' nessuna riga
 * passa mai sotto un pannello o una lettera. Sul telefono niente
 * righe: il margine che chiedono lo toglierebbero allo schermo.
 */
export function PitchFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-[calc(100dvh-var(--header-h)-2rem)] flex-col md:min-h-[calc(100dvh-var(--header-h)-3rem)] md:border-2 md:border-chalk md:px-10 md:py-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden max-md:hidden">
        {CORNERS.map((corner) => (
          <span key={corner} className={`absolute size-10 rounded-full border-2 border-chalk ${corner}`} />
        ))}
      </div>
      <div className="mx-auto flex w-full max-w-[96rem] flex-1 flex-col">{children}</div>
    </div>
  );
}

// Il centro di ogni arco sta sull'angolo: se ne vede il quarto dentro il campo.
const CORNERS = [
  '-left-5 -top-5', '-right-5 -top-5', '-bottom-5 -left-5', '-bottom-5 -right-5',
];

/**
 * La linea di meta' campo fra le due meta' di una pagina divisa (le mie leghe e le
 * porte per una nuova; le aste della lega e le sue persone), col dischetto. Va da un lato all'altro del perimetro, non della colonna: le righe sono
 * posizionate sulla cornice ({@link PitchFrame}, l'antenato posizionato piu' vicino),
 * e dove manca una coordinata restano dove le mette il flusso.
 *
 * <p>Sul computer le due parti sono due meta' uguali, e la linea e' verticale a meta'
 * del campo: il contenuto e' centrato nella cornice, e il centro della colonna fra
 * le due e' il centro del campo. Sotto, una sopra l'altra, e la linea e' orizzontale.
 */
export function HalfwayLine() {
  return (
    <div aria-hidden="true" className="max-lg:my-5 max-lg:h-6 md:max-lg:my-6">
      <span className="absolute inset-x-0 mt-3 border-t border-line md:mt-[11px] md:border-t-2 md:border-chalk lg:hidden" />
      <span className="absolute inset-y-0 left-1/2 -ml-px border-l-2 border-chalk max-lg:hidden" />
      <span className="absolute left-1/2 mt-[7px] size-2.5 -translate-x-1/2 rounded-full bg-chalk max-md:hidden lg:hidden" />
      <span className="absolute left-1/2 top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chalk max-lg:hidden" />
    </div>
  );
}

// Scritte per intero: Tailwind trova le classi leggendo il sorgente.
const CRESTS = ['bg-crest-1', 'bg-crest-2', 'bg-crest-3', 'bg-crest-4', 'bg-crest-5', 'bg-crest-6'];

/**
 * Lo stemma di una lega: la sua prima lettera su uno dei sei colori, sempre lo stesso
 * per la stessa lega. Serve a ritrovarla a colpo d'occhio fra le altre, come la
 * maglia di una squadra.
 */
export function Crest({ id, name, muted = false, size = 'md' }: {
  id: string;
  name: string;
  muted?: boolean;
  /** md nelle righe di un elenco, lg in testa alla pagina della lega. */
  size?: 'md' | 'lg';
}) {
  let hash = 0;
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  const letter = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <span
      aria-hidden="true"
      className={`w-exp grid shrink-0 place-items-center rounded-xl font-bold ${
        size === 'lg' ? 'size-14 text-2xl' : 'size-11 text-lg'
      } ${
        muted
          ? 'border border-dashed border-line-strong text-muted-foreground'
          : `${CRESTS[hash % CRESTS.length]} text-on-accent`
      }`}
    >
      {letter}
    </span>
  );
}
