// Unica fonte dei colori del progetto. tokens.css è generato da qui:
// modificare il CSS a mano significa perdere la modifica alla prossima build.
export const PALETTE = {
  // Il campo: erba viva, con le strisce di taglio di un campo vero. Nessun testo
  // ci poggia sopra direttamente — sta sempre dentro un pannello (surface).
  background:         '#2E6B34',
  'grass-stripe':     '#29612F',
  // Il pannello: pieno, mai trasparente, con il suo bordo che lo stacca
  // dall'erba (almeno 3:1, verificato da contrast.test.ts).
  surface:            '#12301E',
  'panel-border':     '#9BD3A5',
  // Un pannello piu' chiaro per il solo invito principale (la card «Crea asta»):
  // lo distingue dagli altri senza cambiargli forma. Non e' un secondo fondo di
  // uso generale — tutto il resto resta su surface.
  'surface-raised':   '#163A24',
  foreground:         '#F1F7F2',
  'muted-foreground': '#87A594',
  accent:             '#FFC24B',
  'on-accent':        '#1B1400',
  positive:           '#5FD08A',
  destructive:        '#F07A5C',
  // I quattro ruoli. NON riusano positive e destructive nonostante la
  // somiglianza cromatica (il difensore e' verde, l'attaccante e' rosso): sono
  // coincidenze, non lo stesso significato. Il giorno in cui "positivo"
  // diventasse blu, i difensori non devono seguirlo.
  'role-p':           '#FFA552',
  'role-d':           '#7BDB9E',
  'role-c':           '#7FC4FF',
  'role-a':           '#FF8FA3',
};

// Divisori dentro i pannelli (line, line-strong) e il gesso delle linee del
// campo (chalk): bianco con alfa, perché il loro senso è "la stessa linea, più o
// meno marcata", non tre colori diversi.
export const LINES = {
  line:        'rgba(255,255,255,0.15)',
  'line-strong': 'rgba(255,255,255,0.25)',
  chalk:       'rgba(255,255,255,0.8)',
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
