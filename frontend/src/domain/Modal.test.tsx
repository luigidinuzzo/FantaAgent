import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
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

  // Chiusa, la finestra si smonta prima che il browser possa riportare il fuoco:
  // lo riporta lei al bottone che l'ha aperta, con Esc come con «Chiudi».
  it('chiusa, il fuoco torna al bottone che l ha aperta', async () => {
    function Opener() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Crea una lega</button>
          <Modal open={open} titleId="t" title="Crea una lega" onClose={() => setOpen(false)}>
            <input aria-label="Nome" />
          </Modal>
        </>
      );
    }
    render(<Opener />);
    const opener = screen.getByRole('button', { name: 'Crea una lega' });

    await userEvent.click(opener);
    screen.getByLabelText('Nome').focus();
    await userEvent.click(screen.getByRole('button', { name: 'Chiudi' }));
    expect(opener).toHaveFocus();

    await userEvent.click(opener);
    screen.getByLabelText('Nome').focus();
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  // Safari non da' il fuoco a un bottone cliccato: activeElement e' il body, e la
  // finestra deve sapere da chi le dice dove tornare.
  it('con returnFocusRef il fuoco torna li anche se il clic non l ha dato al bottone', () => {
    function Opener() {
      const [open, setOpen] = useState(false);
      const back = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button ref={back} type="button" onClick={() => setOpen(true)}>Crea una lega</button>
          <Modal open={open} titleId="t" title="Crea una lega" onClose={() => setOpen(false)} returnFocusRef={back}>
            <input aria-label="Nome" />
          </Modal>
        </>
      );
    }
    render(<Opener />);
    const opener = screen.getByRole('button', { name: 'Crea una lega' });
    fireEvent.click(opener);
    expect(opener).not.toHaveFocus();
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(opener).toHaveFocus();
  });
});
