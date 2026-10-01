import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryProvider } from '../api/QueryProvider';
import { ProfileMenu } from './ProfileMenu';

const me = { id: 'u1', email: 'a@b.it', displayName: 'Anna', emailVerified: true };

function renderMenu(current: boolean) {
  render(
    <QueryProvider>
      <MemoryRouter><ProfileMenu me={me} current={current} /></MemoryRouter>
    </QueryProvider>,
  );
  return screen.getByRole('button', { name: /Profilo/ });
}

describe('ProfileMenu', () => {
  /**
   * Sulla pagina del profilo il bottone si distingue con contorno e testo oro, non
   * pieno: l'oro pieno e' dell'unica azione della schermata, il salvataggio.
   */
  it('sulla pagina del profilo ha contorno e testo oro, senza fondo pieno', () => {
    const button = renderMenu(true);
    expect(button.className).toContain('border-accent');
    expect(button.className).toContain('text-accent');
    expect(button.className).not.toContain('bg-accent');
  });

  it('altrove resta col contorno dei controlli', () => {
    const button = renderMenu(false);
    expect(button.className).toContain('border-control-border');
    expect(button.className).not.toContain('border-accent');
    expect(button.className).not.toContain('bg-accent');
  });
});
