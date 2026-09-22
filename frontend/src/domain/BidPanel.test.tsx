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
  /**
   * Niente precompilato: con prezzo 1 e la propria squadra gia' scelti, un
   * «Aggiudica» premuto per sbaglio registrava un acquisto vero. Il tetto non si
   * propone mai come prezzo.
   */
  it('parte vuoto: prezzo e squadra si scelgono, e fino ad allora non si aggiudica', async () => {
    panel();
    expect(screen.getByLabelText('Prezzo')).toHaveValue(null);
    expect(screen.getByLabelText('Aggiudica a')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Aggiudica' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Prezzo'), '3');
    expect(screen.getByRole('button', { name: 'Aggiudica' })).toBeDisabled();
  });

  it('aggiudica al partecipante scelto, al prezzo scritto', async () => {
    const onAssign = panel();

    await userEvent.type(screen.getByLabelText('Prezzo'), '7');
    await userEvent.selectOptions(screen.getByLabelText('Aggiudica a'), 'bruno');
    await userEvent.click(screen.getByRole('button', { name: 'Aggiudica' }));

    expect(onAssign).toHaveBeenCalledWith({ participantId: 'bruno', price: 7 });
  });

  /** Il server rifiuterebbe: lo si dice prima dell'invio. */
  it('avvisa se la squadra scelta non puo permettersi il prezzo', async () => {
    panel();
    // Anna: 312 crediti, 17 posti liberi -> al massimo 296.
    await userEvent.type(screen.getByLabelText('Prezzo'), '300');
    await userEvent.selectOptions(screen.getByLabelText('Aggiudica a'), 'anna');
    expect(screen.getByText('Anna può offrire al massimo 296.')).toBeInTheDocument();
  });

  it('avvisa se la squadra ha gia tutti i posti di quel ruolo', async () => {
    panel({ participants: [{ ...PARTICIPANTS[0], filledByRole: { P: 3, D: 3, C: 0, A: 0 } }], role: 'P' });
    await userEvent.selectOptions(screen.getByLabelText('Aggiudica a'), 'anna');
    expect(screen.getByText('Anna ha già tutti i posti portieri.')).toBeInTheDocument();
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

  // Vicino nel DOM non basta: il dispaccio chiede un'associazione
  // programmatica, cosi' che chi ascolta senta l'errore leggendo il campo,
  // non solo chi legge la pagina dall'alto in basso. La proprieta' da
  // verificare e' quella che uno screen reader calcola davvero: la
  // descrizione accessibile del campo, non la presenza dell'attributo.
  it("l'errore e' associato al campo via aria-describedby, non solo vicino nel DOM", () => {
    panel({ error: 'Anna ha solo 12 crediti di budget residuo' });
    expect(screen.getByLabelText('Prezzo')).toHaveAccessibleDescription(
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
      /attendi la conferma/i,
    );
  });

  it('da stantio spiega a chi ascolta che i dati non sono aggiornati, non che si sta aspettando', () => {
    panel({ disabled: true });
    expect(screen.getByRole('button', { name: 'Aggiudica' })).toHaveAccessibleDescription(
      /non sono aggiornati/i,
    );
  });

  it("se stantio e in attesa insieme, vince la spiegazione dell'attesa: e' quella che si risolve da sola", () => {
    panel({ disabled: true, pending: true });
    expect(screen.getByRole('button', { name: /Aggiudico/ })).toHaveAccessibleDescription(
      /attendi la conferma/i,
    );
  });

  it('quando si puo aggiudicare non porta alcuna spiegazione superflua', () => {
    panel();
    expect(screen.getByRole('button', { name: 'Aggiudica' })).toHaveAccessibleDescription('');
  });

  /** Se la squadra scelta sparisce dall'elenco, la scelta si azzera: niente id orfani. */
  it('se la squadra scelta sparisce dall elenco, la scelta si azzera', async () => {
    const onAssign = vi.fn();
    const { rerender } = render(
      <BidPanel participants={PARTICIPANTS} disabled={false} pending={false} error={null} onAssign={onAssign} />,
    );
    await userEvent.selectOptions(screen.getByLabelText('Aggiudica a'), 'bruno');
    rerender(
      <BidPanel participants={[PARTICIPANTS[0]]} disabled={false} pending={false} error={null} onAssign={onAssign} />,
    );
    expect(screen.getByLabelText('Aggiudica a')).toHaveValue('');
  });

  // Un refetch che ridisegna lo stesso elenco con un nuovo riferimento
  // d'array non deve cancellare una scelta dell'utente ancora valida: la
  // risincronizzazione e' per quando la scelta sparisce dalla lista, non un
  // motivo per rifare la scelta ogni volta che la lista si ridisegna.
  it("un refetch che riporta lo stesso elenco non cancella la scelta gia' fatta dall'utente", async () => {
    const onAssign = vi.fn();
    const { rerender } = render(
      <BidPanel
        participants={PARTICIPANTS}
        disabled={false}
        pending={false}
        error={null}
        onAssign={onAssign}
      />,
    );

    await userEvent.type(screen.getByLabelText('Prezzo'), '1');
    await userEvent.selectOptions(screen.getByLabelText('Aggiudica a'), 'bruno');

    // Stessi partecipanti, nuovo riferimento d'array: cosi' arriva un refetch.
    rerender(
      <BidPanel
        participants={[...PARTICIPANTS]}
        disabled={false}
        pending={false}
        error={null}
        onAssign={onAssign}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Aggiudica' }));

    expect(onAssign).toHaveBeenCalledWith({ participantId: 'bruno', price: 1 });
  });

  // Il campo e' dell'utente e di nessun altro: una volta scritto un prezzo,
  // niente lo sovrascrive finche' resta in scena lo stesso giocatore. Prima il
  // pannello inseguiva il tetto a ogni rivalutazione (ogni 5 s), e per non
  // cancellare quello che si stava scrivendo serviva un flag "toccato" e tre
  // test a coprirlo: senza una proposta da inseguire, il problema non esiste.
  it('il prezzo scritto resta: niente lo sovrascrive', async () => {
    const onAssign = vi.fn();
    const { rerender } = render(
      <BidPanel
        participants={PARTICIPANTS}
        disabled={false}
        pending={false}
        error={null}
        onAssign={onAssign}
      />,
    );

    const input = screen.getByLabelText('Prezzo');
    await userEvent.type(input, '60');

    // Una rivalutazione ridisegna il pannello: il prezzo scritto non si muove.
    rerender(
      <BidPanel
        participants={[...PARTICIPANTS]}
        disabled={false}
        pending={false}
        error={null}
        onAssign={onAssign}
      />,
    );

    expect(input).toHaveValue(60);
  });
});
