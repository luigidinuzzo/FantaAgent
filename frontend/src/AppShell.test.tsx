import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
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

  /** Su una pagina lunga la barra non esce dallo schermo: resta ferma in cima. */
  it('la barra resta ferma in cima mentre la pagina scorre', () => {
    render(withRouter(<AppShell chrome="top"><p>x</p></AppShell>));
    const header = screen.getByRole('banner');
    expect(header.className).toContain('sticky');
    expect(header.className).toContain('top-0');
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

  /**
   * Una barra sola su tutte le pagine: marchio e «Le mie aste», entrambi verso la
   * home, e niente elenco di sezioni. Le altre destinazioni hanno la loro porta
   * altrove — /impostazioni dall'ingranaggio, /proiezione dal suo pulsante.
   */
  it('porta il marchio e «Le mie aste», entrambi verso la home, e nient altro', () => {
    render(withRouter(<AppShell chrome="top"><p>x</p></AppShell>));

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    links.forEach((l) => expect(l).toHaveAttribute('href', '/'));
    expect(within(links[0]).getByTestId('wordmark')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Le mie aste' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('sulla home «Le mie aste» dice di essere la pagina corrente', () => {
    const { unmount } = render(withRouter(<AppShell chrome="top"><p>x</p></AppShell>, '/'));
    expect(screen.getByRole('link', { name: 'Le mie aste' })).toHaveAttribute('aria-current', 'page');
    unmount();

    render(withRouter(<AppShell chrome="top"><p>x</p></AppShell>, '/asta'));
    expect(screen.getByRole('link', { name: 'Le mie aste' })).not.toHaveAttribute('aria-current');
  });

  it('il nome e\' il logo, porta alla home e resta una parola sola per chi ascolta', () => {
    render(withRouter(<AppShell chrome="top"><p>x</p></AppShell>));
    const link = screen.getByRole('link', { name: 'FantaAgent' });
    expect(link).toHaveAttribute('href', '/');
    expect(within(link).getByTestId('wordmark')).toBeInTheDocument();
  });

  /**
   * Sul telefono le azioni vanno tutte su una seconda riga a tutta larghezza,
   * invece di andare a capo dove capita e allungare la barra su tre righe.
   */
  it('sul telefono le azioni della barra stanno su una riga loro, a tutta larghezza', () => {
    const { container } = render(withRouter(
      <AppShell chrome="top" slotActions={<button type="button">azione</button>}><p>x</p></AppShell>,
    ));
    const group = screen.getByRole('button', { name: 'azione' }).parentElement;
    expect(group?.className).toContain('max-sm:w-full');
    expect(container.querySelector('header')?.className).toContain('flex-wrap');
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

  it('mostra il nome di chi ha fatto l\'accesso, verso il profilo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'u1', email: 'a@b.it', displayName: 'Anna', emailVerified: true,
    }), { status: 200, headers: { 'content-type': 'application/json' } })));
    render(withRouter(<AppShell chrome="top"><p>x</p></AppShell>));
    expect(await screen.findByRole('link', { name: 'Anna' })).toHaveAttribute('href', '/profilo');
  });
});
