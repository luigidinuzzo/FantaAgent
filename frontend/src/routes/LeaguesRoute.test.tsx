import { render, screen } from '@testing-library/react';
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
    vi.stubGlobal('fetch', respond({
      'GET /api/me': () => json(ME),
      'GET /api/leagues': () => json([]),
      'POST /api/leagues': () => json({ id: 'l9', name: 'Nuova', admin: true, members: [] }, 201),
    }));
    const router = renderLeagues();

    await userEvent.type(await screen.findByLabelText('Nome della lega'), 'Nuova');
    await userEvent.type(screen.getByLabelText('La tua squadra'), 'Anna FC');
    await userEvent.type(screen.getByLabelText('La tua iniziale'), 'a');
    await userEvent.click(screen.getByRole('button', { name: 'Crea la lega' }));

    expect(await screen.findByText('pagina della lega')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/leghe/l9');
  });
});
