import { render, screen, waitFor } from '@testing-library/react';
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
    expect(await screen.findByDisplayValue('Anna')).toBeInTheDocument();
    expect(screen.getByLabelText(/secondi/i)).toHaveValue(5);
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

  it('ad asta aperta i parametri di punteggio sono bloccati, e dice perche', async () => {
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

    const assist = await screen.findByLabelText(/assist/i);
    expect(assist).toBeDisabled();
    expect(assist).toHaveAccessibleDescription(/asta in corso/i);
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

    await screen.findByDisplayValue('Anna');
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
});
