import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { setAuctionContext } from '../api/client';
import { QueryProvider } from '../api/QueryProvider';
import { RecapRoute } from './RecapRoute';

const BOARD = {
  auctionId: 'a1',
  currentPhase: 'D',
  columns: [
    {
      participantId: 'anna', participantName: 'Anna', me: true,
      budgetRemaining: 280, slotsRemaining: 23,
      byRole: {
        P: [{ seq: 1, playerName: 'Sommer', price: 12 }],
        D: [{ seq: 2, playerName: 'Bastoni', price: 20 }],
        C: [], A: [],
      },
    },
    {
      participantId: 'bruno', participantName: 'Bruno', me: false,
      budgetRemaining: 300, slotsRemaining: 25,
      byRole: { P: [], D: [], C: [], A: [] },
    },
  ],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' },
  });
}

function renderRecap(onVoid?: () => Promise<Response>) {
  setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const href = typeof input === 'string' ? input : input.toString();
    if (href.includes('/void')) return (onVoid ?? (() => Promise.resolve(new Response(null, { status: 204 }))))();
    if (href.endsWith('/board')) return Promise.resolve(jsonResponse(BOARD));
    return Promise.reject(new Error(`URL non prevista nel test: ${href}`));
  });
  vi.stubGlobal('fetch', fetchMock);
  render(
    <QueryProvider>
      <MemoryRouter>
        <RecapRoute />
      </MemoryRouter>
    </QueryProvider>,
  );
  return fetchMock;
}

describe('RecapRoute', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('incolonna le rose di tutti', async () => {
    renderRecap();
    expect(await screen.findByText('Bastoni')).toBeInTheDocument();
    expect(screen.getByText('Sommer')).toBeInTheDocument();
    expect(screen.getByText('Bruno')).toBeInTheDocument();
  });

  it('revoca un acquisto preciso, per numero di riga', async () => {
    const fetchMock = renderRecap();
    await userEvent.click(await screen.findByRole('button', { name: /annulla l'acquisto di bastoni/i }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/purchases/2/void'),
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  /**
   * I due rifiuti del task 12 dicono cose diverse, e la schermata deve dirle diverse:
   * "non esiste" invita a ricaricare, "gia' annullato" dice che e' gia' fatto.
   */
  it('distingue i due rifiuti della revoca', async () => {
    renderRecap(() =>
      Promise.resolve(
        jsonResponse(
          {
            type: 'https://fantaagent.local/problems/purchase-already-revoked',
            detail: 'acquisto già annullato',
          },
          409,
        ),
      ),
    );

    await userEvent.click(await screen.findByRole('button', { name: /annulla l'acquisto di bastoni/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/già annullato/i);
  });

  it('una rosa vuota lo dice, invece di sembrare una colonna rotta', async () => {
    renderRecap();
    expect(await screen.findByText(/bruno non ha ancora comprato nessuno/i)).toBeInTheDocument();
  });
});
