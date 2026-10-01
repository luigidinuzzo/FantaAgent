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

  // Inchiodata in basso, in ogni vista e a ogni scorrimento: sticky la lasciava
  // sotto il contenuto quando la vista era piu' corta dello schermo.
  it('sta ferma in fondo allo schermo, da bordo a bordo, sopra la zona sicura', () => {
    render(<PhoneViewBar view="banco" onChange={() => {}} controls={CONTROLS} />);
    const bar = screen.getByRole('tablist', { name: "Viste dell'asta" }).parentElement!;
    for (const c of ['max-lg:fixed', 'inset-x-0', 'bottom-0', 'pb-[env(safe-area-inset-bottom)]', 'lg:hidden']) {
      expect(bar.className).toContain(c);
    }
    expect(bar.className).not.toContain('sticky');
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

  // Ogni scheda ha un id suo; aria-controls solo dove la vista e' davvero un
  // pannello di schede. Banco e Squadre sono sezioni con un nome loro: puntarle
  // da una scheda prometterebbe un tabpanel che non c'e'.
  it('ogni scheda ha un id, e aria-controls solo per le viste che sono pannelli', () => {
    render(<PhoneViewBar view="banco" onChange={() => {}} controls={{ giocatori: 'p-g', rose: 'p-r' }} />);
    expect(screen.getByRole('tab', { name: 'Banco' })).toHaveAttribute('id', 'vista-banco');
    expect(screen.getByRole('tab', { name: 'Giocatori' })).toHaveAttribute('id', 'vista-giocatori');
    expect(screen.getByRole('tab', { name: 'Squadre' })).toHaveAttribute('id', 'vista-squadre');
    expect(screen.getByRole('tab', { name: 'Rose' })).toHaveAttribute('id', 'vista-rose');
    expect(screen.getByRole('tab', { name: 'Banco' })).not.toHaveAttribute('aria-controls');
    expect(screen.getByRole('tab', { name: 'Squadre' })).not.toHaveAttribute('aria-controls');
    expect(screen.getByRole('tab', { name: 'Giocatori' })).toHaveAttribute('aria-controls', 'p-g');
    expect(screen.getByRole('tab', { name: 'Rose' })).toHaveAttribute('aria-controls', 'p-r');
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
