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

  /**
   * Un pannello solo con le righe separate da una linea: otto card dentro una card
   * erano otto cornici in piu' da leggere. La tua riga si riconosce dal fondo e dal
   * filetto oro a sinistra, oltre che a parole.
   */
  it('le squadre sono righe a ogni misura di un pannello solo, la tua col filetto oro', () => {
    render(<ParticipantsColumn participants={[ANNA, CARLA]} phase="C" />);
    const rows = screen.getAllByRole('listitem');
    rows.forEach((row) => expect(row.className).toContain('border-b'));
    const mine = rows.find((row) => row.getAttribute('data-me') === 'true')!;
    expect(mine.className).toContain('border-l-accent');
    expect(mine.className).toContain('bg-surface-raised');
  });

  // Il nome intero: «Atletico Ma No…» non si riconosceva a colpo d'occhio.
  it('il nome della squadra va su due righe invece di troncarsi', () => {
    render(<ParticipantsColumn participants={[ANNA, CARLA]} phase="C" />);
    const name = screen.getAllByRole('listitem')[0].querySelector('[data-testid="team-name"]')!;
    expect(name.className).toContain('line-clamp-2');
    expect(name.className).not.toMatch(/(^| )truncate( |$)/);
  });

  /**
   * Le righe valgono a ogni misura: sul telefono le squadre hanno una vista tutta
   * loro, non c'e' piu' la fila di card che scorre di lato.
   */
  it('le righe valgono a ogni misura: nessuna classe della fila di card sotto lg', () => {
    render(<ParticipantsColumn participants={[ANNA, CARLA]} phase="C" />);
    const carlaRow = screen.getByTestId('manager-carla');
    expect(carlaRow.className).toContain('border-l-transparent');
    expect(carlaRow.className).not.toContain('max-lg:');
    const carlaBudget = screen.getByTestId('budget-carla');
    expect(carlaBudget.className).toContain('text-foreground');
    expect(carlaBudget.className).not.toContain('text-muted-foreground');
    expect(carlaBudget.className).toMatch(/(^| )font-semibold( |$)/);
    expect(screen.getAllByTestId('team-name')[0].className).not.toContain('max-lg:truncate');
    expect(screen.getByRole('list').className).not.toContain('max-lg:');
  });
});
