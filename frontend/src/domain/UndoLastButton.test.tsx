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

  // Fix round 2 (revisione finale): un annullamento rifiutato deve dirlo,
  // non solo riattivare il bottone in silenzio. Rimane vero (vedi
  // AuctionRoute.test.tsx), ma il componente stesso non porta piu' un
  // role="alert" proprio (revisione finale, finding B): mai un alert qui,
  // per costruzione — non serve piu' un prop `error` da verificare.
  it('non rende mai un alert proprio: l\'errore di un annullamento e\' composto dalla rotta', () => {
    render(<UndoLastButton canUndo onUndo={() => {}} pending={false} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
