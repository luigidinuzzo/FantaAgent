import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ValuationResponse } from '../api/types';
import { AnalysisPanel } from './AnalysisPanel';

// Costruito dai campi di ValuationResponse (api/types.ts), riusando lo
// stesso giocatore del fixture di PlayerDecisionCard.test.tsx: e' la stessa
// valutazione, non una seconda inventata da zero per questo file.
const VALUATION: ValuationResponse = {
  playerId: 'd1',
  name: 'Bastoni',
  team: 'Inter',
  role: 'D',
  listPrice: 20,
  expectedPrice: 38,
  maxBid: 47,
  hardCap: 90,
  margin: 9,
  walkAwayReason: 'oltre 47 il completamento perde più di quanto guadagni',
  worthPursuing: true,
  confidenceStars: 4,
  drivers: [
    { label: 'budget', contribution: 3, explanation: 'budget capiente' },
    { label: 'alternative', contribution: -1, explanation: 'tre alternative sopra soglia' },
  ],
};

describe('AnalysisPanel', () => {
  it('mostra il tetto duro, che nessuna schermata ha mai mostrato', () => {
    render(<AnalysisPanel valuation={{ ...VALUATION, hardCap: 90 }} />);
    expect(screen.getByTestId('hard-cap')).toHaveTextContent('90');
  });

  /**
   * Le stelle sono un'immagine. La confidenza deve arrivare anche a chi non le vede,
   * e "3" letto da un sintetizzatore non e' una confidenza: serve la frase.
   */
  it('dice la confidenza a parole, non solo in stelle', () => {
    render(<AnalysisPanel valuation={{ ...VALUATION, confidenceStars: 3 }} />);
    expect(screen.getByRole('img', { name: /confidenza 3 su 5/i })).toBeInTheDocument();
  });

  it('spiega i driver, saltando quelli senza spiegazione', () => {
    // drivers con explanation vuota non producono ne' un punto isolato ne' una
    // virgola doppia: e' il filtro che PlayerDecisionCard aveva gia', e che si
    // sposta qui insieme al testo.
    render(
      <AnalysisPanel
        valuation={{
          ...VALUATION,
          drivers: [
            { label: 'budget', contribution: 3, explanation: '' },
            { label: 'alternative', contribution: -1, explanation: 'tre alternative sopra soglia' },
          ],
        }}
      />,
    );
    expect(screen.queryByText('budget')).not.toBeInTheDocument();
    expect(screen.getByText('alternative')).toBeInTheDocument();
    expect(screen.getByText('tre alternative sopra soglia')).toBeInTheDocument();
  });

  it('non e una live region: la pagina ne ha gia una sola', () => {
    const { container } = render(<AnalysisPanel valuation={VALUATION} />);
    expect(container.querySelector('[role="status"]')).toBeNull();
  });
});
