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

  /**
   * Quattro lettere colorate non dicevano cosa si stava chiamando a chi non le
   * conosceva gia'. Da schermo largo il nome e' scritto; la corrente si stacca per
   * fondo e per il filetto del suo ruolo, non per colore da solo.
   */
  it('la fase porta il suo nome, e la corrente si stacca per fondo', () => {
    render(<PhaseSwitcher phases={['P', 'D', 'C', 'A']} current="D" onChange={() => {}} pending={false} />);

    const corrente = screen.getByRole('button', { name: /difensori, fase corrente/i });
    const altra = screen.getByRole('button', { name: /^attaccanti$/i });
    expect(corrente).toHaveTextContent('Difensori');
    expect(altra).toHaveTextContent('Attaccanti');
    expect(corrente.className).toContain('bg-surface-raised');
    expect(altra.className).not.toContain('bg-surface-raised');
  });

  /**
   * Le fasi non correnti arretrano per taglia e per contorno, MAI per opacita'.
   *
   * <p>Misurato con lo stesso metodo di contrast.test.ts: smorzate al 40% le
   * lettere dei ruoli scendono fra 2,1 e 2,6 contro 1 sul fondo dei pannelli,
   * dove la soglia e' 4,5. Anche al 70% gli attaccanti restano a 3,94. Un
   * elemento che arretra non e' un elemento che si smette di poter leggere: qui
   * dentro ci sono le quattro lettere con cui si cambia fase.
   */
  it('le fasi non correnti non si smorzano: restano leggibili', () => {
    const { container } = render(
      <PhaseSwitcher phases={['P', 'D', 'C', 'A']} current="D" onChange={() => {}} pending={false} />,
    );
    expect(container.innerHTML).not.toMatch(/opacity-[0-9]/);
  });
});
