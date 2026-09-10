import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { setAuctionContext } from '../api/client';
import { QueryProvider } from '../api/QueryProvider';
import { publishBid } from '../domain/bidChannel';
import { STALE_AFTER_MS } from '../domain/ConnectionStatus';
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

function neverResolves() {
  const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
  vi.stubGlobal('fetch', fetchMock);
}

function stubFetchUnknownPlayer() {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const href = typeof input === 'string' ? input : input.toString();
    if (href.includes('/board/bidder/')) {
      return Promise.resolve(
        new Response(JSON.stringify({ type: 'unknown', detail: 'giocatore inesistente' }), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        }),
      );
    }
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

  it('mostra il lotto quando la schermata privata lo trasmette, e non dice piu di non ricevere', async () => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
    stubFetch();
    renderProjection();
    publishBid({ kind: 'bidding', playerId: 'd1', price: 41, remainingMs: 3000 });
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

  // Minor (revisione finale): la proiezione non aveva un h1, a differenza
  // di /asta — chi ascolta aveva un titolo di primo livello su una
  // schermata e niente sull'altra. Il test originale era stato perso nella
  // riscrittura del Task 6.
  it('ha un h1 (sr-only)', async () => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
    stubFetch();
    renderProjection();
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  // Test mancante 1 (revisione finale): i tabelloni ancora in caricamento.
  it('mentre i tabelloni sono ancora in caricamento lo dice, senza mostrare una griglia vuota', () => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
    neverResolves();
    renderProjection();
    expect(screen.getByText(/carico i tabelloni/i)).toBeInTheDocument();
    expect(screen.queryByText(/nessun partecipante/i)).not.toBeInTheDocument();
  });

  // Test mancante 2 (revisione finale): un lotto trasmesso per un
  // playerId che l'endpoint del tabellone non conosce (404). Il
  // comportamento esiste gia' — PublicBidderDialog rende '…' per un nome
  // assente — ma non era mai stato fissato da un test.
  it('un lotto per un giocatore che il tabellone non conosce mostra comunque il prezzo, col nome assente', async () => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
    stubFetchUnknownPlayer();
    renderProjection();
    publishBid({ kind: 'bidding', playerId: 'sconosciuto', price: 12, remainingMs: 4000 });

    expect(await screen.findByTestId('public-price')).toHaveTextContent('12');
    expect(screen.getByRole('heading', { level: 2, name: '…' })).toBeInTheDocument();
  });

  // Test mancante 3 (revisione finale): un lotto trasmesso PRIMA che i
  // tabelloni abbiano finito di caricare. Il prezzo arriva dal canale, non
  // dal tabellone: non deve aspettare la board per comparire.
  it('un lotto arrivato prima che i tabelloni finiscano di caricare si mostra comunque', async () => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const href = typeof input === 'string' ? input : input.toString();
      if (href.includes('/board/bidder/d1')) return Promise.resolve(jsonResponse(PLAYER));
      if (href.endsWith('/board')) {
        return new Promise((resolve) => setTimeout(() => resolve(jsonResponse(BOARD)), 200));
      }
      return Promise.reject(new Error(`URL non prevista nel test: ${href}`));
    });
    vi.stubGlobal('fetch', fetchMock);
    renderProjection();

    publishBid({ kind: 'bidding', playerId: 'd1', price: 41, remainingMs: 3000 });

    expect(await screen.findByTestId('public-price')).toHaveTextContent('41');
    expect(screen.getByText(/carico i tabelloni/i)).toBeInTheDocument();
  });

  describe('lo stato del server', () => {
    afterEach(() => vi.useRealTimers());

    // Finding 3 (revisione finale): board.isError e' true solo su un primo
    // caricamento fallito. Un REFETCH che fallisce su dati gia' in cache
    // lascia status: 'success' — la proiezione mostrerebbe rose e budget
    // congelati all'infinito, con l'unico avviso attivo (quello del canale)
    // che afferma il contrario ("i tabelloni sono aggiornati").
    it('dice quando i dati del server non sono piu freschi, con la stessa disciplina di isStale', async () => {
      setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
      stubFetch();
      vi.useFakeTimers({ shouldAdvanceTime: true });
      renderProjection();

      await waitFor(() => expect(screen.getByTestId('connection-status')).toHaveTextContent('In diretta'));

      await act(async () => {
        vi.advanceTimersByTime(STALE_AFTER_MS + 2_000);
      });

      expect(screen.getByTestId('connection-status')).toHaveTextContent(/connessione persa/i);
    });

    // Le due segnalazioni sono indipendenti e non si devono contraddire:
    // quando ENTRAMBE sono vere, nessuna delle due deve affermare che
    // l'altra fonte di dati va bene.
    it('il canale stantio e il server stantio possono convivere, senza contraddirsi', async () => {
      setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
      stubFetch();
      vi.useFakeTimers({ shouldAdvanceTime: true });
      renderProjection();

      await waitFor(() => expect(screen.getByTestId('connection-status')).toHaveTextContent('In diretta'));

      await act(async () => {
        vi.advanceTimersByTime(STALE_AFTER_MS + 2_000);
      });

      // Il canale non ha mai sentito nulla: e' anche lui stantio.
      expect(screen.getByText(/non riceve dalla schermata privata/i)).toBeInTheDocument();
      expect(screen.getByTestId('connection-status')).toHaveTextContent(/connessione persa/i);
      // Nessuno dei due avvisi afferma che l'altra fonte va bene.
      expect(screen.queryByText(/tabelloni.*aggiornati/i)).not.toBeInTheDocument();
    });
  });
});
