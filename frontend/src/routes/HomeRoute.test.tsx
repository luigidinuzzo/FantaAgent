import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryProvider } from '../api/QueryProvider';
import { setAuctionContext } from '../api/client';
import { HomeRoute } from './HomeRoute';
import { SettingsRoute } from './SettingsRoute';

// I dati della lega che ogni riga porta: otto squadre da 25, 500 crediti a testa.
const LEAGUE = { teams: 8, budget: 500, totalSlots: 200, myName: 'Anna', myBudgetRemaining: 320 };

const CARDS = [
  { id: '2026-09-02', label: 'Lega No Name', lastWritten: '2026-09-02T13:08:41Z',
    purchases: 3, phase: 'D', selected: true, ...LEAGUE },
  { id: '2025-08-30', label: '2025-08-30', lastWritten: '2025-08-30T20:00:00Z',
    purchases: 200, phase: 'A', selected: false, ...LEAGUE },
];

// Le due carte dei test del ridisegno: una sola aperta, una sola chiusa — quanto
// basta a verificare che la riga dica la fase giusta senza tirare in mezzo
// l'intero elenco CARDS sopra.
const OPEN_AUCTION = {
  id: '2026-09-02', label: 'Lega No Name', lastWritten: '2026-09-02T13:08:41Z',
  purchases: 3, phase: 'D', selected: true, ...LEAGUE,
};
const CLOSED_AUCTION = {
  id: '2025-08-30', label: 'Lega Passata', lastWritten: '2025-08-30T20:00:00Z',
  purchases: 2, phase: 'A', selected: false, ...LEAGUE,
};

/** Apre il menu «⋯» di un'asta e sceglie una voce. */
async function chooseFromMenu(label: string, item: string) {
  await userEvent.click(await screen.findByRole('button', { name: `Altre azioni per ${label}` }));
  await userEvent.click(screen.getByRole('menuitem', { name: item }));
}

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
  rules: { participants: 8, budget: 500, slots: { P: 3, D: 8, C: 8, A: 6 } },
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
    expect(screen.getByText('3 di 200 giocatori')).toBeInTheDocument();
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

  /**
   * Al primo accesso la home dice cos'e' FantaAgent e come si usa, invece di un
   * elenco vuoto: e' la prima impressione del prodotto.
   */
  it('al primo accesso spiega come funziona e invita a creare la prima asta', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([])));
    renderHome();

    expect(await screen.findByRole('button', { name: 'Crea la tua prima asta' })).toBeInTheDocument();
    const how = screen.getByRole('region', { name: 'Come funziona' });
    expect(within(how).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByRole('region', { name: "Riprendi un'asta" })).not.toBeInTheDocument();
  });

  /**
   * E' la rotta radice: senza questi due rami, un caricamento lento o un errore di
   * rete mostrano il titolo, un elenco vuoto e il controllo "crea asta" — niente
   * che dica cosa sta succedendo, a chi guarda o a chi ascolta.
   */
  it('mentre carica lo dice, invece di sembrare una lega senza aste', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    renderHome();

    expect(screen.getByText(/carico/i)).toBeInTheDocument();
    // Mentre carica non e' ancora un primo accesso: niente «Come funziona».
    expect(screen.queryByText('Come funziona')).not.toBeInTheDocument();
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
      .toHaveTextContent("L'elenco delle aste non si è caricato. Riprova.");
    expect(screen.queryByText('Come funziona')).not.toBeInTheDocument();
  });

  it('la data dell\'ultima scrittura ha le cifre tabulari, e quella esatta a parte', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([OPEN_AUCTION])));
    renderHome();

    const when = (await screen.findByText('Lega No Name')).closest('li')!.querySelector('time')!;
    expect(when).toHaveClass('tnum');
    expect(when).toHaveAttribute('datetime', OPEN_AUCTION.lastWritten);
    expect(when.getAttribute('title')).toMatch(/2 settembre 2026/);
  });

  it("dice quale asta e' quella aperta adesso", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(CARDS)));
    renderHome();

    expect(await screen.findByText('Aperta ora')).toBeInTheDocument();
  });

  /**
   * Il difetto critico della revisione finale: "Crea asta" portava alle
   * impostazioni di un'asta ancora aperta senza chiuderla — in sola lettura, senza
   * campo per il nome — e confermare rinominava i partecipanti di quella invece di
   * cominciarne una. Il bottone deve chiudere l'asta aperta PRIMA di andare alle
   * impostazioni, che a quel punto offrono il campo del nome.
   */
  it('"crea asta" chiude prima l\'asta aperta, cosi le impostazioni offrono il nome', async () => {
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

    await userEvent.click(await screen.findByRole('button', { name: /crea asta/i }));

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

    await userEvent.click(await screen.findByRole('button', { name: /crea asta/i }));

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('Non è stato possibile preparare una nuova asta. Riprova.');
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
      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/aprire l'asta/i));

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

  /**
   * Nel mockup e' la card-eroe: un bersaglio solo, grande, in cima alla colonna.
   * Il test non misura i pixel — misura che esista un comando con quel nome e che
   * faccia la cosa giusta, cioe' lasciare l'asta aperta PRIMA di navigare (vedi
   * startNew e il difetto critico che documenta).
   */
  it("il pulsante di creazione e' il piu' prominente, e porta alle impostazioni", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const href = typeof input === 'string' ? input : input.toString();
      if (href.endsWith('/auctions')) return Promise.resolve(json([OPEN_AUCTION]));
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

    await userEvent.click(await screen.findByRole('button', { name: /crea asta/i }));

    // L'asta aperta va lasciata (leave, chiamato una volta) PRIMA che le
    // impostazioni compaiano: vederle, e vederle con il campo del nome, prova che
    // la navigazione e' avvenuta solo dopo la conferma della richiesta di uscita.
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/auctions/current/leave'),
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        (typeof input === 'string' ? input : input.toString()).endsWith('/auctions/current/leave'),
      ),
    ).toHaveLength(1);
    expect(await screen.findByLabelText(/nome dell'asta/i)).toBeInTheDocument();
  });

  it("l'asta aperta si riconosce anche senza vedere il pallino", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([OPEN_AUCTION, CLOSED_AUCTION])));
    renderHome();

    // Il pallino colorato e' decorazione. Il fatto sta nel testo.
    expect(await screen.findByText('Aperta ora')).toBeInTheDocument();
  });

  // La fase si legge da RoleBadge (lettera colorata + nome per esteso in
  // sr-only), non da un secondo testo "fase X" a fianco: quel secondo testo
  // era una lettera nuda ripetuta, il difetto che RoleBadge esiste per
  // evitare (revisione finale, finding F) — vedi il commento su HomeRoute.
  it('ogni riga dice fase e acquisti, non solo il nome', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([CLOSED_AUCTION])));
    renderHome();

    expect(await screen.findByText('2 di 200 giocatori')).toBeInTheDocument();
    // CLOSED_AUCTION e' in fase 'A': il nome per esteso di RoleBadge.
    expect(screen.getByText(/attaccante/i)).toBeInTheDocument();
  });

  /**
   * Il vecchio riquadro «Asta aperta» non c'e' piu': l'asta in corso si riprende
   * dalla sua riga, che per questo sta in cima all'elenco anche se il server la
   * manda dopo le altre — altrimenti con piu' di cinque aste finiva su un'altra pagina.
   */
  it("l'asta in corso sta in cima all'elenco, con un solo «Riprendi»", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([CLOSED_AUCTION, OPEN_AUCTION])));
    renderHome();

    const rows = await screen.findAllByRole('listitem');
    expect(rows[0]).toHaveTextContent(OPEN_AUCTION.label);
    expect(screen.getAllByRole('button', { name: `Riprendi ${OPEN_AUCTION.label}` })).toHaveLength(1);
    expect(document.querySelector('aside')).toBeNull();
  });

  /** I due box si trovano per nome, anche da chi scorre la pagina per titoli. */
  it('i box «Comincia una nuova asta» e «Riprendi un asta» hanno un titolo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([CLOSED_AUCTION])));
    renderHome();

    const resume = screen.getByRole('region', { name: "Riprendi un'asta" });
    expect(await within(resume).findByText(CLOSED_AUCTION.label)).toBeInTheDocument();
    const start = screen.getByRole('region', { name: 'Comincia una nuova asta' });
    expect(within(start).getByRole('button', { name: 'Crea asta' })).toBeInTheDocument();
  });

  /**
   * Il profilo mostrava valori finti in attesa dell'accesso: una sezione che non fa
   * niente e' peggio di una assente. La home ha la barra in alto delle altre pagine,
   * con «Le mie aste» come pagina corrente.
   */
  it('usa la barra in alto con «Le mie aste» corrente, e niente Profilo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([OPEN_AUCTION])));
    const router = createMemoryRouter([{ path: '/', element: <HomeRoute /> }]);
    setAuctionContext({ leagueId: 'default', auctionId: 'corrente' });
    render(<QueryProvider><RouterProvider router={router} /></QueryProvider>);

    expect(await screen.findByRole('button', { name: 'Crea asta' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Le mie aste' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByText('Profilo')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Sezioni' })).not.toBeInTheDocument();
  });
  it('«Elimina» del menu apre la conferma, e confermare cancella e ricarica', async () => {
    const fetchMock = vi.fn((_input: RequestInfo, init?: RequestInit) => {
      if (init?.method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }));
      return Promise.resolve(json([CLOSED_AUCTION]));
    });
    vi.stubGlobal('fetch', fetchMock);
    renderHome();

    await chooseFromMenu(CLOSED_AUCTION.label, 'Elimina');
    await userEvent.click(screen.getByRole('button', { name: 'Elimina' }));

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/leagues/default/auctions/${CLOSED_AUCTION.id}`,
      expect.objectContaining({ method: 'DELETE' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { level: 1, name: 'Le tue aste' })).toHaveFocus();
  });

  it('annullare non chiama il server', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json([CLOSED_AUCTION]));
    vi.stubGlobal('fetch', fetchMock);
    renderHome();
    await chooseFromMenu(CLOSED_AUCTION.label, 'Elimina');
    await userEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
  });

  /**
   * Con aste presenti ma nessuna aperta la pagina diceva «Nessuna asta ancora»
   * accanto a un elenco pieno.
   */
  it('senza asta aperta non dice di non avere aste', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([CLOSED_AUCTION])));
    renderHome();
    await screen.findByText(CLOSED_AUCTION.label);
    expect(screen.queryByText(/nessuna asta/i)).not.toBeInTheDocument();
  });

  it('senza il totale dei posti, un solo acquisto si dice al singolare', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([{ ...CLOSED_AUCTION, purchases: 1, totalSlots: 0 }])));
    renderHome();
    expect(await screen.findByText('1 acquisto')).toBeInTheDocument();
    expect(screen.queryByText(/1 acquisti/)).not.toBeInTheDocument();
  });

  /** Una «A» in un cerchio da sola non dice che e' la fase in cui l'asta e' rimasta. */
  it('la fase si legge per esteso, una volta sola per chi ascolta', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([CLOSED_AUCTION])));
    renderHome();
    const phase = await screen.findByText('Fase attaccanti');
    expect(phase).toBeVisible();
    // La lettera colorata e' nascosta a chi ascolta: niente «A attaccante Fase attaccanti».
    expect(phase.querySelector('[aria-hidden="true"]')).toHaveTextContent('A');
  });

  /** Il giallo pieno resta a «Crea asta» e all'asta aperta, non a ogni riga. */
  it('«Riprendi» e pieno solo sull asta in corso', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([OPEN_AUCTION, CLOSED_AUCTION])));
    renderHome();
    const open = await screen.findByRole('button', { name: `Riprendi ${OPEN_AUCTION.label}` });
    const closed = screen.getByRole('button', { name: `Riprendi ${CLOSED_AUCTION.label}` });
    expect(open.className).toContain('bg-accent');
    expect(closed.className).not.toContain('bg-accent');
  });

  /** Oltre cinque aste l'elenco si sfoglia, invece di allungarsi senza fine. */
  it('mostra al massimo cinque aste e sfoglia le altre', async () => {
    const seven = Array.from({ length: 7 }, (_, i) => ({
      ...CLOSED_AUCTION, id: `a${i}`, label: `Asta ${i + 1}`,
    }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(seven)));
    renderHome();

    expect(await screen.findByText('Asta 1')).toBeInTheDocument();
    expect(screen.getByText('Asta 5')).toBeInTheDocument();
    expect(screen.queryByText('Asta 6')).not.toBeInTheDocument();
    const pager = screen.getByRole('navigation', { name: 'Pagine delle aste' });
    expect(pager).toHaveTextContent('1–5 di 7');

    await userEvent.click(screen.getByRole('button', { name: 'Pagina successiva' }));
    expect(screen.getByText('Asta 6')).toBeInTheDocument();
    expect(screen.getByText('Asta 7')).toBeInTheDocument();
    expect(screen.queryByText('Asta 1')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pagina successiva' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Pagina precedente' }));
    expect(screen.getByText('Asta 1')).toBeInTheDocument();
  });

  /** Il pannello ha la stessa misura con una o cinque aste: la pagina non cambia proporzioni. */
  it("l'elenco e' alto cinque righe anche con una sola asta", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([CLOSED_AUCTION])));
    renderHome();
    await screen.findByText(CLOSED_AUCTION.label);
    expect(screen.getByTestId('elenco-aste').className).toContain('min-h-[32.5rem]');
  });

  it('con cinque aste o meno non mostra i bottoni delle pagine', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([CLOSED_AUCTION])));
    renderHome();
    await screen.findByText(CLOSED_AUCTION.label);
    expect(screen.queryByRole('navigation', { name: 'Pagine delle aste' })).not.toBeInTheDocument();
  });

  it('sotto il contenuto mostra il marchio e la firma', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([CLOSED_AUCTION])));
    renderHome();
    await screen.findByText(CLOSED_AUCTION.label);
    const footer = document.querySelector('footer');
    expect(footer).not.toBeNull();
    expect(within(footer as HTMLElement).getByTestId('wordmark')).toBeInTheDocument();
    expect(footer).toHaveTextContent('2026, Luigi di Nuzzo');
  });


  /** L'invito a cominciare non deve sembrare il pannello dell'elenco. */
  it('il box «Crea asta» si distingue da quello delle aste', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([CLOSED_AUCTION])));
    renderHome();

    const list = await screen.findByRole('region', { name: "Riprendi un'asta" });
    const hero = screen.getByRole('region', { name: 'Comincia una nuova asta' });
    expect(hero.className).toContain('bg-surface-raised');
    expect(hero.className).toContain('border-accent');
    expect(list.className).not.toContain('bg-surface-raised');
    expect(list.className).not.toContain('border-accent');
  });

  /**
   * Lo stato e il verbo vengono dai numeri: nessun acquisto e' «Da iniziare» con
   * «Inizia», tutti i posti pieni e' «Conclusa» con «Apri». «Riprendi» su un'asta
   * finita prometteva qualcosa da riprendere che non c'era.
   */
  it('ogni riga dice lo stato e il bottone usa il verbo giusto', async () => {
    const nuova = { ...CLOSED_AUCTION, id: 'n', label: 'Nuova', purchases: 0 };
    const finita = { ...CLOSED_AUCTION, id: 'f', label: 'Finita', purchases: 200 };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([OPEN_AUCTION, nuova, finita])));
    renderHome();

    const rowOf = async (label: string) => (await screen.findByText(label)).closest('li')!;
    expect(within(await rowOf('Nuova')).getByText('Da iniziare')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inizia Nuova' })).toBeInTheDocument();
    expect(within(await rowOf('Finita')).getByText('Conclusa')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apri Finita' })).toBeInTheDocument();
    expect(within(await rowOf('Lega No Name')).getByText('In corso')).toBeInTheDocument();
  });

  it('la riga dice squadre e crediti rimasti di chi usa l app', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([OPEN_AUCTION])));
    renderHome();

    expect(await screen.findByText('8 squadre')).toBeInTheDocument();
    expect(screen.getByText('ti restano 320 crediti')).toBeInTheDocument();
  });

  /** Tutta la riga apre l'asta: il bottone la copre, e non ci sono due bersagli. */
  it('la riga ha un solo bottone principale, esteso a tutta la riga', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([CLOSED_AUCTION])));
    renderHome();

    const button = await screen.findByRole('button', { name: `Riprendi ${CLOSED_AUCTION.label}` });
    expect(button.className).toContain('after:inset-0');
    expect(button.closest('li')?.className).toContain('relative');
    // Il cestino sempre visibile non c'e' piu': Elimina sta nel menu.
    expect(screen.queryByRole('button', { name: `Elimina ${CLOSED_AUCTION.label}` })).not.toBeInTheDocument();
  });

  it('rinominare manda il nuovo nome e chiude la finestra', async () => {
    const fetchMock = vi.fn((_input: RequestInfo, init?: RequestInit) => {
      if (init?.method === 'PATCH') return Promise.resolve(new Response(null, { status: 204 }));
      return Promise.resolve(json([CLOSED_AUCTION]));
    });
    vi.stubGlobal('fetch', fetchMock);
    renderHome();

    await chooseFromMenu(CLOSED_AUCTION.label, 'Rinomina');
    const field = screen.getByLabelText("Nome dell'asta");
    expect(field).toHaveValue(CLOSED_AUCTION.label);
    await userEvent.clear(field);
    expect(screen.getByRole('button', { name: 'Salva nome' })).toBeDisabled();
    await userEvent.type(field, 'Lega Rinata');
    await userEvent.click(screen.getByRole('button', { name: 'Salva nome' }));

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/leagues/default/auctions/${CLOSED_AUCTION.id}`,
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ name: 'Lega Rinata' }) }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('duplicare crea la copia e lo dice', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const href = typeof input === 'string' ? input : input.toString();
      if (href.endsWith('/duplicate')) return Promise.resolve(json({ id: 'copia' }, 201));
      return Promise.resolve(json([CLOSED_AUCTION]));
    });
    vi.stubGlobal('fetch', fetchMock);
    renderHome();

    await chooseFromMenu(CLOSED_AUCTION.label, 'Duplica');

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/leagues/default/auctions/${CLOSED_AUCTION.id}/duplicate`,
      expect.objectContaining({ method: 'POST' }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(`Copia di «${CLOSED_AUCTION.label}» creata.`);
  });

  /** Il menu si usa da tastiera: frecce fra le voci, Esc chiude e torna al bottone. */
  it('il menu si apre sulla prima voce, si percorre con le frecce e si chiude con Esc', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([CLOSED_AUCTION])));
    renderHome();

    const trigger = await screen.findByRole('button', { name: `Altre azioni per ${CLOSED_AUCTION.label}` });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: 'Rinomina' })).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Elimina' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  /** Con piu' di una pagina compare la ricerca, che filtra per nome e dice quando non trova. */
  it('oltre cinque aste si cerca per nome', async () => {
    const seven = Array.from({ length: 7 }, (_, i) => ({
      ...CLOSED_AUCTION, id: `a${i}`, label: i === 6 ? 'Fantalega Ultima' : `Asta ${i + 1}`,
    }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(seven)));
    renderHome();

    const search = await screen.findByRole('searchbox', { name: "Cerca un'asta per nome" });
    await userEvent.type(search, 'ultima');
    expect(screen.getByText('Fantalega Ultima')).toBeInTheDocument();
    expect(screen.queryByText('Asta 1')).not.toBeInTheDocument();

    await userEvent.clear(search);
    await userEvent.type(search, 'nessuna così');
    expect(screen.getByText('Nessuna asta si chiama «nessuna così».')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mostra tutte le aste' }));
    expect(screen.getByText('Asta 1')).toBeInTheDocument();
  });

  it('con cinque aste o meno non mostra la ricerca', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([CLOSED_AUCTION])));
    renderHome();
    await screen.findByText(CLOSED_AUCTION.label);
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  /** Mentre carica, righe segnaposto nella stessa zona fissa: niente salta all'arrivo. */
  it('mentre carica mostra righe segnaposto nascoste a chi ascolta', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    renderHome();
    const area = screen.getByTestId('elenco-aste');
    const placeholder = area.querySelector('ul[aria-hidden="true"]');
    expect(placeholder?.querySelectorAll('li')).toHaveLength(5);
  });
});
