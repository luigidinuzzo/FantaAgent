import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ParticipantsFieldset } from './ParticipantsFieldset';

describe('ParticipantsFieldset', () => {
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
});
