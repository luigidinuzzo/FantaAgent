import type { CSSProperties } from 'react';

/** Quante strisce di taglio attraversano lo sfondo, da un lato all'altro. */
export const STRIPES = 12;

/**
 * L'erba a strisce: due token della palette in un gradiente ripetuto, largo quanto
 * tutto lo sfondo. Sta sul contenitore e non dentro l'SVG del campo, perche' il
 * campo si scala per restare intero (meet) e lascerebbe ai lati bande senza erba.
 */
export const GRASS: CSSProperties = {
  backgroundColor: 'var(--background)',
  backgroundImage:
    'linear-gradient(90deg, var(--background) 50%, var(--grass-stripe) 50%)',
  backgroundSize: `calc(200% / ${STRIPES}) 100%`,
};
