import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PALETTE, LINES, contrastRatio, hexToOklch } from '../../scripts/palette.mjs';

// Ogni coppia che la direzione Campo mette davvero una sopra l'altra.
// 4.5:1 per il testo normale, 3:1 per il testo grande (il tetto, 76px).
const PAIRS: Array<[keyof typeof PALETTE, keyof typeof PALETTE, number]> = [
  ['foreground', 'background', 4.5],
  ['foreground', 'surface', 4.5],
  ['muted-foreground', 'background', 4.5],
  ['muted-foreground', 'surface', 4.5],
  ['accent', 'background', 3],
  ['accent', 'surface', 3],
  ['on-accent', 'accent', 4.5],
  ['positive', 'surface', 3],
  ['destructive', 'surface', 3],
];

describe('palette Campo', () => {
  it.each(PAIRS)('%s su %s raggiunge %s:1', (fg, bg, min) => {
    expect(contrastRatio(PALETTE[fg], PALETTE[bg])).toBeGreaterThanOrEqual(min);
  });

  it('tokens.css è rigenerato dalla palette corrente', () => {
    const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
    for (const [name, hex] of Object.entries(PALETTE)) {
      const { l, c, h } = hexToOklch(hex);
      const expected = `--${name}: oklch(${l.toFixed(4)} ${c.toFixed(4)} ${h.toFixed(2)});`;
      expect(css).toContain(expected);
      expect(css).toContain(`--color-${name}: var(--${name});`);
    }
    for (const name of Object.keys(LINES)) {
      expect(css).toContain(`--color-${name}: var(--${name});`);
    }
  });
});
