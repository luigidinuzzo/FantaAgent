import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom';
import { AppShell } from './AppShell';
import { QueryProvider } from './api/QueryProvider';

function withRouter(node: React.ReactNode, path = '/asta') {
  return (
    <QueryProvider>
      <MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>
    </QueryProvider>
  );
}

describe('AppShell', () => {
  // Senza accesso, come tutte queste pagine se non arriva prima chi ha fatto
  // l'accesso: il test del nome-link (sotto) sostituisce lo stub con un 200.
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      type: 'https://fantaagent.local/problems/unauthenticated', detail: 'Serve l\'accesso.',
    }), { status: 401, headers: { 'content-type': 'application/problem+json' } })));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('mostra il contenuto dentro un landmark main', () => {
    render(withRouter(<AppShell chrome="top"><p>contenuto</p></AppShell>));
    expect(screen.getByRole('main')).toHaveTextContent('contenuto');
  });

  it('espone la barra superiore come banner', () => {
    render(withRouter(<AppShell chrome="top"><p>x</p></AppShell>));
    expect(screen.getByRole('banner')).toHaveTextContent('FantaAgent');
  });

  /** Su una pagina lunga le barre non escono dallo schermo: restano ferme in cima, insieme. */
  it('le barre restano ferme in cima mentre la pagina scorre', () => {
    render(withRouter(<AppShell chrome="top"><p>x</p></AppShell>));
    const bars = screen.getByRole('banner').parentElement;
    expect(bars?.className).toContain('sticky');
    expect(bars?.className).toContain('top-0');
  });

  /**
   * Il campo (in AppFrame) parte sotto la barra, a --header-h: la barra ha
   * quell'altezza minima su ogni pagina, cosi' il campo e' identico ovunque e
   * nessuna barra piu' alta ne copre un pezzo in piu'.
   */
  it('la barra ha la stessa altezza minima su ogni pagina, quella da cui parte il campo', () => {
    render(withRouter(<AppShell chrome="none"><p>x</p></AppShell>));
    expect(screen.getByRole('banner').className).toContain('min-h-[var(--header-h)]');
  });

  it('ospita lo slot di stato nella barra', () => {
    render(withRouter(
      <AppShell chrome="top" slotStatus={<span>in diretta</span>}><p>x</p></AppShell>,
    ));
    expect(screen.getByRole('banner')).toHaveTextContent('in diretta');
  });

  it('senza percorso porta solo il marchio, verso la home', () => {
    render(withRouter(<AppShell chrome="top"><p>x</p></AppShell>));
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', '/');
    expect(within(links[0]).getByTestId('wordmark')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  const TRAIL = [
    { label: 'Le mie leghe', to: '/' },
    { label: 'Lega del Bar', to: '/leghe/l1' },
    { label: 'Asta estiva' },
  ];

  /**
   * Il percorso dice dove si e' e come si torna indietro, un passo alla volta. I
   * passi prima sono collegamenti; l'ultimo e' la pagina in cui ci si trova, e lo
   * dice a chi ascolta.
   */
  it('il percorso elenca i passi: gli altri sono collegamenti, l ultimo e la pagina corrente', () => {
    render(withRouter(<AppShell chrome="top" trail={TRAIL}><p>x</p></AppShell>));
    const nav = screen.getByRole('navigation', { name: 'Percorso' });
    expect(within(nav).getByRole('link', { name: 'Le mie leghe' })).toHaveAttribute('href', '/');
    expect(within(nav).getByRole('link', { name: 'Lega del Bar' })).toHaveAttribute('href', '/leghe/l1');
    expect(within(nav).queryByRole('link', { name: 'Asta estiva' })).toBeNull();
    expect(within(nav).getByText('Asta estiva')).toHaveAttribute('aria-current', 'page');
  });

  /** Sul telefono non c'e' posto per tutto il percorso: resta il passo da cui si viene. */
  it('sul telefono del percorso resta solo il passo precedente', () => {
    render(withRouter(<AppShell chrome="top" trail={TRAIL}><p>x</p></AppShell>));
    const nav = screen.getByRole('navigation', { name: 'Percorso' });
    const item = (text: string) => within(nav).getByText(text).closest('li');
    expect(item('Le mie leghe')?.className).toContain('max-sm:hidden');
    expect(item('Lega del Bar')?.className).not.toContain('max-sm:hidden');
    expect(item('Asta estiva')?.className).toContain('max-sm:hidden');
  });

  it('la proiezione non ha percorso, nemmeno se glielo si passa', () => {
    render(withRouter(<AppShell chrome="none" trail={TRAIL}><p>x</p></AppShell>));
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('il nome e\' il logo, porta alla home e resta una parola sola per chi ascolta', () => {
    render(withRouter(<AppShell chrome="top"><p>x</p></AppShell>));
    const link = screen.getByRole('link', { name: 'FantaAgent' });
    expect(link).toHaveAttribute('href', '/');
    expect(within(link).getByTestId('wordmark')).toBeInTheDocument();
  });

  /**
   * I comandi della schermata hanno una barra loro, sotto quella di navigazione:
   * nella stessa riga di marchio, percorso e profilo non c'era posto, e sul
   * telefono andavano a capo su tre righe.
   */
  it('i comandi della schermata stanno in una barra loro, fuori da quella di navigazione', () => {
    render(withRouter(
      <AppShell chrome="top" slotActions={<button type="button">azione</button>}><p>x</p></AppShell>,
    ));
    const commands = screen.getByRole('group', { name: 'Comandi della pagina' });
    expect(within(commands).getByRole('button', { name: 'azione' })).toBeInTheDocument();
    expect(within(screen.getByRole('banner')).queryByRole('button', { name: 'azione' })).toBeNull();
  });

  it('senza comandi la seconda barra non c e', () => {
    render(withRouter(<AppShell chrome="top"><p>x</p></AppShell>));
    expect(screen.queryByRole('group', { name: 'Comandi della pagina' })).toBeNull();
  });

  it('con chrome=none (proiezione) non mostra nessun link, nemmeno il nome', () => {
    render(withRouter(<AppShell chrome="none"><p>x</p></AppShell>));

    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.getByRole('banner')).toHaveTextContent('FantaAgent');
  });

  /**
   * Non nascosti con CSS: non resi affatto. Un pulsante nascosto alla vista resta
   * raggiungibile da tastiera e dai lettori di schermo, su una schermata che non lo
   * prevede.
   */
  it('i pulsanti azione appaiono solo sulla barra con la navigazione', () => {
    const { unmount } = render(withRouter(
      <AppShell chrome="top" slotActions={<button type="button">Annulla</button>}>
        <p>x</p>
      </AppShell>,
    ));
    expect(screen.getByRole('button', { name: 'Annulla' })).toBeInTheDocument();
    unmount();

    render(withRouter(
      <AppShell chrome="none" slotActions={<button type="button">Annulla</button>}>
        <p>x</p>
      </AppShell>,
    ));
    expect(screen.queryByRole('button', { name: 'Annulla' })).not.toBeInTheDocument();
  });

  it('Profilo apre un menu con il profilo e l\'uscita', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/auth/logout' && init?.method === 'POST') return Promise.resolve(new Response(null, { status: 204 }));
      if (url === '/api/auth/csrf') return Promise.resolve(new Response(null, { status: 204 }));
      return Promise.resolve(new Response(JSON.stringify({
        id: 'u1', email: 'a@b.it', displayName: 'Anna', emailVerified: true,
      }), { status: 200, headers: { 'content-type': 'application/json' } }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const router = createMemoryRouter([
      { path: '/', element: <AppShell chrome="top"><p>x</p></AppShell> },
      { path: '/accedi', element: <p>pagina di accesso</p> },
    ]);
    render(<QueryProvider><RouterProvider router={router} /></QueryProvider>);

    const button = await screen.findByRole('button', { name: /Profilo/ });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(button);

    const menu = screen.getByRole('menu', { name: 'Profilo' });
    expect(menu).toHaveTextContent('Anna');
    expect(menu).toHaveTextContent('a@b.it');
    expect(within(menu).getByRole('menuitem', { name: 'Il tuo profilo' })).toHaveAttribute('href', '/profilo');
    // Aperto, il focus va alla prima voce; Esc chiude e torna al bottone.
    expect(within(menu).getByRole('menuitem', { name: 'Il tuo profilo' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(button).toHaveFocus();

    await userEvent.click(button);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Esci' }));
    expect(await screen.findByText('pagina di accesso')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url, init]) => url === '/api/auth/logout' && init?.method === 'POST')).toBe(true);
  });
});
