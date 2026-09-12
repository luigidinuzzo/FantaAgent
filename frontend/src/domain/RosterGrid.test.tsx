import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setAuctionContext } from '../api/client';
import { QueryProvider } from '../api/QueryProvider';
import { RosterGrid } from './RosterGrid';

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

// La capacita' per ruolo non e' nel corpo di /board (vedi il commento in
// RosterGrid.tsx): viene da /state, la stessa mappa per ogni partecipante
// perche' e' una regola di lega condivisa.
const STATE = {
  auctionId: 'a1',
  auctionName: 'Prova',
  currentPhase: 'D',
  phases: ['P', 'D', 'C', 'A'],
  soldInPhase: 2,
  myParticipantId: 'anna',
  canUndo: false,
  participants: [
    {
      id: 'anna', name: 'Anna', initial: 'A', me: true,
      budgetRemaining: 280, slotsRemaining: 23,
      filledByRole: { P: 1, D: 1, C: 0, A: 0 },
      slotsByRole: { P: 3, D: 8, C: 8, A: 6 },
    },
    {
      id: 'bruno', name: 'Bruno', initial: 'B', me: false,
      budgetRemaining: 300, slotsRemaining: 25,
      filledByRole: { P: 0, D: 0, C: 0, A: 0 },
      slotsByRole: { P: 3, D: 8, C: 8, A: 6 },
    },
  ],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' },
  });
}

function renderRoster(onVoid?: (href: string) => Promise<Response>) {
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
    if (href.endsWith('/state')) return Promise.resolve(jsonResponse(STATE));
    return Promise.reject(new Error(`URL non prevista nel test: ${href}`));
  });
  vi.stubGlobal('fetch', fetchMock);
  render(
    <QueryProvider>
      <RosterGrid />
    </QueryProvider>,
  );
  return fetchMock;
}

describe('RosterGrid', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('incolonna le rose di tutti', async () => {
    renderRoster();
    expect(await screen.findByText('Bastoni')).toBeInTheDocument();
    expect(screen.getByText('Sommer')).toBeInTheDocument();
    expect(screen.getByText('Bruno')).toBeInTheDocument();
  });

  it('revoca un acquisto preciso, per numero di riga', async () => {
    const fetchMock = renderRoster();
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
  it("manda il seq all'asta che LA BOARD ha letto, non a quella della finestra", async () => {
    const fetchMock = renderRoster();
    await userEvent.click(await screen.findByRole('button', { name: /annulla l'acquisto di bastoni/i }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/leagues/default/auctions/a1/purchases/2/void',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  /**
   * Prima del fix, `pending` era un booleano unico condiviso da OGNI riga: una
   * revoca in volo su un giocatore disabilitava anche il bottone di tutti gli
   * altri, in ogni colonna. Va disabilitato solo il bottone del `seq` in corso.
   */
  it('revoca solo la riga in volo, non tutte', async () => {
    let resolveVoid!: (r: Response) => void;
    const pending = new Promise<Response>((resolve) => { resolveVoid = resolve; });
    renderRoster(() => pending);

    const bastoniButton = await screen.findByRole('button', { name: /annulla l'acquisto di bastoni/i });
    const sommerButton = screen.getByRole('button', { name: /annulla l'acquisto di sommer/i });
    await userEvent.click(bastoniButton);

    await waitFor(() => expect(bastoniButton).toBeDisabled());
    expect(sommerButton).toBeEnabled();

    resolveVoid(new Response(null, { status: 204 }));
    await waitFor(() => expect(bastoniButton).toBeEnabled());
  });

  it("l'esportazione e un link da scaricare, non una fetch", async () => {
    renderRoster();
    const link = await screen.findByRole('link', { name: /csv/i });
    expect(link).toHaveAttribute('download');
    expect(link.getAttribute('href')).toContain('/export.csv');
    // Stesso auctionId della board ('a1'), non quello del contesto ('corrente').
    expect(link.getAttribute('href')).toBe('/api/leagues/default/auctions/a1/export.csv');
  });

  /**
   * I due rifiuti dicono cose diverse, e la schermata deve dirle diverse:
   * "non esiste" invita a ricaricare, "gia' annullato" dice che e' gia' fatto.
   */
  it('distingue i due rifiuti della revoca', async () => {
    renderRoster(() =>
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
   * Una sola frase di errore alla volta: l'errore della revoca ha la precedenza
   * su quello di caricamento, perche' e' la risposta al gesto piu' recente.
   */
  it('una sola frase di errore alla volta', async () => {
    renderRoster(() =>
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

  it('una rosa vuota lo dice, invece di sembrare una colonna rotta', async () => {
    renderRoster();
    // Bruno non ha comprato nessuno: le sue sezioni di ruolo restano a 0/n,
    // con le righe-slot vuote a dirlo — non una colonna che sembra rotta.
    expect(await screen.findByRole('button', { name: /portieri.*0 su 3/i })).toBeInTheDocument();
  });

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
        <RosterGrid />
      </QueryProvider>,
    );

    const alerts = await screen.findAllByRole('alert', {}, { timeout: 3000 });
    expect(alerts).toHaveLength(1);
  });

  /**
   * Le sezioni di ruolo si aprono chiuse dal loro bottone, e il nome accessibile
   * dice ruolo e riempimento — non solo un chevron muto.
   */
  it('le sezioni di ruolo si possono chiudere, e dicono quanto sono piene', async () => {
    renderRoster();
    const section = await screen.findByRole('button', { name: /portieri.*1 su 3/i });
    expect(section).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Sommer')).toBeInTheDocument();

    await userEvent.click(section);

    expect(section).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Sommer')).not.toBeInTheDocument();

    await userEvent.click(section);
    expect(section).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Sommer')).toBeInTheDocument();
  });

  it('le righe-slot vuote hanno un trattino e un testo sr-only "posto libero"', async () => {
    renderRoster();
    // Anna: portieri, 1 occupato su 3 -> 2 posti liberi.
    await screen.findByText('Sommer');
    const freeTexts = screen.getAllByText('posto libero');
    expect(freeTexts.length).toBeGreaterThan(0);
    expect(freeTexts[0]).toHaveClass('sr-only');
  });

  it('e una tabella vera per colonna, con intestazioni e didascalia per il partecipante', async () => {
    renderRoster();
    await screen.findByText('Sommer');
    expect(screen.getByText('Rosa di Anna')).toHaveClass('sr-only');
    expect(screen.getAllByRole('columnheader', { name: 'Giocatore' }).length).toBeGreaterThan(0);
  });

  /**
   * La capienza per ruolo arriva da /state, un oggetto distinto dalla board:
   * niente garantisce che porti la chiave che /board nomina. Stesso caso di
   * `compositionText` in SquadCards.tsx — il tipo promette un Record<Role,
   * number> completo, ma quel che arriva sul filo e' JSON, e una chiave
   * assente non deve diventare "undefined" a schermo né nel nome accessibile
   * della fascia.
   */
  it('non scrive "undefined" se /state non porta la capienza di un ruolo', async () => {
    // Clone via JSON, non uno spread tipato: e' esattamente cio' che succede
    // sul filo — la chiave 'P' semplicemente non c'e' nel corpo della
    // risposta, non e' un valore `undefined` scritto a mano che TypeScript
    // impedirebbe di assegnare.
    const brokenState = JSON.parse(JSON.stringify(STATE));
    delete brokenState.participants[0].slotsByRole.P;

    setAuctionContext({ leagueId: 'default', auctionId: 'corrente' });
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const href = typeof input === 'string' ? input : input.toString();
      if (href.endsWith('/board')) return Promise.resolve(jsonResponse(BOARD));
      if (href.endsWith('/state')) return Promise.resolve(jsonResponse(brokenState));
      return Promise.reject(new Error(`URL non prevista nel test: ${href}`));
    });
    vi.stubGlobal('fetch', fetchMock);
    render(
      <QueryProvider>
        <RosterGrid />
      </QueryProvider>,
    );

    // Anna ha gia' Sommer (1 portiere comprato): con la capienza mancante il
    // denominatore e' 0, non "undefined" — "1 su 0", non "1 su undefined".
    // Il nome resta specifico ad Anna: la sezione Portieri di Bruno (0 su 3,
    // capienza intatta) non deve essere confusa con questa.
    const section = await screen.findByRole('button', { name: /portieri.*1 su 0/i });
    expect(section.textContent).not.toMatch(/undefined/i);
    expect(document.body.textContent).not.toMatch(/undefined/i);
  });

  /**
   * Stesso principio, l'altro modo in cui la seconda fonte puo' mancare: il
   * partecipante che LA BOARD nomina non e' affatto in /state (un tab
   * stantio, o le due risposte semplicemente disallineate).
   */
  it('non scrive "undefined" se /state non porta affatto il partecipante che la board nomina', async () => {
    const brokenState = { ...STATE, participants: STATE.participants.filter((p) => p.id !== 'anna') };

    setAuctionContext({ leagueId: 'default', auctionId: 'corrente' });
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const href = typeof input === 'string' ? input : input.toString();
      if (href.endsWith('/board')) return Promise.resolve(jsonResponse(BOARD));
      if (href.endsWith('/state')) return Promise.resolve(jsonResponse(brokenState));
      return Promise.reject(new Error(`URL non prevista nel test: ${href}`));
    });
    vi.stubGlobal('fetch', fetchMock);
    render(
      <QueryProvider>
        <RosterGrid />
      </QueryProvider>,
    );

    const section = await screen.findByRole('button', { name: /portieri.*1 su 0/i });
    expect(section.textContent).not.toMatch(/undefined/i);
    expect(document.body.textContent).not.toMatch(/undefined/i);
  });
});
