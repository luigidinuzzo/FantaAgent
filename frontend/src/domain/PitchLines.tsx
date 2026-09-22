import { useLayoutEffect, useRef, useState } from 'react';

/** Quanto le linee in gesso stanno dentro il bordo dello spazio, in pixel. */
export const PITCH_INSET = 24;

/**
 * Le proporzioni del campo, dal disegno che l'app usava prima (un campo 1120×720):
 * frazioni della lunghezza (lungo l'asse delle porte) e della larghezza. Il raggio
 * del cerchio e degli archi dipende dalla sola larghezza, cosi' resta un cerchio
 * qualunque sia la forma della finestra.
 */
const P = {
  circle: 100 / 720,
  penaltyDepth: 180 / 1120,
  penaltyWidth: 400 / 720,
  goalDepth: 60 / 1120,
  goalWidth: 180 / 720,
  spot: 120 / 1120,
  corner: 20 / 720,
};

interface Size { w: number; h: number }

/**
 * L'ultima misura presa, condivisa fra le pagine. Ogni schermata monta il suo
 * AppShell, quindi cambiando pagina il campo rinasce: partendo dalla finestra
 * intera (che include la barra) disegnava per un fotogramma un campo piu' alto,
 * con tutte le linee spostate, e al successivo tornava giusto. Si vedeva come uno
 * sfondo che cambia e poi torna com'era. Ripartendo da qui, il campo nuovo e'
 * identico al vecchio fin dal primo fotogramma.
 */
let lastSize: Size | null = null;

/**
 * Le linee di un campo che riempie uno spazio w×h, con le porte sui lati corti.
 *
 * <p>Si disegna in coordinate del campo — u lungo le porte, v di traverso — e si
 * traducono in x,y alla fine: dritto sugli schermi orizzontali, girato su quelli
 * verticali. Girare scambia gli assi, cioe' specchia: il verso degli archi si
 * inverte con lui.
 */
function fieldMarkings({ w, h }: Size) {
  const landscape = w >= h;
  const m = PITCH_INSET;
  const L = (landscape ? w : h) - 2 * m;
  const S = (landscape ? h : w) - 2 * m;
  const xy = (u: number, v: number) => (landscape ? [m + u, m + v] : [m + v, m + u]);
  const pt = (u: number, v: number) => xy(u, v).join(' ');
  const sweep = (flag: 0 | 1) => (landscape ? flag : 1 - flag);
  const box = (u0: number, depth: number, width: number) => {
    const v0 = (S - width) / 2;
    const [x0, y0] = xy(u0, v0);
    const [x1, y1] = xy(u0 + depth, v0 + width);
    return { x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) };
  };

  const r = S * P.circle;
  const pd = L * P.penaltyDepth;
  const spot = L * P.spot;
  const cr = S * P.corner;
  // La lunetta: la parte del cerchio attorno al dischetto che esce dall'area.
  const dx = pd - spot;
  const dy = dx < r ? Math.sqrt(r * r - dx * dx) : 0;
  const mid = S / 2;
  const [cx, cy] = xy(L / 2, mid);

  return {
    outer: box(0, L, S),
    halfway: [xy(L / 2, 0), xy(L / 2, S)],
    centre: { cx, cy, r },
    boxes: [
      box(0, pd, S * P.penaltyWidth),
      box(L - pd, pd, S * P.penaltyWidth),
      box(0, L * P.goalDepth, S * P.goalWidth),
      box(L - L * P.goalDepth, L * P.goalDepth, S * P.goalWidth),
    ],
    arcs: [
      dy > 0 ? `M ${pt(pd, mid - dy)} A ${r} ${r} 0 0 ${sweep(1)} ${pt(pd, mid + dy)}` : '',
      dy > 0 ? `M ${pt(L - pd, mid - dy)} A ${r} ${r} 0 0 ${sweep(0)} ${pt(L - pd, mid + dy)}` : '',
      `M ${pt(0, cr)} A ${cr} ${cr} 0 0 ${sweep(0)} ${pt(cr, 0)}`,
      `M ${pt(L - cr, 0)} A ${cr} ${cr} 0 0 ${sweep(0)} ${pt(L, cr)}`,
      `M ${pt(0, S - cr)} A ${cr} ${cr} 0 0 ${sweep(1)} ${pt(cr, S)}`,
      `M ${pt(L, S - cr)} A ${cr} ${cr} 0 0 ${sweep(0)} ${pt(L - cr, S)}`,
    ].filter(Boolean),
    spots: [xy(L / 2, mid), xy(spot, mid), xy(L - spot, mid)],
  };
}

/**
 * Il campo da gioco dietro ogni schermata: l'erba a strisce di taglio
 * ({@code .pitch-grass} in index.css) e le linee in gesso.
 *
 * <p><b>Nessun testo poggia sull'erba.</b> Tutto cio' che si legge sta in un
 * pannello pieno ({@code bg-surface}) con il suo bordo, quindi le linee possono
 * essere bianche e piene senza intaccare la lettura.
 *
 * <p><b>A tutto schermo.</b> Le linee prendono le misure dello spazio in cui stanno,
 * lette dal browser, e il campo lo riempie fino a {@link PITCH_INSET} dal bordo.
 * Prima era un disegno 3:2 scalato per restare intero, che su uno schermo largo
 * lasciava due fasce d'erba vuote ai lati. Non si deforma: cerchi e archi hanno il
 * raggio calcolato sulla larghezza del campo, quindi restano cerchi. Sugli schermi
 * verticali le porte vanno in alto e in basso.
 *
 * <p>SVG inline e non un'immagine: erba e gesso sono token della palette
 * ({@code --background}, {@code --grass-stripe}, {@code --chalk}).
 */
export function PitchLines({ className = 'inset-0' }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // La misura della pagina precedente, se c'e'; altrimenti la finestra, al primo
  // caricamento dell'app (e la misura vera arriva prima che si veda, qui sotto).
  const [size, setSize] = useState<Size>(() => lastSize ?? {
    w: typeof window === 'undefined' ? 1200 : window.innerWidth,
    h: typeof window === 'undefined' ? 800 : window.innerHeight,
  });

  // useLayoutEffect e non useEffect: misura e ridisegna prima che il browser
  // mostri il fotogramma, cosi' non si vede mai un campo con le misure sbagliate.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    function update(width: number, height: number) {
      if (width <= 0 || height <= 0) return;
      const next = { w: width, h: height };
      lastSize = next;
      setSize((prev) => (prev.w === width && prev.h === height ? prev : next));
    }
    const rect = el.getBoundingClientRect();
    update(rect.width, rect.height);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      update(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const f = fieldMarkings(size);

  return (
    // z-0, non -z-10: il componente viene montato dentro una radice che porta
    // bg-background e non crea un proprio contesto di impilamento, quindi un
    // indice negativo finirebbe dietro il fondo opaco di quella radice.
    // AppShell da' z-10 al contenuto e z-30 alla barra, cosi' restano sopra.
    <div
      ref={ref}
      data-testid="pitch"
      className={`pitch-grass pointer-events-none fixed z-0 overflow-hidden ${className}`}
    >
      <svg
        aria-hidden="true"
        data-orientation={size.w >= size.h ? 'landscape' : 'portrait'}
        width="100%"
        height="100%"
        viewBox={`0 0 ${size.w} ${size.h}`}
        className="absolute inset-0"
      >
        <g fill="none" stroke="var(--chalk)" strokeWidth="5" strokeLinecap="round">
          <rect {...f.outer} />
          <line x1={f.halfway[0][0]} y1={f.halfway[0][1]} x2={f.halfway[1][0]} y2={f.halfway[1][1]} />
          <circle cx={f.centre.cx} cy={f.centre.cy} r={f.centre.r} />
          {f.boxes.map((b, i) => <rect key={i} {...b} />)}
          {f.arcs.map((d, i) => <path key={i} d={d} />)}
        </g>
        <g fill="var(--chalk)">
          {f.spots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === 0 ? 6 : 5} />)}
        </g>
      </svg>
    </div>
  );
}
