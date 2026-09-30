import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { BoardColumn, ParticipantView } from '../api/types';
import { MyRoster } from './MyRoster';

const ME: ParticipantView = {
  id: 'anna', name: 'Anna', initial: 'A', me: true, budgetRemaining: 120, slotsRemaining: 11,
  filledByRole: { P: 3, D: 8, C: 3, A: 0 }, slotsByRole: { P: 3, D: 8, C: 8, A: 6 },
};

const COLUMN: BoardColumn = {
  participantId: 'anna', participantName: 'Anna', me: true, budgetRemaining: 120, slotsRemaining: 11,
  byRole: {
    P: [{ seq: 1, playerName: 'Maignan', price: 32 }, { seq: 2, playerName: 'Skorupski', price: 15 }, { seq: 3, playerName: 'Audero', price: 7 }],
    D: [],
    C: [{ seq: 4, playerName: 'Pulisic', price: 90 }],
    A: [],
  },
};

describe('MyRoster', () => {
  it('una riga per ruolo, con i posti occupati su quelli che ha', () => {
    render(<MyRoster me={ME} column={COLUMN} />);
    const rows = within(screen.getByRole('list', { name: 'La tua rosa' })).getAllByRole('listitem');
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent('3 di 3');
    expect(rows[2]).toHaveTextContent('1 di 8');
    expect(rows[3]).toHaveTextContent('0 di 6');
  });

  it('dice chi hai preso e a quanto, e quando non hai ancora nessuno', () => {
    render(<MyRoster me={ME} column={COLUMN} />);
    const rows = within(screen.getByRole('list', { name: 'La tua rosa' })).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Maignan 32 · Skorupski 15 · Audero 7');
    expect(rows[1]).toHaveTextContent('ancora nessuno');
  });

  // Il tabellone non e' ancora arrivato: la rosa c'e' lo stesso, coi posti da
  // riempire, invece di una colonna vuota.
  it('senza tabellone resta la rosa coi suoi posti', () => {
    render(<MyRoster me={ME} column={undefined} />);
    const rows = within(screen.getByRole('list', { name: 'La tua rosa' })).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('0 di 3');
  });
});
