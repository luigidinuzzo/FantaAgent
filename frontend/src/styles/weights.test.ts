// @vitest-environment node
//
// Come contrast.test.ts, questo test legge i sorgenti da disco: una regola di
// scala tipografica non vive in un componente, vive nel rapporto fra tutti. Un
// test che rendesse un componente alla volta non potrebbe mai dire «questo e' il
// numero piu' pesante della pagina», che e' esattamente l'affermazione da
// difendere.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = new URL('..', import.meta.url).pathname;

/**
 * Dove il peso massimo e' ammesso, e perche'.
 *
 * <p>Il difetto che questo test blocca: quasi ogni numero dell'applicazione era
 * {@code font-extrabold}. Se tutto e' pesante il peso smette di dire quale numero
 * conta, e la gerarchia resta affidata alla sola dimensione — si faticava a
 * tornare col colpo d'occhio sul tetto, che e' il numero per cui l'applicazione
 * esiste.
 *
 * <p>La regola: <b>un numero eroe per schermata</b>. Sul portatile e' il tetto (e,
 * mentre il conto corre, l'offerta: il numero su cui si decide adesso); sulla
 * proiezione sono i numeri che la sala legge da lontano, dove la gerarchia e'
 * un'altra perche' non c'e' nient'altro in pagina. Tutto il resto scende di un
 * gradino.
 *
 * <p>Una voce in piu' qui e' una deroga da giustificare, non una scappatoia.
 */
const HEROES = new Map([
  ['domain/PlayerDecisionCard.tsx', 1],
  // Mentre il conto corre il numero su cui si decide e' l'offerta: le altre due
  // letture (tempo, chi e' in testa) non prendono piu' il peso massimo.
  ['domain/BidderDialog.tsx', 1],
  // La proiezione e' l'altra schermata: si legge da tutto il tavolo, e li' il
  // prezzo, il nome e il conto SONO la pagina. Non c'e' niente da cui staccarli.
  ['domain/PublicBidderDialog.tsx', 4],
  ['routes/ProjectionRoute.tsx', 3],
  // Il marchio: il suo peso e' identita', non gerarchia.
  ['domain/Wordmark.tsx', 0],
]);

function sources(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) sources(path, found);
    else if (entry.name.endsWith('.tsx') && !entry.name.includes('.test.')) found.push(path);
  }
  return found;
}

describe('la scala dei pesi', () => {
  it('riserva il peso massimo ai numeri eroe, e a nessun altro', () => {
    const offenders: string[] = [];

    for (const file of sources(SRC)) {
      const relative = file.slice(SRC.length);
      const count = (readFileSync(file, 'utf8').match(/font-extrabold/g) ?? []).length;
      const allowed = HEROES.get(relative) ?? 0;
      if (count > allowed) {
        offenders.push(`${relative}: ${count} font-extrabold, ne sono ammessi ${allowed}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
