import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { MyAuction } from '../api/types';
import { MyAuctionCard } from './MyAuctionCard';

const auction: MyAuction = {
  id: 'a1', leagueId: 'l1', leagueName: 'Lega dei Colizzati', name: 'Asta estiva 2026',
  status: 'IN_PROGRESS', phase: 'C', budgetRemaining: 120, slotsRemaining: 11,
  lastActivity: '2026-10-01T10:00:00Z', admin: true,
};

function renderCard(primary: boolean, a: MyAuction = auction) {
  return render(<MemoryRouter><MyAuctionCard auction={a} primary={primary} /></MemoryRouter>);
}

describe('MyAuctionCard', () => {
  it('dice lega, asta, stato, fase e quanto ti resta', () => {
    renderCard(true);
    expect(screen.getByText('Lega dei Colizzati')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Asta estiva 2026' })).toBeInTheDocument();
    expect(screen.getByText('In corso')).toBeInTheDocument();
    expect(screen.getByText('Centrocampisti')).toBeInTheDocument();
    expect(screen.getByText(/120 crediti · 11 posti/)).toBeInTheDocument();
  });

  it('Entra nell asta porta all asta', () => {
    renderCard(true);
    expect(screen.getByRole('link', { name: 'Entra nell\'asta Asta estiva 2026' }))
      .toHaveAttribute('href', '/leghe/l1/aste/a1');
  });

  it('oro solo sulla prima', () => {
    renderCard(true);
    expect(screen.getByRole('link', { name: /Entra nell'asta/ }).className).toContain('bg-accent');
  });

  it('le altre normali', () => {
    renderCard(false);
    expect(screen.getByRole('link', { name: /Entra nell'asta/ }).className).not.toContain('bg-accent');
  });

  it('da iniziare lo dice', () => {
    renderCard(false, { ...auction, status: 'NOT_STARTED' });
    expect(screen.getByText('Da iniziare')).toBeInTheDocument();
  });
});
