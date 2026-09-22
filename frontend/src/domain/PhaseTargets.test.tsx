import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { TargetView } from '../api/types';
import { PhaseTargets } from './PhaseTargets';

const T: TargetView = {
  id: 'f1', name: 'Falcone', team: 'Lecce', role: 'P', listPrice: 8,
  maxBid: 34, expectedPrice: 16, margin: 18, worthPursuing: true,
};

describe('PhaseTargets', () => {
  it('ogni occasione mette il giocatore sul battitore', async () => {
    const onSelect = vi.fn();
    render(<PhaseTargets phase="P" targets={[T]} loading={false} disabled={false} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: /^Falcone, Lecce: mercato 16, tetto 34, margine \+18/ }));
    expect(onSelect).toHaveBeenCalledWith('f1');
    expect(screen.getByText(/I portieri liberi/)).toBeInTheDocument();
  });

  /** Un caricamento fallito non e' «non ci sono occasioni»: e' stato un difetto vero. */
  it('se le occasioni non arrivano lo dice, invece di dire che non ce ne sono', () => {
    render(<PhaseTargets phase="P" targets={[]} loading={false} failed disabled={false} onSelect={() => {}} />);
    expect(screen.getByText(/non si sono caricate/)).toBeInTheDocument();
    expect(screen.queryByText(/non restano giocatori liberi/)).not.toBeInTheDocument();
  });

  it('senza occasioni invita a passare alla fase successiva', () => {
    render(<PhaseTargets phase="P" targets={[]} loading={false} disabled={false} onSelect={() => {}} />);
    expect(screen.getByText(/non restano giocatori liberi/)).toBeInTheDocument();
  });

  it('a battitore aperto le occasioni non si possono scegliere', () => {
    render(<PhaseTargets phase="P" targets={[T]} loading={false} disabled onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: /^Falcone/ })).toBeDisabled();
  });
});
