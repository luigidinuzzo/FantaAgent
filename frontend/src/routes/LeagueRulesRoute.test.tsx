import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryProvider } from '../api/QueryProvider';
import type { LeagueRulesResponse } from '../api/types';
import { LeagueRulesRoute } from './LeagueRulesRoute';

const RULES: LeagueRulesResponse = {
  bidder: { bidTimerSeconds: 5, beepEnabled: true },
  scoring: {
    defenceModifierEnabled: false,
    defendersCounted: 3,
    thresholds: [{ minAverage: 0, bonus: 0 }, { minAverage: 4, bonus: 1 }],
    goalBonus: { P: 0, D: 0, C: 0, A: 0 },
    assist: 1, penaltyScored: 3, penaltyMissed: -3, penaltySaved: 3,
    yellowCard: -0.5, redCard: -1, goalConceded: -1, cleanSheet: 1,
    confirmed: true,
  },
  rules: { budget: 500, slots: { P: 3, D: 8, C: 8, A: 6 } },
  canEdit: true,
};

const INVALID = 'https://fantaagent.local/problems/invalid-settings';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' },
  });
}

/**
 * Le regole della lega l1: la lettura risponde con {@code rules}, il salvataggio con
 * {@code put} (per difetto, le stesse regole salvate). Ogni altra chiamata — la barra
 * chiede chi sono — risponde 404, come farebbe una rotta che il test non conosce.
 */
function stubRules(rules: LeagueRulesResponse, put: () => Promise<Response> = () =>
  Promise.resolve(jsonResponse(rules))) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const href = typeof input === 'string' ? input : input.toString();
    if (href === '/api/leagues/l1/rules' && init?.method === 'PUT') return put();
    if (href === '/api/leagues/l1/rules') return Promise.resolve(jsonResponse(rules));
    return Promise.resolve(jsonResponse({ type: 'about:blank' }, 404));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function problem(errors?: Record<string, unknown>, detail = 'Alcune impostazioni non sono valide.') {
  return () => Promise.resolve(jsonResponse(
    errors === undefined ? { type: INVALID, detail } : { type: INVALID, detail, errors }, 422));
}

/** Il corpo dell'ultimo PUT, letto quando serve. */
function sentBody(fetchMock: ReturnType<typeof stubRules>) {
  const put = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT').at(-1);
  return put ? JSON.parse(put[1]!.body as string) : null;
}

function renderRules() {
  const router = createMemoryRouter([
    { path: '/leghe/:leagueId/regole', element: <LeagueRulesRoute /> },
  ], { initialEntries: ['/leghe/l1/regole'] });
  render(<QueryProvider><RouterProvider router={router} /></QueryProvider>);
}

describe('LeagueRulesRoute', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('il titolo e\' «Regole della lega», e dice a quali aste valgono', async () => {
    stubRules(RULES);
    renderRules();
    expect(await screen.findByText(
      'Valgono per le prossime aste della lega. Quelle già create tengono le regole con cui sono nate.',
    )).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Regole della lega' })).toBeInTheDocument();
  });

  /**
   * «Battitore» e' chi batte la palla; chi conduce un'asta e' il banditore, e il
   * posto dove sta il lotto e' il banco. Queste preferenze — secondi del conto
   * alla rovescia, avviso sonoro — sono di chi conduce.
   */
  it('le preferenze di chi conduce si chiamano Banditore', async () => {
    stubRules(RULES);
    renderRules();
    expect(await screen.findByRole('group', { name: 'Banditore' })).toBeInTheDocument();
  });

  it('mostra le regole della lega', async () => {
    stubRules(RULES);
    renderRules();
    expect(await screen.findByLabelText(/secondi/i)).toHaveValue(5);
    expect(screen.getByLabelText('Crediti per squadra')).toHaveValue(RULES.rules.budget);
  });

  /** Le squadre sono i membri che partecipano a ogni asta: non una regola. */
  it('il numero di squadre non e\' fra le regole', async () => {
    stubRules(RULES);
    renderRules();
    await screen.findByLabelText('Crediti per squadra');
    expect(screen.queryByText(/squadre$/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /aggiungi partecipante/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/nome dell'asta/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Parti da')).not.toBeInTheDocument();
  });

  it('la freccia riporta alla pagina della lega', async () => {
    stubRules(RULES);
    renderRules();
    expect(await screen.findByRole('link', { name: 'Torna alla lega' })).toHaveAttribute('href', '/leghe/l1');
  });

  it('chi non e\' amministratore legge le regole ma non le cambia', async () => {
    stubRules({ ...RULES, canEdit: false });
    renderRules();
    expect(await screen.findByText('Solo l\'amministratore della lega può cambiare le regole.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Salva/ })).not.toBeInTheDocument();
  });

  /** Per chi legge, valori scritti: nessun campo, nessun campo spento. */
  it('chi non e\' amministratore vede un riepilogo, senza campi', async () => {
    stubRules({ ...RULES, canEdit: false });
    renderRules();
    const rules = await screen.findByRole('region', { name: 'Crediti e posti' });
    expect(within(rules).getByText('Crediti per squadra')).toBeInTheDocument();
    expect(within(rules).getByText(String(RULES.rules.budget))).toBeInTheDocument();
    const scoring = screen.getByRole('region', { name: 'Punteggio' });
    expect(within(scoring).getByText('Assist')).toBeInTheDocument();
    const bidder = screen.getByRole('region', { name: 'Banditore' });
    expect(within(bidder).getByText('5')).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('il salvataggio manda banditore, punteggio e regole, e resta qui', async () => {
    const fetchMock = stubRules(RULES);
    renderRules();
    await userEvent.click(await screen.findByRole('button', { name: /Salva/ }));
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
    expect(Object.keys(JSON.parse(put![1]!.body as string)).sort()).toEqual(['bidder', 'rules', 'scoring']);
    expect(await screen.findByRole('status')).toHaveTextContent('Regole salvate.');
    expect(screen.getByRole('heading', { level: 1, name: 'Regole della lega' })).toBeInTheDocument();
  });

  it('mostra gli errori accanto al loro campo, e ne annuncia il conto una volta sola', async () => {
    stubRules(RULES, problem({
      budget: ['I crediti devono essere almeno 1.'],
      'thresholds[1]': ['Riga 2: la media non può essere negativa.'],
    }));
    renderRules();

    await userEvent.click(await screen.findByRole('button', { name: /salva/i }));

    expect(await screen.findByText('I crediti devono essere almeno 1.')).toBeInTheDocument();
    // Match esatto: il riassunto in fondo contiene anch'esso "riga 2".
    expect(screen.getByText('Riga 2: la media non può essere negativa.')).toBeInTheDocument();

    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent(/2 errori/i);
    expect(alerts[0]).toHaveTextContent(/crediti per squadra/i);
    expect(alerts[0]).toHaveTextContent(/riga 2 della tabella/i);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  /** Le soglie non toccate tornano al server tali e quali, non appiattite o perse. */
  it('rispedisce le soglie del modificatore di difesa non toccate, invariate', async () => {
    const fetchMock = stubRules(RULES);
    renderRules();
    await userEvent.click(await screen.findByRole('button', { name: /salva/i }));
    await waitFor(() => expect(sentBody(fetchMock)).not.toBeNull());
    expect(sentBody(fetchMock).scoring.thresholds).toEqual(RULES.scoring.thresholds);
  });

  /**
   * La tabella ha un editor: il salvataggio manda la riga COME L'UTENTE L'HA
   * MODIFICATA. Il modificatore deve essere attivo perche' la tabella sia modificabile.
   */
  it("invia la soglia modificata dall'utente, non quella arrivata dal server", async () => {
    const fetchMock = stubRules({ ...RULES, scoring: { ...RULES.scoring, defenceModifierEnabled: true } });
    renderRules();

    const field = await screen.findByLabelText(/soglia da media, riga 1/i);
    await userEvent.clear(field);
    await userEvent.type(field, '6.75');
    await userEvent.click(screen.getByRole('button', { name: /salva/i }));

    await waitFor(() => expect(sentBody(fetchMock)).not.toBeNull());
    expect(sentBody(fetchMock).scoring.thresholds[0].minAverage).toBe(6.75);
  });

  /**
   * Un 422 con lo slug giusto ma senza la mappa `errors`: chi ha premuto "Salva"
   * deve sentire ALMENO il `detail` del problem.
   */
  it('un 422 invalid-settings senza mappa errors mostra comunque un annuncio', async () => {
    stubRules(RULES, problem(undefined, 'Corpo del problem inatteso.'));
    renderRules();

    await userEvent.click(await screen.findByRole('button', { name: /salva/i }));

    const alerts = await screen.findAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent(/corpo del problem inatteso/i);
  });

  /** I validatori tornano l'elenco COMPLETO degli errori, non il primo. */
  it('mostra tutti gli errori di un campo, non solo il primo', async () => {
    stubRules(RULES, problem({
      bidTimerSeconds: ['Primo problema sui secondi.', 'Secondo problema sui secondi.'],
    }));
    renderRules();

    await userEvent.click(await screen.findByRole('button', { name: /salva/i }));

    expect(await screen.findByText('Primo problema sui secondi.')).toBeInTheDocument();
    expect(screen.getByText('Secondo problema sui secondi.')).toBeInTheDocument();
  });

  it('svuotare il campo dei secondi non lo forza a 0 prima di finire di digitare', async () => {
    stubRules(RULES);
    renderRules();

    const timer = await screen.findByLabelText(/secondi/i);
    await userEvent.clear(timer);
    expect(timer).toHaveValue(null);

    await userEvent.type(timer, '45');
    expect(timer).toHaveValue(45);
  });

  /**
   * Un corpo con una chiave che non e' un elenco di stringhe non deve far crashare
   * il render, ne' inventare un conteggio dalla lunghezza della stringa.
   */
  it('un corpo con una chiave non a forma di array non crasha, e dice comunque qualcosa', async () => {
    stubRules(RULES, problem({ budget: 'boom' }));
    renderRules();

    await userEvent.click(await screen.findByRole('button', { name: /salva/i }));

    const alerts = await screen.findAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent(/alcune impostazioni non sono valide/i);
  });

  it('una chiave sconosciuta nel corpo non finisce nel riassunto come "undefined"', async () => {
    stubRules(RULES, problem({
      budget: ['Servono crediti.'],
      sorpresa: ['non dovrebbe apparire'],
    }));
    renderRules();

    await userEvent.click(await screen.findByRole('button', { name: /salva/i }));

    expect(await screen.findByText('Servono crediti.')).toBeInTheDocument();
    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).not.toHaveTextContent(/undefined/i);
  });

  /** Il punteggio e' sempre aperto: un <details> chiuso nascondeva il campo invalido. */
  it('il punteggio e\' sempre visibile, e non si puo\' chiudere', async () => {
    stubRules(RULES);
    renderRules();

    expect(await screen.findByRole('group', { name: /punteggio/i })).toBeVisible();
    expect(screen.getByText('Assist')).toBeVisible();
    expect(document.querySelector('details, summary')).toBeNull();
    expect(screen.queryByRole('button', { name: /punteggio/i })).not.toBeInTheDocument();
  });

  it('i pulsanti − e + cambiano il countdown di un secondo, fermandosi ai limiti', async () => {
    stubRules(RULES);
    renderRules();

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
    const fetchMock = stubRules(RULES);
    renderRules();

    await userEvent.click(await screen.findByRole('button', { name: 'Dieci crediti in più' }));
    await userEvent.click(screen.getByRole('button', { name: 'Un posto in meno: difensori' }));
    await userEvent.click(screen.getByRole('button', { name: /salva/i }));

    await waitFor(() => expect(sentBody(fetchMock)).not.toBeNull());
    expect(sentBody(fetchMock).rules).toEqual({ budget: 510, slots: { P: 3, D: 7, C: 8, A: 6 } });
  });

  it('un errore sui posti compare nel riassunto con il nome del ruolo', async () => {
    stubRules(RULES, problem({ 'slots[P]': ['Gli slot dei portieri devono essere fra 1 e 30: indicati 0.'] }));
    renderRules();
    await userEvent.click(await screen.findByRole('button', { name: /salva/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/posti portieri/i);
  });

  /** Il salvataggio resta in vista mentre si scorre il modulo. */
  it('il bottone di salvataggio sta in una barra fissa in fondo', async () => {
    stubRules(RULES);
    renderRules();
    const button = await screen.findByRole('button', { name: 'Salva le regole' });
    expect(button.parentElement?.className).toContain('sticky');
  });

  it('un indice porta a ogni sezione del modulo', async () => {
    stubRules(RULES);
    renderRules();
    const index = await screen.findByRole('navigation', { name: 'Sezioni del modulo' });
    for (const [label, id] of [
      ['Banditore', 'sezione-banditore'], ['Crediti e posti', 'sezione-regole'], ['Punteggio', 'sezione-punteggio'],
    ]) {
      expect(within(index).getByRole('link', { name: label })).toHaveAttribute('href', `#${id}`);
      expect(document.getElementById(id)).not.toBeNull();
    }
  });
});
