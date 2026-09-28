import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ParticipantView } from '../api/types';
import { ParticipantsColumn } from './ParticipantsColumn';

const ANNA: ParticipantView = {
  id: 'anna', name: 'Anna', initial: 'A', me: true,
  budgetRemaining: 312, slotsRemaining: 17,
  filledByRole: { P: 1, D: 3, C: 0, A: 0 },
  slotsByRole: { P: 3, D: 8, C: 8, A: 6 },
};

/** Carla ha gia' i tre portieri: in fase P non rilancera'. */
const CARLA: ParticipantView = {
  id: 'carla', name: 'Carla', initial: 'C', me: false,
  budgetRemaining: 200, slotsRemaining: 9,
  filledByRole: { P: 3, D: 8, C: 3, A: 2 },
  slotsByRole: { P: 3, D: 8, C: 8, A: 6 },
};

describe('ParticipantsColumn', () => {
  it('nome e crediti di ogni squadra, e la tua si riconosce anche a parole', () => {
    render(<ParticipantsColumn participants={[ANNA, CARLA]} />);
    expect(screen.getByTestId('budget-anna')).toHaveTextContent('312');
    expect(within(screen.getByTestId('manager-anna')).getByText(', sei tu')).toBeInTheDocument();
  });

  /**
   * La domanda che decide un rilancio non e' solo «quanto ha in tasca», e'
   * «gli serve ancora?». Una squadra con i posti del ruolo pieni non alzera' mai,
   * per quanti crediti abbia: leggerne solo i crediti faceva sopravvalutare la
   * concorrenza a ogni chiamata.
   */
  it('dice quanti posti del ruolo in corso restano a ogni squadra', () => {
    render(<ParticipantsColumn participants={[ANNA, CARLA]} phase="P" />);
    expect(screen.getByTestId('manager-anna')).toHaveTextContent('cerca 2 portieri');
  });

  it('chi ha i posti del ruolo pieni lo dice, e non si conta piu fra i rivali', () => {
    render(<ParticipantsColumn participants={[ANNA, CARLA]} phase="P" />);
    expect(screen.getByTestId('manager-carla')).toHaveTextContent('portieri al completo');
  });

  it('un posto solo si dice al singolare', () => {
    const uno = { ...ANNA, filledByRole: { ...ANNA.filledByRole, P: 2 } };
    render(<ParticipantsColumn participants={[uno]} phase="P" />);
    expect(screen.getByTestId('manager-anna')).toHaveTextContent('cerca 1 portiere');
  });

  /** Ad asta conclusa non c'e' nessuna fase in corso: la riga resta com'era. */
  it('senza fase in corso resta nome e crediti', () => {
    render(<ParticipantsColumn participants={[ANNA]} />);
    expect(screen.getByTestId('manager-anna')).not.toHaveTextContent('cerca');
  });
});
