// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('..', import.meta.url));

/**
 * Dove i 12px sono ammessi, e perche': solo cio' che e' decorazione o ripete a
 * parole qualcosa detto altrove. Vuoto oggi. Una voce qui e' una deroga da
 * giustificare una per una, sul modello di DECORATIVE in contrast.test.ts.
 */
const SMALL = new Map<string, number>([]);

function sources(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) sources(path, found);
    else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) found.push(path);
  }
  return found;
}

describe('la misura del testo', () => {
  // Se la scansione trovasse zero file passerebbe comunque, a vuoto: un
  // controllo che non guarda nessun sorgente non prova niente.
  it('la scansione trova davvero i sorgenti', () => {
    expect(sources(SRC).length).toBeGreaterThan(50);
  });

  // Seconde righe, etichette e note erano a 12px su verde scuro: si leggevano a
  // fatica sul portatile e per niente sul telefono. La misura piu' piccola per un
  // testo che informa e' text-meta, 13px.
  it('nessun testo che informa scende sotto i 13px', () => {
    const offenders: string[] = [];
    for (const file of sources(SRC)) {
      const relative = file.slice(SRC.length);
      const count = (readFileSync(file, 'utf8').match(/\btext-xs\b/g) ?? []).length;
      const allowed = SMALL.get(relative) ?? 0;
      if (count > allowed) offenders.push(`${relative}: ${count} text-xs, ne sono ammessi ${allowed}`);
    }
    expect(offenders).toEqual([]);
  });
});
