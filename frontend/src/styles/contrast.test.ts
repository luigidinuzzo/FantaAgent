// @vitest-environment node
//
// Questo file legge tokens.css da disco con node:fs; l'ambiente jsdom,
// diventato il default del progetto in questo task, sostituisce il
// costruttore globale URL e rompe il controllo "scheme file" di
// readFileSync. Qui serve il vero ambiente Node.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { PALETTE, LINES, contrastRatio, hexToOklch } from '../../scripts/palette.mjs';

/** Il colore che si vede davvero quando `fg` e' steso su `bg` con opacita' `alpha`. */
function blend(fg: string, bg: string, alpha: number): string {
  const channels = (hex: string) => hex.replace('#', '').match(/../g)!.map((c) => parseInt(c, 16));
  const [fr, fg_, fb] = channels(fg);
  const [br, bg_, bb] = channels(bg);
  const mix = (a: number, b: number) => Math.round(a * alpha + b * (1 - alpha));
  return `#${[mix(fr, br), mix(fg_, bg_), mix(fb, bb)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Le smorzature che NON sono testo: decorazione marcata {@code aria-hidden}, il cui
 * contenuto e' gia' detto a parole altrove. La soglia di contrasto vale per il testo
 * che porta informazione; un segno grafico che nessuno deve leggere non la deve.
 *
 * <p>Una per una, con la ragione: e' una deroga da giustificare, non una scappatoia.
 * Se una di queste smettesse di essere decorativa, la riga qui andrebbe tolta.
 */
const DECORATIVE = new Map([
  [
    'routes/ProjectionRoute.tsx: text-muted-foreground/50',
    'il trattino di un posto ancora libero: aria-hidden, e quanti ne mancano lo dice il conto',
  ],
]);

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
  // La card «Crea asta» usa surface-raised: tutto cio' che le sta sopra va verificato
  // anche li', non solo su surface.
  ['foreground', 'surface-raised', 4.5],
  ['muted-foreground', 'surface-raised', 4.5],
  ['accent', 'surface-raised', 4.5],
  ['positive', 'surface-raised', 4.5],
  ['panel-border', 'surface-raised', 3],
  ['muted-foreground', 'surface', 4.5],
  ['accent', 'surface', 4.5],
  ['on-accent', 'accent', 4.5],
  ['on-accent', 'positive', 4.5],
  // Il bottone «Elimina» della conferma di cancellazione.
  ['on-accent', 'destructive', 4.5],
  ['positive', 'surface', 4.5],
  ['destructive', 'surface', 4.5],
  // I quattro ruoli escono come testo dentro una pillola: 4.5, non 3.
  ['role-p', 'surface', 4.5],
  ['role-d', 'surface', 4.5],
  ['role-c', 'surface', 4.5],
  ['role-a', 'surface', 4.5],
  // Il marchio e la firma in fondo alla home stanno direttamente sull'erba: la firma
  // e' testo piccolo (4.5), «Agent» in accento e' testo grande (3).
  ['foreground', 'background', 4.5],
  ['foreground', 'grass-stripe', 4.5],
  ['accent', 'background', 3],
  ['accent', 'grass-stripe', 3],
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
  it.each(['crest-1', 'crest-2', 'crest-3', 'crest-4', 'crest-5', 'crest-6'] as const)(
    'la lettera dello stemma si legge su %s',
    (crest) => {
      expect(contrastRatio(PALETTE['on-accent'], PALETTE[crest])).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(['role-p', 'role-d', 'role-c', 'role-a'] as const)(
    'on-accent raggiunge 4.5:1 sopra %s',
    (role) => {
      expect(contrastRatio(PALETTE['on-accent'], PALETTE[role])).toBeGreaterThanOrEqual(4.5);
    },
  );

  /**
   * Le coppie qui sopra verificano i TOKEN. Ma una classe puo' smorzare un token
   * con un'opacita' — `text-muted-foreground/80` — e quel testo non e' piu' il
   * colore verificato: e' la sua miscela col fondo. `muted-foreground` passa a
   * 5.34:1, all'80% scende a 3.99 e non arriva piu' alla soglia del testo piccolo.
   *
   * <p>Questo test non elenca le occorrenze: le CERCA nel sorgente. Una nuova
   * scritta smorzata scritta fra sei mesi viene presa senza che nessuno si ricordi
   * di aggiungerla a una lista.
   */
  it('nessuna scritta smorzata da un opacita scende sotto 4.5:1 sul pannello', () => {
    const files = readdirSync(new URL('..', import.meta.url), { recursive: true, encoding: 'utf8' })
      .filter((f) => (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.includes('.test.'));

    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
      for (const [, token, pct] of source.matchAll(/text-([a-z-]+)\/(\d{1,3})\b/g)) {
        const base = PALETTE[token as keyof typeof PALETTE];
        if (base === undefined) continue;
        const found = `${file}: text-${token}/${pct}`;
        if (DECORATIVE.has(found)) continue;
        const ratio = contrastRatio(blend(base, PALETTE.surface, Number(pct) / 100), PALETTE.surface);
        if (ratio < 4.5) offenders.push(`${found} → ${ratio.toFixed(2)}:1`);
      }
    }
    expect(offenders).toEqual([]);
  });

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
