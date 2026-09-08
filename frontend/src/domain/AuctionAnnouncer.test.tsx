import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuctionAnnouncer, purchaseMessage } from './AuctionAnnouncer';

describe('purchaseMessage', () => {
  it('dice chi ha preso chi, a quanto, e cosa resta a me', () => {
    expect(
      purchaseMessage({
        playerName: 'Bastoni',
        buyerName: 'Anna',
        price: 47,
        myBudgetRemaining: 265,
        mySlotsRemaining: 17,
      }),
    ).toBe(
      'Bastoni aggiudicato ad Anna per 47 crediti. Ti restano 265 crediti e 17 slot.',
    );
  });

  it("usa 'a' invece di 'ad' davanti a consonante", () => {
    expect(
      purchaseMessage({
        playerName: 'Gatti',
        buyerName: 'Bruno',
        price: 12,
        myBudgetRemaining: 253,
        mySlotsRemaining: 16,
      }),
    ).toContain('aggiudicato a Bruno');
  });

  it("usa 'ad' anche davanti a una vocale accentata: la regola e' sul suono, non sull'ASCII", () => {
    expect(
      purchaseMessage({
        playerName: 'Gatti',
        buyerName: 'Émile',
        price: 12,
        myBudgetRemaining: 253,
        mySlotsRemaining: 16,
      }),
    ).toContain('aggiudicato ad Émile');
  });

  it('accorda il singolare quando resta uno slot solo', () => {
    expect(
      purchaseMessage({
        playerName: 'Gatti',
        buyerName: 'Bruno',
        price: 12,
        myBudgetRemaining: 1,
        mySlotsRemaining: 1,
      }),
    ).toContain('Ti restano 1 credito e 1 slot.');
  });
});

describe('AuctionAnnouncer', () => {
  it("e' l'unica live region, ed e' atomica", () => {
    render(<AuctionAnnouncer message="Bastoni aggiudicato ad Anna per 47 crediti." />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-atomic', 'true');
    expect(region).toHaveTextContent('Bastoni aggiudicato ad Anna per 47 crediti.');
  });

  it('non ingombra lo schermo', () => {
    render(<AuctionAnnouncer message="qualcosa" />);
    expect(screen.getByRole('status')).toHaveClass('sr-only');
  });
});
