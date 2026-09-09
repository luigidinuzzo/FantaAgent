import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { setAuctionContext } from '../api/client';
import { QueryProvider } from '../api/QueryProvider';
import { publishBid } from '../domain/bidChannel';
import { ProjectionRoute } from './ProjectionRoute';

const BOARD = {
  auctionId: 'a1',
  currentPhase: 'D',
  columns: [
    {
      participantId: 'anna',
      participantName: 'Anna',
      me: true,
      budgetRemaining: 300,
      slotsRemaining: 25,
      byRole: { P: [], D: [], C: [], A: [] },
    },
  ],
};

const PLAYER = {
  playerId: 'd1', name: 'Bastoni', team: 'Inter', role: 'D' as const,
  listPrice: 20, timerSeconds: 5, beepEnabled: false,
};

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function stubFetch() {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const href = typeof input === 'string' ? input : input.toString();
    if (href.includes('/board/bidder/d1')) return Promise.resolve(jsonResponse(PLAYER));
    if (href.endsWith('/board')) return Promise.resolve(jsonResponse(BOARD));
    return Promise.reject(new Error(`URL non prevista nel test: ${href}`));
  });
  vi.stubGlobal('fetch', fetchMock);
}

function renderProjection() {
  render(
    <QueryProvider>
      <MemoryRouter>
        <ProjectionRoute />
      </MemoryRouter>
    </QueryProvider>,
  );
}

describe('ProjectionRoute', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('non offre nessuna azione: si guarda soltanto', () => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
    stubFetch();
    renderProjection();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  });

  it('mostra il lotto quando la schermata privata lo trasmette', async () => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
    stubFetch();
    renderProjection();
    publishBid({ kind: 'bidding', playerId: 'd1', price: 41, remainingMs: 3000, totalMs: 5000 });
    // Il prezzo arriva dal canale ed e' visibile subito; il nome arriva dal server.
    expect(await screen.findByTestId('public-price')).toHaveTextContent('41');
  });

  it('dice di non ricevere invece di restare ferma fingendo', () => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
    stubFetch();
    vi.stubGlobal('BroadcastChannel', undefined);
    renderProjection();
    expect(screen.getByText(/non riceve dalla schermata privata/i)).toBeInTheDocument();
  });
});
