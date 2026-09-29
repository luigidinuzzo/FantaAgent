import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryProvider } from '../api/QueryProvider';
import { LeaguesRoute } from './LeaguesRoute';

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
        { id: 'l1', name: 'Lega del Bar', admin: true, teamName: 'Anna FC', initial: 'A' },
      ]),
    }));
    renderLeagues();

    const link = await screen.findByRole('link', { name: /Lega del Bar/ });
    expect(link).toHaveAttribute('href', '/leghe/l1');
    expect(link).toHaveTextContent('Anna FC');
    expect(link).toHaveTextContent('Amministratore');
  });

  it('crea una lega e ci entra', async () => {
    const fetchMock = respond({
      'GET /api/me': () => json(ME),
      'GET /api/leagues': () => json([]),
      'POST /api/leagues': () => json({ id: 'l9', name: 'Nuova', admin: true, members: [] }, 201),
    });
    vi.stubGlobal('fetch', fetchMock);
    const router = renderLeagues();

    await userEvent.type(await screen.findByLabelText('Nome della lega'), 'Nuova');
    await userEvent.type(screen.getByLabelText('La tua squadra'), 'Anna FC');
    await userEvent.type(screen.getByLabelText('La tua iniziale'), 'a');
    await userEvent.click(screen.getByRole('button', { name: 'Crea la lega' }));

    expect(await screen.findByText('pagina della lega')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/leghe/l9');

    // L'iniziale si mostra maiuscola nel campo, ma deve viaggiare maiuscola anche
    // nella richiesta: chi digita "a" non deve spedire "a" mentre legge "A".
    const [, postInit] = fetchMock.mock.calls.find(
      ([url, init]) => url === '/api/leagues' && (init?.method ?? 'GET').toUpperCase() === 'POST',
    ) as [string, RequestInit];
    expect(JSON.parse(postInit.body as string)).toMatchObject({ initial: 'A' });
  });

  it('con l\'elenco e la creazione falliti insieme, un solo alert in pagina', async () => {
    const problem = (detail: string) => json({
      type: 'https://fantaagent.local/problems/service-unavailable', detail,
    }, 503);
    vi.stubGlobal('fetch', respond({
      'GET /api/me': () => json(ME),
      'GET /api/leagues': () => problem('Il servizio non risponde in questo momento. Riprova fra poco.'),
      'POST /api/leagues': () => problem('Il servizio non risponde in questo momento. Riprova fra poco.'),
    }));
    renderLeagues();

    await userEvent.type(await screen.findByLabelText('Nome della lega'), 'Nuova');
    await userEvent.type(screen.getByLabelText('La tua squadra'), 'Anna FC');
    await userEvent.type(screen.getByLabelText('La tua iniziale'), 'a');
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
});
