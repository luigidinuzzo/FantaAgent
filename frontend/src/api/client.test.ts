import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProblemError, apiGet, apiLeaguePut, apiPost, setAuctionContext } from './client';

describe('client API', () => {
  beforeEach(() => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('costruisce la URL nella forma multi-lega', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await apiGet('/state');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/leagues/default/auctions/a1/state',
      expect.anything(),
    );
  });

  it("traduce problem+json in un errore con lo slug del tipo", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            type: 'https://fantaagent.local/problems/insufficient-budget',
            detail: 'Anna ha solo 12 crediti di budget residuo',
            status: 422,
          }),
          { status: 422, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );

    await expect(apiPost('/purchases', {})).rejects.toMatchObject({
      slug: 'insufficient-budget',
      detail: 'Anna ha solo 12 crediti di budget residuo',
      status: 422,
    });
  });

  it('un errore senza corpo problem resta comunque un ProblemError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 500 })),
    );

    await expect(apiGet('/state')).rejects.toBeInstanceOf(ProblemError);
  });

  it('una risposta 204 non prova a leggere JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    await expect(apiPost('/phase', { role: 'C' })).resolves.toBeNull();
  });

  it('apiLeaguePut manda un PUT alla lega, non all\'asta', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ auctionId: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await apiLeaguePut('/settings', { auctionName: 'Lega' });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/leagues/default/settings',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  /**
   * Il meccanismo su cui la schermata Impostazioni si regge: ProblemError non
   * conosce la forma di ogni corpo di errore dell'API, quindi porta il corpo intero
   * indistinto, e chi chiama restringe il tipo da solo per lo slug che gli interessa.
   */
  it('porta al chiamante il corpo intero del problem, con qualunque proprieta abbia', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            type: 'https://fantaagent.local/problems/invalid-settings',
            detail: 'Alcune impostazioni non sono valide.',
            errors: { auction: [], participants: ['errore'], scoring: [], bidder: [] },
          }),
          { status: 422, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );

    const error = await apiPost('/purchases', {}).catch((e) => e as ProblemError);

    expect(error).toBeInstanceOf(ProblemError);
    expect((error as ProblemError).body).toMatchObject({
      errors: { participants: ['errore'] },
    });
  });
});
