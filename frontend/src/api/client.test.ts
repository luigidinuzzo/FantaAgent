import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ProblemError,
  api,
  apiGet,
  apiLeaguePut,
  apiPost,
  apiPostToAuction,
  fieldErrors,
  setAuctionContext,
} from './client';

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
   * `seq` e' per-registro: un tab lasciato aperto su un'asta e uno switch su
   * un'altra basterebbero, con l'indirizzo pinnato a {@code corrente}, a mandare
   * un {@code seq} al registro sbagliato. {@link apiPostToAuction} indirizza
   * l'asta passata esplicitamente, non quella del contesto della finestra.
   */
  it("apiPostToAuction indirizza l'asta passata, non quella del contesto", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiPostToAuction('2025-08-30', '/purchases/7/void');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/leagues/default/auctions/2025-08-30/purchases/7/void',
      expect.objectContaining({ method: 'POST' }),
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

  it('manda il token CSRF nelle scritture e non nelle letture', async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    vi.stubGlobal('fetch', fetchMock);

    await api('/api/auth/logout', { method: 'POST' });
    await api('/api/me').catch(() => {});

    const [, postInit] = fetchMock.mock.calls[0];
    expect(postInit.headers['X-XSRF-TOKEN']).toBe('token-di-prova');
    const [, getInit] = fetchMock.mock.calls[1];
    expect(getInit.headers['X-XSRF-TOKEN']).toBeUndefined();
  });

  it('senza cookie chiede il token prima di scrivere', async () => {
    document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/auth/csrf') {
        document.cookie = 'XSRF-TOKEN=appena-arrivato; path=/';
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    await api('/api/auth/login', { method: 'POST', body: { email: 'a', password: 'b' } });

    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/csrf');
    expect(fetchMock.mock.calls[1][1].headers['X-XSRF-TOKEN']).toBe('appena-arrivato');
    document.cookie = 'XSRF-TOKEN=token-di-prova; path=/';
  });

  it('legge gli errori per campo di un problema', () => {
    const error = new ProblemError('https://fantaagent.local/problems/invalid-account', 'x', 422,
      { errors: { email: ['Scrivi un indirizzo email valido.'] } });
    expect(fieldErrors(error)).toEqual({ email: ['Scrivi un indirizzo email valido.'] });
    expect(fieldErrors(new Error('altro'))).toEqual({});
  });
});
