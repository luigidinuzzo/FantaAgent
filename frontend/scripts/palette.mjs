// Unica fonte dei colori del progetto. tokens.css è generato da qui:
// modificare il CSS a mano significa perdere la modifica alla prossima build.
export const PALETTE = {
  // Il fondo della finestra: uniforme, quasi nero con una punta di verde. L'erba a
  // strisce non e' piu' qui — vedi grass, in fondo.
  background:         '#07130E',
  // Le barre: quella di navigazione in alto, e quella in basso sul telefono.
  bar:                '#0A1A12',
  // Il pannello: pieno, mai trasparente. Si stacca dal fondo per luminosita'; il
  // bordo lo rifinisce, non lo regge.
  surface:            '#0D2117',
  'panel-border':     '#274636',
  // Il bordo di bottoni secondari e campi: almeno 3:1 su ogni fondo, verificato da
  // contrast.test.ts. E' cio' che dice «questo si preme, qui si scrive».
  'control-border':   '#5F8F75',
  // Cio' che e' scelto o e' tuo dentro un pannello: la riga selezionata, la tua
  // squadra, la casella dell'offerta.
  'surface-raised':   '#143020',
  foreground:         '#F3F6F2',
  'muted-foreground': '#A7B8AD',
  accent:             '#F5B942',
  'on-accent':        '#1B1400',
  positive:           '#4ED187',
  destructive:        '#F06A6A',
  // I quattro ruoli. NON riusano positive e destructive nonostante la
  // somiglianza cromatica (il difensore e' verde, l'attaccante e' rosso): sono
  // coincidenze, non lo stesso significato. Il giorno in cui "positivo"
  // diventasse blu, i difensori non devono seguirlo.
  'role-p':           '#FFB84D',
  'role-d':           '#55D98A',
  'role-c':           '#63B3FF',
  'role-a':           '#FF6F91',
  // Lo stemma di ogni lega: un colore per riconoscerla a colpo d'occhio, scelto
  // dall'identificativo. Tinte lontane dai quattro ruoli e dall'accento, perche'
  // uno stemma «P» non deve sembrare il badge dei portieri. Lettera scura sopra
  // (on-accent).
  'crest-1':          '#7FD1C7',
  'crest-2':          '#B9A8F0',
  'crest-3':          '#B5DB6A',
  'crest-4':          '#E3C9A0',
  'crest-5':          '#D9A6D9',
  'crest-6':          '#A7B7D6',
  // L'erba, con le strisce di taglio: solo la meta' campo delle pagine d'ingresso
  // (HalfPitch). E' la firma del prodotto, non piu' lo sfondo di ogni pagina.
  grass:              '#2E6B34',
  'grass-stripe':     '#29612F',
};

// Divisori dentro i pannelli (line, line-strong) e il gesso delle linee del
// campo (chalk): bianco con alfa, perché il loro senso è "la stessa linea, più o
// meno marcata", non tre colori diversi. Piu' tenui di prima: su un fondo scuro e
// uniforme una linea al 25% si leggeva come un bordo, non come un divisore.
export const LINES = {
  line:          'rgba(255,255,255,0.09)',
  'line-strong': 'rgba(255,255,255,0.18)',
  // Solo le righe della meta' campo d'ingresso.
  chalk:         'rgba(255,255,255,0.4)',
};

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
}

export function hexToOklch(hex) {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  const C = Math.sqrt(A * A + B * B);
  let h = (Math.atan2(B, A) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c: C, h };
}

export function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a, b) {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function renderTokens() {
  const vars = Object.entries(PALETTE).map(([name, hex]) => {
    const { l, c, h } = hexToOklch(hex);
    return `  --${name}: oklch(${l.toFixed(4)} ${c.toFixed(4)} ${h.toFixed(2)});`;
  });
  const lines = Object.entries(LINES).map(([n, v]) => `  --${n}: ${v};`);
  const theme = [...Object.keys(PALETTE), ...Object.keys(LINES)]
    .map((n) => `  --color-${n}: var(--${n});`);
  return `/* GENERATO da scripts/palette.mjs — non modificare a mano.
   Rigenera con: npm run tokens */

:root {
${vars.join('\n')}
${lines.join('\n')}
  --font-sans: 'Archivo Variable', system-ui, sans-serif;
}

@theme inline {
${theme.join('\n')}
  --font-sans: var(--font-sans);
}
`;
}
