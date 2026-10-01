import { fireEvent, render, screen } from '@testing-library/react';
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

  it('la cartella scelta arriva a onPick', () => {
    const onPick = vi.fn();
    render(<FolderPicker id="f" picked={null} onPick={onPick} />);
    const input = screen.getByLabelText('Scegli la cartella', { selector: 'input' });
    const file = new File(['x'], 'eventi.json');
    fireEvent.change(input, { target: { files: [file] } });
    expect(onPick).toHaveBeenCalled();
  });
});
