import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ParticipantSettings } from '../api/types';
import { ParticipantsFieldset } from './ParticipantsFieldset';

function Harness({ initial }: { initial: ParticipantSettings[] }) {
  const [value, setValue] = useState(initial);
  return <ParticipantsFieldset value={value} onChange={setValue} errors={{}} />;
}

describe('ParticipantsFieldset', () => {
  afterEach(() => vi.unstubAllGlobals());

  /**
   * L'iniziale duplicata riguarda l'insieme, non una riga (chiave
   * {@code "participants"}): resta descritta dal fieldset. Una <legend> fornisce
   * il NOME accessibile del fieldset; descriverla con aria-describedby non e' una
   * relazione garantita dagli screen reader. E' il <fieldset> — un group — che
   * supporta davvero una descrizione.
   */
  it("descrive gli errori dell'insieme sul fieldset, non sulla legend", () => {
    render(
      <ParticipantsFieldset
        value={[{ id: 'anna', name: 'Anna', initial: 'A', me: true }]}
        onChange={() => {}}
        errors={{ participants: ["L'iniziale «A» è usata da più partecipanti."] }}
      />,
    );

    const group = screen.getByRole('group', { name: 'Partecipanti' });
    expect(group).toHaveAccessibleDescription(/iniziale «a» è usata/i);
  });

  /**
   * Un nome vuoto riguarda UNA riga precisa (task 16): l'errore sta accanto al
   * SUO input, non nell'elenco generico dell'insieme.
   */
  it('descrive un nome vuoto sul suo input', () => {
    render(
      <ParticipantsFieldset
        value={[{ id: 'anna', name: '', initial: 'A', me: true }]}
        onChange={() => {}}
        errors={{ 'participants[anna].name': ['Il partecipante con id «anna» non può avere un nome vuoto.'] }}
      />,
    );

    const field = screen.getByLabelText(/nome del partecipante/i);
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription(/nome vuoto/i);
  });

  /**
   * A vista il bottone e' solo una X: il nome accessibile deve dire cosa fa e
   * QUALE riga toglie. getByRole con `name` e' l'unica verifica che lo scopre —
   * un'asserzione su textContent passerebbe anche con "TogliAnna" attaccato.
   */
  it('il bottone X ha per nome accessibile "Togli" seguito dal nome della riga, e nessun testo visibile', () => {
    render(
      <ParticipantsFieldset
        value={[{ id: 'anna', name: 'Anna', initial: 'A', me: true }]}
        onChange={() => {}}
        errors={{}}
      />,
    );

    const remove = screen.getByRole('button', { name: 'Togli Anna' });
    expect(remove.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    // Tutto il testo del bottone e' per chi ascolta: a vista resta la X.
    remove.querySelectorAll(':scope > :not(.sr-only):not(svg)').forEach((el) => {
      expect(el.textContent).toBe('');
    });
    expect(
      Array.from(remove.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim()),
    ).toHaveLength(0);
  });

  it('"Sei tu" resta un radio col nome della riga', () => {
    render(
      <ParticipantsFieldset
        value={[{ id: 'anna', name: 'Anna', initial: 'A', me: true }]}
        onChange={() => {}}
        errors={{}}
      />,
    );

    expect(screen.getByRole('radio', { name: 'Sei tu: Anna' })).toBeChecked();
  });

  /**
   * crypto.randomUUID() non esiste fuori da un contesto sicuro — plausibile su
   * http:// da un tablet in LAN la sera dell'asta. "Aggiungi partecipante" non
   * deve lanciare in quel caso.
   */
  it('aggiunge un partecipante anche senza crypto.randomUUID', async () => {
    const originalCrypto = globalThis.crypto;
    vi.stubGlobal('crypto', { ...originalCrypto, randomUUID: undefined });

    render(<Harness initial={[]} />);

    await userEvent.click(screen.getByRole('button', { name: /aggiungi partecipante/i }));

    expect(await screen.findByLabelText(/nome del partecipante/i)).toBeInTheDocument();
  });
  it('con lockCount non si aggiungono né si tolgono righe, ma i nomi restano modificabili', () => {
    render(
      <ParticipantsFieldset
        value={[{ id: 'anna', name: 'Anna', initial: 'A', me: true }]}
        onChange={() => {}}
        errors={{}}
        lockCount
      />,
    );
    expect(screen.queryByRole('button', { name: /aggiungi partecipante/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Togli Anna' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Nome del partecipante')).not.toBeDisabled();
  });


  /**
   * L'iniziale non si chiede piu': la calcola il server dal nome. Nella schermata
   * restano nome, «sei tu» e la X.
   */
  it('non chiede l iniziale', () => {
    render(
      <ParticipantsFieldset
        value={[{ id: 'anna', name: 'Anna', initial: 'A', me: true }]}
        onChange={() => {}}
        errors={{}}
      />,
    );
    expect(screen.queryByLabelText(/iniziale/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Iniziale')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Nome del partecipante')).toBeInTheDocument();
  });
});
