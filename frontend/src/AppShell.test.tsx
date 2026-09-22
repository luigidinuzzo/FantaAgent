import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from './AppShell';

function withRouter(node: React.ReactNode, path = '/asta') {
  return <MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>;
}

describe('AppShell', () => {
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
   * Il campo parte sotto la barra, a --header-h: la barra ha quell'altezza minima su
   * ogni pagina, cosi' il campo e' identico ovunque e nessuna barra piu' alta ne
   * copre un pezzo in piu'.
   */
  it('la barra ha la stessa altezza minima su ogni pagina, quella da cui parte il campo', () => {
    render(withRouter(<AppShell chrome="none"><p>x</p></AppShell>));
    expect(screen.getByRole('banner').className).toContain('min-h-[var(--header-h)]');
    expect(screen.getByTestId('pitch').className).toContain('top-[var(--header-h)]');
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
   * Il campo e' uno solo per ogni schermata, proiezione compresa, e occupa tutta la
   * finestra sotto la barra: due copie sovrapposte raddoppierebbero le strisce e le
   * linee, e dietro la barra la linea di fondo sarebbe coperta.
   */
  it.each(['top', 'none'] as const)('con chrome=%s disegna il campo una volta sola, sotto la barra', (chrome) => {
    const { container, getByTestId } = render(withRouter(<AppShell chrome={chrome}><p>x</p></AppShell>));

    expect(container.querySelectorAll('[data-testid="pitch"]')).toHaveLength(1);
    const pitch = getByTestId('pitch').className;
    expect(pitch).toContain('inset-x-0');
    expect(pitch).toContain('bottom-0');
    expect(pitch).toContain('top-[var(--header-h)]');
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
});
