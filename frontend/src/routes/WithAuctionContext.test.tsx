import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { auctionContext } from '../api/client';
import { WithAuctionContext } from './WithAuctionContext';

function Probe() {
  const { leagueId, auctionId } = auctionContext();
  return <p>{leagueId}/{auctionId}</p>;
}

describe('WithAuctionContext', () => {
  it('prende lega e asta dall\'indirizzo prima che i figli chiedano qualcosa', () => {
    const router = createMemoryRouter([{
      path: '/leghe/:leagueId/aste/:auctionId',
      element: <WithAuctionContext><Probe /></WithAuctionContext>,
    }], { initialEntries: ['/leghe/l1/aste/a9'] });
    render(<RouterProvider router={router} />);
    expect(screen.getByText('l1/a9')).toBeInTheDocument();
  });
});
