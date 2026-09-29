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
    'GET /api/leagues/l1/auctions': () => json([]),
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

function renderLeagueWithAuctionRoute() {
  const router = createMemoryRouter([
    { path: '/leghe/:leagueId', element: <LeagueRoute /> },
    { path: '/leghe/:leagueId/aste/:auctionId', element: <p>pagina dell'asta</p> },
  ], { initialEntries: ['/leghe/l1'] });
  render(<QueryProvider><RouterProvider router={router} /></QueryProvider>);
  return router;
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

  it.each([true, false])('porta alle regole della lega, per tutti (amministratore: %s)', async (admin) => {
    stub(admin);
    renderLeague();
    expect(await screen.findByRole('link', { name: 'Regole della lega' })).toHaveAttribute('href', '/leghe/l1/regole');
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

  it('elenca le aste con il punto a cui sono e i crediti che restano', async () => {
    stub(false, {
      'GET /api/leagues/l1/auctions': () => json([{
        id: 'a1', name: 'Asta d\'estate', createdAt: '2026-09-28T20:00:00Z', lastWritten: '2026-09-28T21:00:00Z',
        purchases: 12, phase: 'D', teams: 8, budget: 500, totalSlots: 200, myBudgetRemaining: 320,
        bidder: { bidTimerSeconds: 5, beepEnabled: true },
      }]),
    });
    renderLeague();
    const link = await screen.findByRole('link', { name: /Asta d'estate/ });
    expect(link).toHaveAttribute('href', '/leghe/l1/aste/a1');
    expect(link).toHaveTextContent('12 di 200 giocatori');
    expect(link).toHaveTextContent('320 crediti');
  });

  it('l\'amministratore crea un\'asta e ci entra', async () => {
    stub(true, {
      'GET /api/leagues/l1/auctions': () => json([]),
      'POST /api/leagues/l1/auctions': () => json({
        id: 'a2', name: 'Riparazione', createdAt: '2026-09-28T20:00:00Z', lastWritten: null, purchases: 0,
        phase: 'P', teams: 2, budget: 500, totalSlots: 50, myBudgetRemaining: 500,
        bidder: { bidTimerSeconds: 5, beepEnabled: true },
      }, 201),
    });
    const router = renderLeagueWithAuctionRoute();
    await userEvent.type(await screen.findByLabelText('Nome della nuova asta'), 'Riparazione');
    await userEvent.click(screen.getByRole('button', { name: 'Crea l\'asta' }));
    expect(await screen.findByText('pagina dell\'asta')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/leghe/l1/aste/a2');
  });

  it('un membro puo\' lasciare la lega, l\'amministratore no', async () => {
    stub(false, { 'GET /api/leagues/l1/auctions': () => json([]) });
    renderLeague();
    expect(await screen.findByRole('button', { name: 'Lascia la lega' })).toBeInTheDocument();
  });

  it('l\'amministratore non lascia la lega, ma toglie gli altri dopo una conferma', async () => {
    const fetchMock = stub(true, {
      'DELETE /api/leagues/l1/members/u2': () => new Response(null, { status: 204 }),
    });
    renderLeague();
    await userEvent.click(await screen.findByRole('button', { name: 'Togli Bruno FC' }));
    expect(screen.queryByRole('button', { name: 'Lascia la lega' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Togli Anna FC' })).not.toBeInTheDocument();

    const dialog = screen.getByRole('dialog', { name: /Togliere «Bruno FC»/ });
    expect(dialog).toHaveTextContent('Sei sicuro? L\'azione è irreversibile.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Togli' }));

    await vi.waitFor(() => expect(fetchMock.mock.calls
      .some(([url, init]) => url === '/api/leagues/l1/members/u2' && init?.method === 'DELETE')).toBe(true));
  });

  it('chi lascia la lega conferma e torna all\'elenco delle leghe', async () => {
    stub(false, { 'DELETE /api/leagues/l1/members/u1': () => new Response(null, { status: 204 }) });
    const router = createMemoryRouter([
      { path: '/', element: <p>le mie leghe</p> },
      { path: '/leghe/:leagueId', element: <LeagueRoute /> },
    ], { initialEntries: ['/leghe/l1'] });
    render(<QueryProvider><RouterProvider router={router} /></QueryProvider>);

    await userEvent.click(await screen.findByRole('button', { name: 'Lascia la lega' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Esci dalla lega' }));

    expect(await screen.findByText('le mie leghe')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('il menu dell\'amministratore porta alle impostazioni dell\'asta', async () => {
    stub(true, {
      'GET /api/leagues/l1/auctions': () => json([{
        id: 'a1', name: 'Asta', createdAt: '2026-09-28T20:00:00Z', lastWritten: null,
        purchases: 0, phase: 'P', teams: 2, budget: 500, totalSlots: 50, myBudgetRemaining: 500,
        bidder: { bidTimerSeconds: 5, beepEnabled: true },
      }]),
    });
    renderLeague();
    await userEvent.click(await screen.findByRole('button', { name: 'Altre azioni per Asta' }));
    expect(screen.getByRole('menuitem', { name: 'Impostazioni dell\'asta' }))
      .toHaveAttribute('href', '/leghe/l1/aste/a1/impostazioni');
    expect(screen.getByRole('menuitem', { name: 'Rinomina' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Elimina' })).toBeInTheDocument();
  });

  it('chi non e\' amministratore non ha il menu delle aste', async () => {
    stub(false, {
      'GET /api/leagues/l1/auctions': () => json([{
        id: 'a1', name: 'Asta', createdAt: '2026-09-28T20:00:00Z', lastWritten: null,
        purchases: 0, phase: 'P', teams: 2, budget: 500, totalSlots: 50, myBudgetRemaining: null,
        bidder: { bidTimerSeconds: 5, beepEnabled: true },
      }]),
    });
    renderLeague();
    const link = await screen.findByRole('link', { name: /Asta/ });
    expect(link).not.toHaveTextContent('crediti');
    expect(screen.queryByRole('button', { name: 'Altre azioni per Asta' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Nome della nuova asta')).not.toBeInTheDocument();
  });
});
