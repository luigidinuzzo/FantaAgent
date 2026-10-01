import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { QueryProvider } from '../api/QueryProvider';
import { CreateLeagueDialog } from './CreateLeagueDialog';

describe('CreateLeagueDialog', () => {
  // Sul telefono la finestra e' ancorata in basso, alta quanto il suo stato piu'
  // alto (con la riga d'errore): niente fascia vuota a tutto schermo, e niente che
  // salti quando l'errore compare. Il bottone sta in fondo all'altezza riservata.
  it('sotto sm ancorata in basso, alta quanto lo stato con l errore; il bottone in fondo', () => {
    render(<QueryProvider><MemoryRouter><CreateLeagueDialog open onClose={() => {}} /></MemoryRouter></QueryProvider>);
    const dialog = screen.getByRole('dialog', { name: 'Crea una lega' }).className.split(/\s+/);
    expect(dialog).toContain('max-sm:mt-auto');
    expect(dialog).toContain('max-sm:min-h-[30.5rem]');
    expect(dialog).not.toContain('max-sm:h-dvh');
    const form = screen.getByRole('button', { name: 'Crea la lega' }).closest('form')!.className.split(/\s+/);
    expect(form).toContain('sm:min-h-[22rem]');
    expect(form).toContain('flex-1');
    const footer = screen.getByRole('button', { name: 'Crea la lega' }).parentElement!.className.split(/\s+/);
    expect(footer).toContain('mt-auto');
  });
});
