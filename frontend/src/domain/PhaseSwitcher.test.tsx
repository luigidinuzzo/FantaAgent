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
  // il bottone e basta, senza dire a nessuno perche'. Rimane vero (vedi
  // AuctionRoute.test.tsx), ma il componente stesso non porta piu' un
  // role="alert" proprio (revisione finale, finding B): mai un alert qui,
  // per costruzione — non serve piu' un prop `error` da verificare.
  it('non rende mai un alert proprio: l\'errore di un cambio fase e\' composto dalla rotta', () => {
    render(
      <PhaseSwitcher phases={['P', 'D', 'C', 'A']} current="D" onChange={() => {}} pending={false} />,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
