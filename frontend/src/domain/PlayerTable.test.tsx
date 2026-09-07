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

  // aria-selected su <tr> non e' annunciato dagli assistivi qui: lo stato e'
  // supportato su role=row solo dentro un antenato grid o treegrid (widget
  // interattivi); il nostro <table> ha invece role=table, statico, dove
  // aria-selected non e' pertinente — l'attributo resterebbe nel DOM ma
  // invisibile a chi non vede. Il bottone e' l'elemento interattivo reale,
  // quindi e' li' che deve stare il segnale: aria-current e' cio' che MDN
  // indica per "elemento correntemente attivo in un insieme" quando
  // aria-selected non si applica.
  it('segnala la riga selezionata agli assistivi tramite il bottone', () => {
    render(<PlayerTable rows={ROWS} selectedId="d1" onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: /Dimarco/ })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: /Gatti/ })).not.toHaveAttribute('aria-current');
  });

  it('con nessun giocatore invita ad agire invece di restare vuota', () => {
    render(<PlayerTable rows={[]} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText(/Nessun giocatore libero in questa fase/)).toBeInTheDocument();
  });
});
