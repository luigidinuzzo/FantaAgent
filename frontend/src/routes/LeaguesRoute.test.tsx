import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryProvider } from '../api/QueryProvider';
import { inviteToken, LeaguesRoute } from './LeaguesRoute';

const ME = { id: 'u1', email: 'a@b.it', displayName: 'Anna', emailVerified: true };

function respond(routes: Record<string, () => Response>) {
  return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const key = `${(init?.method ?? 'GET').toUpperCase()} ${url}`;
    const handler = routes[key];
    if (!handler) throw new Error(`chiamata inattesa: ${key}`);
    return Promise.resolve(handler());
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function renderLeagues() {
  const router = createMemoryRouter([
    { path: '/leghe', element: <LeaguesRoute /> },
    { path: '/leghe/:leagueId', element: <p>pagina della lega</p> },
    { path: '/invito/:token', element: <p>pagina dell'invito</p> },
  ], { initialEntries: ['/leghe'] });
  render(<QueryProvider><RouterProvider router={router} /></QueryProvider>);
  return router;
}

describe('LeaguesRoute', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('elenca le leghe con la propria squadra', async () => {
    vi.stubGlobal('fetch', respond({
      'GET /api/me': () => json(ME),
      'GET /api/leagues': () => json([
        { id: 'l1', name: 'Lega del Bar', admin: true, teamName: 'Anna FC', initial: 'A', members: 4, auctions: 2, pendingRequests: 2 },
      ]),
      'GET /api/join-requests': () => json([]),
    }));
    renderLeagues();

    const link = await screen.findByRole('link', { name: /Lega del Bar/ });
    expect(link).toHaveAttribute('href', '/leghe/l1');
    expect(link).toHaveTextContent('Anna FC');
    expect(link).toHaveTextContent('Amministri tu, 4 membri, 2 aste');
    expect(link).toHaveTextContent('2 richieste');
  });

  it('cerca una lega e chiede di entrare', async () => {
    let requested = false;
    const fetchMock = respond({
      'GET /api/me': () => json(ME),
      'GET /api/leagues': () => json([]),
      'GET /api/join-requests': () => json(requested
        ? [{ leagueId: 'l7', leagueName: 'Lega dei Cugini', teamName: 'Anna FC', requestedAt: '2026-09-30T10:00:00Z' }]
        : []),
      'GET /api/leagues/search?q=cugini': () => json([
        { id: 'l7', name: 'Lega dei Cugini', adminName: 'Marco', members: 7, status: requested ? 'PENDING' : 'NONE' },
      ]),
      'POST /api/join-requests/l7': () => { requested = true; return new Response(null, { status: 204 }); },
    });
    vi.stubGlobal('fetch', fetchMock);
    renderLeagues();

    const search = await screen.findByRole('searchbox', { name: 'Cerca la lega' });
    await userEvent.type(search, 'cu');
    expect(screen.getByText('Scrivi almeno 3 lettere del nome.')).toBeInTheDocument();
    await userEvent.type(search, 'gini');

    const found = await screen.findByRole('list', { name: 'Leghe trovate' });
    expect(within(found).getByText('Amministra Marco, 7 membri')).toBeInTheDocument();
    await userEvent.click(within(found).getByRole('button', { name: 'Chiedi di entrare in Lega dei Cugini' }));
    await userEvent.type(screen.getByLabelText('La tua squadra', { selector: '#join-team' }), 'Anna FC');
    await userEvent.click(screen.getByRole('button', { name: 'Manda la richiesta' }));

    expect(await screen.findByText(/Richiesta inviata a Marco/)).toBeInTheDocument();
    const [, init] = fetchMock.mock.calls.find(([url]) => url === '/api/join-requests/l7') as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ teamName: 'Anna FC' });
    // La richiesta compare fra le leghe, in attesa, con il gesto per ritirarla.
    expect(await screen.findByRole('button', { name: 'Ritira la richiesta per Lega dei Cugini' })).toBeInTheDocument();
  });

  it('crea una lega e ci entra', async () => {
    const fetchMock = respond({
      'GET /api/me': () => json(ME),
      'GET /api/leagues': () => json([]),
      'GET /api/join-requests': () => json([]),
      'POST /api/leagues': () => json({ id: 'l9', name: 'Nuova', admin: true, members: [] }, 201),
    });
    vi.stubGlobal('fetch', fetchMock);
    const router = renderLeagues();

    await userEvent.type(await screen.findByLabelText('Nome della lega'), 'Nuova');
    await userEvent.type(screen.getByLabelText('La tua squadra'), 'Anna FC');
    await userEvent.click(screen.getByRole('button', { name: 'Crea la lega' }));

    expect(await screen.findByText('pagina della lega')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/leghe/l9');

    // L'iniziale non si chiede e non si manda: la sceglie il server.
    const [, postInit] = fetchMock.mock.calls.find(
      ([url, init]) => url === '/api/leagues' && (init?.method ?? 'GET').toUpperCase() === 'POST',
    ) as [string, RequestInit];
    expect(JSON.parse(postInit.body as string)).toEqual({ name: 'Nuova', teamName: 'Anna FC' });
  });

  it('un errore su un campo che la pagina non mostra si legge comunque', async () => {
    vi.stubGlobal('fetch', respond({
      'GET /api/me': () => json(ME),
      'GET /api/leagues': () => json([]),
      'GET /api/join-requests': () => json([]),
      'POST /api/leagues': () => json({
        type: 'https://fantaagent.local/problems/invalid-league', detail: 'Alcuni dati non sono validi.',
        errors: { initial: ['L\'iniziale deve essere una lettera.'] },
      }, 422),
    }));
    renderLeagues();

    await userEvent.type(await screen.findByLabelText('Nome della lega'), 'Nuova');
    await userEvent.type(screen.getByLabelText('La tua squadra'), 'Anna FC');
    await userEvent.click(screen.getByRole('button', { name: 'Crea la lega' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('L\'iniziale deve essere una lettera.');
  });

  it('con l\'elenco e la creazione falliti insieme, un solo alert in pagina', async () => {
    const problem = (detail: string) => json({
      type: 'https://fantaagent.local/problems/service-unavailable', detail,
    }, 503);
    vi.stubGlobal('fetch', respond({
      'GET /api/me': () => json(ME),
      'GET /api/leagues': () => problem('Il servizio non risponde in questo momento. Riprova fra poco.'),
      'GET /api/join-requests': () => json([]),
      'POST /api/leagues': () => problem('Il servizio non risponde in questo momento. Riprova fra poco.'),
    }));
    renderLeagues();

    await userEvent.type(await screen.findByLabelText('Nome della lega'), 'Nuova');
    await userEvent.type(screen.getByLabelText('La tua squadra'), 'Anna FC');
    await userEvent.click(screen.getByRole('button', { name: 'Crea la lega' }));

    // QueryProvider ritenta una volta (retry: 1) la query dell'elenco prima di
    // arrendersi: il timeout predefinito di waitFor non basterebbe ad aspettare
    // quel giro, e i due messaggi (creazione, poi elenco) non compaiono insieme.
    await waitFor(() => {
      expect(screen.getAllByText(
        'Il servizio non risponde in questo momento. Riprova fra poco.',
      )).toHaveLength(2);
    }, { timeout: 3000 });
    const messages = screen.getAllByText('Il servizio non risponde in questo momento. Riprova fra poco.');
    expect(messages.filter((el) => el.getAttribute('role') === 'alert')).toHaveLength(1);
  });

  it('un link d\'invito incollato porta alla pagina dell\'invito', async () => {
    vi.stubGlobal('fetch', respond({
      'GET /api/me': () => json(ME),
      'GET /api/leagues': () => json([]),
      'GET /api/join-requests': () => json([]),
    }));
    const router = renderLeagues();

    const input = await screen.findByLabelText('Hai un link d\'invito?');
    await userEvent.type(input, 'ciao');
    await userEvent.click(screen.getByRole('button', { name: 'Entra con il link' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Questo non sembra un link d\'invito');

    await userEvent.clear(input);
    await userEvent.type(input, 'https://fanta.example/invito/AbCdEfGhIjKlMnOpQrSt_-12');
    await userEvent.click(screen.getByRole('button', { name: 'Entra con il link' }));
    expect(await screen.findByText('pagina dell\'invito')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/invito/AbCdEfGhIjKlMnOpQrSt_-12');
  });
});

describe('inviteToken', () => {
  it.each([
    ['https://fanta.example/invito/AbCdEfGhIjKlMnOpQrSt', 'AbCdEfGhIjKlMnOpQrSt'],
    ['  http://localhost:5173/invito/AbCdEfGhIjKlMnOpQrSt/  ', 'AbCdEfGhIjKlMnOpQrSt'],
    ['https://fanta.example/invito/AbCdEfGhIjKlMnOpQrSt?utm=x', 'AbCdEfGhIjKlMnOpQrSt'],
    ['AbCdEfGhIjKlMnOpQrSt', 'AbCdEfGhIjKlMnOpQrSt'],
    ['https://fanta.example/leghe/123', null],
    ['ciao', null],
  ])('%s', (text, token) => {
    expect(inviteToken(text)).toBe(token);
  });
});
