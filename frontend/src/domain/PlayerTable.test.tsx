import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PhaseRowView } from '../api/types';
import { PlayerTable } from './PlayerTable';

const ROWS: PhaseRowView[] = [
  {
    id: 'd1', name: 'Dimarco', team: 'INT', role: 'D', listPrice: 21,
    maxBid: 29, expectedPrice: 22, margin: 7, fantamediaAttesa: 6.8, titolaritaPercent: 88,
  },
  {
    id: 'd2', name: 'Gatti', team: 'JUV', role: 'D', listPrice: 16,
    maxBid: 11, expectedPrice: 15, margin: -4, fantamediaAttesa: 6.1, titolaritaPercent: 74,
  },
];

describe('PlayerTable', () => {
  it('e una tabella vera, con intestazione', () => {
    render(<PlayerTable rows={ROWS} selectedId={null} onSelect={() => {}} />);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').length).toBeGreaterThan(3);
    expect(within(table).getAllByRole('row')).toHaveLength(3); // intestazione + 2
  });

  it('incolonna i numeri con le cifre tabulari', () => {
    render(<PlayerTable rows={ROWS} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByTestId('maxbid-d1')).toHaveClass('tnum');
  });

  it('distingue le righe sopra soglia', () => {
    render(<PlayerTable rows={ROWS} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByTestId('row-d2')).toHaveAttribute('data-above-threshold', 'true');
    expect(screen.getByTestId('row-d1')).toHaveAttribute('data-above-threshold', 'false');
  });

  it('seleziona una riga col clic e con la tastiera', async () => {
    const onSelect = vi.fn();
    render(<PlayerTable rows={ROWS} selectedId={null} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button', { name: /Dimarco/ }));
    expect(onSelect).toHaveBeenCalledWith('d1');

    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  // aria-current da solo annuncia "corrente" senza riferimento: chi ascolta
  // sente "Dimarco, bottone, corrente" e non sa corrente di cosa. La
  // correzione vera sta nel nome accessibile del bottone, che dice insieme
  // l'azione e lo stato — non in un attributo di stato in piu' da decifrare.
  // Verifichiamo il nome accessibile, non un attributo: e' quello, non
  // l'attributo, che lo screen reader annuncia per un bottone.
  it('il nome accessibile del bottone dice l azione e, se selezionata, lo stato', () => {
    const { rerender } = render(
      <PlayerTable rows={ROWS} selectedId={null} onSelect={() => {}} />,
    );
    expect(screen.getByRole('button', { name: 'Valuta Dimarco' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Valuta Gatti' })).toBeInTheDocument();

    rerender(<PlayerTable rows={ROWS} selectedId="d1" onSelect={() => {}} />);
    expect(
      screen.getByRole('button', { name: 'Dimarco, selezionato per la valutazione' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Valuta Gatti' })).toBeInTheDocument();
  });

  // Il colore (destructive contro accent) e data-above-threshold non
  // raggiungono chi non vede: un data-* non entra nell'albero di
  // accessibilita' e il colore da solo non e' mai informazione. Il testo
  // nascosto accanto al tetto e' l'equivalente per chi non vede: si legge
  // insieme al numero, non lo sostituisce.
  it('segnala il superamento del tetto anche a chi non vede, non solo col colore', () => {
    render(<PlayerTable rows={ROWS} selectedId={null} onSelect={() => {}} />);
    expect(within(screen.getByTestId('maxbid-d2')).getByText(/oltre il tetto/)).toBeInTheDocument();
    expect(
      within(screen.getByTestId('maxbid-d1')).queryByText(/oltre il tetto/),
    ).not.toBeInTheDocument();
  });

  it('con nessun giocatore invita ad agire invece di restare vuota', () => {
    render(<PlayerTable rows={[]} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText(/Nessun giocatore libero in questa fase/)).toBeInTheDocument();
  });

  // Fix round 1: un lotto e' aperto sul battitore alla volta. Senza
  // bloccare la tabella, un clic vagante su un'altra riga mentre il
  // battitore e' aperto cambia il giocatore sotto un rilancio in corso —
  // countdown, prezzo accumulato e beep perduti senza preavviso, e la
  // proiezione (che ascolta lo stesso canale) vedrebbe il lotto saltare a
  // meta' asta. Abbandonare un lotto resta un gesto deliberato: si chiude
  // il battitore, non si clicca altrove per sbaglio.
  it('quando la selezione e bloccata i bottoni delle righe sono disabilitati e lo dicono a chi ascolta', () => {
    render(<PlayerTable rows={ROWS} selectedId="d1" onSelect={() => {}} disabled />);
    const button = screen.getByRole('button', { name: /Dimarco/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(/battitore/i);
  });

  it('quando non e bloccata i bottoni restano normali', () => {
    render(<PlayerTable rows={ROWS} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: /Dimarco/ })).not.toBeDisabled();
  });

  // Il nome del giocatore cominciava esattamente sul bordo sinistro della
  // cornice e la titolarita' finiva su quello destro: le celle avevano solo
  // riempimento verticale. Nella prima colonna il riempimento sta sul bottone,
  // che occupa tutta la cella, non sulla cella stessa.
  it('stacca il testo dai bordi: ogni cella ha il suo riempimento laterale', () => {
    render(<PlayerTable rows={ROWS} selectedId={null} onSelect={() => {}} />);
    screen.getAllByRole('columnheader').forEach((th) => {
      expect(th.className).toContain('px-');
    });
    const row = screen.getByTestId('row-d1');
    expect(within(row).getByRole('button', { name: /Dimarco/ }).className).toContain('px-');
    within(row).getAllByRole('cell').slice(1).forEach((td) => {
      expect(td.className).toContain('px-');
    });
  });
});
