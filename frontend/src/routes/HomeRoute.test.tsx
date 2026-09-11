import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryProvider } from '../api/QueryProvider';
import { setAuctionContext } from '../api/client';
import { HomeRoute } from './HomeRoute';
import { SettingsRoute } from './SettingsRoute';

const CARDS = [
  { id: '2026-09-02', label: 'Lega No Name', lastWritten: '2026-09-02T13:08:41Z',
    purchases: 3, phase: 'D', selected: true },
  { id: '2025-08-30', label: '2025-08-30', lastWritten: '2025-08-30T20:00:00Z',
    purchases: 200, phase: 'A', selected: false },
];

const SETTINGS_CLOSED = {
  bidder: { bidTimerSeconds: 5, beepEnabled: true },
  participants: [{ id: 'anna', name: 'Anna', initial: 'A', me: true }],
  scoring: {
    defenceModifierEnabled: false, defendersCounted: 3,
    thresholds: [{ minAverage: 0, bonus: 0 }],
    goalBonus: { P: 0, D: 0, C: 0, A: 0 },
    assist: 1, penaltyScored: 3, penaltyMissed: -3, penaltySaved: 3,
    yellowCard: -0.5, redCard: -1, goalConceded: -1, cleanSheet: 1, confirmed: true,
  },
  auctionOpen: false,
};

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

  /**
   * E' la rotta radice: senza questi due rami, un caricamento lento o un errore di
   * rete mostrano il titolo, un elenco vuoto e il controllo "nuova asta" — niente
   * che dica cosa sta succedendo, a chi guarda o a chi ascolta.
   */
  it('mentre carica lo dice, invece di sembrare una lega senza aste', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    renderHome();

    expect(screen.getByText(/carico/i)).toBeInTheDocument();
    expect(screen.queryByText(/nessuna asta/i)).not.toBeInTheDocument();
  });

  it('un elenco che non arriva lo dice con un alert, invece di sembrare una lega senza aste', async () => {
    // Una NUOVA Response per ogni chiamata: React Query riprova una volta (retry: 1),
    // e il corpo di una Response gia' letta non si puo' leggere una seconda volta —
    // mockResolvedValue riusa la STESSA istanza, che al secondo tentativo farebbe
    // fallire response.json() e mostrerebbe il messaggio di ripiego "errore di
    // rete" invece di quello vero del problem.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          json({ type: 'https://fantaagent.local/problems/internal-error',
            detail: 'Errore interno del server.' }, 500),
        ),
      ),
    );
    renderHome();

    // Timeout allungato: la query di React Query riprova una volta (retry: 1 in
    // QueryProvider) prima di arrendersi, con un ritardo di circa un secondo fra i
    // due tentativi — il timeout di default di findByRole non basterebbe ad
    // aspettarlo.
    expect(await screen.findByRole('alert', {}, { timeout: 3000 }))
      .toHaveTextContent(/errore interno/i);
    expect(screen.queryByText(/nessuna asta/i)).not.toBeInTheDocument();
  });

  it('la data dell\'ultima scrittura ha le cifre tabulari, per allinearsi in colonna', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(CARDS)));
    renderHome();

    const when = await screen.findByText(/2 set 2026/i);
    expect(when).toHaveClass('tnum');
  });

  it("dice quale asta e' quella aperta adesso", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(CARDS)));
    renderHome();

    expect(await screen.findByText(/in corso/i)).toBeInTheDocument();
  });

  /**
   * Il difetto critico della revisione finale: "Nuova asta" portava alle
   * impostazioni di un'asta ancora aperta senza chiuderla — in sola lettura, senza
   * campo per il nome — e confermare rinominava i partecipanti di quella invece di
   * cominciarne una. Il bottone deve chiudere l'asta aperta PRIMA di andare alle
   * impostazioni, che a quel punto offrono il campo del nome.
   */
  it('"nuova asta" chiude prima l\'asta aperta, cosi le impostazioni offrono il nome', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const href = typeof input === 'string' ? input : input.toString();
      if (href.endsWith('/auctions')) return Promise.resolve(json(CARDS));
      if (href.endsWith('/auctions/current/leave')) {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (href.endsWith('/settings') && !init?.method) return Promise.resolve(json(SETTINGS_CLOSED));
      return Promise.reject(new Error(`URL non prevista nel test: ${href}`));
    });
    vi.stubGlobal('fetch', fetchMock);
    setAuctionContext({ leagueId: 'default', auctionId: 'corrente' });

    const router = createMemoryRouter(
      [
        { path: '/', element: <HomeRoute /> },
        { path: '/impostazioni', element: <SettingsRoute /> },
      ],
      { initialEntries: ['/'] },
    );
    render(
      <QueryProvider>
        <RouterProvider router={router} />
      </QueryProvider>,
    );

    await userEvent.click(await screen.findByRole('button', { name: /nuova asta/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/auctions/current/leave'),
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    // Il nome dell'asta esiste solo in preparazione: vederlo prova che le
    // impostazioni non sono piu' quelle, in sola lettura, dell'asta appena lasciata.
    expect(await screen.findByLabelText(/nome dell'asta/i)).toBeInTheDocument();
  });

  /**
   * Se la chiusura dell'asta aperta fallisce, restare zitti significherebbe che
   * l'unico segno per l'utente e' il bottone che smette di girare — nessuna
   * spiegazione, e la navigazione verso le impostazioni che semplicemente non
   * avviene.
   */
  it('un fallimento della chiusura lo dice, invece di restare zitta', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const href = typeof input === 'string' ? input : input.toString();
      if (href.endsWith('/auctions')) return Promise.resolve(json(CARDS));
      if (href.endsWith('/auctions/current/leave')) {
        return Promise.resolve(
          json({ type: 'https://fantaagent.local/problems/internal-error',
            detail: 'Errore interno del server.' }, 500),
        );
      }
      return Promise.reject(new Error(`URL non prevista nel test: ${href}`));
    });
    vi.stubGlobal('fetch', fetchMock);
    renderHome();

    await userEvent.click(await screen.findByRole('button', { name: /nuova asta/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/errore interno/i);
  });

  /**
   * Difetto della revisione finale: il fallimento di una mutazione (select/leave)
   * e il fallimento del refetch periodico della lista (refetchInterval, in
   * QueryProvider) sono due condizioni indipendenti — niente le esclude a
   * vicenda come invece accade fra select e leave. Un "Riprendi" fallito seguito
   * da un refetch fallito rendeva due role="alert" insieme: due live region che
   * parlano nello stesso istante si sovrappongono, e uno screen reader ne perde
   * una.
   */
  it('un refetch della lista fallito dopo un Riprendi fallito non mostra due alert insieme', async () => {
    let auctionsCalls = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const href = typeof input === 'string' ? input : input.toString();
      if (href.endsWith('/auctions')) {
        auctionsCalls += 1;
        if (auctionsCalls === 1) return Promise.resolve(json(CARDS));
        return Promise.resolve(
          json({ type: 'https://fantaagent.local/problems/internal-error',
            detail: 'Errore interno del server.' }, 500),
        );
      }
      if (href.includes('/select')) {
        return Promise.resolve(
          json({ type: 'https://fantaagent.local/problems/internal-error',
            detail: 'Selezione fallita.' }, 500),
        );
      }
      return Promise.reject(new Error(`URL non prevista nel test: ${href}`));
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderHome();

      await user.click(await screen.findByRole('button', { name: /riprendi lega no name/i }));
      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/selezione fallita/i));

      // Il refetch periodico (refetchInterval 5s) fallisce a sua volta, e la
      // query riprova una volta (retry: 1) prima di arrendersi. A piccoli
      // passi, non un unico salto: react-query concatena una promise di
      // ritardo fra un tentativo e il successivo, e un solo salto grande non
      // da' occasione a quella catena di avanzare un anello alla volta.
      for (let i = 0; i < 6; i++) {
        // eslint-disable-next-line no-await-in-loop
        await act(async () => {
          vi.advanceTimersByTime(2_000);
        });
      }

      await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(1));
    } finally {
      vi.useRealTimers();
    }
  });
});
