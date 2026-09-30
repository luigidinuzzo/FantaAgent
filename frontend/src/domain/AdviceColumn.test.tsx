import { cleanup, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ParticipantView, TargetView, ValuationResponse } from '../api/types';
import { AdviceColumn } from './AdviceColumn';

const ME: ParticipantView = {
  id: 'anna', name: 'Anna', initial: 'A', me: true, budgetRemaining: 120, slotsRemaining: 11,
  filledByRole: { P: 3, D: 8, C: 3, A: 0 }, slotsByRole: { P: 3, D: 8, C: 8, A: 6 },
};

const TARGETS: TargetView[] = [
  { id: 'c1', name: 'Zielinski', team: 'Monza', role: 'C', listPrice: 15, maxBid: 60, expectedPrice: 51, margin: 9, worthPursuing: true },
  { id: 'c2', name: 'Rovella', team: 'Udinese', role: 'C', listPrice: 12, maxBid: 41, expectedPrice: 41, margin: 0, worthPursuing: true },
];

const VALUATION: ValuationResponse = {
  playerId: 'c9', name: 'Mkhitaryan', team: 'Inter', role: 'C', listPrice: 21, expectedPrice: 71, maxBid: 72,
  hardCap: 86, margin: 1, walkAwayReason: '', worthPursuing: true, confidenceStars: 4,
  drivers: [{ label: 'Titolarità', contribution: 12, explanation: 'Gioca quasi sempre dall\'inizio.' }],
};

function renderColumn(overrides: Partial<Parameters<typeof AdviceColumn>[0]> = {}) {
  const onSelect = vi.fn();
  render(
    <AdviceColumn
      phase="C"
      targets={TARGETS}
      targetsLoading={false}
      targetsFailed={false}
      selectedId={null}
      valuation={null}
      bidderOpen={false}
      onSelect={onSelect}
      me={ME}
      myColumn={undefined}
      {...overrides}
    />,
  );
  return onSelect;
}

describe('AdviceColumn', () => {
  it('si chiama «I tuoi consigli» e dice che li vedi solo tu', () => {
    renderColumn();
    const column = screen.getByRole('region', { name: 'I tuoi consigli' });
    expect(within(column).getByText('Solo tu')).toBeInTheDocument();
  });

  it('a riposo: le occasioni della fase e la tua rosa', () => {
    renderColumn();
    expect(screen.getByRole('heading', { name: 'Occasioni della fase' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'La tua rosa' })).getByRole('list')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Perché questo prezzo' })).toBeNull();
  });

  it('col lotto: il perche del prezzo e le alternative, senza il lotto stesso', () => {
    renderColumn({ selectedId: 'c9', valuation: VALUATION, targets: [...TARGETS, { ...TARGETS[0], id: 'c9', name: 'Mkhitaryan' }] });
    expect(screen.getByRole('heading', { name: 'Perché questo prezzo' })).toBeInTheDocument();
    const alternatives = screen.getByRole('region', { name: 'Invece di lui' });
    expect(within(alternatives).getByRole('button', { name: /Zielinski/ })).toBeInTheDocument();
    expect(within(alternatives).queryByRole('button', { name: /Mkhitaryan/ })).toBeNull();
    expect(screen.queryByRole('region', { name: 'La tua rosa' })).toBeNull();
  });

  // Il titolo della colonna e' un h2: cio' che ci sta dentro e' un livello sotto,
  // come «La tua rosa». Un h2 dentro un h2 diceva a chi naviga per titoli che le
  // occasioni erano una colonna a se', accanto ai consigli invece che dentro.
  it('i titoli dentro la colonna sono di terzo livello', () => {
    renderColumn();
    expect(screen.getByRole('heading', { name: 'Occasioni della fase', level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'La tua rosa', level: 3 })).toBeInTheDocument();
    cleanup();
    renderColumn({ selectedId: 'c9', valuation: VALUATION });
    expect(screen.getByRole('heading', { name: 'Perché questo prezzo', level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Invece di lui', level: 3 })).toBeInTheDocument();
    cleanup();
    renderColumn({ selectedId: 'c9', valuation: null });
    expect(screen.getByRole('heading', { name: 'Perché questo prezzo', level: 3 })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['I tuoi consigli']);
  });

  // Un lotto alla volta: col conto avviato le alternative restano da leggere, ma
  // sceglierne una cambierebbe il giocatore sotto un rilancio in corso.
  it('col conto avviato le alternative si leggono ma non si scelgono', () => {
    renderColumn({ selectedId: 'c9', valuation: VALUATION, bidderOpen: true });
    const alternatives = screen.getByRole('region', { name: 'Invece di lui' });
    within(alternatives).getAllByRole('button').forEach((b) => expect(b).toBeDisabled());
  });
});
