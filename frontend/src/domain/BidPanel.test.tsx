import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ParticipantView } from '../api/types';
import { BidPanel } from './BidPanel';

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

function panel(overrides = {}) {
  const onAssign = vi.fn();
  render(
    <BidPanel
      suggestedPrice={47}
      participants={PARTICIPANTS}
      disabled={false}
      pending={false}
      error={null}
      onAssign={onAssign}
      {...overrides}
    />,
  );
  return onAssign;
}

describe('BidPanel', () => {
  it('propone il tetto come prezzo di partenza', () => {
    panel();
    expect(screen.getByLabelText('Prezzo')).toHaveValue(47);
  });

  it('aggiudica al partecipante scelto', async () => {
    const onAssign = panel();

    await userEvent.selectOptions(screen.getByLabelText('Aggiudica a'), 'bruno');
    await userEvent.click(screen.getByRole('button', { name: 'Aggiudica' }));

    expect(onAssign).toHaveBeenCalledWith({ participantId: 'bruno', price: 47 });
  });

  it("durante l'attesa il bottone lo dice e non si puo' ripremere", () => {
    panel({ pending: true });
    const button = screen.getByRole('button', { name: /Aggiudico/ });
    expect(button).toBeDisabled();
  });

  it("l'errore compare vicino al campo, col testo del server", () => {
    panel({ error: 'Anna ha solo 12 crediti di budget residuo' });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Anna ha solo 12 crediti di budget residuo',
    );
  });

  it('da stantio non si puo aggiudicare', () => {
    panel({ disabled: true });
    expect(screen.getByRole('button', { name: 'Aggiudica' })).toBeDisabled();
  });

  // Un bottone disabilitato e' annunciato come "non disponibile" e basta: chi
  // vede lo deduce dalla scheda in tratteggio o dalla connessione persa in
  // testata, chi ascolta no. Le due ragioni sono situazioni diverse — l'attesa
  // si scioglie da sola in decine di millisecondi, lo stantio no — quindi il
  // testo deve distinguerle, non limitarsi a dire "disabilitato".
  it("durante l'attesa spiega a chi ascolta che sta aspettando il server", () => {
    panel({ pending: true });
    expect(screen.getByRole('button', { name: /Aggiudico/ })).toHaveAccessibleDescription(
      /conferma del server/i,
    );
  });

  it('da stantio spiega a chi ascolta che i dati non sono aggiornati, non che si sta aspettando', () => {
    panel({ disabled: true });
    expect(screen.getByRole('button', { name: 'Aggiudica' })).toHaveAccessibleDescription(
      /non sono aggiornati/i,
    );
  });

  it('se stantio e in attesa insieme, vince la spiegazione dell\'attesa: e\' quella che si risolve da sola', () => {
    panel({ disabled: true, pending: true });
    expect(screen.getByRole('button', { name: /Aggiudico/ })).toHaveAccessibleDescription(
      /conferma del server/i,
    );
  });

  it('quando si puo aggiudicare non porta alcuna spiegazione superflua', () => {
    panel();
    expect(screen.getByRole('button', { name: 'Aggiudica' })).toHaveAccessibleDescription('');
  });

  // useValuation (Task 11) rivaluta ogni 5 s anche il giocatore GIA'
  // selezionato: se nel frattempo qualcun altro aggiudica altrove, i budget
  // cambiano e il tetto di QUESTO giocatore puo' ricalcolarsi pur restando lo
  // stesso giocatore. BidPanel non riceve un playerId con cui distinguere
  // "e' cambiato il giocatore" da "e' stato rivalutato lo stesso": deve
  // dedurlo da cio' che ha per le mani, o rischia di cancellare in silenzio
  // un prezzo che l'utente sta scrivendo in quel preciso istante.
  it('una rivalutazione del giocatore gia\' selezionato non cancella il prezzo che si sta scrivendo', async () => {
    const onAssign = vi.fn();
    const { rerender } = render(
      <BidPanel
        suggestedPrice={47}
        participants={PARTICIPANTS}
        disabled={false}
        pending={false}
        error={null}
        onAssign={onAssign}
      />,
    );

    const input = screen.getByLabelText('Prezzo');
    await userEvent.clear(input);
    await userEvent.type(input, '60');
    expect(input).toHaveValue(60);

    // Stesso giocatore, nuova rivalutazione: il tetto e' sceso a 45.
    rerender(
      <BidPanel
        suggestedPrice={45}
        participants={PARTICIPANTS}
        disabled={false}
        pending={false}
        error={null}
        onAssign={onAssign}
      />,
    );

    expect(input).toHaveValue(60);
  });

  it('senza modifiche del campo, un nuovo tetto lo aggiorna comunque (cambio giocatore)', () => {
    const onAssign = vi.fn();
    const { rerender } = render(
      <BidPanel
        suggestedPrice={47}
        participants={PARTICIPANTS}
        disabled={false}
        pending={false}
        error={null}
        onAssign={onAssign}
      />,
    );

    rerender(
      <BidPanel
        suggestedPrice={52}
        participants={PARTICIPANTS}
        disabled={false}
        pending={false}
        error={null}
        onAssign={onAssign}
      />,
    );

    expect(screen.getByLabelText('Prezzo')).toHaveValue(52);
  });
});
