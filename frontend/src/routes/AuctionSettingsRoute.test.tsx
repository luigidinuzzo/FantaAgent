import { render, screen, waitFor, within } from '@testing-library/react';
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

function stub(locked: boolean, admin = true, overrides: Record<string, () => Response> = {}) {
  const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const key = `${(init?.method ?? 'GET').toUpperCase()} ${url}`;
    const routes: Record<string, () => Response> = {
      'GET /api/me': () => json({ id: 'u1', email: 'a@b.it', displayName: 'Anna', emailVerified: true }),
      'GET /api/leagues/l1': () => json({ ...LEAGUE, admin }),
      'GET /api/leagues/l1/auctions': () => json([CARD]),
      'GET /api/leagues/l1/auctions/a1/seats': () => json(SEATS(locked)),
      'PUT /api/leagues/l1/auctions/a1/seats': () => json(SEATS(locked)),
      'PATCH /api/leagues/l1/auctions/a1': () => new Response(null, { status: 204 }),
      ...overrides,
    };
    if (!routes[key]) throw new Error(`chiamata inattesa: ${key}`);
    return Promise.resolve(routes[key]());
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const calls = (fetchMock: ReturnType<typeof stub>, method: string) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === method);

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
    await userEvent.click(screen.getByRole('button', { name: 'Salva' }));

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
    await userEvent.click(screen.getByRole('button', { name: 'Salva' }));

    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
    expect(JSON.parse(put![1].body)).toHaveLength(3);
  });

  it('salva i secondi del banditore', async () => {
    const fetchMock = stub(true);
    renderSettings();
    await userEvent.click(await screen.findByRole('button', { name: 'Un secondo in più' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salva' }));

    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(JSON.parse(patch![1].body)).toEqual({ bidder: { bidTimerSeconds: 6, beepEnabled: true } });
  });

  it('chi non e\' amministratore vede il turno ma non lo cambia', async () => {
    stub(false, false);
    renderSettings();
    const order = await screen.findByRole('list', { name: 'Turno di chiamata' });
    expect(within(order).getByText('Bruno FC')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sposta/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salva' })).not.toBeInTheDocument();
    expect(screen.queryByText('Tutto salvato')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Nome della squadra di Anna')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Banditore' })).not.toBeInTheDocument();
  });

  it('una sola barra: un solo Salva per turno e banditore', async () => {
    stub(true);
    renderSettings();
    await screen.findByRole('list', { name: 'Turno di chiamata' });
    expect(screen.getByRole('heading', { level: 1, name: 'Asta' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Turno di chiamata' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Banditore' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salva il turno' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salva il banditore' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salva' })).toBeDisabled();
    expect(screen.getByText('Tutto salvato')).toBeInTheDocument();
  });

  it('spostare una squadra e cambiare i secondi, poi Salva: due scritture, una pressione', async () => {
    const fetchMock = stub(true);
    renderSettings();
    await userEvent.click(await screen.findByRole('button', { name: 'Sposta giù Anna FC' }));
    await userEvent.click(screen.getByRole('button', { name: 'Un secondo in più' }));
    expect(screen.getByText('Modifiche non salvate')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Salva' }));

    expect(await screen.findByText('Tutto salvato')).toBeInTheDocument();
    expect(calls(fetchMock, 'PUT')).toHaveLength(1);
    expect(calls(fetchMock, 'PATCH')).toHaveLength(1);
  });

  it('cambiato solo il banditore, salva solo il banditore', async () => {
    const fetchMock = stub(true);
    renderSettings();
    await userEvent.click(await screen.findByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Salva' }));

    await waitFor(() => expect(calls(fetchMock, 'PATCH')).toHaveLength(1));
    expect(JSON.parse(calls(fetchMock, 'PATCH')[0][1]!.body as string))
      .toEqual({ bidder: { bidTimerSeconds: 5, beepEnabled: false } });
    expect(calls(fetchMock, 'PUT')).toHaveLength(0);
  });

  it('un valore riportato com\'era non e\' una modifica', async () => {
    stub(true);
    renderSettings();
    await userEvent.click(await screen.findByRole('button', { name: 'Sposta giù Anna FC' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sposta giù Bruno FC' }));
    await userEvent.click(screen.getByRole('button', { name: 'Un secondo in più' }));
    await userEvent.click(screen.getByRole('button', { name: 'Un secondo in meno' }));
    expect(screen.getByText('Tutto salvato')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salva' })).toBeDisabled();
  });

  it('Annulla riporta turno e banditore a come sono salvati', async () => {
    stub(true);
    renderSettings();
    await userEvent.click(await screen.findByRole('button', { name: 'Sposta giù Anna FC' }));
    await userEvent.click(screen.getByRole('button', { name: 'Un secondo in più' }));
    await userEvent.click(screen.getByRole('button', { name: 'Annulla' }));

    const order = screen.getByRole('list', { name: 'Turno di chiamata' });
    expect(within(order).getAllByRole('listitem')[0]).toHaveTextContent('Anna FC');
    expect(screen.getByRole('spinbutton')).toHaveValue(5);
    expect(screen.getByText('Tutto salvato')).toBeInTheDocument();
  });

  it('se una delle due scritture fallisce, la barra dice quale', async () => {
    const fetchMock = stub(true, true, {
      'PUT /api/leagues/l1/auctions/a1/seats': () => json({ type: 'about:blank', detail: 'boom' }, 500),
    });
    renderSettings();
    await userEvent.click(await screen.findByRole('button', { name: 'Sposta giù Anna FC' }));
    await userEvent.click(screen.getByRole('button', { name: 'Un secondo in più' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salva' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Il turno non è stato salvato. Riprova.');
    expect(calls(fetchMock, 'PATCH')).toHaveLength(1);
    // Il banditore salvato non e' piu' una modifica; il turno si', e resta da salvare.
    const order = screen.getByRole('list', { name: 'Turno di chiamata' });
    expect(within(order).getAllByRole('listitem')[0]).toHaveTextContent('Bruno FC');
    expect(screen.getByRole('button', { name: 'Salva' })).toBeEnabled();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('se falliscono entrambe, la barra lo dice una volta', async () => {
    stub(true, true, {
      'PUT /api/leagues/l1/auctions/a1/seats': () => json({ type: 'about:blank' }, 500),
      'PATCH /api/leagues/l1/auctions/a1': () => json({ type: 'about:blank' }, 500),
    });
    renderSettings();
    await userEvent.click(await screen.findByRole('button', { name: 'Sposta giù Anna FC' }));
    await userEvent.click(screen.getByRole('button', { name: 'Un secondo in più' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salva' }));

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('Turno e banditore non sono stati salvati. Riprova.');
  });

  it('se fallisce solo il banditore, la barra dice il banditore', async () => {
    stub(true, true, {
      'PATCH /api/leagues/l1/auctions/a1': () => json({ type: 'about:blank' }, 500),
    });
    renderSettings();
    await userEvent.click(await screen.findByRole('button', { name: 'Un secondo in più' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salva' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Il banditore non è stato salvato. Riprova.');
  });

  it('le frecce sono da 44px e le righe da 56px', async () => {
    stub(true);
    renderSettings();
    const down = await screen.findByRole('button', { name: 'Sposta giù Anna FC' });
    expect(down.className).toMatch(/size-11|min-h-11/);
    expect(down.className).toContain('size-11');
    expect(down.closest('li')?.className).toContain('min-h-14');
  });
});
