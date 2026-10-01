import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

describe('Modal', () => {
  it('chiusa non c e', () => {
    render(<Modal open={false} titleId="t" title="Crea una lega" onClose={() => {}}>x</Modal>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // jsdom non trasforma Esc in cancel come fa il browser: si lancia l'evento a mano.
  it('aperta e una finestra col suo titolo, e Esc (cancel) chiama onClose', () => {
    const onClose = vi.fn();
    render(<Modal open titleId="t" title="Crea una lega" onClose={onClose}><input aria-label="Nome" /></Modal>);
    const dialog = screen.getByRole('dialog', { name: 'Crea una lega' });
    expect(dialog).toBeInTheDocument();
    const cancel = new Event('cancel', { cancelable: true });
    fireEvent(dialog, cancel);
    expect(onClose).toHaveBeenCalled();
    expect(cancel.defaultPrevented).toBe(true);
  });

  it('ha un bottone Chiudi', async () => {
    const onClose = vi.fn();
    render(<Modal open titleId="t" title="T" onClose={onClose}>x</Modal>);
    await userEvent.click(screen.getByRole('button', { name: 'Chiudi' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('sotto sm a tutto schermo, da sm larga 32rem', () => {
    render(<Modal open titleId="t" title="T" onClose={() => {}}>x</Modal>);
    const cls = screen.getByRole('dialog').className;
    expect(cls).toContain('max-sm:h-dvh');
    expect(cls).toContain('sm:w-[32rem]');
  });
});
