import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryProvider } from '../api/QueryProvider';
import { LeagueRoute } from './LeagueRoute';

const ME = { id: 'u1', email: 'a@b.it', displayName: 'Anna', emailVerified: true };
const MEMBERS = [
  { userId: 'u1', displayName: 'Anna', teamName: 'Anna FC', initial: 'A', role: 'ADMIN', me: true },
  { userId: 'u2', displayName: 'Bruno', teamName: 'Bruno FC', initial: 'B', role: 'MEMBER', me: false },
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function stub(admin: boolean, extra: Record<string, () => Response> = {}) {
  const routes: Record<string, () => Response> = {
    'GET /api/me': () => json(ME),
    'GET /api/leagues/l1': () => json({ id: 'l1', name: 'Lega del Bar', admin, members: MEMBERS }),
    'GET /api/leagues/l1/invites': () => json([]),
    ...extra,
  };
  const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const key = `${(init?.method ?? 'GET').toUpperCase()} ${url}`;
    if (!routes[key]) throw new Error(`chiamata inattesa: ${key}`);
    return Promise.resolve(routes[key]());
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderLeague() {
  const router = createMemoryRouter([{ path: '/leghe/:leagueId', element: <LeagueRoute /> }],
    { initialEntries: ['/leghe/l1'] });
  render(<QueryProvider><RouterProvider router={router} /></QueryProvider>);
}

describe('LeagueRoute', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('mostra i membri con la loro squadra', async () => {
    stub(false);
    renderLeague();
    const members = await screen.findByRole('list', { name: 'Membri' });
    expect(within(members).getByText('Bruno FC')).toBeInTheDocument();
    expect(within(members).getByText('Anna FC')).toBeInTheDocument();
  });

  it('chi non e\' amministratore non vede gli inviti', async () => {
    const fetchMock = stub(false);
    renderLeague();
    await screen.findByRole('list', { name: 'Membri' });
    expect(screen.queryByRole('button', { name: 'Crea un link d\'invito' })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/leagues/l1/invites')).toBe(false);
  });

  it('l\'amministratore crea un link e lo vede una volta', async () => {
    stub(true, {
      'POST /api/leagues/l1/invites': () => json({
        id: 'i1', link: 'https://fanta.example/invito/abc', expiresAt: '2026-10-12T20:00:00Z',
      }, 201),
    });
    renderLeague();

    await userEvent.click(await screen.findByRole('button', { name: 'Crea un link d\'invito' }));

    expect(await screen.findByRole('textbox', { name: 'Link d\'invito' }))
      .toHaveValue('https://fanta.example/invito/abc');
  });
});
