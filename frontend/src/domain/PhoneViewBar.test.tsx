import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PhoneViewBar } from './PhoneViewBar';

const CONTROLS = { banco: 'v-banco', giocatori: 'v-giocatori', squadre: 'v-squadre', rose: 'v-rose' };

describe('PhoneViewBar', () => {
  it('quattro schede, la scelta selezionata e in oro', () => {
    render(<PhoneViewBar view="giocatori" onChange={() => {}} controls={CONTROLS} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Banco', 'Giocatori', 'Squadre', 'Rose']);
    const current = screen.getByRole('tab', { name: 'Giocatori' });
    expect(current).toHaveAttribute('aria-selected', 'true');
    expect(current).toHaveAttribute('aria-controls', 'v-giocatori');
    expect(current.className).toContain('text-accent');
    expect(current).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Banco' })).toHaveAttribute('tabindex', '-1');
  });

  it('solo sul telefono', () => {
    render(<PhoneViewBar view="banco" onChange={() => {}} controls={CONTROLS} />);
    expect(screen.getByRole('tablist', { name: "Viste dell'asta" }).parentElement?.className).toContain('lg:hidden');
  });

  it('le frecce scelgono la vista vicina e ci portano il fuoco', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<PhoneViewBar view="banco" onChange={onChange} controls={CONTROLS} />);
    screen.getByRole('tab', { name: 'Banco' }).focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('rose');
    rerender(<PhoneViewBar view="rose" onChange={onChange} controls={CONTROLS} />);
    expect(screen.getByRole('tab', { name: 'Rose' })).toHaveFocus();
  });

  it('i bersagli sono alti 64px', () => {
    render(<PhoneViewBar view="banco" onChange={() => {}} controls={CONTROLS} />);
    screen.getAllByRole('tab').forEach((t) => expect(t.className).toContain('min-h-16'));
  });

  it('Home e End vanno alla prima e all\'ultima vista', async () => {
    const onChange = vi.fn();
    render(<PhoneViewBar view="giocatori" onChange={onChange} controls={CONTROLS} />);
    screen.getByRole('tab', { name: 'Giocatori' }).focus();
    await userEvent.keyboard('{End}');
    expect(onChange).toHaveBeenLastCalledWith('rose');
    await userEvent.keyboard('{Home}');
    expect(onChange).toHaveBeenLastCalledWith('banco');
  });

  it('un cambio di vista da fuori non ruba il fuoco', () => {
    const { rerender } = render(
      <div>
        <button type="button">altrove</button>
        <PhoneViewBar view="banco" onChange={() => {}} controls={CONTROLS} />
      </div>,
    );
    screen.getByRole('button', { name: 'altrove' }).focus();
    rerender(
      <div>
        <button type="button">altrove</button>
        <PhoneViewBar view="squadre" onChange={() => {}} controls={CONTROLS} />
      </div>,
    );
    expect(screen.getByRole('button', { name: 'altrove' })).toHaveFocus();
  });
});
