import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { MyAuction } from '../api/types';
import { FeaturedAuction } from './FeaturedAuction';

const auction: MyAuction = {
  id: 'a1', leagueId: 'l1', leagueName: 'Lega dei Colizzati', name: 'Asta estiva 2026',
  status: 'IN_PROGRESS', phase: 'C', budgetRemaining: 120, slotsRemaining: 11,
  lastActivity: '2026-10-01T10:00:00Z', admin: true,
};

function renderFeatured(a: MyAuction = auction) {
  return render(<MemoryRouter><FeaturedAuction auction={a} /></MemoryRouter>);
}

describe('FeaturedAuction', () => {
  it('dice lega, asta, stato, fase e quanto ti resta', () => {
    renderFeatured();
    expect(screen.getByText('Lega dei Colizzati')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Asta estiva 2026' })).toBeInTheDocument();
    expect(screen.getByText('In corso')).toBeInTheDocument();
    expect(screen.getByText('Centrocampisti')).toBeInTheDocument();
    expect(screen.getByText(/120 crediti · 11 posti/)).toBeInTheDocument();
  });

  it('Entra nell asta porta all asta, ed e l oro', () => {
    renderFeatured();
    const enter = screen.getByRole('link', { name: 'Entra nell\'asta Asta estiva 2026' });
    expect(enter).toHaveAttribute('href', '/leghe/l1/aste/a1');
    expect(enter.className).toContain('bg-accent');
  });

  // Dal computer il bottone sta a destra, largo sempre uguale; sul telefono sotto,
  // a tutta larghezza. Il riquadro ha un'altezza minima decisa prima.
  it('il bottone e largo fisso dal computer, pieno sul telefono; il riquadro ha la sua altezza', () => {
    renderFeatured();
    const enter = screen.getByRole('link', { name: /Entra nell'asta/ });
    expect(enter.className).toContain('max-md:w-full');
    expect(enter.className).toContain('md:w-56');
    const panel = screen.getByRole('article');
    expect(panel.className).toMatch(/min-h-\[/);
    expect(panel.className).toContain('md:flex-row');
  });

  it('da iniziare lo dice', () => {
    renderFeatured({ ...auction, status: 'NOT_STARTED' });
    expect(screen.getByText('Da iniziare')).toBeInTheDocument();
  });
});
