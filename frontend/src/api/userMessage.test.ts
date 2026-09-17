import { describe, expect, it } from 'vitest';
import { ProblemError, userMessage } from './client';

const problem = (slug: string, detail: string) =>
  new ProblemError(`https://fantaagent.local/problems/${slug}`, detail, 400, {});

describe('userMessage', () => {
  it('mostra il testo del server quando e scritto per chi gioca', () => {
    expect(userMessage(problem('insufficient-budget', 'Anna ha solo 12 crediti di budget residuo'), 'ripiego'))
      .toBe('Anna ha solo 12 crediti di budget residuo');
  });

  /**
   * Il caso vero: un backend avviato prima che la cancellazione esistesse rispondeva
   * «Indirizzo inesistente: /api/leagues/default/auctions/2026-09-12», e la modale lo
   * mostrava cosi' com'era a chi voleva solo cancellare un'asta.
   */
  it.each([
    ['unknown-endpoint', 'Indirizzo inesistente: /api/leagues/default/auctions/2026-09-12'],
    ['unknown-auction', 'asta sconosciuta: 2026-09-12'],
    ['internal-error', 'Errore interno del server.'],
    ['purchase-not-found', 'nessun acquisto con id 7'],
    ['invalid-request', 'fase non prevista dal regolamento: X'],
  ])('per %s mostra la frase della schermata, non il dettaglio tecnico', (slug, detail) => {
    expect(userMessage(problem(slug, detail), "Non è stato possibile eliminare l'asta. Riprova."))
      .toBe("Non è stato possibile eliminare l'asta. Riprova.");
  });

  it('un errore di rete, senza problem, usa la frase della schermata', () => {
    expect(userMessage(new TypeError('Failed to fetch'), 'ripiego')).toBe('ripiego');
  });
});
