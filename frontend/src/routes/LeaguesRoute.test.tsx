import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryProvider } from '../api/QueryProvider';
import type { LeagueCard, MyAuction, MyJoinRequest } from '../api/types';
import { LeaguesRoute } from './LeaguesRoute';

const ME = { id: 'u1', email: 'a@b.it', displayName: 'Anna', emailVerified: true };

function respond(routes: Record<string, () => Response>) {
  return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const key = `${(init?.method ?? 'GET').toUpperCase()} ${url}`;
    const handler = routes[key];
    if (!handler) throw new Error(`chiamata inattesa: ${key}`);
    return Promise.resolve(handler());
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** Le quattro letture della home, con quello che serve al caso; il resto si aggiunge. */
function home({ leagues = [BAR], auctions = [], requests = [], more = {} }: {
  leagues?: LeagueCard[];
  auctions?: MyAuction[];
  requests?: MyJoinRequest[];
  more?: Record<string, () => Response>;
} = {}) {
  const fetchMock = respond({
    'GET /api/me': () => json(ME),
    'GET /api/leagues': () => json(leagues),
    'GET /api/auctions': () => json(auctions),
    'GET /api/join-requests': () => json(requests),
    ...more,
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderLeagues() {
  const router = createMemoryRouter([
    { path: '/leghe', element: <LeaguesRoute /> },
    { path: '/leghe/:leagueId', element: <p>pagina della lega</p> },
    { path: '/leghe/:leagueId/aste/:auctionId', element: <p>pagina dell'asta</p> },
    { path: '/invito/:token', element: <p>pagina dell'invito</p> },
  ], { initialEntries: ['/leghe'] });
  render(<QueryProvider><RouterProvider router={router} /></QueryProvider>);
  return router;
}

const BAR: LeagueCard = {
  id: 'l1', name: 'Lega del Bar', admin: true, teamName: 'Anna FC', initial: 'A', members: 4, auctions: 2, pendingRequests: 2,
};
const UFFICIO: LeagueCard = {
  id: 'l2', name: 'Fantaufficio', admin: false, teamName: 'Scarsenal', initial: 'S', members: 10, auctions: 1, pendingRequests: 0,
};

function auction(id: string, status: MyAuction['status'], lastActivity: string): MyAuction {
  return {
    id, leagueId: 'l1', leagueName: 'Lega del Bar', name: `Asta ${id}`, status, phase: 'C',
    budgetRemaining: 120, slotsRemaining: status === 'CONCLUDED' ? 0 : 11, lastActivity, admin: true,
  };
}

describe('LeaguesRoute', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('elenca le leghe con la propria squadra', async () => {
    home();
    renderLeagues();

    const link = await screen.findByRole('link', { name: /Lega del Bar/ });
    expect(link).toHaveAttribute('href', '/leghe/l1');
    expect(link).toHaveTextContent('Anna FC');
    expect(link).toHaveTextContent('Amministri tu, 4 membri, 2 aste');
    expect(link).toHaveTextContent('2 richieste');
  });

  it('le richieste mandate stanno fra le leghe, in attesa, con Ritira', async () => {
    home({ requests: [{ leagueId: 'l7', leagueName: 'Lega dei Cugini', teamName: 'Anna FC', requestedAt: '2026-09-30T10:00:00Z' }] });
    renderLeagues();
    expect(await screen.findByRole('button', { name: 'Ritira la richiesta per Lega dei Cugini' })).toBeInTheDocument();
  });

  it('in cima le aste in corso e da iniziare, la piu recente con l oro', async () => {
    home({ auctions: [
      auction('a1', 'IN_PROGRESS', '2026-09-30T21:00:00Z'),
      auction('a2', 'IN_PROGRESS', '2026-09-20T21:00:00Z'),
      auction('a3', 'CONCLUDED', '2026-01-12T21:00:00Z'),
    ] });
    renderLeagues();
    const cards = await screen.findAllByRole('article');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]!).getByRole('heading', { name: 'Asta a1' })).toBeInTheDocument();
    expect(within(cards[0]!).getByRole('link', { name: /Entra nell'asta/ }).className).toContain('bg-accent');
    expect(within(cards[1]!).getByRole('link', { name: /Entra nell'asta/ }).className).not.toContain('bg-accent');
  });

  it('le concluse in un elenco compatto, tre al massimo con Mostra tutte', async () => {
    home({ auctions: [
      auction('a1', 'IN_PROGRESS', '2026-09-30T21:00:00Z'),
      auction('c1', 'CONCLUDED', '2026-04-12T21:00:00Z'),
      auction('c2', 'CONCLUDED', '2026-03-12T21:00:00Z'),
      auction('c3', 'CONCLUDED', '2026-02-12T21:00:00Z'),
      auction('c4', 'CONCLUDED', '2026-01-12T21:00:00Z'),
    ] });
    renderLeagues();
    const list = await screen.findByRole('list', { name: 'Aste concluse' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(within(list).getByRole('link', { name: /Asta c1/ })).toHaveAttribute('href', '/leghe/l1/aste/c1');
    await userEvent.click(screen.getByRole('button', { name: 'Mostra tutte' }));
    expect(within(list).getAllByRole('listitem')).toHaveLength(4);
    expect(screen.queryByRole('button', { name: 'Mostra tutte' })).not.toBeInTheDocument();
  });

  it('con tre concluse o meno niente Mostra tutte', async () => {
    home({ auctions: [auction('c1', 'CONCLUDED', '2026-04-12T21:00:00Z')] });
    renderLeagues();
    await screen.findByRole('list', { name: 'Aste concluse' });
    expect(screen.queryByRole('button', { name: 'Mostra tutte' })).not.toBeInTheDocument();
  });

  it('crea e unisciti sono bottoni normali nell intestazione che aprono una finestra', async () => {
    home();
    renderLeagues();
    const group = await screen.findByRole('group', { name: 'Azioni della pagina' });
    expect(within(group).getByRole('button', { name: 'Crea una lega' }).className).not.toContain('bg-accent');
    expect(within(group).getByRole('button', { name: 'Unisciti a una lega' }).className).not.toContain('bg-accent');
    await userEvent.click(within(group).getByRole('button', { name: 'Crea una lega' }));
    expect(screen.getByRole('dialog', { name: 'Crea una lega' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Chiudi' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.click(within(group).getByRole('button', { name: 'Unisciti a una lega' }));
    expect(screen.getByRole('dialog', { name: 'Unisciti a una lega' })).toBeInTheDocument();
  });

  it('senza aste in corso una riga sola; per chi amministra «Prepara un asta» porta alla lega', async () => {
    home({ leagues: [UFFICIO, BAR], auctions: [auction('c1', 'CONCLUDED', '2026-04-12T21:00:00Z')] });
    renderLeagues();
    expect(await screen.findByText('Nessuna asta in corso')).toBeInTheDocument();
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    expect(screen.getByRole('link', { name: 'Prepara un\'asta' })).toHaveAttribute('href', '/leghe/l1');
    expect(document.querySelectorAll('.bg-accent')).toHaveLength(0);
  });

  it('senza aste e senza leghe amministrate niente Prepara un asta', async () => {
    home({ leagues: [UFFICIO] });
    renderLeagues();
    expect(await screen.findByText('Nessuna asta in corso')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Prepara un\'asta' })).not.toBeInTheDocument();
  });

  it('senza leghe uno stato vuoto con Crea una lega oro e Unisciti normale', async () => {
    home({ leagues: [] });
    renderLeagues();
    const empty = await screen.findByRole('region', { name: 'Non sei ancora in nessuna lega' });
    const create = within(empty).getByRole('button', { name: 'Crea una lega' });
    expect(create.className).toContain('bg-accent');
    expect(within(empty).getByRole('button', { name: 'Unisciti a una lega' }).className).not.toContain('bg-accent');
    expect(screen.queryByText('Nessuna asta in corso')).not.toBeInTheDocument();
    expect(document.querySelectorAll('.bg-accent')).toHaveLength(1);
    await userEvent.click(create);
    expect(screen.getByRole('dialog', { name: 'Crea una lega' })).toBeInTheDocument();
  });

  it('una sola azione oro nella pagina', async () => {
    home({ auctions: [
      auction('a1', 'IN_PROGRESS', '2026-09-30T21:00:00Z'),
      auction('a2', 'NOT_STARTED', '2026-09-20T21:00:00Z'),
    ] });
    renderLeagues();
    await screen.findAllByRole('article');
    expect(document.querySelectorAll('.bg-accent').length).toBe(1);
  });

  it('crea una lega e ci entra', async () => {
    const fetchMock = home({
      more: { 'POST /api/leagues': () => json({ id: 'l9', name: 'Nuova', admin: true, members: [] }, 201) },
    });
    const router = renderLeagues();

    await userEvent.click(await screen.findByRole('button', { name: 'Crea una lega' }));
    const dialog = screen.getByRole('dialog', { name: 'Crea una lega' });
    expect(within(dialog).getByLabelText('Nome della lega')).toHaveFocus();
    await userEvent.type(within(dialog).getByLabelText('Nome della lega'), 'Nuova');
    await userEvent.type(within(dialog).getByLabelText('La tua squadra'), 'Anna FC');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crea la lega' }));

    expect(await screen.findByText('pagina della lega')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/leghe/l9');

    // L'iniziale non si chiede e non si manda: la sceglie il server.
    const [, postInit] = fetchMock.mock.calls.find(
      ([url, init]) => url === '/api/leagues' && (init?.method ?? 'GET').toUpperCase() === 'POST',
    ) as [string, RequestInit];
    expect(JSON.parse(postInit.body as string)).toEqual({ name: 'Nuova', teamName: 'Anna FC' });
  });

  it('un errore su un campo che la finestra non mostra si legge comunque', async () => {
    home({
      more: {
        'POST /api/leagues': () => json({
          type: 'https://fantaagent.local/problems/invalid-league', detail: 'Alcuni dati non sono validi.',
          errors: { initial: ['L\'iniziale deve essere una lettera.'] },
        }, 422),
      },
    });
    renderLeagues();

    await userEvent.click(await screen.findByRole('button', { name: 'Crea una lega' }));
    await userEvent.type(screen.getByLabelText('Nome della lega'), 'Nuova');
    await userEvent.type(screen.getByLabelText('La tua squadra'), 'Anna FC');
    await userEvent.click(screen.getByRole('button', { name: 'Crea la lega' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('L\'iniziale deve essere una lettera.');
  });

  it('con l\'elenco e la creazione falliti insieme, un solo alert in pagina', async () => {
    const problem = () => json({
      type: 'https://fantaagent.local/problems/service-unavailable',
      detail: 'Il servizio non risponde in questo momento. Riprova fra poco.',
    }, 503);
    home({ more: { 'GET /api/leagues': problem, 'POST /api/leagues': problem } });
    renderLeagues();

    await userEvent.click(await screen.findByRole('button', { name: 'Crea una lega' }));
    await userEvent.type(screen.getByLabelText('Nome della lega'), 'Nuova');
    await userEvent.type(screen.getByLabelText('La tua squadra'), 'Anna FC');
    await userEvent.click(screen.getByRole('button', { name: 'Crea la lega' }));

    // QueryProvider ritenta una volta (retry: 1) la query dell'elenco prima di
    // arrendersi: il timeout predefinito di waitFor non basterebbe ad aspettare
    // quel giro, e i due messaggi (creazione, poi elenco) non compaiono insieme.
    await waitFor(() => {
      expect(screen.getAllByText(
        'Il servizio non risponde in questo momento. Riprova fra poco.',
      )).toHaveLength(2);
    }, { timeout: 3000 });
    expect(screen.getAllByRole('alert', { hidden: true })).toHaveLength(1);
  });

  it('sul telefono i bottoni dell intestazione stanno su una riga: testo piu piccolo, meno margine', async () => {
    home();
    renderLeagues();
    const group = await screen.findByRole('group', { name: 'Azioni della pagina' });
    for (const button of within(group).getAllByRole('button')) {
      expect(button.className).toContain('max-sm:text-sm');
      expect(button.className).toContain('max-sm:px-3');
    }
  });

  it('i nomi di lega e squadra non si troncano, vanno a capo', async () => {
    home({ requests: [{ leagueId: 'l7', leagueName: 'Lega dei Cugini', teamName: 'Longobarda', requestedAt: '2026-09-30T10:00:00Z' }] });
    renderLeagues();
    for (const text of ['Lega del Bar', 'Anna FC', 'Lega dei Cugini', 'Longobarda']) {
      expect((await screen.findByText(text)).className).not.toContain('truncate');
    }
  });

  // Safari non da' il fuoco a un bottone cliccato (fireEvent.click fa lo stesso):
  // il fuoco torna comunque al bottone che ha aperto la finestra.
  it.each([
    ['Crea una lega', 'Crea una lega'],
    ['Unisciti a una lega', 'Unisciti a una lega'],
  ])('chiusa %s, il fuoco torna al bottone dell intestazione', async (button, title) => {
    home();
    renderLeagues();
    const group = await screen.findByRole('group', { name: 'Azioni della pagina' });
    const opener = within(group).getByRole('button', { name: button });
    fireEvent.click(opener);
    expect(opener).not.toHaveFocus();
    fireEvent.click(within(screen.getByRole('dialog', { name: title })).getByRole('button', { name: 'Chiudi' }));
    expect(opener).toHaveFocus();
  });

  it('senza leghe, chiusa la finestra il fuoco torna al bottone grande che l ha aperta', async () => {
    home({ leagues: [] });
    renderLeagues();
    const empty = await screen.findByRole('region', { name: 'Non sei ancora in nessuna lega' });
    const opener = within(empty).getByRole('button', { name: 'Unisciti a una lega' });
    fireEvent.click(opener);
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(opener).toHaveFocus();
  });

  it('con le aste che non arrivano non dice «Nessuna asta in corso»', async () => {
    const problem = () => json({
      type: 'https://fantaagent.local/problems/service-unavailable',
      detail: 'Il servizio non risponde in questo momento. Riprova fra poco.',
    }, 503);
    home({ more: { 'GET /api/auctions': problem } });
    renderLeagues();
    expect(await screen.findByRole('alert', {}, { timeout: 3000 }))
      .toHaveTextContent('Il servizio non risponde in questo momento.');
    expect(screen.queryByText('Nessuna asta in corso')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: "Prepara un'asta" })).not.toBeInTheDocument();
  });

  it('mentre le aste arrivano non dice «Nessuna asta in corso»', async () => {
    // Le aste non rispondono mai: tutto il resto si'.
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => (url === '/api/auctions'
      ? new Promise(() => {})
      : Promise.resolve(url === '/api/leagues' ? json([BAR]) : url === '/api/me' ? json(ME) : json([])))));
    renderLeagues();
    await screen.findByRole('link', { name: /Lega del Bar/ });
    expect(screen.queryByText('Nessuna asta in corso')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: "Prepara un'asta" })).not.toBeInTheDocument();
  });

  it('mentre le leghe arrivano, righe segnaposto alte come quelle vere', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => (url === '/api/leagues'
      ? new Promise(() => {})
      : Promise.resolve(url === '/api/me' ? json(ME) : json([])))));
    renderLeagues();
    const section = (await screen.findByRole('heading', { name: 'Le tue leghe' })).closest('section')!;
    const rows = section.querySelectorAll('ul[aria-hidden="true"] > li');
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      // La riga vera: py-3 intorno a stemma da 44px e tre righe di testo (24 + 20 + 18).
      expect(row.className).toContain('min-h-16');
      expect(row.className).toContain('py-3');
      expect(row.querySelector('.size-11')).not.toBeNull();
      expect([...row.querySelector('.flex-1')!.children].map((l) => l.className.match(/\bh-\S+/)?.[0]))
        .toEqual(['h-6', 'h-5', 'h-[1.125rem]']);
    }
  });

  it('Mostra tutte porta il fuoco alla prima conclusa che era nascosta', async () => {
    home({ auctions: [
      auction('c1', 'CONCLUDED', '2026-04-12T21:00:00Z'),
      auction('c2', 'CONCLUDED', '2026-03-12T21:00:00Z'),
      auction('c3', 'CONCLUDED', '2026-02-12T21:00:00Z'),
      auction('c4', 'CONCLUDED', '2026-01-12T21:00:00Z'),
    ] });
    renderLeagues();
    await userEvent.click(await screen.findByRole('button', { name: 'Mostra tutte' }));
    expect(screen.getByRole('link', { name: /Asta c4/ })).toHaveFocus();
  });

  it('con un errore di pagina gia\' detto, quello del ritiro non si annuncia', async () => {
    const problem = () => json({
      type: 'https://fantaagent.local/problems/service-unavailable',
      detail: 'Il servizio non risponde in questo momento. Riprova fra poco.',
    }, 503);
    home({
      requests: [{ leagueId: 'l7', leagueName: 'Lega dei Cugini', teamName: 'Anna FC', requestedAt: '2026-09-30T10:00:00Z' }],
      more: { 'GET /api/auctions': problem, 'DELETE /api/join-requests/l7': problem },
    });
    renderLeagues();
    await screen.findByRole('alert', {}, { timeout: 3000 });
    await userEvent.click(screen.getByRole('button', { name: 'Ritira la richiesta per Lega dei Cugini' }));
    expect(await screen.findByText('Non sono riuscito a ritirarla. Riprova.')).toBeInTheDocument();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });
});
