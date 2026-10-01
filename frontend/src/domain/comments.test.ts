// @vitest-environment node
//
// I commenti del frontend dicono cosa fa l'interfaccia, non come e' fatto il
// backend: un nome di classe Java qui invecchia senza che nessuno se ne accorga.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('..', import.meta.url));

function sources(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'legacy') sources(path, found);
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) found.push(path);
  }
  return found;
}

describe('i commenti', () => {
  it('nessun nome di classe del backend', () => {
    const files = sources(SRC);
    expect(files.length).toBeGreaterThan(50);
    const offenders = files.flatMap((file) =>
      (readFileSync(file, 'utf8').match(/\b[A-Z][A-Za-z]+(?:Service|Repository|Controller|Handler)\b(?:\.\w+)?/g) ?? [])
        .map((name) => `${relative(SRC, file)}: ${name}`));
    expect(offenders).toEqual([]);
  });
});
