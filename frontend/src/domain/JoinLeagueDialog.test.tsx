import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryProvider } from '../api/QueryProvider';
import { inviteToken, JoinLeagueDialog } from './JoinLeagueDialog';

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

function renderDialog() {
  const router = createMemoryRouter([
    { path: '/', element: <JoinLeagueDialog open onClose={() => {}} /> },
    { path: '/leghe/:leagueId', element: <p>pagina della lega</p> },
    { path: '/invito/:token', element: <p>pagina dell'invito</p> },
  ], { initialEntries: ['/'] });
  render(<QueryProvider><RouterProvider router={router} /></QueryProvider>);
  return router;
}

const BAR = [
  { id: 'l7', name: 'Lega Bar Sport', adminName: 'Paolo', members: 9, status: 'NONE' },
  { id: 'l8', name: 'Lega Barcollo', adminName: 'Marta', members: 12, status: 'PENDING' },
  { id: 'l2', name: 'Fantaufficio Bar', adminName: 'Sara', members: 10, status: 'MEMBER' },
];

describe('JoinLeagueDialog', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('e una finestra col suo titolo', () => {
    vi.stubGlobal('fetch', respond({}));
    renderDialog();
    expect(screen.getByRole('dialog', { name: 'Unisciti a una lega' })).toBeInTheDocument();
  });

  it('cerca una lega e chiede di entrare', async () => {
    let requested = false;
    const fetchMock = respond({
      'GET /api/join-requests': () => json([]),
      'GET /api/leagues/search?q=cugini': () => json([
        { id: 'l7', name: 'Lega dei Cugini', adminName: 'Marco', members: 7, status: requested ? 'PENDING' : 'NONE' },
      ]),
      'POST /api/join-requests/l7': () => { requested = true; return new Response(null, { status: 204 }); },
    });
    vi.stubGlobal('fetch', fetchMock);
    renderDialog();

    const search = screen.getByRole('searchbox', { name: 'Cerca la lega' });
    await userEvent.type(search, 'cu');
    expect(screen.getByText('Scrivi almeno 3 lettere del nome.')).toBeInTheDocument();
    await userEvent.type(search, 'gini');

    const found = await screen.findByRole('list', { name: 'Leghe trovate' });
    expect(within(found).getByText('Amministra Marco · 7 membri')).toBeInTheDocument();
    await userEvent.click(within(found).getByRole('button', { name: 'Chiedi di entrare in Lega dei Cugini' }));
    await userEvent.type(screen.getByLabelText('La tua squadra', { selector: '#join-team' }), 'Anna FC');
    await userEvent.click(screen.getByRole('button', { name: 'Manda la richiesta' }));

    expect(await screen.findByText(/Richiesta inviata a Marco/)).toBeInTheDocument();
    const [, init] = fetchMock.mock.calls.find(([url]) => url === '/api/join-requests/l7') as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ teamName: 'Anna FC' });
  });

  it('l azione sta sempre a destra: chiedi, richiesta inviata non attiva, apri', async () => {
    vi.stubGlobal('fetch', respond({ 'GET /api/leagues/search?q=bar': () => json(BAR) }));
    renderDialog();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Cerca la lega' }), 'bar');
    const found = await screen.findByRole('list', { name: 'Leghe trovate' });
    expect(within(found).getByRole('button', { name: 'Chiedi di entrare in Lega Bar Sport' })).toBeEnabled();
    expect(within(found).getByRole('button', { name: 'Richiesta inviata' })).toBeDisabled();
    expect(within(found).getByRole('link', { name: 'Apri' })).toHaveAttribute('href', '/leghe/l2');
  });

  it('i risultati scorrono dentro la loro area e la finestra non cambia altezza', async () => {
    vi.stubGlobal('fetch', respond({ 'GET /api/leagues/search?q=bar': () => json(BAR) }));
    renderDialog();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Cerca la lega' }), 'bar');
    await screen.findByRole('list', { name: 'Leghe trovate' });
    const area = screen.getByTestId('join-results');
    expect(area.className).toContain('h-[24rem]');
    expect(area.className).toContain('overflow-y-auto');
  });

  it('il link d invito sta separato, sotto i risultati', () => {
    vi.stubGlobal('fetch', respond({}));
    renderDialog();
    expect(screen.getByRole('group', { name: 'Hai un link d\'invito?' })).toBeInTheDocument();
  });

  it('un link d\'invito incollato porta alla pagina dell\'invito', async () => {
    vi.stubGlobal('fetch', respond({}));
    const router = renderDialog();

    const input = screen.getByLabelText('Il link d\'invito');
    await userEvent.type(input, 'ciao');
    await userEvent.click(screen.getByRole('button', { name: 'Entra con il link' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Questo non sembra un link d\'invito');

    await userEvent.clear(input);
    await userEvent.type(input, 'https://fanta.example/invito/AbCdEfGhIjKlMnOpQrSt_-12');
    await userEvent.click(screen.getByRole('button', { name: 'Entra con il link' }));
    expect(await screen.findByText('pagina dell\'invito')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/invito/AbCdEfGhIjKlMnOpQrSt_-12');
  });
});

describe('inviteToken', () => {
  it.each([
    ['https://fanta.example/invito/AbCdEfGhIjKlMnOpQrSt', 'AbCdEfGhIjKlMnOpQrSt'],
    ['  http://localhost:5173/invito/AbCdEfGhIjKlMnOpQrSt/  ', 'AbCdEfGhIjKlMnOpQrSt'],
    ['https://fanta.example/invito/AbCdEfGhIjKlMnOpQrSt?utm=x', 'AbCdEfGhIjKlMnOpQrSt'],
    ['AbCdEfGhIjKlMnOpQrSt', 'AbCdEfGhIjKlMnOpQrSt'],
    ['https://fanta.example/leghe/123', null],
    ['ciao', null],
  ])('%s', (text, token) => {
    expect(inviteToken(text)).toBe(token);
  });
});
