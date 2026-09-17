// @vitest-environment node
//
// Questo file legge tokens.css da disco con node:fs; l'ambiente jsdom,
// diventato il default del progetto in questo task, sostituisce il
// costruttore globale URL e rompe il controllo "scheme file" di
// readFileSync. Qui serve il vero ambiente Node.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PALETTE, LINES, contrastRatio, hexToOklch } from '../../scripts/palette.mjs';

// Ogni coppia che l'interfaccia mette davvero una sopra l'altra.
//
// Il testo vive SEMPRE dentro un pannello (surface): l'erba (background) e' il
// campo, non un fondo da leggere. Per questo le coppie di testo sono tutte su
// surface, e l'unica coppia con background e' quella del bordo del pannello, che
// deve staccarlo dal campo (3:1, la soglia dei contorni dei componenti).
//
// La soglia del testo segue la DIMENSIONE con cui il colore viene reso: accent,
// positive e destructive escono a text-sm (14-16px), quindi 4.5 e non 3.
const PAIRS: Array<[keyof typeof PALETTE, keyof typeof PALETTE, number]> = [
  ['foreground', 'surface', 4.5],
  ['muted-foreground', 'surface', 4.5],
  ['accent', 'surface', 4.5],
  ['on-accent', 'accent', 4.5],
  ['on-accent', 'positive', 4.5],
  ['positive', 'surface', 4.5],
  ['destructive', 'surface', 4.5],
  // I quattro ruoli escono come testo dentro una pillola: 4.5, non 3.
  ['role-p', 'surface', 4.5],
  ['role-d', 'surface', 4.5],
  ['role-c', 'surface', 4.5],
  ['role-a', 'surface', 4.5],
  // Il bordo del pannello contro l'erba, su entrambe le strisce di taglio, e
  // contro il pannello stesso.
  ['panel-border', 'background', 3],
  ['panel-border', 'grass-stripe', 3],
  ['panel-border', 'surface', 3],
];

describe('palette Campo', () => {
  it.each(PAIRS)('%s su %s raggiunge %s:1', (fg, bg, min) => {
    expect(contrastRatio(PALETTE[fg], PALETTE[bg])).toBeGreaterThanOrEqual(min);
  });

  // Nella griglia delle rose la fascia di ruolo e' PIENA e porta la lettera in
  // scuro sopra di se': e' una coppia che il ciclo qui sopra non tocca, perche'
  // li il ruolo e' il fondo e non il testo.
  it.each(['role-p', 'role-d', 'role-c', 'role-a'] as const)(
    'on-accent raggiunge 4.5:1 sopra %s',
    (role) => {
      expect(contrastRatio(PALETTE['on-accent'], PALETTE[role])).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('tokens.css è rigenerato dalla palette corrente', () => {
    const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
    for (const [name, hex] of Object.entries(PALETTE)) {
      const { l, c, h } = hexToOklch(hex);
      const expected = `--${name}: oklch(${l.toFixed(4)} ${c.toFixed(4)} ${h.toFixed(2)});`;
      expect(css).toContain(expected);
      expect(css).toContain(`--color-${name}: var(--${name});`);
    }
    for (const [name, value] of Object.entries(LINES)) {
      expect(css).toContain(`--${name}: ${value};`);
      expect(css).toContain(`--color-${name}: var(--${name});`);
    }
  });
});
