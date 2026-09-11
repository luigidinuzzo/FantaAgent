import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from './AppShell';
import { routeDefinitions } from './router';

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
   * Il difetto strutturale delle tappe precedenti: due revisioni consecutive hanno
   * trovato "una rotta aggiunta e nessuno che la collega". La barra e' l'unico
   * elemento che ogni schermata condivide, quindi e' qui che la navigazione vive —
   * qualunque forma prenda, laterale o superiore.
   */
  it.each(['side', 'top'] as const)(
    'con chrome=%s collega ogni rotta del router',
    (chrome) => {
      render(withRouter(<AppShell chrome={chrome}><p>x</p></AppShell>));

      const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
      const reachable = routeDefinitions
        .map((r) => r.path)
        // La proiezione e' l'eccezione voluta: seconda schermata per un proiettore,
        // zero controlli, si apre solo dal suo collegamento in /asta.
        .filter((path) => path !== '/proiezione');

      for (const path of reachable) {
        expect(hrefs).toContain(path);
      }
    },
  );

  it('la barra laterale e quella superiore offrono le STESSE destinazioni', () => {
    const { unmount } = render(withRouter(<AppShell chrome="side"><p>x</p></AppShell>));
    const side = screen.getAllByRole('link').map((a) => a.getAttribute('href')).sort();
    unmount();

    render(withRouter(<AppShell chrome="top"><p>x</p></AppShell>));
    const top = screen.getAllByRole('link').map((a) => a.getAttribute('href')).sort();

    // Due elenchi di sezioni sarebbero due cose da tenere d'accordo: e' un solo
    // elenco reso in due forme, e questo test lo impone.
    expect(top).toEqual(side);
  });

  it('il nome porta alla home', () => {
    render(withRouter(<AppShell chrome="side"><p>x</p></AppShell>));
    expect(screen.getByRole('link', { name: 'FantaAgent' })).toHaveAttribute('href', '/');
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
