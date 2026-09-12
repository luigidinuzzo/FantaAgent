// @vitest-environment node
//
// Questo file legge tokens.css da disco con node:fs; l'ambiente jsdom,
// diventato il default del progetto in questo task, sostituisce il
// costruttore globale URL e rompe il controllo "scheme file" di
// readFileSync. Qui serve il vero ambiente Node.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PALETTE, LINES, contrastRatio, hexToOklch } from '../../scripts/palette.mjs';

// Ogni coppia che la direzione Campo mette davvero una sopra l'altra.
// La soglia segue la DIMENSIONE con cui il colore viene reso, non il ruolo del
// token: 3:1 vale solo per il testo grande. accent, positive e destructive
// erano fermi a 3 ma escono a text-sm (14-16px) in PlayerDecisionCard,
// PlayerTable, ConnectionStatus e SquadCards, dove serve 4.5. Li superano
// gia' tutti: la soglia bassa non proteggeva le dimensioni spedite, e avrebbe
// lasciato passare la prima ritinteggiatura che le avesse peggiorate.
const PAIRS: Array<[keyof typeof PALETTE, keyof typeof PALETTE, number]> = [
  ['foreground', 'background', 4.5],
  ['foreground', 'surface', 4.5],
  ['muted-foreground', 'background', 4.5],
  ['muted-foreground', 'surface', 4.5],
  ['accent', 'background', 4.5],
  ['accent', 'surface', 4.5],
  ['on-accent', 'accent', 4.5],
  ['positive', 'background', 4.5],
  ['positive', 'surface', 4.5],
  ['destructive', 'background', 4.5],
  ['destructive', 'surface', 4.5],
  // I quattro ruoli escono come testo dentro una pillola e come fascia sopra la
  // griglia delle rose: 4.5, non 3, perche' e' testo piccolo, esattamente come
  // accent, positive e destructive qui sopra.
  ['role-p', 'background', 4.5],
  ['role-p', 'surface', 4.5],
  ['role-d', 'background', 4.5],
  ['role-d', 'surface', 4.5],
  ['role-c', 'background', 4.5],
  ['role-c', 'surface', 4.5],
  ['role-a', 'background', 4.5],
  ['role-a', 'surface', 4.5],
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
