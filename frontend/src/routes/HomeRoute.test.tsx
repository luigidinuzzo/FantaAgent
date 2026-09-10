import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryProvider } from '../api/QueryProvider';
import { setAuctionContext } from '../api/client';
import { HomeRoute } from './HomeRoute';

const CARDS = [
  { id: '2026-09-02', label: 'Lega No Name', lastWritten: '2026-09-02T13:08:41Z',
    purchases: 3, phase: 'D', selected: false },
  { id: '2025-08-30', label: '2025-08-30', lastWritten: '2025-08-30T20:00:00Z',
    purchases: 200, phase: 'A', selected: false },
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json' },
  });
}

function renderHome() {
  setAuctionContext({ leagueId: 'default', auctionId: 'corrente' });
  render(
    <QueryProvider>
      <MemoryRouter>
        <HomeRoute />
      </MemoryRouter>
    </QueryProvider>,
  );
}

describe('HomeRoute', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('elenca le aste con quanto serve a riconoscerle', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(CARDS)));
    renderHome();

    expect(await screen.findByText('Lega No Name')).toBeInTheDocument();
    expect(screen.getByText(/3 acquisti/)).toBeInTheDocument();
    expect(screen.getByText('2025-08-30')).toBeInTheDocument();
  });

  it('riprende un asta e chiede al server di selezionarla', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(CARDS))
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    renderHome();

    await userEvent.click(await screen.findByRole('button', { name: /riprendi lega no name/i }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/leagues/default/auctions/2026-09-02/select',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('senza aste invita a crearne una invece di restare vuota', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([])));
    renderHome();

    expect(await screen.findByText(/nessuna asta/i)).toBeInTheDocument();
  });
});
