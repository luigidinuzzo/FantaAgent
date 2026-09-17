import { GRASS } from './pitch';

/**
 * Il campo da gioco dietro ogni schermata: l'erba a strisce di taglio e le linee
 * in gesso — bordo, metà campo, cerchio e dischetto di centrocampo, aree di
 * rigore e di porta, dischetti del rigore, lunette e archi d'angolo.
 *
 * <p><b>Nessun testo poggia sull'erba.</b> Tutto cio' che si legge sta in un
 * pannello pieno ({@code bg-surface}) con il suo bordo, quindi le linee possono
 * essere bianche e piene senza intaccare la lettura.
 *
 * <p><b>Centrato sui contenuti, sempre intero.</b> Chi lo monta sceglie dove
 * comincia con {@code className} (AppShell lo fa partire dal bordo della barra
 * laterale): un campo disegnato su tutta la finestra finiva per meta' sotto la
 * barra, con la metà campo spostata rispetto alle card. Le linee si scalano per
 * stare tutte nello spazio ({@code meet}) invece di essere tagliate in modo
 * diverso a ogni dimensione della finestra.
 *
 * <p>SVG inline e non un'immagine: erba e gesso sono token della palette
 * ({@code --background}, {@code --grass-stripe}, {@code --chalk}). Un PNG sarebbe
 * un colore fuori dalla palette, invisibile al test di contrasto.
 */
export function PitchLines({ className = 'inset-0' }: { className?: string }) {
  return (
    // z-0, non -z-10: il componente viene montato dentro una radice che porta
    // bg-background e non crea un proprio contesto di impilamento, quindi un
    // indice negativo finirebbe dietro il fondo opaco di quella radice.
    // AppShell da' z-10 a header e main, cosi' il contenuto resta sopra.
    <div
      data-testid="pitch"
      className={`pointer-events-none fixed z-0 overflow-hidden ${className}`}
      style={GRASS}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-4 h-[calc(100%-2rem)] w-[calc(100%-2rem)]"
      >
        <g fill="none" stroke="var(--chalk)" strokeWidth="5" strokeLinecap="round">
          <rect x="40" y="40" width="1120" height="720" />
          <line x1="600" y1="40" x2="600" y2="760" />
          <circle cx="600" cy="400" r="100" />
          {/* Aree di rigore e di porta. */}
          <rect x="40" y="200" width="180" height="400" />
          <rect x="980" y="200" width="180" height="400" />
          <rect x="40" y="310" width="60" height="180" />
          <rect x="1100" y="310" width="60" height="180" />
          {/* Lunette: la parte del cerchio di 100 attorno al dischetto che esce dall'area. */}
          <path d="M 220 320 A 100 100 0 0 1 220 480" />
          <path d="M 980 320 A 100 100 0 0 0 980 480" />
          {/* Archi d'angolo. */}
          <path d="M 40 60 A 20 20 0 0 0 60 40" />
          <path d="M 1140 40 A 20 20 0 0 0 1160 60" />
          <path d="M 40 740 A 20 20 0 0 1 60 760" />
          <path d="M 1160 740 A 20 20 0 0 0 1140 760" />
        </g>
        <g fill="var(--chalk)">
          <circle cx="600" cy="400" r="6" />
          <circle cx="160" cy="400" r="5" />
          <circle cx="1040" cy="400" r="5" />
        </g>
      </svg>
    </div>
  );
}
