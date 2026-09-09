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

function stubFetchBoardError() {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const href = typeof input === 'string' ? input : input.toString();
    if (href.endsWith('/board')) {
      return Promise.resolve(
        new Response(JSON.stringify({ type: 'unknown', detail: 'errore' }), { status: 500 }),
      );
    }
    return Promise.reject(new Error(`URL non prevista nel test: ${href}`));
  });
  vi.stubGlobal('fetch', fetchMock);
}

function stubFetchEmptyBoard() {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const href = typeof input === 'string' ? input : input.toString();
    if (href.endsWith('/board')) {
      return Promise.resolve(jsonResponse({ ...BOARD, columns: [] }));
    }
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

  it('mostra il lotto quando la schermata privata lo trasmette, e non dice piu di non ricevere', async () => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
    stubFetch();
    renderProjection();
    publishBid({ kind: 'bidding', playerId: 'd1', price: 41, remainingMs: 3000, totalMs: 5000 });
    // Il prezzo arriva dal canale ed e' visibile subito; il nome arriva dal server.
    expect(await screen.findByTestId('public-price')).toHaveTextContent('41');
    expect(screen.queryByText(/non riceve dalla schermata privata/i)).not.toBeInTheDocument();
  });

  it('dice di non ricevere invece di restare ferma fingendo, quando il browser non ha il canale', () => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
    stubFetch();
    vi.stubGlobal('BroadcastChannel', undefined);
    renderProjection();
    expect(screen.getByText(/non riceve dalla schermata privata/i)).toBeInTheDocument();
  });

  // Bug (revisione): la versione precedente controllava solo se il BROWSER
  // supporta BroadcastChannel, non se questa finestra ha davvero sentito
  // l'altra. BroadcastChannel non attraversa mai due dispositivi: su una
  // proiezione aperta altrove l'API resta definita, quindi quel controllo
  // varrebbe sempre true, anche senza aver mai sentito nulla — l'esatto
  // difetto che la specifica vieta. Qui il canale c'e' (non e' stubbato
  // via), ma nessun messaggio arriva mai: la schermata deve dirlo comunque.
  it("dice di non ricevere anche quando il canale c'e' ma nessun messaggio arriva mai", () => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
    stubFetch();
    renderProjection();
    expect(screen.getByText(/non riceve dalla schermata privata/i)).toBeInTheDocument();
  });

  it('carica correttamente ma non trova nessun tabellone', async () => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
    stubFetchEmptyBoard();
    renderProjection();
    expect(await screen.findByText(/nessun partecipante/i)).toBeInTheDocument();
  });

  it('dice se i tabelloni non si caricano, invece di mostrare una griglia vuota identica a "nessun partecipante"', async () => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
    stubFetchBoardError();
    renderProjection();
    // QueryProvider ritenta una volta (retry: 1) prima di arrendersi: il
    // timeout predefinito di findBy non basterebbe ad aspettare quel giro.
    expect(await screen.findByRole('alert', {}, { timeout: 3000 })).toHaveTextContent(
      /non riesco a caricare/i,
    );
  });
});
