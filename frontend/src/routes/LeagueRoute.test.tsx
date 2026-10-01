import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryProvider } from '../api/QueryProvider';
import { LeagueRoute } from './LeagueRoute';

const ME = { id: 'u1', email: 'a@b.it', displayName: 'Anna', emailVerified: true };
const MEMBERS = [
  { userId: 'u1', displayName: 'Anna', teamName: 'Anna FC', initial: 'A', role: 'ADMIN', me: true },
  { userId: 'u2', displayName: 'Bruno', teamName: 'Bruno FC', initial: 'B', role: 'MEMBER', me: false },
];

const AUCTION = {
  id: 'a1', name: 'Asta estiva 2026', createdAt: '2026-09-28T20:00:00Z', lastWritten: '2026-09-28T21:00:00Z',
  purchases: 12, phase: 'D', teams: 8, budget: 500, totalSlots: 200, myBudgetRemaining: 320,
  bidder: { bidTimerSeconds: 5, beepEnabled: true },
};
const REQUEST = { userId: 'u3', displayName: 'Francesca', teamName: 'Hellas Madonna', requestedAt: '2026-09-28T10:00:00Z' };
const WITH_LONGOBARDA = [
  ...MEMBERS,
  { userId: 'u4', displayName: 'Oronzo', teamName: 'Longobarda', initial: 'L', role: 'MEMBER', me: false },
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function stub(admin: boolean, extra: Record<string, () => Response> = {}) {
  const routes: Record<string, () => Response> = {
    'GET /api/me': () => json(ME),
    'GET /api/leagues/l1': () => json({ id: 'l1', name: 'Lega del Bar', admin, members: MEMBERS }),
    'GET /api/leagues/l1/invites': () => json([]),
    'GET /api/leagues/l1/join-requests': () => json([]),
    'GET /api/leagues/l1/auctions': () => json([]),
    ...extra,
  };
  const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const key = `${(init?.method ?? 'GET').toUpperCase()} ${url}`;
    if (!routes[key]) throw new Error(`chiamata inattesa: ${key}`);
    return Promise.resolve(routes[key]());
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderLeague() {
  const router = createMemoryRouter([{ path: '/leghe/:leagueId', element: <LeagueRoute /> }],
    { initialEntries: ['/leghe/l1'] });
  render(<QueryProvider><RouterProvider router={router} /></QueryProvider>);
}

function renderLeagueWithAuctionRoute() {
  const router = createMemoryRouter([
    { path: '/leghe/:leagueId', element: <LeagueRoute /> },
    { path: '/leghe/:leagueId/aste/:auctionId', element: <p>pagina dell'asta</p> },
  ], { initialEntries: ['/leghe/l1'] });
  render(<QueryProvider><RouterProvider router={router} /></QueryProvider>);
  return router;
}

describe('LeagueRoute', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('l\'amministratore accetta chi chiede di entrare', async () => {
    let requests = [{ userId: 'u3', displayName: 'Carla', teamName: 'Carla FC', requestedAt: '2026-09-29T10:00:00Z' }];
    const fetchMock = stub(true, {
      'GET /api/leagues/l1/join-requests': () => json(requests),
      'POST /api/leagues/l1/join-requests/u3/approve': () => { requests = []; return new Response(null, { status: 204 }); },
      'GET /api/leagues': () => json([]),
    });
    renderLeague();

    const list = await screen.findByRole('list', { name: 'Richieste di ingresso' });
    expect(within(list).getByText('Carla FC')).toBeInTheDocument();
    await userEvent.click(within(list).getByRole('button', { name: 'Accetta Carla FC' }));

    expect(fetchMock.mock.calls.some(([url, init]) => url === '/api/leagues/l1/join-requests/u3/approve'
      && (init?.method ?? '').toUpperCase() === 'POST')).toBe(true);
    // Senza piu' richieste il pannello sparisce.
    await vi.waitFor(() => expect(screen.queryByRole('heading', { name: 'Richieste di ingresso' })).toBeNull());
  });

  it('chi non amministra non chiede le richieste', async () => {
    const fetchMock = stub(false);
    renderLeague();
    await screen.findByRole('list', { name: 'Membri' });
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/leagues/l1/join-requests')).toBe(false);
  });

  it('mostra i membri con la loro squadra', async () => {
    stub(false);
    renderLeague();
    const members = await screen.findByRole('list', { name: 'Membri' });
    expect(await within(members).findByText('Bruno FC')).toBeInTheDocument();
    expect(within(members).getByText('Anna FC')).toBeInTheDocument();
  });

  // L'oro e' dell'azione principale e del numero su cui si decide. Otto tondi
  // d'oro in un elenco di membri gli toglievano forza senza dire niente.
  it('le iniziali dei membri non portano l oro', async () => {
    stub(false);
    renderLeague();
    const members = await screen.findByRole('list', { name: 'Membri' });
    await within(members).findByText('Bruno FC');
    const initials = members.querySelectorAll('li > span[aria-hidden="true"]');
    expect(initials).toHaveLength(2);
    initials.forEach((initial) => expect(initial.className).not.toContain('bg-accent'));
  });

  it.each([true, false])('porta alle regole della lega, per tutti (amministratore: %s)', async (admin) => {
    stub(admin);
    renderLeague();
    expect(await screen.findByRole('link', { name: 'Regole della lega' })).toHaveAttribute('href', '/leghe/l1/regole');
  });

  it('chi non e\' amministratore non vede gli inviti', async () => {
    const fetchMock = stub(false);
    renderLeague();
    await screen.findByRole('list', { name: 'Membri' });
    expect(screen.queryByRole('button', { name: 'Crea un link d\'invito' })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/leagues/l1/invites')).toBe(false);
  });

  it('l\'amministratore crea un link e lo vede una volta', async () => {
    stub(true, {
      'POST /api/leagues/l1/invites': () => json({
        id: 'i1', link: 'https://fanta.example/invito/abc', expiresAt: '2026-10-12T20:00:00Z',
      }, 201),
    });
    renderLeague();

    await userEvent.click(await screen.findByRole('button', { name: 'Crea un link d\'invito' }));

    expect(await screen.findByRole('textbox', { name: 'Link d\'invito' }))
      .toHaveValue('https://fanta.example/invito/abc');
  });

  it('elenca le aste con lo stato, la fase e i crediti che restano', async () => {
    stub(false, {
      'GET /api/leagues/l1/auctions': () => json([
        AUCTION,
        { ...AUCTION, id: 'a2', name: 'Asta nuova', purchases: 0, phase: 'P' },
        { ...AUCTION, id: 'a3', name: 'Asta vecchia', purchases: 200, phase: 'A', myBudgetRemaining: 3 },
      ]),
    });
    renderLeague();
    const list = await screen.findByRole('list', { name: 'Aste' });
    const [running, fresh, done] = within(list).getAllByRole('listitem');
    expect(running).toHaveTextContent('In corso · difensori · ti restano 320 crediti');
    expect(fresh).toHaveTextContent('Da iniziare · portieri · ti restano 320 crediti');
    expect(done).toHaveTextContent('Conclusa · ti restano 3 crediti');
  });

  it('ogni asta ha Entra e il menu', async () => {
    stub(true, { 'GET /api/leagues/l1/auctions': () => json([AUCTION]) });
    renderLeague();
    expect(await screen.findByRole('link', { name: 'Entra in Asta estiva 2026' }))
      .toHaveAttribute('href', '/leghe/l1/aste/a1');
    expect(screen.getByRole('button', { name: 'Azioni per Asta estiva 2026' })).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('senza aste, una riga che dice cosa fare', async () => {
    stub(true);
    renderLeague();
    expect(await screen.findByText('Nessuna asta ancora.')).toBeInTheDocument();
  });

  it('l\'amministratore crea un\'asta e ci entra', async () => {
    stub(true, {
      'GET /api/leagues/l1/auctions': () => json([]),
      'POST /api/leagues/l1/auctions': () => json({
        id: 'a2', name: 'Riparazione', createdAt: '2026-09-28T20:00:00Z', lastWritten: null, purchases: 0,
        phase: 'P', teams: 2, budget: 500, totalSlots: 50, myBudgetRemaining: 500,
        bidder: { bidTimerSeconds: 5, beepEnabled: true },
      }, 201),
    });
    const router = renderLeagueWithAuctionRoute();
    await userEvent.click(await screen.findByRole('button', { name: 'Nuova asta' }));
    await userEvent.type(screen.getByLabelText('Nome della nuova asta'), 'Riparazione');
    await userEvent.click(screen.getByRole('button', { name: 'Crea l\'asta' }));
    expect(await screen.findByText('pagina dell\'asta')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/leghe/l1/aste/a2');
  });

  it('un membro puo\' lasciare la lega, l\'amministratore no', async () => {
    stub(false, { 'GET /api/leagues/l1/auctions': () => json([]) });
    renderLeague();
    expect(await screen.findByRole('button', { name: 'Lascia la lega' })).toBeInTheDocument();
  });

  it('l\'amministratore non lascia la lega, ma toglie gli altri dopo una conferma', async () => {
    const fetchMock = stub(true, {
      'DELETE /api/leagues/l1/members/u2': () => new Response(null, { status: 204 }),
    });
    renderLeague();
    await userEvent.click(await screen.findByRole('button', { name: 'Azioni per Bruno FC' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Togli dalla lega' }));
    expect(screen.queryByRole('button', { name: 'Lascia la lega' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Azioni per Anna FC' })).not.toBeInTheDocument();

    const dialog = screen.getByRole('dialog', { name: /Togliere «Bruno FC»/ });
    expect(dialog).toHaveTextContent('Sei sicuro? L\'azione è irreversibile.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Togli' }));

    await vi.waitFor(() => expect(fetchMock.mock.calls
      .some(([url, init]) => url === '/api/leagues/l1/members/u2' && init?.method === 'DELETE')).toBe(true));
  });

  it('chi lascia la lega conferma e torna all\'elenco delle leghe', async () => {
    stub(false, { 'DELETE /api/leagues/l1/members/u1': () => new Response(null, { status: 204 }) });
    const router = createMemoryRouter([
      { path: '/', element: <p>le mie leghe</p> },
      { path: '/leghe/:leagueId', element: <LeagueRoute /> },
    ], { initialEntries: ['/leghe/l1'] });
    render(<QueryProvider><RouterProvider router={router} /></QueryProvider>);

    await userEvent.click(await screen.findByRole('button', { name: 'Lascia la lega' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Esci dalla lega' }));

    expect(await screen.findByText('le mie leghe')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('il menu dell\'amministratore porta alle impostazioni dell\'asta', async () => {
    stub(true, {
      'GET /api/leagues/l1/auctions': () => json([{
        id: 'a1', name: 'Asta', createdAt: '2026-09-28T20:00:00Z', lastWritten: null,
        purchases: 0, phase: 'P', teams: 2, budget: 500, totalSlots: 50, myBudgetRemaining: 500,
        bidder: { bidTimerSeconds: 5, beepEnabled: true },
      }]),
    });
    renderLeague();
    await userEvent.click(await screen.findByRole('button', { name: 'Azioni per Asta' }));
    expect(screen.getByRole('menuitem', { name: 'Impostazioni dell\'asta' }))
      .toHaveAttribute('href', '/leghe/l1/aste/a1/impostazioni');
    expect(screen.getByRole('menuitem', { name: 'Rinomina' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Elimina' })).toBeInTheDocument();
  });

  it('chi non e\' amministratore non ha il menu delle aste', async () => {
    stub(false, {
      'GET /api/leagues/l1/auctions': () => json([{
        id: 'a1', name: 'Asta', createdAt: '2026-09-28T20:00:00Z', lastWritten: null,
        purchases: 0, phase: 'P', teams: 2, budget: 500, totalSlots: 50, myBudgetRemaining: null,
        bidder: { bidTimerSeconds: 5, beepEnabled: true },
      }]),
    });
    renderLeague();
    const list = await screen.findByRole('list', { name: 'Aste' });
    expect(list).not.toHaveTextContent('crediti');
    expect(screen.getByRole('link', { name: 'Entra in Asta' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Azioni per Asta' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Nome della nuova asta')).not.toBeInTheDocument();
  });
  it('l intestazione ha h1, il contesto e Regole della lega come bottone normale', async () => {
    stub(true, { 'GET /api/leagues/l1/auctions': () => json([AUCTION]) });
    renderLeague();
    expect(await screen.findByRole('heading', { level: 1, name: 'Lega del Bar' })).toBeInTheDocument();
    expect(await screen.findByText('Amministri tu · 2 membri · 1 asta')).toBeInTheDocument();
    const group = screen.getByRole('group', { name: 'Azioni della pagina' });
    const rules = within(group).getByRole('link', { name: 'Regole della lega' });
    expect(rules).toHaveAttribute('href', '/leghe/l1/regole');
    expect(rules.className).not.toContain('bg-accent');
    expect(rules.className).toContain('max-sm:text-sm');
  });

  it('Nuova asta apre il campo del nome in cima all elenco; Crea l asta e l unico oro', async () => {
    stub(true, { 'GET /api/leagues/l1/auctions': () => json([AUCTION]) });
    renderLeague();
    await screen.findByRole('link', { name: 'Entra in Asta estiva 2026' });
    expect(screen.queryByRole('textbox', { name: 'Nome della nuova asta' })).not.toBeInTheDocument();
    expect(document.querySelectorAll('.bg-accent')).toHaveLength(0);

    const open = screen.getByRole('button', { name: 'Nuova asta' });
    expect(open.className).not.toContain('bg-accent');
    await userEvent.click(open);
    const field = screen.getByRole('textbox', { name: 'Nome della nuova asta' });
    expect(field).toHaveFocus();
    // In cima all'elenco: il campo viene prima della prima asta.
    const first = screen.getByRole('link', { name: 'Entra in Asta estiva 2026' });
    expect(field.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Crea l\'asta' }).className).toContain('bg-accent');
    expect(document.querySelectorAll('.bg-accent')).toHaveLength(1);

    await userEvent.type(field, 'Riparazione');
    await userEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(screen.queryByRole('textbox', { name: 'Nome della nuova asta' })).not.toBeInTheDocument();
    expect(document.querySelectorAll('.bg-accent')).toHaveLength(0);
    // Riaperto, il campo riparte vuoto.
    await userEvent.click(screen.getByRole('button', { name: 'Nuova asta' }));
    expect(screen.getByRole('textbox', { name: 'Nome della nuova asta' })).toHaveValue('');
  });

  it('Accetta e Rifiuta sono bottoni normali', async () => {
    stub(true, { 'GET /api/leagues/l1/join-requests': () => json([REQUEST]) });
    renderLeague();
    const accept = await screen.findByRole('button', { name: 'Accetta Hellas Madonna' });
    expect(accept.className).not.toContain('bg-accent');
    expect(screen.getByRole('button', { name: 'Rifiuta Hellas Madonna' }).className).not.toContain('bg-accent');
  });

  it('togliere un membro passa dal menu e chiede conferma', async () => {
    stub(true, {
      'GET /api/leagues/l1': () => json({ id: 'l1', name: 'Lega del Bar', admin: true, members: WITH_LONGOBARDA }),
    });
    renderLeague();
    const members = await screen.findByRole('list', { name: 'Membri' });
    await within(members).findByText('Longobarda');
    expect(screen.queryByRole('button', { name: /^Togli / })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Azioni per Longobarda' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Togli dalla lega' }));
    expect(screen.getByRole('dialog', { name: 'Togliere «Longobarda» dalla lega?' })).toBeInTheDocument();
  });

  it('chi non amministra non vede Nuova asta, Importa, menu, richieste, inviti', async () => {
    stub(false, {
      'GET /api/leagues/l1': () => json({ id: 'l1', name: 'Lega del Bar', admin: false, members: WITH_LONGOBARDA }),
      'GET /api/leagues/l1/auctions': () => json([AUCTION]),
    });
    renderLeague();
    await screen.findByRole('link', { name: 'Entra in Asta estiva 2026' });
    await within(screen.getByRole('list', { name: 'Membri' })).findByText('Longobarda');
    expect(screen.getByText('3 membri · 1 asta')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nuova asta' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Importa un\'asta' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Azioni per Asta estiva 2026' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Azioni per Longobarda' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Richieste di ingresso' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Inviti' })).not.toBeInTheDocument();
  });

  it('nel documento: aste, poi richieste, inviti, membri', async () => {
    stub(true, { 'GET /api/leagues/l1/join-requests': () => json([REQUEST]) });
    renderLeague();
    await screen.findByRole('heading', { level: 2, name: 'Richieste di ingresso' });
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['Aste', 'Richieste di ingresso', 'Inviti', 'Membri']);
  });
});
