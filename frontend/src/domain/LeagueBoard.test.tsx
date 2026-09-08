import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ParticipantView } from '../api/types';
import { LeagueBoard } from './LeagueBoard';

const PARTICIPANTS: ParticipantView[] = [
  {
    id: 'anna', name: 'Anna', initial: 'A', me: true,
    budgetRemaining: 312, slotsRemaining: 17,
    filledByRole: { P: 1, D: 3, C: 0, A: 0 },
    slotsByRole: { P: 3, D: 8, C: 8, A: 6 },
  },
  {
    id: 'bruno', name: 'Bruno', initial: 'B', me: false,
    budgetRemaining: 289, slotsRemaining: 19,
    filledByRole: { P: 1, D: 2, C: 0, A: 0 },
    slotsByRole: { P: 3, D: 8, C: 8, A: 6 },
  },
];

describe('LeagueBoard', () => {
  it('mostra nome e budget di ciascuno', () => {
    render(<LeagueBoard participants={PARTICIPANTS} />);
    expect(screen.getByText('Anna')).toBeInTheDocument();
    expect(screen.getByTestId('budget-anna')).toHaveTextContent('312');
  });

  it('distingue visivamente me dagli altri', () => {
    render(<LeagueBoard participants={PARTICIPANTS} />);
    expect(screen.getByTestId('manager-anna')).toHaveAttribute('data-me', 'true');
    expect(screen.getByTestId('manager-bruno')).toHaveAttribute('data-me', 'false');
  });

  it('rende la composizione come barra segmentata, non come stringa', () => {
    render(<LeagueBoard participants={PARTICIPANTS} />);
    const bar = screen.getByTestId('composition-anna');
    expect(bar.querySelectorAll('[data-role]')).toHaveLength(4);
    expect(screen.queryByText('1P 3D 0C 0A')).not.toBeInTheDocument();
  });

  it('la barra resta comprensibile senza vederla', () => {
    render(<LeagueBoard participants={PARTICIPANTS} />);
    expect(screen.getByTestId('composition-anna')).toHaveAccessibleName(
      '1 portiere su 3, 3 difensori su 8, 0 centrocampisti su 8, 0 attaccanti su 6',
    );
  });

  // Il bordo colorato (border-accent contro border-line) distingue "questo
  // sei tu" solo per chi vede quello schermo, ed e' il fatto piu' importante
  // della riga: dove sto giocando io. Verifichiamo il testo annunciato, non
  // un attributo: data-me e' gia' testato sopra, ma e' un data-*, non entra
  // nell'albero di accessibilita' e nessuno screen reader lo legge.
  it('segnala "sei tu" anche a chi non vede, non solo col colore del bordo', () => {
    render(<LeagueBoard participants={PARTICIPANTS} />);
    expect(within(screen.getByTestId('manager-anna')).getByText(/sei tu/)).toBeInTheDocument();
    expect(
      within(screen.getByTestId('manager-bruno')).queryByText(/sei tu/),
    ).not.toBeInTheDocument();
  });

  it('con nessun partecipante non esplode, e resta un pannello leggibile', () => {
    render(<LeagueBoard participants={[]} />);
    expect(screen.getByRole('heading', { name: 'Chi ha cosa' })).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  // Il tipo garantisce una mappa completa, ma sul filo arriva JSON: una
  // chiave assente non deve diventare "undefined" nel testo o una barra
  // rotta (NaN%) — deve leggersi e disegnarsi come zero.
  it('con un ruolo assente da una mappa tratta il posto come zero, non come NaN o undefined', () => {
    const incomplete = {
      id: 'carla', name: 'Carla', initial: 'C', me: false,
      budgetRemaining: 200, slotsRemaining: 25,
      filledByRole: { P: 0, D: 0, C: 0 } as ParticipantView['filledByRole'],
      slotsByRole: { P: 3, D: 8, C: 8, A: 6 },
    } as ParticipantView;

    render(<LeagueBoard participants={[incomplete]} />);

    expect(screen.getByTestId('composition-carla')).toHaveAccessibleName(
      '0 portieri su 3, 0 difensori su 8, 0 centrocampisti su 8, 0 attaccanti su 6',
    );
  });
});
