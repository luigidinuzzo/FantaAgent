import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PhasePager } from './PhasePager';

describe('PhasePager', () => {
  it('non mostra nulla quando la fase ha una sola pagina', () => {
    render(
      <PhasePager
        offset={0} pageSize={25} total={10}
        hasPrevious={false} hasNext={false}
        onPrevious={() => {}} onNext={() => {}}
      />,
    );
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('mostra il conteggio con le cifre tabulari', () => {
    render(
      <PhasePager
        offset={25} pageSize={25} total={60}
        hasPrevious={true} hasNext={true}
        onPrevious={() => {}} onNext={() => {}}
      />,
    );
    const count = screen.getByText('26–50 di 60');
    expect(count).toHaveClass('tnum');
  });

  it('sulla prima pagina il bottone precedente e spento e dice perche', () => {
    render(
      <PhasePager
        offset={0} pageSize={25} total={60}
        hasPrevious={false} hasNext={true}
        onPrevious={() => {}} onNext={() => {}}
      />,
    );
    const prev = screen.getByRole('button', { name: /precedente/i });
    expect(prev).toBeDisabled();
    expect(prev).toHaveAccessibleDescription(/prima pagina/i);
    expect(screen.getByRole('button', { name: /successiva/i })).not.toBeDisabled();
  });

  it('sulla ultima pagina il bottone successiva e spento e dice perche', () => {
    render(
      <PhasePager
        offset={50} pageSize={25} total={60}
        hasPrevious={true} hasNext={false}
        onPrevious={() => {}} onNext={() => {}}
      />,
    );
    const next = screen.getByRole('button', { name: /successiva/i });
    expect(next).toBeDisabled();
    expect(next).toHaveAccessibleDescription(/ultima pagina/i);
  });

  it('i due bottoni chiamano i rispettivi callback', async () => {
    const onPrevious = vi.fn();
    const onNext = vi.fn();
    render(
      <PhasePager
        offset={25} pageSize={25} total={60}
        hasPrevious={true} hasNext={true}
        onPrevious={onPrevious} onNext={onNext}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /precedente/i }));
    await userEvent.click(screen.getByRole('button', { name: /successiva/i }));
    expect(onPrevious).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
