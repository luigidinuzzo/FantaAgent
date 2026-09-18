import { act, render, screen, waitFor, within } from '@testing-library/react';
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

// Le due carte dei test del ridisegno: una sola aperta, una sola chiusa — quanto
// basta a verificare che la riga dica la fase giusta senza tirare in mezzo
// l'intero elenco CARDS sopra.
const OPEN_AUCTION = {
  id: '2026-09-02', label: 'Lega No Name', lastWritten: '2026-09-02T13:08:41Z',
  purchases: 3, phase: 'D', selected: true,
};
const CLOSED_AUCTION = {
  id: '2025-08-30', label: 'Lega Passata', lastWritten: '2025-08-30T20:00:00Z',
  purchases: 2, phase: 'A', selected: false,
};

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
    expect(screen.getByText(/3 acquisti/)).toBeInTheDocument();
    expect(screen.getByText('2025-08-30')).toBeInTheDocument();
  });

  it('riprende un asta e chiede al server di selezionarla', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(CARDS))
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    renderHome();

    // Con CARDS[0] selezionata, la pagina ha ANCHE il "Riprendi" della card destra
    // — ma il suo nome accessibile e' "Riprendi l'asta aperta, ...", una frase
    // diversa: questa query trova solo quello della riga-pillola.
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
   * rete mostrano il titolo, un elenco vuoto e il controllo "crea asta" — niente
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
      .toHaveTextContent("L'elenco delle aste non si è caricato. Riprova.");
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

      // Come sopra: questa query trova solo il "Riprendi" della riga-pillola, non
      // quello della card destra (nome accessibile diverso apposta).
      await user.click(await screen.findByRole('button', { name: /riprendi lega no name/i }));
      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/riprendere l'asta/i));

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

    // Il pallino colorato del mockup e' decorazione. Il fatto sta nel testo.
    expect(await screen.findByText('In corso')).toBeInTheDocument();
  });

  // La fase si legge da RoleBadge (lettera colorata + nome per esteso in
  // sr-only), non da un secondo testo "fase X" a fianco: quel secondo testo
  // era una lettera nuda ripetuta, il difetto che RoleBadge esiste per
  // evitare (revisione finale, finding F) — vedi il commento su HomeRoute.
  it('ogni riga dice fase e acquisti, non solo il nome', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([CLOSED_AUCTION])));
    renderHome();

    expect(await screen.findByText(/2 acquisti/)).toBeInTheDocument();
    // CLOSED_AUCTION e' in fase 'A': il nome per esteso di RoleBadge.
    expect(screen.getByText(/attaccante/i)).toBeInTheDocument();
  });

  /**
   * Difetto di accessibilita' gia' corretto piu' volte in questo progetto: con
   * un'asta aperta la pagina ha DUE bottoni "Riprendi" (la riga-pillola e la card
   * destra). Il testo visibile "Riprendi" puo' restare uguale nei due — chi guarda
   * ha il contesto della card attorno — ma il nome ACCESSIBILE deve nominare
   * l'asta in entrambi, altrimenti chi naviga per elenco di ruoli sente due voci
   * identiche e una non dice a quale asta si riferisce. Senza questo test la
   * regressione puo' rientrare (e' successo) senza che nulla diventi rosso.
   */
  it("entrambi i bottoni «Riprendi» nominano la loro asta, non solo la riga", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([OPEN_AUCTION])));
    renderHome();

    // La riga-pillola: aria-label "Riprendi <nome>", come sempre.
    expect(
      await screen.findByRole('button', { name: `Riprendi ${OPEN_AUCTION.label}` }),
    ).toBeInTheDocument();
    // La card destra: una frase diversa (per non collidere con quella della riga
    // in una query per nome), ma che nomina comunque l'asta.
    expect(
      screen.getByRole('button', { name: `Riprendi l'asta aperta, ${OPEN_AUCTION.label}` }),
    ).toBeInTheDocument();
  });

  /**
   * Profilo cambia il contenuto, non la pagina: l'indirizzo resta "/" e le aste
   * tornano con Asta. Il profilo e' finto finche' non c'e' l'accesso, e lo dice.
   */
  it('Profilo mostra il profilo al posto delle aste, senza cambiare pagina', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([OPEN_AUCTION])));
    const router = createMemoryRouter([{ path: '/', element: <HomeRoute /> }]);
    setAuctionContext({ leagueId: 'default', auctionId: 'corrente' });
    render(<QueryProvider><RouterProvider router={router} /></QueryProvider>);

    const nav = screen.getByRole('navigation', { name: 'Sezioni' });
    expect(within(nav).getByRole('button', { name: 'Asta' })).toHaveAttribute('aria-current', 'true');
    expect(await screen.findByRole('button', { name: 'Crea asta' })).toBeInTheDocument();

    await userEvent.click(within(nav).getByRole('button', { name: 'Profilo' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Profilo' })).toBeInTheDocument();
    expect(screen.getByText('Allenatore')).toBeInTheDocument();
    expect(screen.getByText(/modificabile dopo l'introduzione dell'accesso/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Crea asta' })).not.toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'Profilo' })).toHaveAttribute('aria-current', 'true');
    expect(router.state.location.pathname).toBe('/');
    // Il profilo non e' modificabile: nessuna casella che finga di salvare.
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);

    await userEvent.click(within(nav).getByRole('button', { name: 'Asta' }));
    expect(screen.getByRole('button', { name: 'Crea asta' })).toBeInTheDocument();
  });

  it('si apre su Profilo quando ci si arriva dalla barra di un altra schermata', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([])));
    setAuctionContext({ leagueId: 'default', auctionId: 'corrente' });
    render(
      <QueryProvider>
        <MemoryRouter initialEntries={[{ pathname: '/', state: { section: 'profilo' } }]}>
          <HomeRoute />
        </MemoryRouter>
      </QueryProvider>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Profilo' })).toBeInTheDocument();
  });
  it('il cestino apre la conferma, e confermare cancella e ricarica', async () => {
    const fetchMock = vi.fn((_input: RequestInfo, init?: RequestInit) => {
      if (init?.method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }));
      return Promise.resolve(json([CLOSED_AUCTION]));
    });
    vi.stubGlobal('fetch', fetchMock);
    renderHome();

    await userEvent.click(await screen.findByRole('button', { name: `Elimina ${CLOSED_AUCTION.label}` }));
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
    await userEvent.click(await screen.findByRole('button', { name: `Elimina ${CLOSED_AUCTION.label}` }));
    await userEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
  });

  it('la card dell asta aperta non ha il cestino', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([OPEN_AUCTION])));
    renderHome();
    await screen.findByRole('button', { name: `Riprendi l'asta aperta, ${OPEN_AUCTION.label}` });
    expect(screen.getAllByRole('button', { name: /^Elimina / })).toHaveLength(1);
  });

  /**
   * Con aste presenti ma nessuna aperta la colonna destra diceva «Nessuna asta
   * ancora» accanto a un elenco pieno. Ora non c'e' proprio.
   */
  it('senza asta aperta non dice di non avere aste, e non mostra la colonna destra', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([CLOSED_AUCTION])));
    renderHome();
    await screen.findByText(CLOSED_AUCTION.label);
    expect(screen.queryByText(/nessuna asta/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/asta aperta/i)).not.toBeInTheDocument();
    expect(document.querySelector('aside')).toBeNull();
  });

  it('un solo acquisto si dice al singolare', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([{ ...CLOSED_AUCTION, purchases: 1 }])));
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

  /** Il giallo pieno resta a «Crea asta» e all'asta in corso, non a ogni riga. */
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

  it('con cinque aste o meno non mostra i bottoni delle pagine', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([CLOSED_AUCTION])));
    renderHome();
    await screen.findByText(CLOSED_AUCTION.label);
    expect(screen.queryByRole('navigation', { name: 'Pagine delle aste' })).not.toBeInTheDocument();
  });

  it('sotto le aste mostra il marchio e la firma', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([CLOSED_AUCTION])));
    renderHome();
    await screen.findByText(CLOSED_AUCTION.label);
    const footer = document.querySelector('footer');
    expect(footer).not.toBeNull();
    expect(within(footer as HTMLElement).getByTestId('wordmark')).toBeInTheDocument();
    expect(footer).toHaveTextContent('2026, Luigi di Nuzzo');
  });

});
