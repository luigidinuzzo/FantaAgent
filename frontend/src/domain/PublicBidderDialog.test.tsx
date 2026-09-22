import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PublicBidderDialog } from './PublicBidderDialog';

const BID = {
  kind: 'bidding' as const,
  playerId: 'd1',
  price: 41,
  remainingMs: 3000,
};

const PLAYER = {
  playerId: 'd1', name: 'Bastoni', team: 'Inter', role: 'D' as const,
  listPrice: 20, timerSeconds: 5, beepEnabled: false,
};

describe('PublicBidderDialog', () => {
  it('mostra chi si sta battendo, a quanto, e quanto manca', () => {
    render(<PublicBidderDialog bid={BID} player={PLAYER} />);
    expect(screen.getByText('Bastoni')).toBeInTheDocument();
    expect(screen.getByTestId('public-price')).toHaveTextContent('41');
    expect(screen.getByTestId('public-clock')).toHaveTextContent('3');
  });

  it('non ha nessun campo che possa contenere un tetto', () => {
    const { container } = render(<PublicBidderDialog bid={BID} player={PLAYER} />);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/tetto/i);
    expect(text).not.toMatch(/massimo/i);
    expect(text).not.toMatch(/margine/i);
  });

  it('mostra anche il ruolo, con la lettera e il nome per esteso per chi ascolta', () => {
    render(<PublicBidderDialog bid={BID} player={PLAYER} />);
    expect(screen.getByText('D')).toBeInTheDocument();
    expect(screen.getByText('difensore')).toBeInTheDocument();
  });

  it('senza il giocatore (non ancora arrivato dal tabellone) non mostra nessun ruolo', () => {
    render(<PublicBidderDialog bid={BID} player={undefined} />);
    expect(screen.queryByText('D')).not.toBeInTheDocument();
  });

  /** Chi e' in testa, quando l'operatore l'ha segnato: la sala lo vuole vedere. */
  it('mostra chi e in testa se c e, e non inventa nessuno se manca', () => {
    const { unmount } = render(<PublicBidderDialog bid={{ ...BID, leaderName: 'Diego' }} player={PLAYER} />);
    expect(screen.getByTestId('public-leader')).toHaveTextContent('Diego');
    unmount();
    render(<PublicBidderDialog bid={BID} player={PLAYER} />);
    expect(screen.queryByTestId('public-leader')).not.toBeInTheDocument();
  });
});
