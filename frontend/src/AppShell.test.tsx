import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from './AppShell';

function withRouter(node: React.ReactNode) {
  return <MemoryRouter>{node}</MemoryRouter>;
}

describe('AppShell', () => {
  it('mostra il contenuto dentro un landmark main', () => {
    render(withRouter(<AppShell chrome="side"><p>contenuto</p></AppShell>));
    expect(screen.getByRole('main')).toHaveTextContent('contenuto');
  });

  it('espone la barra superiore come banner', () => {
    render(withRouter(<AppShell chrome="side"><p>x</p></AppShell>));
    expect(screen.getByRole('banner')).toHaveTextContent('FantaAgent');
  });

  it('ospita lo slot di stato nella barra', () => {
    render(withRouter(
      <AppShell chrome="side" slotStatus={<span>in diretta</span>}><p>x</p></AppShell>,
    ));
    expect(screen.getByRole('banner')).toHaveTextContent('in diretta');
  });

  /**
   * Durante la serata la barra porta solo il marchio: niente nome dell'asta ripetuto
   * (sta gia' nell'elenco da cui si e' entrati) e niente elenco di sezioni. Le
   * destinazioni restano raggiungibili da altrove — /impostazioni dall'ingranaggio
   * dell'asta, /proiezione dal suo pulsante, /asta dalla home.
   */
  it('con chrome=top la barra porta il marchio e il pulsante Home, e nient altro', () => {
    render(withRouter(<AppShell chrome="top"><p>x</p></AppShell>));

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    links.forEach((l) => expect(l).toHaveAttribute('href', '/'));
    expect(within(links[0]).getByTestId('wordmark')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('la barra laterale offre Asta e Profilo, con la sezione corrente dichiarata', () => {
    render(withRouter(
      <AppShell chrome="side" section="profilo" onSectionChange={() => {}}><p>x</p></AppShell>,
    ));

    const nav = screen.getByRole('navigation', { name: 'Sezioni' });
    const items = within(nav).getAllByRole('button');
    expect(items.map((b) => b.textContent)).toEqual(['Asta', 'Profilo']);
    expect(within(nav).getByRole('button', { name: 'Profilo' })).toHaveAttribute('aria-current', 'true');
    expect(within(nav).getByRole('button', { name: 'Asta' })).not.toHaveAttribute('aria-current');
  });

  it('sulla home le voci della barra laterale cambiano sezione senza navigare', async () => {
    const onSectionChange = vi.fn();
    render(withRouter(
      <AppShell chrome="side" section="asta" onSectionChange={onSectionChange}><p>x</p></AppShell>,
    ));

    const nav = screen.getByRole('navigation', { name: 'Sezioni' });
    expect(within(nav).queryAllByRole('link')).toHaveLength(0);
    await userEvent.click(within(nav).getByRole('button', { name: 'Profilo' }));
    expect(onSectionChange).toHaveBeenCalledWith('profilo');
  });

  it('il nome porta alla home', () => {
    render(withRouter(<AppShell chrome="side"><p>x</p></AppShell>));
    expect(screen.getByRole('link', { name: 'FantaAgent' })).toHaveAttribute('href', '/');
  });

  /**
   * Su un telefono i pulsanti icona dell'asta piu' lo stato di connessione non stanno
   * su una riga sola: senza andare a capo, la pagina intera scorreva di lato.
   */
  it('il gruppo di destra della barra sa andare a capo', () => {
    const { container } = render(withRouter(<AppShell chrome="top"><p>x</p></AppShell>));
    const group = container.querySelector('header > div.ml-auto');
    expect(group?.className).toContain('flex-wrap');
  });

  it('con chrome=none (proiezione) non mostra nessun link, nemmeno il nome', () => {
    render(withRouter(<AppShell chrome="none"><p>x</p></AppShell>));

    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.getByRole('banner')).toHaveTextContent('FantaAgent');
  });

  /**
   * Il campo e' uno solo per ogni schermata, proiezione compresa: due copie
   * sovrapposte raddoppierebbero le strisce e le linee.
   */
  it.each(['side', 'top', 'none'] as const)('con chrome=%s disegna il campo una volta sola', (chrome) => {
    const { container } = render(withRouter(<AppShell chrome={chrome}><p>x</p></AppShell>));

    expect(container.querySelectorAll('[data-testid="pitch"]')).toHaveLength(1);
  });

  /** Il campo centrato sui contenuti, non sulla finestra: comincia dove finisce la barra. */
  it('con la barra laterale il campo comincia dopo la barra, larga quanto lui la sposta', () => {
    const { container, getByTestId } = render(withRouter(<AppShell chrome="side"><p>x</p></AppShell>));
    const offset = getByTestId('pitch').className.match(/md:left-(\d+)/)?.[1];
    const width = container.querySelector('header')?.className.match(/md:w-(\d+)/)?.[1];
    expect(offset).toBeDefined();
    expect(offset).toBe(width);
  });

  it('con la barra in alto il campo occupa tutta la finestra', () => {
    const { getByTestId } = render(withRouter(<AppShell chrome="top"><p>x</p></AppShell>));
    expect(getByTestId('pitch').className).toContain('inset-0');
  });

  /**
   * Le impostazioni sono una pagina lunga: scorrendola, marchio e voci devono restare
   * in vista invece di uscire dallo schermo.
   */
  it('la barra laterale resta ferma mentre il contenuto scorre', () => {
    const { container } = render(withRouter(<AppShell chrome="side"><p>x</p></AppShell>));
    const header = container.querySelector('header');
    expect(header?.className).toContain('md:sticky');
    expect(header?.className).toContain('md:top-0');
    expect(header?.className).toContain('md:h-dvh');
  });

  it('il nome e\' il logo, e resta una parola sola per chi ascolta', () => {
    render(withRouter(<AppShell chrome="side"><p>x</p></AppShell>));
    const link = screen.getByRole('link', { name: 'FantaAgent' });
    expect(within(link).getByTestId('wordmark')).toBeInTheDocument();
  });

  /**
   * Non nascosti con CSS: non resi affatto. Un pulsante nascosto alla vista resta
   * raggiungibile da tastiera e dai lettori di schermo, su una schermata che non lo
   * prevede.
   */
  it('i pulsanti azione appaiono solo sulla barra superiore', () => {
    const { unmount } = render(withRouter(
      <AppShell chrome="top" slotActions={<button type="button">Annulla</button>}>
        <p>x</p>
      </AppShell>,
    ));
    expect(screen.getByRole('button', { name: 'Annulla' })).toBeInTheDocument();
    unmount();

    render(withRouter(
      <AppShell chrome="side" slotActions={<button type="button">Annulla</button>}>
        <p>x</p>
      </AppShell>,
    ));
    expect(screen.queryByRole('button', { name: 'Annulla' })).not.toBeInTheDocument();
  });
});
