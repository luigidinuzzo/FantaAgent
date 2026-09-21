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
  // Il tetto e' il punto oltre il quale NON conviene, non il prezzo a cui si
  // aggiudica: proporlo nel campo suggeriva di pagare sempre il massimo, e un
  // invio distratto registrava il tetto al posto del prezzo vero — che per i
  // giocatori che nessuno contende e' quasi sempre uno. Il tetto resta grande
  // e in evidenza nella scheda, dove si consulta.
  it('parte da uno, non dal tetto', () => {
    panel();
    expect(screen.getByLabelText('Prezzo')).toHaveValue(1);
  });

  it('aggiudica al partecipante scelto', async () => {
    const onAssign = panel();

    await userEvent.selectOptions(screen.getByLabelText('Aggiudica a'), 'bruno');
    await userEvent.click(screen.getByRole('button', { name: 'Aggiudica' }));

    expect(onAssign).toHaveBeenCalledWith({ participantId: 'bruno', price: 1 });
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

  // La route (Task 17) monta questo pannello con participants=[] finche' la
  // query dei partecipanti non risolve, e nessuna delle due chiamate cambia
  // istanza (nessun key): se la selezione iniziale, calcolata una volta sola
  // dall'array vuoto, non si risincronizza quando i dati arrivano, resta ''
  // per sempre. Il <select> del browser mostrerebbe comunque la prima
  // opzione — sembra scelta — mentre un invio senza toccare il menu manda
  // participantId: '' nel registro d'aggiudicazione: una scrittura corrotta
  // sul percorso piu' comune, assegnare a se stessi.
  it('i partecipanti arrivano dopo il mount: la selezione segue i dati invece di restare vuota per sempre', async () => {
    const onAssign = vi.fn();
    const { rerender } = render(
      <BidPanel
        participants={[]}
        disabled={false}
        pending={false}
        error={null}
        onAssign={onAssign}
      />,
    );

    rerender(
      <BidPanel
        participants={PARTICIPANTS}
        disabled={false}
        pending={false}
        error={null}
        onAssign={onAssign}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Aggiudica' }));

    expect(onAssign).toHaveBeenCalledWith({ participantId: 'anna', price: 1 });
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
    await userEvent.clear(input);
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
