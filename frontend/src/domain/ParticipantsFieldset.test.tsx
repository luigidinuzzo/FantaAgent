import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ParticipantSettings } from '../api/types';
import { ParticipantsFieldset } from './ParticipantsFieldset';

function Harness({ initial }: { initial: ParticipantSettings[] }) {
  const [value, setValue] = useState(initial);
  return <ParticipantsFieldset value={value} onChange={setValue} errors={[]} />;
}

describe('ParticipantsFieldset', () => {
  afterEach(() => vi.unstubAllGlobals());

  /**
   * Una <legend> fornisce il NOME accessibile del fieldset; descriverla con
   * aria-describedby non e' una relazione garantita dagli screen reader. E' il
   * <fieldset> — un group — che supporta davvero una descrizione.
   */
  it('descrive gli errori sul fieldset, non sulla legend', () => {
    render(
      <ParticipantsFieldset
        value={[{ id: 'anna', name: 'Anna', initial: 'A', me: true }]}
        onChange={() => {}}
        errors={["L'iniziale «A» è usata da più partecipanti."]}
      />,
    );

    const group = screen.getByRole('group', { name: 'Partecipanti' });
    expect(group).toHaveAccessibleDescription(/iniziale «a» è usata/i);
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
});
