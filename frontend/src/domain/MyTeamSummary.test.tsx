import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ParticipantView } from '../api/types';
import { MyTeamSummary } from './MyTeamSummary';

const ME: ParticipantView = {
  id: 'anna', name: 'Anna', initial: 'A', me: true,
  budgetRemaining: 310, slotsRemaining: 20,
  filledByRole: { P: 1, D: 2, C: 1, A: 1 },
  slotsByRole: { P: 3, D: 8, C: 8, A: 6 },
};

describe('MyTeamSummary', () => {
  it('dice crediti, posti liberi e la media per posto arrotondata per difetto', () => {
    render(<MyTeamSummary me={ME} />);
    expect(screen.getByText('310')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    // 310 / 20 = 15.5: al tavolo si conta per difetto.
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('media per posto')).toBeInTheDocument();
  });

  it('dice i posti presi per ruolo sul totale', () => {
    render(<MyTeamSummary me={ME} />);
    const roles = screen.getByRole('list', { name: 'Posti per ruolo' });
    expect(within(roles).getByText('2 di 8')).toBeInTheDocument();
    expect(within(roles).getByText('difensori')).toBeInTheDocument();
  });

  it('a rosa completa la media non e zero ma un trattino', () => {
    render(<MyTeamSummary me={{ ...ME, budgetRemaining: 4, slotsRemaining: 0 }} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  /** Sotto ogni ruolo chi hai preso, e a destra gli ultimi acquisti di tutta la lega. */
  it('mostra i tuoi giocatori per ruolo e gli ultimi acquisti, dal piu recente', () => {
    const board = {
      auctionId: 'a1', currentPhase: 'P' as const,
      columns: [
        { participantId: 'anna', participantName: 'Anna', me: true, budgetRemaining: 310, slotsRemaining: 20,
          byRole: { P: [{ seq: 1, playerName: 'Maignan', price: 38 }], D: [], C: [], A: [] } },
        { participantId: 'diego', participantName: 'Diego', me: false, budgetRemaining: 400, slotsRemaining: 24,
          byRole: { P: [{ seq: 2, playerName: 'Svilar', price: 42 }], D: [], C: [], A: [] } },
      ],
    };
    render(<MyTeamSummary me={ME} board={board} />);

    const roles = screen.getByRole('list', { name: 'Posti per ruolo' });
    expect(within(roles).getByText('Maignan')).toBeInTheDocument();
    expect(within(roles).queryByText('Svilar')).not.toBeInTheDocument();

    const recent = screen.getByRole('region', { name: 'Ultimi acquisti' });
    const items = within(recent).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Svilar');
    expect(items[0]).toHaveTextContent('a Diego');
    expect(items[1]).toHaveTextContent('Maignan');
    expect(items[1]).toHaveTextContent('a te');
  });

  it('senza acquisti lo dice, invece di lasciare la colonna vuota', () => {
    render(<MyTeamSummary me={ME} board={{ auctionId: 'a1', currentPhase: 'P', columns: [] }} />);
    expect(screen.getByText("Ancora nessun acquisto in quest'asta.")).toBeInTheDocument();
    expect(screen.getAllByText('Ancora nessuno')).toHaveLength(4);
  });
});
