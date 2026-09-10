import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PhaseSwitcher } from './PhaseSwitcher';

describe('PhaseSwitcher', () => {
  it('segnala la fase corrente a chi ascolta, non solo col colore', () => {
    render(<PhaseSwitcher phases={['P', 'D', 'C', 'A']} current="D" onChange={() => {}} pending={false} />);
    expect(screen.getByRole('button', { name: /difensori, fase corrente/i })).toBeInTheDocument();
  });

  it('cambia fase quando si sceglie', async () => {
    const onChange = vi.fn();
    render(<PhaseSwitcher phases={['P', 'D', 'C', 'A']} current="D" onChange={onChange} pending={false} />);
    await userEvent.click(screen.getByRole('button', { name: /^centrocampisti$/i }));
    expect(onChange).toHaveBeenCalledWith('C');
  });

  it("durante l'attesa non si puo' ripremere", () => {
    render(<PhaseSwitcher phases={['P', 'D', 'C', 'A']} current="D" onChange={() => {}} pending />);
    expect(screen.getByRole('button', { name: /^attaccanti$/i })).toBeDisabled();
  });

  // Fix round 2 (revisione finale): un cambio fase rifiutato rieffettivava
  // il bottone e basta, senza dire a nessuno perche'. Stessa disciplina
  // dell'errore di aggiudicazione in BidPanel/BidderDialog: role="alert"
  // puntuale, non una seconda live region ambientale.
  it('mostra un cambio fase rifiutato, anche a chi ascolta', () => {
    render(
      <PhaseSwitcher
        phases={['P', 'D', 'C', 'A']}
        current="D"
        onChange={() => {}}
        pending={false}
        error="Non puoi cambiare fase: ci sono lotti ancora aperti"
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Non puoi cambiare fase: ci sono lotti ancora aperti',
    );
  });

  it('senza errore non mostra nessun alert', () => {
    render(
      <PhaseSwitcher phases={['P', 'D', 'C', 'A']} current="D" onChange={() => {}} pending={false} error={null} />,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
