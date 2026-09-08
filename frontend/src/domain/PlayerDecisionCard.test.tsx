import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ValuationResponse } from '../api/types';
import { PlayerDecisionCard } from './PlayerDecisionCard';

const VALUATION: ValuationResponse = {
  playerId: 'd1',
  name: 'Bastoni',
  team: 'Inter',
  role: 'D',
  listPrice: 20,
  expectedPrice: 38,
  maxBid: 47,
  hardCap: 90,
  margin: 9,
  walkAwayReason: 'oltre 47 il completamento perde più di quanto guadagni',
  worthPursuing: true,
  confidenceStars: 4,
  drivers: [
    { label: 'budget', contribution: 3, explanation: 'budget capiente' },
    { label: 'alternative', contribution: -1, explanation: 'tre alternative sopra soglia' },
  ],
};

describe('PlayerDecisionCard', () => {
  it('mostra il tetto come numero dominante', () => {
    render(<PlayerDecisionCard valuation={VALUATION} stale={false} />);
    const maxBid = screen.getByTestId('max-bid');
    expect(maxBid).toHaveTextContent('47');
  });

  it('mostra mercato, margine e il verdetto', () => {
    render(<PlayerDecisionCard valuation={VALUATION} stale={false} />);
    expect(screen.getByTestId('expected-price')).toHaveTextContent('38');
    expect(screen.getByTestId('margin')).toHaveTextContent('+9');
    expect(screen.getByText('Prendi')).toBeInTheDocument();
  });

  it('quando non conviene mostra Lascia e la ragione', () => {
    render(
      <PlayerDecisionCard
        valuation={{ ...VALUATION, worthPursuing: false, margin: -4, maxBid: 11 }}
        stale={false}
      />,
    );
    expect(screen.getByText('Lascia')).toBeInTheDocument();
    expect(screen.getByTestId('margin')).toHaveTextContent('−4');
  });

  it('elenca i driver in parole, non in sigle', () => {
    render(<PlayerDecisionCard valuation={VALUATION} stale={false} />);
    expect(screen.getByText(/budget capiente/)).toBeInTheDocument();
    expect(screen.getByText(/tre alternative sopra soglia/)).toBeInTheDocument();
  });

  it('quando il dato e stantio si segnala come tale', () => {
    render(<PlayerDecisionCard valuation={VALUATION} stale />);
    expect(screen.getByTestId('decision-card')).toHaveAttribute('data-stale', 'true');
    // Il tetto resta leggibile: serve ancora. Cio' che cade e' la pretesa
    // che sia aggiornato.
    expect(screen.getByTestId('max-bid')).toHaveTextContent('47');
  });

  it('quando il dato e stantio espone un avviso per lo screen reader', () => {
    render(<PlayerDecisionCard valuation={VALUATION} stale />);
    expect(
      screen.getByText('I valori mostrati non sono più aggiornati.'),
    ).toBeInTheDocument();
  });

  it('espone la scheda come regione raggiungibile per nome accessibile', () => {
    render(<PlayerDecisionCard valuation={VALUATION} stale={false} />);
    expect(screen.getByRole('region', { name: 'Bastoni' })).toBeInTheDocument();
  });

  it('non mostra punteggiatura spuria quando i driver sono assenti o vuoti', () => {
    const { rerender } = render(
      <PlayerDecisionCard valuation={{ ...VALUATION, drivers: [] }} stale={false} />,
    );
    expect(screen.queryByText('.')).not.toBeInTheDocument();

    rerender(
      <PlayerDecisionCard
        valuation={{
          ...VALUATION,
          drivers: [
            { label: 'budget', contribution: 3, explanation: '' },
            { label: 'alternative', contribution: -1, explanation: 'tre alternative sopra soglia' },
          ],
        }}
        stale={false}
      />,
    );
    expect(screen.getByText('tre alternative sopra soglia.')).toBeInTheDocument();
  });
});
