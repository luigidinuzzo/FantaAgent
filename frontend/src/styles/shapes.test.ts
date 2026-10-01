// @vitest-environment node
//
// Come weights.test.ts, legge i sorgenti da disco: «tutto e' una pillola» non e' il
// difetto di un componente, e' il rapporto fra tutti.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('..', import.meta.url));

/**
 * Dove la pillola e' ammessa, e perche': solo cio' che e' uno stato o un'etichetta.
 * Bottoni, campi e pannelli hanno il raggio da 8px. Una voce in piu' qui e' una
 * deroga da giustificare, non una scappatoia.
 */
const PILLS = new Map([
  // Il distintivo del ruolo: una lettera in un tondo.
  ['domain/RoleBadge.tsx', 1],
  // Il pallino dello stato della connessione.
  ['domain/ConnectionStatus.tsx', 1],
  // Il conteggio delle richieste da decidere.
  ['routes/LeaguesRoute.tsx', 1],
  // Lo stato di un'asta nella home: «In corso», «Da iniziare».
  ['domain/MyAuctionCard.tsx', 1],
  // L'iniziale di un membro.
  ['routes/LeagueRoute.tsx', 1],
  // La riga dello scheletro mentre le regole si caricano.
  ['routes/LeagueRulesRoute.tsx', 1],
  // Il pallino del ruolo in ogni fase del controllo segmentato.
  ['domain/PhaseSwitcher.tsx', 1],
  // Il distintivo «Solo tu»: un'etichetta.
  ['domain/OnlyYouBadge.tsx', 1],
]);

function sources(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) sources(path, found);
    else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) found.push(path);
  }
  return found;
}

describe('le forme', () => {
  // Se la scansione trovasse zero file passerebbe comunque, a vuoto: un
  // controllo che non guarda nessun sorgente non prova niente.
  it('la scansione trova davvero i sorgenti', () => {
    expect(sources(SRC).length).toBeGreaterThan(50);
  });

  it('nessun raggio oltre gli 8px: pannelli, bottoni e campi sono rounded-lg', () => {
    const offenders: string[] = [];
    for (const file of sources(SRC)) {
      const found = readFileSync(file, 'utf8').match(/rounded-(?:[a-z]{1,2}-)?(?:xl|2xl|3xl|4xl)\b/g);
      if (found) offenders.push(`${file.slice(SRC.length)}: ${found.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });

  it('la pillola resta a cio che e uno stato o un etichetta', () => {
    const offenders: string[] = [];
    for (const file of sources(SRC)) {
      const relative = file.slice(SRC.length);
      const count = (readFileSync(file, 'utf8').match(/rounded-full/g) ?? []).length;
      const allowed = PILLS.get(relative) ?? 0;
      if (count > allowed) offenders.push(`${relative}: ${count} rounded-full, ne sono ammessi ${allowed}`);
    }
    expect(offenders).toEqual([]);
  });
});
