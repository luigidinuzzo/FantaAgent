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
    render(withRouter(<AppShell><p>contenuto</p></AppShell>));
    expect(screen.getByRole('main')).toHaveTextContent('contenuto');
  });

  it('espone la barra superiore come banner', () => {
    render(withRouter(<AppShell><p>x</p></AppShell>));
    expect(screen.getByRole('banner')).toHaveTextContent('FantaAgent');
  });

  it('ospita lo slot di stato nella barra', () => {
    render(withRouter(<AppShell slotStatus={<span>in diretta</span>}><p>x</p></AppShell>));
    expect(screen.getByRole('banner')).toHaveTextContent('in diretta');
  });

  /**
   * Il difetto strutturale della revisione finale: due revisioni consecutive hanno
   * trovato "una rotta aggiunta e nessuno che la collega" — /proiezione alla tappa
   * 4, /riepilogo alla tappa 5. La barra e' l'unico elemento che ogni schermata
   * condivide: e' qui che la navigazione va tenuta, non in un link isolato per
   * schermata.
   */
  it('collega ogni rotta del router, cosi che una nuova non resti irraggiungibile', () => {
    render(withRouter(<AppShell><p>x</p></AppShell>));

    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    const reachable = routeDefinitions
      .map((r) => r.path)
      // La proiezione e' l'eccezione voluta: e' una seconda schermata pensata per
      // un proiettore, senza nessun controllo — va aperta solo dal collegamento
      // "Apri la proiezione" in AuctionRoute (target=_blank), non dalla barra
      // comune, che sulla proiezione stessa deve restare del tutto assente.
      .filter((path) => path !== '/proiezione');

    for (const path of reachable) {
      expect(hrefs).toContain(path);
    }
  });

  it('il nome porta alla home', () => {
    render(withRouter(<AppShell><p>x</p></AppShell>));
    expect(screen.getByRole('link', { name: 'FantaAgent' })).toHaveAttribute('href', '/');
  });

  /**
   * La proiezione e' una seconda schermata pensata per essere lanciata su un
   * proiettore: il suo vincolo permanente e' zero pulsanti e zero caselle di
   * testo, e questo si estende alla navigazione — un link e' role="link", non
   * role="button", ma non deve comunque essercene nessuno.
   */
  it('senza la navigazione (proiezione) non mostra nessun link, nemmeno il nome', () => {
    render(withRouter(<AppShell nav={false}><p>x</p></AppShell>));

    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.getByRole('banner')).toHaveTextContent('FantaAgent');
  });
});
