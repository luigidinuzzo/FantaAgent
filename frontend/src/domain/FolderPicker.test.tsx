import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FolderPicker } from './FolderPicker';

describe('FolderPicker', () => {
  it('un bottone in italiano, da 44px, e nessuna scritta del browser', () => {
    render(<FolderPicker id="f" picked={null} onPick={() => {}} />);
    const button = screen.getByRole('button', { name: 'Scegli la cartella' });
    expect(button.className).toContain('min-h-11');
    expect(screen.getByLabelText('Scegli la cartella', { selector: 'input' }).className).toContain('sr-only');
  });

  it('il bottone apre la scelta del browser', () => {
    render(<FolderPicker id="f" picked={null} onPick={() => {}} />);
    const input = screen.getByLabelText('Scegli la cartella', { selector: 'input' }) as HTMLInputElement;
    const click = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByRole('button', { name: 'Scegli la cartella' }));
    expect(click).toHaveBeenCalled();
  });

  it('dopo la scelta dice il nome della cartella', () => {
    render(<FolderPicker id="f" picked="Asta 2025" onPick={() => {}} />);
    expect(screen.getByText('Asta 2025')).toBeInTheDocument();
  });

  it('la cartella scelta arriva a onPick, come FileList', async () => {
    const onPick = vi.fn();
    render(<FolderPicker id="f" picked={null} onPick={onPick} />);
    const input = screen.getByLabelText('Scegli la cartella', { selector: 'input' });
    const events = new File(['{}'], 'events.jsonl');
    const members = new File(['x'], 'league-members.yml');
    await userEvent.upload(input, [events, members]);
    expect(onPick).toHaveBeenCalledTimes(1);
    const list = onPick.mock.calls[0][0] as FileList;
    expect(list).toBeInstanceOf(FileList);
    expect(Array.from(list)).toEqual([events, members]);
  });

  it('spento resta raggiungibile ma non apre la scelta', () => {
    render(<FolderPicker id="f" picked={null} onPick={() => {}} disabled />);
    const button = screen.getByRole('button', { name: 'Scegli la cartella' });
    const input = screen.getByLabelText('Scegli la cartella', { selector: 'input' }) as HTMLInputElement;
    const click = vi.spyOn(input, 'click');
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(button);
    expect(click).not.toHaveBeenCalled();
  });
});
