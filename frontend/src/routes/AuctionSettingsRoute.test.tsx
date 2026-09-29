import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryProvider } from '../api/QueryProvider';
import { AuctionSettingsRoute } from './AuctionSettingsRoute';

const LEAGUE = {
  id: 'l1', name: 'Lega del Bar', admin: true, members: [
    { userId: 'u1', displayName: 'Anna', teamName: 'Anna FC', initial: 'A', role: 'ADMIN', me: true },
    { userId: 'u2', displayName: 'Bruno', teamName: 'Bruno FC', initial: 'B', role: 'MEMBER', me: false },
    { userId: 'u3', displayName: 'Carla', teamName: 'Carla FC', initial: 'C', role: 'MEMBER', me: false },
  ],
};
const CARD = {
  id: 'a1', name: 'Asta', createdAt: '2026-09-28T20:00:00Z', lastWritten: null, purchases: 0, phase: 'P',
  teams: 2, budget: 500, totalSlots: 50, myBudgetRemaining: 500, bidder: { bidTimerSeconds: 5, beepEnabled: true },
};
const SEATS = (locked: boolean) => ({
  locked, seats: [
    { userId: 'u1', displayName: 'Anna', teamName: 'Anna FC', initial: 'A', position: 1 },
    { userId: 'u2', displayName: 'Bruno', teamName: 'Bruno FC', initial: 'B', position: 2 },
  ],
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function stub(locked: boolean, admin = true) {
  const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const key = `${(init?.method ?? 'GET').toUpperCase()} ${url}`;
    const routes: Record<string, () => Response> = {
      'GET /api/me': () => json({ id: 'u1', email: 'a@b.it', displayName: 'Anna', emailVerified: true }),
      'GET /api/leagues/l1': () => json({ ...LEAGUE, admin }),
      'GET /api/leagues/l1/auctions': () => json([CARD]),
      'GET /api/leagues/l1/auctions/a1/seats': () => json(SEATS(locked)),
      'PUT /api/leagues/l1/auctions/a1/seats': () => json(SEATS(locked)),
      'PATCH /api/leagues/l1/auctions/a1': () => new Response(null, { status: 204 }),
    };
    if (!routes[key]) throw new Error(`chiamata inattesa: ${key}`);
    return Promise.resolve(routes[key]());
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderSettings() {
  const router = createMemoryRouter([
    { path: '/leghe/:leagueId/aste/:auctionId/impostazioni', element: <AuctionSettingsRoute /> },
  ], { initialEntries: ['/leghe/l1/aste/a1/impostazioni'] });
  render(<QueryProvider><RouterProvider router={router} /></QueryProvider>);
}

describe('AuctionSettingsRoute', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('cambia il turno di chiamata', async () => {
    const fetchMock = stub(true);
    renderSettings();
    await userEvent.click(await screen.findByRole('button', { name: 'Sposta su Bruno FC' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salva il turno' }));

    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
    expect(JSON.parse(put![1].body).map((s: { userId: string }) => s.userId)).toEqual(['u2', 'u1']);
  });

  it('ad asta iniziata nomi e iniziali non si toccano', async () => {
    stub(true);
    renderSettings();
    expect(await screen.findByText(/si può cambiare solo il turno di chiamata/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Nome della squadra di Anna')).not.toBeInTheDocument();
  });

  it('prima dell\'inizio si aggiunge chi non ha un posto', async () => {
    const fetchMock = stub(false);
    renderSettings();
    const missing = await screen.findByRole('list', { name: 'Membri senza posto' });
    await userEvent.click(within(missing).getByRole('button', { name: 'Aggiungi Carla FC' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salva il turno' }));

    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
    expect(JSON.parse(put![1].body)).toHaveLength(3);
  });

  it('salva i secondi del banditore', async () => {
    const fetchMock = stub(true);
    renderSettings();
    await userEvent.click(await screen.findByRole('button', { name: 'Un secondo in più' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salva il banditore' }));

    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(JSON.parse(patch![1].body)).toEqual({ bidder: { bidTimerSeconds: 6, beepEnabled: true } });
  });

  it('chi non e\' amministratore vede il turno ma non lo cambia', async () => {
    stub(false, false);
    renderSettings();
    const order = await screen.findByRole('list', { name: 'Turno di chiamata' });
    expect(within(order).getByText('Bruno FC')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sposta/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salva il turno' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Nome della squadra di Anna')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Banditore' })).not.toBeInTheDocument();
  });
});
