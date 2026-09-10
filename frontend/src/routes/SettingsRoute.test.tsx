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
    thresholds: [{ minAverage: 0, bonus: 0 }],
    goalBonus: { P: 0, D: 0, C: 0, A: 0 },
    assist: 1, penaltyScored: 3, penaltyMissed: -3, penaltySaved: 3,
    yellowCard: -0.5, redCard: -1, goalConceded: -1, cleanSheet: 1,
    confirmed: true,
  },
  auctionOpen: false,
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

  it('mostra gli errori accanto alla loro sezione, e ne annuncia il conto una volta sola', async () => {
    renderSettings(() =>
      Promise.resolve(
        jsonResponse(
          {
            type: 'https://fantaagent.local/problems/invalid-settings',
            detail: 'Alcune impostazioni non sono valide.',
            errors: {
              auction: [],
              participants: ["L'iniziale «A» è usata da più partecipanti."],
              scoring: ['Riga 2: la media non può essere negativa.'],
              bidder: [],
            },
          },
          422,
        ),
      ),
    );

    await userEvent.click(await screen.findByRole('button', { name: /salva/i }));

    expect(await screen.findByText(/l'iniziale «a» è usata/i)).toBeInTheDocument();
    expect(screen.getByText(/riga 2/i)).toBeInTheDocument();

    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent(/2 errori/i);
    expect(alerts[0]).toHaveTextContent(/partecipanti/i);
    expect(alerts[0]).toHaveTextContent(/punteggio/i);
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

    const defenders = await screen.findByLabelText(/difensori conteggiati/i);
    expect(defenders).toBeDisabled();
    expect(defenders).toHaveAccessibleDescription(/asta in corso/i);
  });

  /**
   * Il valore delle soglie non ha un editor in questa tappa (task 6 gliene dara' uno):
   * un salvataggio deve rispedirlo al server tale e quale, non appiattirlo o perderlo,
   * o il round-trip che questa tappa promette silenziosamente non regge.
   */
  it('rispedisce le soglie del modificatore di difesa invariate', async () => {
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
              auction: ['Primo problema sul nome.', 'Secondo problema sul nome.'],
              participants: [],
              scoring: [],
              bidder: [],
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
});
