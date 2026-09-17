/** Quante strisce di taglio attraversano il campo, da una porta all'altra. */
export const STRIPES = 12;

const W = 1200;
const H = 800;

/**
 * Il campo da gioco dietro ogni schermata: l'erba a strisce di taglio e le linee
 * in gesso — bordo, metà campo, cerchio e dischetto di centrocampo, aree di
 * rigore e di porta, dischetti del rigore, lunette e archi d'angolo.
 *
 * <p>Ora che le linee si vedono davvero, il vincolo che le teneva quasi invisibili
 * (un'opacita' "sotto la soglia del testo") e' sostituito da uno piu' semplice e
 * piu' forte: <b>nessun testo poggia sull'erba</b>. Tutto cio' che si legge sta in
 * un pannello pieno ({@code bg-surface}) con il suo bordo, quindi le linee possono
 * essere bianche e piene senza intaccare la lettura. La stessa ragione rende
 * inutile distinguere app e proiezione: il campo e' uno solo.
 *
 * <p>SVG inline e non un'immagine: erba e gesso sono token della palette
 * ({@code --background}, {@code --grass-stripe}, {@code --chalk}). Un PNG sarebbe
 * un colore fuori dalla palette, invisibile al test di contrasto e alla prossima
 * ritinteggiatura.
 */
export function PitchLines() {
  const stripeWidth = W / STRIPES;
  return (
    // z-0, non -z-10: il componente viene montato dentro una radice che porta
    // bg-background e non crea un proprio contesto di impilamento, quindi un
    // indice negativo finirebbe dietro il fondo opaco di quella radice.
    // AppShell da' z-10 a header e main, cosi' il contenuto resta sopra.
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
      >
        <rect x="0" y="0" width={W} height={H} fill="var(--background)" />
        {Array.from({ length: STRIPES }, (_, i) =>
          i % 2 === 1 ? (
            <rect
              key={i}
              data-testid="grass-stripe"
              x={i * stripeWidth}
              y="0"
              width={stripeWidth}
              height={H}
              fill="var(--grass-stripe)"
            />
          ) : null,
        )}
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
