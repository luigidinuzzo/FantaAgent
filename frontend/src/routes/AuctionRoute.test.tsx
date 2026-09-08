import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setAuctionContext } from '../api/client';
import { QueryProvider } from '../api/QueryProvider';
import { AuctionRoute } from './AuctionRoute';

const STATE = {
  auctionId: 'a1',
  auctionName: 'Prova',
  currentPhase: 'P',
  phases: ['P', 'D', 'C', 'A'],
  soldInPhase: 0,
  myParticipantId: 'anna',
  canUndo: false,
  participants: [
    {
      id: 'anna', name: 'Anna', initial: 'A', me: true,
      budgetRemaining: 300, slotsRemaining: 25,
      filledByRole: { P: 0, D: 0, C: 0, A: 0 },
      slotsByRole: { P: 3, D: 8, C: 8, A: 6 },
    },
  ],
};

const PHASE = {
  rows: [
    {
      id: 'p1', name: 'Giocatore Uno', team: 'AAA', role: 'P', listPrice: 1,
      maxBid: 50, expectedPrice: 10, margin: 5, fantamediaAttesa: 5.5, titolaritaPercent: 80,
    },
    {
      id: 'p2', name: 'Giocatore Due', team: 'BBB', role: 'P', listPrice: 2,
      maxBid: 80, expectedPrice: 20, margin: 8, fantamediaAttesa: 6.1, titolaritaPercent: 70,
    },
  ],
  offset: 0,
  pageSize: 25,
  total: 2,
  hasPrevious: false,
  hasNext: false,
};

function valuation(playerId: string, maxBid: number) {
  return {
    playerId,
    name: playerId === 'p1' ? 'Giocatore Uno' : 'Giocatore Due',
    team: playerId === 'p1' ? 'AAA' : 'BBB',
    role: 'P',
    listPrice: 1,
    expectedPrice: 10,
    maxBid,
    hardCap: maxBid + 10,
    margin: 5,
    walkAwayReason: '',
    worthPursuing: true,
    confidenceStars: 3,
    drivers: [],
  };
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('AuctionRoute', () => {
  afterEach(() => vi.unstubAllGlobals());

  // Solo la route puo' metterlo in scena: BidPanel da solo non riceve un
  // playerId con cui simulare un cambio di giocatore.
  //
  // Il primo passaggio da p1 a p2 passa comunque per un istante senza dato
  // (la query di p2 non e' ancora in cache), e quel vuoto smonta gia' la
  // scheda da solo — un falso positivo che non proverebbe nulla sulla key.
  // La prova vera e' tornare su p1: a quel punto la sua valutazione e' GIA'
  // in cache (staleTime 5s), quindi valuation.data passa da quella di p2 a
  // quella di p1 SENZA alcun istante vuoto in mezzo. Senza key, PlayerDecisionCard
  // (e con essa BidPanel) non smonterebbe mai, e il prezzo digitato per p2
  // resterebbe nel campo anche per p1.
  it('tornando su un giocatore gia visto (dato in cache, nessun vuoto) il prezzo torna comunque al suo tetto', async () => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const href = typeof input === 'string' ? input : input.toString();
      if (href.includes('/players/p1/valuation')) return Promise.resolve(jsonResponse(valuation('p1', 50)));
      if (href.includes('/players/p2/valuation')) return Promise.resolve(jsonResponse(valuation('p2', 80)));
      if (href.includes('/players/phase')) return Promise.resolve(jsonResponse(PHASE));
      if (href.endsWith('/state')) return Promise.resolve(jsonResponse(STATE));
      return Promise.reject(new Error(`URL non prevista nel test: ${href}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <QueryProvider>
        <AuctionRoute />
      </QueryProvider>,
    );

    await userEvent.click(await screen.findByRole('button', { name: /Valuta Giocatore Uno/ }));
    const price = await screen.findByLabelText('Prezzo');
    await waitFor(() => expect(price).toHaveValue(50));

    await userEvent.clear(price);
    await userEvent.type(price, '99');
    expect(price).toHaveValue(99);

    // p1 -> p2: passa per il vuoto, quindi non e' la prova che conta.
    await userEvent.click(await screen.findByRole('button', { name: /Valuta Giocatore Due/ }));
    const price2 = await screen.findByLabelText('Prezzo');
    await waitFor(() => expect(price2).toHaveValue(80));
    await userEvent.clear(price2);
    await userEvent.type(price2, '15');
    expect(price2).toHaveValue(15);

    // p2 -> p1: p1 e' gia' in cache, nessun vuoto. Questa e' la prova.
    await userEvent.click(await screen.findByRole('button', { name: /Valuta Giocatore Uno/ }));
    await waitFor(() => expect(screen.getByLabelText('Prezzo')).toHaveValue(50));
  });
});
