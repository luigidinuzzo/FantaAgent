import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('ha un h1 col titolo e la riga di contesto', () => {
    render(<PageHeader title="Le tue aste" context="3 in corso" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Le tue aste' })).toBeInTheDocument();
    expect(screen.getByText('3 in corso')).toBeInTheDocument();
  });

  // L'oro della pagina sta nel contenuto, mai nell'intestazione.
  it('le azioni stanno in un gruppo e non sono oro', () => {
    render(<PageHeader title="T" actions={<button type="button" className="border">Crea</button>} />);
    const group = screen.getByRole('group', { name: 'Azioni della pagina' });
    expect(group).toContainElement(screen.getByRole('button', { name: 'Crea' }));
    expect(group.innerHTML).not.toContain('bg-accent');
  });

  it('sotto sm le azioni vanno sotto il titolo, a tutta larghezza', () => {
    render(<PageHeader title="T" actions={<button type="button">A</button>} />);
    expect(screen.getByRole('group', { name: 'Azioni della pagina' }).className).toContain('max-sm:w-full');
  });
});
