import type { ReactNode } from 'react';
import { PitchGrass } from './PitchGrass';

/**
 * La meta' superiore di un campo, in scala (68×52,5), nella colonna di destra delle
 * pagine divise in due: un pannello a tutta altezza a sinistra (30rem, 36rem da xl),
 * il campo accanto. Le pagine d'ingresso.
 *
 * <p>Il campo e' largo quanto la colonna meno 2,5rem per lato, a meno che la finestra
 * sia troppo bassa per starci con 2,5rem sopra e sotto. {@code children} sta nella
 * zona libera fra la lunetta e il mezzo cerchio di centrocampo: nessuna riga passa
 * sotto una lettera o sotto un pannello, che e' il difetto per cui le righe erano
 * state spente sulle altre pagine. I figli possono misurarsi sulla larghezza del
 * campo (cqw).
 *
 * <p>Sul telefono niente righe e niente campo: i figli entrano nella griglia della
 * pagina ({@code contents}) e si ordinano con {@code order}.
 */
export function HalfPitch({ children }: { children: ReactNode }) {
  return (
    <div className="max-lg:contents lg:relative lg:col-start-2 lg:row-start-1 lg:flex lg:items-center lg:justify-center">
      {/* L'erba riempie la colonna di destra, e solo quella. Sul telefono la meta'
          campo non c'e' e i figli entrano nella griglia della pagina: niente erba. */}
      <PitchGrass className="inset-0 max-lg:hidden" />
      <div className={`max-lg:contents lg:relative lg:aspect-[68/52.5] lg:[container-type:inline-size] ${SIZE}`}>
        <HalfPitchLines />
        {/* La zona libera, in percentuale dell'altezza: dalla lunetta (20,15 m su
            52,5) al mezzo cerchio di centrocampo (43,35 m). */}
        <div className="max-lg:contents lg:absolute lg:inset-x-[6%] lg:top-[38.4%] lg:bottom-[17.4%] lg:flex lg:flex-col lg:items-center lg:justify-center lg:gap-[4cqw]">
          {children}
        </div>
      </div>
    </div>
  );
}

// Scritte per intero: Tailwind trova le classi leggendo il sorgente.
const SIZE =
  'lg:w-[min(calc(100vw-35rem),calc((100dvh-5rem)*68/52.5))] xl:w-[min(calc(100vw-41rem),calc((100dvh-5rem)*68/52.5))]';

/**
 * Le righe in gesso della meta' superiore di un campo, in metri (68×52,5):
 * perimetro con la linea di meta' campo come lato basso, mezzo cerchio e dischetto
 * di centrocampo, area di rigore, area piccola, dischetto e lunetta. Gli archi
 * d'angolo restano fuori: a questa misura sono un puntino. Lo spessore non scala col
 * campo (non-scaling-stroke).
 */
function HalfPitchLines() {
  const line = { fill: 'none', stroke: 'var(--chalk)', strokeWidth: 2, vectorEffect: 'non-scaling-stroke' } as const;
  // La lunetta: il cerchio di 9,15 m attorno al dischetto (a 11 m), fuori dall'area
  // (16,5 m). Taglia il bordo dell'area a 7,31 m dal centro.
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 68 52.5"
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full overflow-visible max-lg:hidden"
    >
      <rect x="0" y="0" width="68" height="52.5" {...line} />
      <path d="M24.85 52.5 A9.15 9.15 0 0 1 43.15 52.5" {...line} />
      <circle cx="34" cy="52.5" r="0.3" fill="var(--chalk)" />
      <rect x="13.84" y="0" width="40.32" height="16.5" {...line} />
      <rect x="24.84" y="0" width="18.32" height="5.5" {...line} />
      <circle cx="34" cy="11" r="0.3" fill="var(--chalk)" />
      <path d="M26.69 16.5 A9.15 9.15 0 0 0 41.31 16.5" {...line} />
    </svg>
  );
}
