import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UndoLastButton } from './UndoLastButton';

describe('UndoLastButton', () => {
  it('senza niente da annullare e disabilitato, e dice perche', () => {
    render(<UndoLastButton canUndo={false} onUndo={() => {}} pending={false} />);
    const button = screen.getByRole('button', { name: /annulla/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(/nessun acquisto da annullare/i);
  });

  it('annulla quando si preme', async () => {
    const onUndo = vi.fn();
    render(<UndoLastButton canUndo onUndo={onUndo} pending={false} />);
    await userEvent.click(screen.getByRole('button', { name: /annulla/i }));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  // Fix round 2 (revisione finale): stessa disciplina di PhaseSwitcher e
  // BidPanel — un annullamento rifiutato deve dirlo, non solo riattivare
  // il bottone in silenzio.
  it('mostra un annullamento rifiutato, anche a chi ascolta', () => {
    render(
      <UndoLastButton canUndo onUndo={() => {}} pending={false} error="Niente da annullare" />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Niente da annullare');
  });

  it('senza errore non mostra nessun alert', () => {
    render(<UndoLastButton canUndo onUndo={() => {}} pending={false} error={null} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
