import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { RulesSection } from '../api/types';
import { LeagueRulesFieldset } from './LeagueRulesFieldset';

const RULES: RulesSection = { budget: 500, slots: { P: 3, D: 8, C: 8, A: 6 } };

function Harness({ disabled = false, onValue }: { disabled?: boolean; onValue?: (r: RulesSection) => void }) {
  const [value, setValue] = useState(RULES);
  return (
    <LeagueRulesFieldset
      value={value}
      onChange={(next) => { setValue(next); onValue?.(next); }}
      participants={7}
      errors={{}}
      disabled={disabled}
    />
  );
}

describe('LeagueRulesFieldset', () => {
  it('crediti a passi di 10 e slot a passi di 1', async () => {
    let last: RulesSection | null = null;
    render(<Harness onValue={(r) => { last = r; }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Dieci crediti in più' }));
    expect(screen.getByLabelText('Crediti per squadra')).toHaveValue(510);
    await userEvent.click(screen.getByRole('button', { name: 'Uno slot in meno: difensori' }));
    expect(last!.slots.D).toBe(7);
  });

  it('le squadre sono i partecipanti, in sola lettura', () => {
    render(<Harness />);
    const group = screen.getByRole('group', { name: 'Regole della lega' });
    expect(within(group).getByText('7')).toBeInTheDocument();
    expect(within(group).getByText('squadre')).toBeInTheDocument();
    expect(within(group).queryByLabelText(/squadre/i)).not.toBeInTheDocument();
  });

  it('ad asta aperta i campi sono bloccati e dicono perche', () => {
    render(<Harness disabled />);
    const budget = screen.getByLabelText('Crediti per squadra');
    expect(budget).toBeDisabled();
    expect(budget).toHaveAccessibleDescription(
      'Asta in corso: crediti, slot e numero di squadre sono bloccati, perché cambiarli ricalcolerebbe budget e rose già pagate.',
    );
    expect(screen.getByRole('button', { name: 'Dieci crediti in più' })).toBeDisabled();
  });

  it('un errore di slot sta accanto al suo campo', () => {
    render(
      <LeagueRulesFieldset
        value={RULES}
        onChange={() => {}}
        participants={7}
        errors={{ 'slots[P]': ['Gli slot dei portieri devono essere fra 1 e 30: indicati 0.'] }}
        disabled={false}
      />,
    );
    // Per ruolo, non per nome visibile: chi ascolta sente «Slot portieri», non la
    // lettera colorata con il singolare di RoleBadge.
    expect(screen.getByRole('spinbutton', { name: 'Slot portieri' })).toHaveAccessibleDescription(/fra 1 e 30/);
  });

  /** Le tre sezioni del modulo si somigliano: cornice e titolo in evidenza. */
  it('e una sezione con cornice e titolo, come Partecipanti e Punteggio', () => {
    const { container } = render(<Harness />);
    const fieldset = container.querySelector('fieldset');
    expect(fieldset?.className).toContain('border-line-strong');
    expect(fieldset?.className).not.toContain('border-0');
    expect(screen.getByText('Regole della lega').tagName).toBe('LEGEND');
  });
});
