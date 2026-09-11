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

function renderRecap(onVoid?: (href: string) => Promise<Response>) {
  // Deliberatamente diverso da BOARD.auctionId ('a1'): e' esattamente lo scenario
  // del tab stantio — la finestra e' altrove, la board di QUESTA schermata resta
  // 'a1' — e prova che la revoca usa l'id della board letto dalla risposta, non
  // quello del contesto della finestra.
  setAuctionContext({ leagueId: 'default', auctionId: 'corrente' });
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const href = typeof input === 'string' ? input : input.toString();
    if (href.includes('/void')) {
      return (onVoid ?? (() => Promise.resolve(new Response(null, { status: 204 }))))(href);
    }
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
   * {@code seq} e' per registro: indirizzare la revoca con l'asta del CONTESTO
   * della finestra (che qui e' deliberatamente 'corrente', diverso da
   * BOARD.auctionId 'a1') manderebbe il numero di riga al registro sbagliato se
   * nel frattempo un'altra finestra avesse selezionato un'altra asta. La revoca
   * deve usare l'auctionId che la board ha appena letto, non quello del contesto.
   */
  it("indirizza la revoca con l'auctionId della board, non con quello del contesto", async () => {
    const fetchMock = renderRecap();
    await userEvent.click(await screen.findByRole('button', { name: /annulla l'acquisto di bastoni/i }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/leagues/default/auctions/a1/purchases/2/void',
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
    const alerts = await screen.findAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent(/già annullato/i);
  });

  /**
   * Il terzo rifiuto possibile, distinto dagli altri due: non e' che l'acquisto non
   * ci sia (purchase-not-found) o sia gia' stato revocato (already-revoked), e' che
   * l'ASTA indirizzata dalla revoca non e' (piu') quella aperta — la guardia
   * risponde 404 unknown-auction. E' il caso del tab stantio: un riepilogo aperto
   * su un'asta mentre altrove si e' passati a un'altra. Ricaricare la pagina, non
   * ripetere il tentativo, e' la sola cosa sensata da suggerire.
   */
  it("un'asta cambiata nel frattempo lo dice, distinto dall'acquisto assente", async () => {
    renderRecap(() =>
      Promise.resolve(
        jsonResponse(
          {
            type: 'https://fantaagent.local/problems/unknown-auction',
            detail: 'asta sconosciuta: a1',
          },
          404,
        ),
      ),
    );

    await userEvent.click(await screen.findByRole('button', { name: /annulla l'acquisto di bastoni/i }));
    const alerts = await screen.findAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent(/cambiata/i);
    expect(alerts[0]).toHaveTextContent(/ricarica/i);
    expect(alerts[0]).not.toHaveTextContent(/non c'è più/i);
  });

  /**
   * Prima del fix, `pending` era un booleano unico condiviso da OGNI riga: una
   * revoca in volo su un giocatore disabilitava anche il bottone di tutti gli
   * altri, in ogni colonna. Va disabilitato solo il bottone del `seq` in corso.
   */
  it('la revoca in volo disabilita solo il suo bottone, non tutti gli altri', async () => {
    let resolveVoid!: (r: Response) => void;
    const pending = new Promise<Response>((resolve) => { resolveVoid = resolve; });
    renderRecap(() => pending);

    const bastoniButton = await screen.findByRole('button', { name: /annulla l'acquisto di bastoni/i });
    const sommerButton = screen.getByRole('button', { name: /annulla l'acquisto di sommer/i });
    await userEvent.click(bastoniButton);

    await waitFor(() => expect(bastoniButton).toBeDisabled());
    expect(sommerButton).toBeEnabled();

    resolveVoid(new Response(null, { status: 204 }));
    await waitFor(() => expect(bastoniButton).toBeEnabled());
  });

  /**
   * L'esportazione e' un <a href download>, non una fetch: il browser deve
   * gestire il salvataggio da solo. L'href porta l'auctionId della BOARD ('a1'),
   * non quello del contesto della finestra ('corrente'), per lo stesso motivo
   * della revoca — vedi il test sopra sull'auctionId della board.
   */
  it("il pulsante di esportazione punta all'export.csv dell'asta della board", async () => {
    renderRecap();
    const link = await screen.findByRole('link', { name: /scarica il csv delle rose/i });
    expect(link).toHaveAttribute('href', '/api/leagues/default/auctions/a1/export.csv');
    expect(link).toHaveAttribute('download');
  });

  it('una rosa vuota lo dice, invece di sembrare una colonna rotta', async () => {
    renderRecap();
    expect(await screen.findByText(/bruno non ha ancora comprato nessuno/i)).toBeInTheDocument();
  });

  /**
   * Generalizza la disciplina "un solo alert" delle impostazioni: qui i due alert
   * possibili sono l'errore della revoca e l'errore di caricamento della board.
   * Non devono mai poter comparire insieme.
   */
  it('un errore di caricamento della board resta un unico alert', async () => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
    // Una NUOVA Response per ogni chiamata: React Query riprova una volta (retry: 1
    // in QueryProvider), e il corpo di una Response gia' letta non si puo' leggere
    // una seconda volta.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          jsonResponse({ type: 'https://fantaagent.local/problems/internal-error',
            detail: 'Errore interno del server.' }, 500),
        ),
      ),
    );
    render(
      <QueryProvider>
        <MemoryRouter>
          <RecapRoute />
        </MemoryRouter>
      </QueryProvider>,
    );

    const alerts = await screen.findAllByRole('alert', {}, { timeout: 3000 });
    expect(alerts).toHaveLength(1);
  });
});
