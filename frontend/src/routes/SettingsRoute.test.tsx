import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { setAuctionContext } from '../api/client';
import { QueryProvider } from '../api/QueryProvider';
import { SettingsRoute } from './SettingsRoute';

const SETTINGS = {
  bidder: { bidTimerSeconds: 5, beepEnabled: true },
  participants: [
    { id: 'anna', name: 'Anna', initial: 'A', me: true },
    { id: 'bruno', name: 'Bruno', initial: 'B', me: false },
  ],
  scoring: {
    defenceModifierEnabled: false,
    defendersCounted: 3,
    thresholds: [{ minAverage: 0, bonus: 0 }, { minAverage: 4, bonus: 1 }],
    goalBonus: { P: 0, D: 0, C: 0, A: 0 },
    assist: 1, penaltyScored: 3, penaltyMissed: -3, penaltySaved: 3,
    yellowCard: -0.5, redCard: -1, goalConceded: -1, cleanSheet: 1,
    confirmed: true,
  },
  auctionOpen: false,
  rules: { participants: 8, budget: 500, slots: { P: 3, D: 8, C: 8, A: 6 } },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' },
  });
}

function renderSettings(put: () => Promise<Response>) {
  setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const href = typeof input === 'string' ? input : input.toString();
    if (href.endsWith('/settings') && init?.method === 'PUT') return put();
    if (href.endsWith('/settings')) return Promise.resolve(jsonResponse(SETTINGS));
    return Promise.reject(new Error(`URL non prevista nel test: ${href}`));
  });
  vi.stubGlobal('fetch', fetchMock);
  render(
    <QueryProvider>
      <MemoryRouter>
        <SettingsRoute />
      </MemoryRouter>
    </QueryProvider>,
  );
  return fetchMock;
}

describe('SettingsRoute', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('mostra le impostazioni che arrivano dal server', async () => {
    renderSettings(() => Promise.resolve(jsonResponse({ auctionId: null })));
    expect(await screen.findByLabelText(/secondi/i)).toHaveValue(5);
    expect(screen.getByLabelText('Crediti per squadra')).toHaveValue(SETTINGS.rules.budget);
  });

  /**
   * Un'asta nuova parte da otto righe vuote col segnaposto, non da nomi finti né da
   * quelli di un'altra lega: «Team 1» andava cancellato a mano, e non si vedeva
   * quali righe fossero ancora da scrivere.
   */
  it('una nuova asta parte da otto righe vuote con il segnaposto', async () => {
    renderSettings(() => Promise.resolve(jsonResponse({ auctionId: null })));
    expect(await screen.findByPlaceholderText('Nome della squadra 1')).toHaveValue('');
    expect(screen.getByPlaceholderText('Nome della squadra 8')).toHaveValue('');
    expect(screen.queryByDisplayValue('Team 1')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Anna')).not.toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(8);
    // Nessuna iniziale da compilare: la calcola il server dai nomi.
    expect(screen.queryByLabelText(/iniziale/i)).not.toBeInTheDocument();
  });

  /** Ad asta aperta, invece, si vedono i partecipanti veri di quell'asta. */
  it('ad asta aperta mostra i partecipanti dell asta', async () => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(jsonResponse({ ...SETTINGS, auctionOpen: true }))));
    render(
      <QueryProvider>
        <MemoryRouter>
          <SettingsRoute />
        </MemoryRouter>
      </QueryProvider>,
    );
    expect(await screen.findByDisplayValue('Anna')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Team 1')).not.toBeInTheDocument();
  });

  /**
   * Si entra qui dall'ingranaggio della barra dell'asta: la freccia deve riportare
   * dove si era, non alla home. Senza asta aperta la schermata e' invece «Crea asta»,
   * e la porta — di andata e di ritorno — e' la home.
   */
  it("ad asta aperta la freccia torna all'asta, non alla home", async () => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(jsonResponse({ ...SETTINGS, auctionOpen: true }))));
    render(
      <QueryProvider>
        <MemoryRouter>
          <SettingsRoute />
        </MemoryRouter>
      </QueryProvider>,
    );
    expect(await screen.findByRole('link', { name: "Torna all'asta" }))
      .toHaveAttribute('href', '/asta');
  });

  /**
   * Le impostazioni portano la barra compatta dell'asta, non la spalla della home:
   * quelle due voci riportavano alla home proprio mentre la freccia riporta
   * all'asta, due uscite diverse per la stessa schermata.
   */
  it('porta la barra compatta, senza la spalla di Asta e Profilo', async () => {
    renderSettings(() => Promise.resolve(jsonResponse({ auctionId: null })));
    await screen.findByLabelText(/secondi/i);
    expect(screen.queryByRole('navigation', { name: 'Sezioni' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'FantaAgent' })).toHaveAttribute('href', '/');
  });

  /** Preparando un'asta l'uscita e' «Le mie aste» nella barra: niente seconda freccia. */
  it('senza asta aperta si esce da «Le mie aste», senza una seconda freccia', async () => {
    renderSettings(() => Promise.resolve(jsonResponse({ auctionId: null })));
    await screen.findByLabelText(/secondi/i);
    expect(screen.getByRole('link', { name: 'Le mie aste' })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('link', { name: 'Torna alla home' })).not.toBeInTheDocument();
  });

  /**
   * Il nome dell'asta esiste solo in preparazione: ad asta aperta non se ne crea una
   * seconda, e il campo non avrebbe niente da fare.
   */
  it("chiede il nome dell'asta solo quando non ce n'e' una aperta", async () => {
    renderSettings(() => Promise.resolve(jsonResponse({ auctionId: null })));
    expect(await screen.findByLabelText(/nome dell'asta/i)).toBeInTheDocument();
  });

  it('mostra gli errori accanto al loro campo, e ne annuncia il conto una volta sola', async () => {
    renderSettings(() =>
      Promise.resolve(
        jsonResponse(
          {
            type: 'https://fantaagent.local/problems/invalid-settings',
            detail: 'Alcune impostazioni non sono valide.',
            errors: {
              participants: ["L'iniziale «A» è usata da più partecipanti."],
              'thresholds[1]': ['Riga 2: la media non può essere negativa.'],
            },
          },
          422,
        ),
      ),
    );

    await userEvent.click(await screen.findByRole('button', { name: /salva/i }));

    expect(await screen.findByText(/l'iniziale «a» è usata/i)).toBeInTheDocument();
    // Match esatto: il riassunto in fondo contiene anch'esso "riga 2" (nella sua
    // forma «riga 2 della tabella soglie»), e un match generico su /riga 2/i
    // troverebbe entrambi i nodi.
    expect(screen.getByText('Riga 2: la media non può essere negativa.')).toBeInTheDocument();

    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent(/2 errori/i);
    expect(alerts[0]).toHaveTextContent(/partecipanti/i);
    // Il riassunto ora nomina il CAMPO, non la sezione "punteggio" di prima: le
    // soglie non hanno un campo proprio, quindi la riga della tabella.
    expect(alerts[0]).toHaveTextContent(/riga 2 della tabella/i);
  });

  /**
   * Ad asta aperta il punteggio non e' un modulo spento ma un riepilogo da leggere,
   * con la ragione detta una volta sola.
   */
  it('ad asta aperta il punteggio e un riepilogo da leggere, e dice perche', async () => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
    const fetchMock = vi.fn(() =>
      Promise.resolve(jsonResponse({ ...SETTINGS, auctionOpen: true })),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(
      <QueryProvider>
        <MemoryRouter>
          <SettingsRoute />
        </MemoryRouter>
      </QueryProvider>,
    );

    const scoring = await screen.findByRole('region', { name: 'Punteggio' });
    expect(within(scoring).getByText('Assist')).toBeInTheDocument();
    expect(within(scoring).queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(within(scoring).queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText(/asta in corso: regole della lega e punteggio sono fissati/i)).toBeInTheDocument();
  });

  /**
   * Le soglie non toccate devono tornare al server tali e quali, non appiattite o
   * perse: {@link ThresholdsTable} (task 18) le legge e le scrive con lo spread
   * come ogni altro campo, ma nessun test lo verifica se non si preme "Salva"
   * senza avere aperto quello specifico modulo.
   */
  it('rispedisce le soglie del modificatore di difesa non toccate, invariate', async () => {
    let sentBody: unknown = null;
    const fetchMock = renderSettings(() => Promise.resolve(jsonResponse({ auctionId: null })));
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const href = typeof input === 'string' ? input : input.toString();
      if (href.endsWith('/settings') && init?.method === 'PUT') {
        sentBody = JSON.parse(init.body as string);
        return Promise.resolve(jsonResponse({ auctionId: null }));
      }
      if (href.endsWith('/settings')) return Promise.resolve(jsonResponse(SETTINGS));
      return Promise.reject(new Error(`URL non prevista nel test: ${href}`));
    });

    await screen.findByPlaceholderText('Nome della squadra 1');
    await userEvent.type(await screen.findByLabelText(/nome dell'asta/i), 'Lega');
    await userEvent.click(screen.getByRole('button', { name: /salva/i }));

    await waitFor(() => expect(sentBody).not.toBeNull());
    expect((sentBody as { scoring: { thresholds: unknown } }).scoring.thresholds).toEqual(
      SETTINGS.scoring.thresholds,
    );
  });

  /**
   * Il caso che il test sopra non copre: la tabella adesso ha un editor (task 18),
   * quindi un salvataggio deve mandare la riga COME L'UTENTE L'HA MODIFICATA, non
   * il valore arrivato dal server. Il modificatore deve essere attivo perche' la
   * tabella sia modificabile — altrimenti {@code ScoringFieldset} la disabilita.
   */
  it("invia la soglia modificata dall'utente, non quella arrivata dal server", async () => {
    const settingsWithModifierOn = {
      ...SETTINGS,
      scoring: { ...SETTINGS.scoring, defenceModifierEnabled: true },
    };
    let sentBody: unknown = null;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const href = typeof input === 'string' ? input : input.toString();
      if (href.endsWith('/settings') && init?.method === 'PUT') {
        sentBody = JSON.parse(init.body as string);
        return Promise.resolve(jsonResponse({ auctionId: null }));
      }
      if (href.endsWith('/settings')) return Promise.resolve(jsonResponse(settingsWithModifierOn));
      return Promise.reject(new Error(`URL non prevista nel test: ${href}`));
    });
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
    vi.stubGlobal('fetch', fetchMock);
    render(
      <QueryProvider>
        <MemoryRouter>
          <SettingsRoute />
        </MemoryRouter>
      </QueryProvider>,
    );

    const field = await screen.findByLabelText(/soglia da media, riga 1/i);
    await userEvent.clear(field);
    await userEvent.type(field, '6.75');
    await userEvent.click(screen.getByRole('button', { name: /salva/i }));

    await waitFor(() => expect(sentBody).not.toBeNull());
    expect(
      (sentBody as { scoring: { thresholds: Array<{ minAverage: number }> } }).scoring
        .thresholds[0].minAverage,
    ).toBe(6.75);
  });

  /**
   * Un 422 con lo slug giusto ma senza la mappa `errors` (un proxy che riscrive il
   * corpo, un bug futuro nel controller): non deve sparire in silenzio. Chi ha
   * premuto "Salva" deve sentire ALMENO il `detail` del problem, non il bottone
   * che smette di girare senza dire perche'.
   */
  it('un 422 invalid-settings senza mappa errors mostra comunque un annuncio', async () => {
    renderSettings(() =>
      Promise.resolve(
        jsonResponse(
          {
            type: 'https://fantaagent.local/problems/invalid-settings',
            detail: 'Corpo del problem inatteso.',
          },
          422,
        ),
      ),
    );

    await userEvent.click(await screen.findByRole('button', { name: /salva/i }));

    const alerts = await screen.findAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent(/corpo del problem inatteso/i);
  });

  /**
   * Il progetto esiste anche per questo: i validatori tornano l'elenco COMPLETO
   * degli errori, non il primo. Se in futuro il nome dell'asta ne accumula due,
   * la schermata non ne deve mostrare solo uno.
   */
  it("mostra tutti gli errori del nome dell'asta, non solo il primo", async () => {
    renderSettings(() =>
      Promise.resolve(
        jsonResponse(
          {
            type: 'https://fantaagent.local/problems/invalid-settings',
            detail: 'Alcune impostazioni non sono valide.',
            errors: {
              auctionName: ['Primo problema sul nome.', 'Secondo problema sul nome.'],
            },
          },
          422,
        ),
      ),
    );

    await userEvent.click(await screen.findByRole('button', { name: /salva/i }));

    expect(await screen.findByText('Primo problema sul nome.')).toBeInTheDocument();
    expect(screen.getByText('Secondo problema sul nome.')).toBeInTheDocument();
  });

  /**
   * Stesso idioma di ScoringFieldset (Number(e.target.value) su un controllato),
   * qui sul timer del battitore: svuotare il campo non deve forzarlo a 0 prima
   * che l'utente abbia finito di digitare il nuovo valore.
   */
  it('svuotare il campo dei secondi non lo forza a 0 prima di finire di digitare', async () => {
    renderSettings(() => Promise.resolve(jsonResponse({ auctionId: null })));

    const timer = await screen.findByLabelText(/secondi/i);
    await userEvent.clear(timer);
    expect(timer).toHaveValue(null);

    await userEvent.type(timer, '45');
    expect(timer).toHaveValue(45);
  });

  /**
   * Prima del fix, il bottone tornava da "Salvo…" a "Salva" e basta: nessuna
   * conferma che il salvataggio fosse andato a buon fine. Va nello stesso, unico
   * nodo di alert usato per gli errori — non un secondo role="status".
   */
  it('un salvataggio riuscito ad asta aperta lo conferma', async () => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const href = typeof input === 'string' ? input : input.toString();
      if (href.endsWith('/settings') && init?.method === 'PUT') {
        return Promise.resolve(jsonResponse({ auctionId: null }));
      }
      return Promise.resolve(jsonResponse({ ...SETTINGS, auctionOpen: true }));
    });
    vi.stubGlobal('fetch', fetchMock);
    render(
      <QueryProvider>
        <MemoryRouter>
          <SettingsRoute />
        </MemoryRouter>
      </QueryProvider>,
    );

    await userEvent.click(await screen.findByRole('button', { name: /salva/i }));

    expect(await screen.findByText(/salvat/i)).toBeInTheDocument();
    // Un solo alert, come per gli errori: non un secondo role="status".
    expect(screen.queryAllByRole('status')).toHaveLength(0);
  });

  /**
   * settingsErrorsOf si fermava a un livello di restringimento: verificava che
   * "errors" fosse un oggetto e poi si fidava del resto. Un corpo con
   * {@code errors.participants} una STRINGA invece di un array (un backend rotto,
   * un proxy che lo trasforma) dava `errors.participants.length === 4` (la
   * lunghezza della stringa "boom"), un riassunto «4 errori: 4 in partecipanti» e
   * poi FieldErrors che chiama `.map` su una stringa — un crash del render,
   * ancora peggio del silenzio che questo stesso meccanismo dovrebbe evitare.
   */
  it('un corpo con una sezione non a forma di array non crasha, e dice comunque qualcosa', async () => {
    renderSettings(() =>
      Promise.resolve(
        jsonResponse(
          {
            type: 'https://fantaagent.local/problems/invalid-settings',
            detail: 'Alcune impostazioni non sono valide.',
            errors: { participants: 'boom' },
          },
          422,
        ),
      ),
    );

    await userEvent.click(await screen.findByRole('button', { name: /salva/i }));

    // Non crasha (il render arriva fino a un alert) e non mostra un conteggio
    // inventato dalla lunghezza della stringa: cade nel ramo generico, che dice
    // almeno il `detail` del problem.
    const alerts = await screen.findAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent(/alcune impostazioni non sono valide/i);
  });

  /**
   * Le chiavi sono di campo e non si conoscono tutte in anticipo (task 16): una
   * chiave che {@code fieldLabel} non riconosce (un campo futuro, un typo) deve
   * comunque poter comparire nel riassunto — mostrando se stessa, non
   * "undefined" come farebbe una mappa fissa indicizzata su una chiave assente.
   */
  it('una chiave sconosciuta nel corpo non finisce nel riassunto come "undefined"', async () => {
    renderSettings(() =>
      Promise.resolve(
        jsonResponse(
          {
            type: 'https://fantaagent.local/problems/invalid-settings',
            detail: 'Alcune impostazioni non sono valide.',
            errors: {
              participants: ['Serve un nome unico.'],
              sorpresa: ['non dovrebbe apparire'],
            },
          },
          422,
        ),
      ),
    );

    await userEvent.click(await screen.findByRole('button', { name: /salva/i }));

    expect(await screen.findByText('Serve un nome unico.')).toBeInTheDocument();
    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).not.toHaveTextContent(/undefined/i);
  });

  /**
   * Il punteggio fa parte della creazione quanto i partecipanti: sempre aperto,
   * senza nessun controllo per chiuderlo. Era un <details>, che da chiuso
   * nascondeva anche un campo invalido che bloccava il salvataggio.
   */
  it('il punteggio e\' sempre visibile, e non si puo\' chiudere', async () => {
    renderSettings(() => Promise.resolve(jsonResponse({ auctionId: null })));

    expect(await screen.findByRole('group', { name: /punteggio/i })).toBeVisible();
    expect(screen.getByText('Assist')).toBeVisible();
    expect(document.querySelector('details, summary')).toBeNull();
    expect(screen.queryByRole('button', { name: /punteggio/i })).not.toBeInTheDocument();
  });

  /** Il timer si regola anche senza tastiera, un secondo alla volta, dentro i limiti del server. */
  it('i pulsanti − e + cambiano il countdown di un secondo, fermandosi ai limiti', async () => {
    renderSettings(() => Promise.resolve(jsonResponse({ auctionId: null })));

    const timer = await screen.findByLabelText(/secondi/i);
    expect(timer).toHaveValue(5);

    await userEvent.click(screen.getByRole('button', { name: 'Un secondo in più' }));
    expect(timer).toHaveValue(6);
    await userEvent.click(screen.getByRole('button', { name: 'Un secondo in meno' }));
    await userEvent.click(screen.getByRole('button', { name: 'Un secondo in meno' }));
    expect(timer).toHaveValue(4);

    await userEvent.clear(timer);
    await userEvent.type(timer, '1');
    expect(screen.getByRole('button', { name: 'Un secondo in meno' })).toBeDisabled();

    await userEvent.clear(timer);
    await userEvent.type(timer, '120');
    expect(screen.getByRole('button', { name: 'Un secondo in più' })).toBeDisabled();
  });

  it('il salvataggio invia le regole modificate', async () => {
    let sentBody: { rules: { budget: number; slots: Record<string, number> } } | null = null;
    const fetchMock = renderSettings(() => Promise.resolve(jsonResponse({ auctionId: null })));
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const href = typeof input === 'string' ? input : input.toString();
      if (href.endsWith('/settings') && init?.method === 'PUT') {
        sentBody = JSON.parse(init.body as string);
        return Promise.resolve(jsonResponse({ auctionId: null }));
      }
      if (href.endsWith('/settings')) return Promise.resolve(jsonResponse(SETTINGS));
      return Promise.reject(new Error(`URL non prevista nel test: ${href}`));
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Dieci crediti in più' }));
    await userEvent.click(screen.getByRole('button', { name: 'Un posto in meno: difensori' }));
    await userEvent.type(screen.getByLabelText(/nome dell'asta/i), 'Serata');
    await userEvent.click(screen.getByRole('button', { name: /salva/i }));

    await waitFor(() => expect(sentBody).not.toBeNull());
    expect(sentBody!.rules).toEqual({ budget: 510, slots: { P: 3, D: 7, C: 8, A: 6 } });
  });

  /** Le squadre non sono un campo: seguono la lista dei partecipanti mentre la si modifica. */
  /** Il numero di squadre sta sotto i partecipanti, e li segue. */
  it('le squadre seguono i partecipanti aggiunti', async () => {
    renderSettings(() => Promise.resolve(jsonResponse({ auctionId: null })));
    const squadre = (await screen.findByText('squadre')).parentElement;
    expect(squadre).toHaveTextContent('8');

    await userEvent.click(screen.getByRole('button', { name: /aggiungi partecipante/i }));
    expect(screen.getByText('squadre').parentElement).toHaveTextContent('9');

    const togli = screen.getAllByRole('button', { name: /^Togli/ });
    await userEvent.click(togli[togli.length - 1]);
    expect(screen.getByText('squadre').parentElement).toHaveTextContent('8');
  });

  it('ad asta aperta regole e numero di partecipanti sono fissi, e le regole si leggono', async () => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(jsonResponse({ ...SETTINGS, auctionOpen: true }))));
    render(
      <QueryProvider>
        <MemoryRouter>
          <SettingsRoute />
        </MemoryRouter>
      </QueryProvider>,
    );

    const rules = await screen.findByRole('region', { name: 'Regole della lega' });
    expect(within(rules).getByText('Crediti per squadra')).toBeInTheDocument();
    expect(within(rules).getByText(String(SETTINGS.rules.budget))).toBeInTheDocument();
    expect(within(rules).queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /aggiungi partecipante/i })).not.toBeInTheDocument();
  });

  it("un errore sui posti compare nel riassunto con il nome del ruolo", async () => {
    renderSettings(() =>
      Promise.resolve(
        jsonResponse(
          {
            type: 'https://fantaagent.local/problems/invalid-settings',
            detail: 'Alcune impostazioni non sono valide.',
            errors: { 'slots[P]': ['Gli slot dei portieri devono essere fra 1 e 30: indicati 0.'] },
          },
          422,
        ),
      ),
    );
    await userEvent.type(await screen.findByLabelText(/nome dell'asta/i), 'Serata');
    await userEvent.click(screen.getByRole('button', { name: /salva/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/posti portieri/i);
  });

  /**
   * Chi rifa' l'asta ogni stagione con la stessa lega parte dalle regole e dai nomi
   * di quella vecchia, invece di riscriverli: il nome della nuova resta quello scritto.
   */
  it('«Parti da» copia regole e partecipanti di un asta precedente', async () => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
    const old = {
      ...SETTINGS,
      participants: [
        { id: 'luigi', name: 'Luigi', initial: 'L', me: true },
        { id: 'diego', name: 'Diego', initial: 'D', me: false },
      ],
      rules: { ...SETTINGS.rules, budget: 600 },
    };
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const href = typeof input === 'string' ? input : input.toString();
      if (href.includes('/settings/from/2026-09-01')) return Promise.resolve(jsonResponse(old));
      if (href.endsWith('/settings')) return Promise.resolve(jsonResponse(SETTINGS));
      if (href.endsWith('/auctions')) {
        return Promise.resolve(jsonResponse([{ id: '2026-09-01', label: 'Serie A 2026', lastWritten: null,
          purchases: 0, phase: 'P', selected: false, teams: 2, budget: 600, totalSlots: 50,
          myName: 'Luigi', myBudgetRemaining: 600 }]));
      }
      return Promise.reject(new Error(`URL non prevista nel test: ${href}`));
    }));
    render(<QueryProvider><MemoryRouter><SettingsRoute /></MemoryRouter></QueryProvider>);

    await userEvent.type(await screen.findByLabelText(/nome dell'asta/i), 'Nuova stagione');
    const start = screen.getByLabelText('Parti da');
    await screen.findByRole('option', { name: 'Le regole di «Serie A 2026»' });
    await userEvent.selectOptions(start, '2026-09-01');

    expect(await screen.findByDisplayValue('Diego')).toBeInTheDocument();
    expect(screen.getByLabelText('Crediti per squadra')).toHaveValue(600);
    expect(screen.getByLabelText(/nome dell'asta/i)).toHaveValue('Nuova stagione');
    expect(screen.getByText(/copiati: cambia quello che serve/)).toBeInTheDocument();
  });

  /** Il salvataggio resta in vista mentre si scorre il modulo. */
  it('il bottone di salvataggio sta in una barra fissa in fondo', async () => {
    renderSettings(() => Promise.resolve(jsonResponse({ auctionId: null })));
    const button = await screen.findByRole('button', { name: "Salva e comincia l'asta" });
    expect(button.parentElement?.className).toContain('sticky');
  });

  it('un indice porta a ogni sezione del modulo', async () => {
    renderSettings(() => Promise.resolve(jsonResponse({ auctionId: null })));
    const index = await screen.findByRole('navigation', { name: 'Sezioni del modulo' });
    for (const [label, id] of [['Regole della lega', 'sezione-regole'], ['Partecipanti', 'sezione-partecipanti'], ['Punteggio', 'sezione-punteggio']]) {
      expect(within(index).getByRole('link', { name: label })).toHaveAttribute('href', `#${id}`);
      expect(document.getElementById(id)).not.toBeNull();
    }
  });
});
