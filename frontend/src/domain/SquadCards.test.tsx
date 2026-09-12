import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ParticipantView } from '../api/types';
import { SquadCards } from './SquadCards';

const PARTICIPANTS: ParticipantView[] = [
  {
    id: 'p1', name: 'Anna', initial: 'A', me: true,
    budgetRemaining: 312, slotsRemaining: 21,
    filledByRole: { P: 1, D: 3, C: 0, A: 0 },
    slotsByRole: { P: 3, D: 8, C: 8, A: 6 },
  },
  {
    id: 'p2', name: 'Bruno', initial: 'B', me: false,
    budgetRemaining: 289, slotsRemaining: 25,
    filledByRole: { P: 0, D: 0, C: 0, A: 0 },
    slotsByRole: { P: 3, D: 8, C: 8, A: 6 },
  },
];

describe('SquadCards', () => {
  it('mostra nome e budget di ciascuno', () => {
    render(<SquadCards participants={PARTICIPANTS} />);
    expect(screen.getByText('Anna')).toBeInTheDocument();
    expect(screen.getByTestId('budget-p1')).toHaveTextContent('312');
  });

  it('distingue visivamente me dagli altri', () => {
    render(<SquadCards participants={PARTICIPANTS} />);
    expect(screen.getByTestId('manager-p1')).toHaveAttribute('data-me', 'true');
    expect(screen.getByTestId('manager-p2')).toHaveAttribute('data-me', 'false');
  });

  it('rende la composizione come barra segmentata, non come stringa', () => {
    render(<SquadCards participants={PARTICIPANTS} />);
    const bar = screen.getByTestId('composition-p1');
    expect(bar.querySelectorAll('[data-role]')).toHaveLength(4);
    expect(screen.queryByText('1P 3D 0C 0A')).not.toBeInTheDocument();
  });

  // La stessa garanzia di LeagueBoard: compositionText resta, perche' e' cio'
  // che permette di togliere "1P 3D 0C 0A" dallo schermo senza perderlo.
  it('dice a parole com e composta la rosa, non solo con la barra', () => {
    render(<SquadCards participants={PARTICIPANTS} />);
    expect(screen.getByRole('img', { name: /1 portiere su 3/ })).toBeInTheDocument();
  });

  it('dice "sei tu" a parole, non solo con il bordo', () => {
    render(<SquadCards participants={PARTICIPANTS} />);
    expect(screen.getByText(', sei tu')).toHaveClass('sr-only');
    expect(
      within(screen.getByTestId('manager-p2')).queryByText(/sei tu/),
    ).not.toBeInTheDocument();
  });

  it('il budget ha la sua etichetta: non e un numero nudo', () => {
    // Debito chiuso nelle tappe precedenti. Non va riaperto dal ridisegno.
    render(<SquadCards participants={PARTICIPANTS} />);
    expect(screen.getByTestId('budget-p1')).toHaveTextContent(/crediti/i);
  });

  it('mostra gli slot occupati sul totale, e i conteggi per ruolo', () => {
    render(<SquadCards participants={PARTICIPANTS} />);
    // Bruno non ha ancora comprato nessuno: 0 occupati su 25 posti totali.
    expect(screen.getByText('0/25')).toBeInTheDocument();
    // Anna: 1 portiere + 3 difensori occupati, su 25 posti totali.
    expect(screen.getByText('4/25')).toBeInTheDocument();
  });

  it('i quattro conteggi per ruolo compaiono accanto alla pillola colorata', () => {
    render(<SquadCards participants={PARTICIPANTS} />);
    const anna = screen.getByTestId('manager-p1');
    // Il conteggio dei difensori di Anna (3), non un totale qualunque.
    expect(within(anna).getByText('3')).toBeInTheDocument();
  });

  it('nessun "MAX": il massimo offribile non compare da nessuna parte', () => {
    render(<SquadCards participants={PARTICIPANTS} />);
    expect(screen.queryByText(/max/i)).not.toBeInTheDocument();
  });

  it('con nessun partecipante non esplode, e resta un pannello leggibile', () => {
    render(<SquadCards participants={[]} />);
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  // Il tipo garantisce una mappa completa, ma sul filo arriva JSON: una
  // chiave assente non deve diventare "undefined" nel testo o una barra
  // rotta (NaN%) — deve leggersi e disegnarsi come zero.
  it('con un ruolo assente da una mappa tratta il posto come zero, non come NaN o undefined', () => {
    const incomplete = {
      id: 'p3', name: 'Carla', initial: 'C', me: false,
      budgetRemaining: 200, slotsRemaining: 25,
      filledByRole: { P: 0, D: 0, C: 0 } as ParticipantView['filledByRole'],
      slotsByRole: { P: 3, D: 8, C: 8, A: 6 },
    } as ParticipantView;

    render(<SquadCards participants={[incomplete]} />);

    expect(screen.getByTestId('composition-p3')).toHaveAccessibleName(
      '0 portieri su 3, 0 difensori su 8, 0 centrocampisti su 8, 0 attaccanti su 6',
    );
  });
});
