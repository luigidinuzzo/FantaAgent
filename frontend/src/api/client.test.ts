import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProblemError, apiGet, apiPost, setAuctionContext } from './client';

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
});
