import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemberMenu } from './MemberMenu';

describe('MemberMenu', () => {
  it('un bottone per riga, col nome della squadra', () => {
    render(<MemberMenu teamName="Longobarda" onRemove={() => {}} />);
    expect(screen.getByRole('button', { name: 'Azioni per Longobarda' })).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('dentro, Togli dalla lega', async () => {
    const onRemove = vi.fn();
    render(<MemberMenu teamName="Longobarda" onRemove={onRemove} />);
    await userEvent.click(screen.getByRole('button', { name: 'Azioni per Longobarda' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Togli dalla lega' }));
    expect(onRemove).toHaveBeenCalled();
  });

  it('Esc chiude il menu e riporta il fuoco al bottone', async () => {
    render(<MemberMenu teamName="Longobarda" onRemove={() => {}} />);
    const button = screen.getByRole('button', { name: 'Azioni per Longobarda' });
    await userEvent.click(button);
    expect(screen.getByRole('menuitem', { name: 'Togli dalla lega' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });
});
