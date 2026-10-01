import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { QueryProvider } from '../api/QueryProvider';
import { CreateLeagueDialog } from './CreateLeagueDialog';

describe('CreateLeagueDialog', () => {
  // Sul telefono la finestra e' tutto lo schermo: il bottone segue i campi invece
  // di stare in fondo, e fra loro non resta una fascia vuota.
  it('sotto sm il bottone segue i campi; da sm sta in fondo all altezza riservata', () => {
    render(<QueryProvider><MemoryRouter><CreateLeagueDialog open onClose={() => {}} /></MemoryRouter></QueryProvider>);
    const form = screen.getByRole('button', { name: 'Crea la lega' }).closest('form')!;
    const classes = form.className.split(/\s+/);
    expect(classes).toContain('sm:min-h-[22rem]');
    expect(classes).not.toContain('min-h-[22rem]');
    expect(classes).not.toContain('flex-1');
    const footer = screen.getByRole('button', { name: 'Crea la lega' }).parentElement!.className.split(/\s+/);
    expect(footer).toContain('sm:mt-auto');
    expect(footer).not.toContain('mt-auto');
  });
});
