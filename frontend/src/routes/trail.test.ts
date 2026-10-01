// @vitest-environment node
//
// Legge le pagine da disco: il primo passo del percorso e' lo stesso ovunque, e una
// pagina che lo scrive diverso non si vede finche' non ci si arriva.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROUTES = fileURLToPath(new URL('.', import.meta.url));

const pages = readdirSync(ROUTES)
  .filter((name) => /Route\.tsx$/.test(name))
  .map((name) => ({ name, source: readFileSync(join(ROUTES, name), 'utf8') }));

describe('il percorso', () => {
  it('la scansione trova le pagine col percorso', () => {
    expect(pages.filter((p) => /trail=|const trail/.test(p.source)).length).toBeGreaterThan(5);
  });

  /** La home si chiama «Le tue aste»: «Le mie leghe» come primo passo non diceva dove si torna. */
  it('ogni pagina comincia da «Home», che porta alla radice', () => {
    const wrong = pages.filter((p) => p.source.includes("'Le mie leghe'")).map((p) => p.name);
    expect(wrong).toEqual([]);
    const linked = pages.filter((p) => /const trail/.test(p.source) || /trail=\{\[/.test(p.source))
      .filter((p) => p.name !== 'LeaguesRoute.tsx' && !/trail=\{\[\{ label: 'Home' \}\]\}/.test(p.source))
      .filter((p) => !p.source.includes("{ label: 'Home', to: '/' }"))
      .map((p) => p.name);
    expect(linked).toEqual([]);
  });
});
