/**
 * Le linee del campo in un riquadro 1200×800: bordo, metà campo, cerchio e dischetto
 * di centrocampo, aree di rigore e di porta, dischetti del rigore, lunette e archi
 * d'angolo. Un solo disegno, usato dritto e ruotato.
 */
function FieldMarkings() {
  return (
    <>
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
    </>
  );
}

const SVG_BOX = 'absolute inset-4 h-[calc(100%-2rem)] w-[calc(100%-2rem)]';

/**
 * Il campo da gioco dietro ogni schermata: l'erba a strisce di taglio
 * ({@code .pitch-grass} in index.css) e le linee in gesso.
 *
 * <p><b>Nessun testo poggia sull'erba.</b> Tutto cio' che si legge sta in un
 * pannello pieno ({@code bg-surface}) con il suo bordo, quindi le linee possono
 * essere bianche e piene senza intaccare la lettura.
 *
 * <p><b>Centrato sui contenuti, sempre intero, orientato come lo schermo.</b> Chi lo
 * monta sceglie dove comincia con {@code className} (AppShell lo fa partire dal bordo
 * della barra laterale). Le linee si scalano per stare tutte nello spazio
 * ({@code meet}) invece di essere tagliate. Sugli schermi verticali il campo ruota di
 * 90°: dritto, su un telefono, si riduceva a una striscia sottile a metà altezza. Le
 * due forme sono due SVG scelti dall'orientamento via CSS, non da JavaScript: niente
 * da ricalcolare quando si gira il telefono.
 *
 * <p>SVG inline e non un'immagine: erba e gesso sono token della palette
 * ({@code --background}, {@code --grass-stripe}, {@code --chalk}).
 */
export function PitchLines({ className = 'inset-0' }: { className?: string }) {
  return (
    // z-0, non -z-10: il componente viene montato dentro una radice che porta
    // bg-background e non crea un proprio contesto di impilamento, quindi un
    // indice negativo finirebbe dietro il fondo opaco di quella radice.
    // AppShell da' z-10 a header e main, cosi' il contenuto resta sopra.
    <div
      data-testid="pitch"
      className={`pitch-grass pointer-events-none fixed z-0 overflow-hidden ${className}`}
    >
      <svg
        aria-hidden="true"
        data-orientation="landscape"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid meet"
        className={`${SVG_BOX} portrait:hidden`}
      >
        <FieldMarkings />
      </svg>
      <svg
        aria-hidden="true"
        data-orientation="portrait"
        viewBox="0 0 800 1200"
        preserveAspectRatio="xMidYMid meet"
        className={`${SVG_BOX} landscape:hidden`}
      >
        {/* Rotazione di 90° in senso orario: (x, y) diventa (800 - y, x). */}
        <g transform="translate(800 0) rotate(90)">
          <FieldMarkings />
        </g>
      </svg>
    </div>
  );
}
