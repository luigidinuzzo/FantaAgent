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
  /**
   * «mai oltre» e «puoi offrire» erano lo STESSO campo, hardCap, con due nomi
   * diversi e in due punti della stessa schermata. Nello scatto che ha aperto
   * questa revisione il numero 476 compariva cinque volte con cinque significati
   * apparenti: i crediti di una squadra, «mai oltre», «puoi offrire», e due
   * driver. Resta dove si agisce — nella scheda del lotto — e se ne va da qui.
   */
  it('non ripete il limite che la scheda del lotto porta gia', () => {
    const { container } = render(<AnalysisPanel valuation={{ ...VALUATION, hardCap: 90 }} />);
    expect(container.querySelector('[data-testid="hard-cap"]')).toBeNull();
    expect(screen.queryByText('mai oltre')).not.toBeInTheDocument();
  });

  /**
   * Il pannello spiega la decisione: non deve portare il numero piu' grande della
   * schermata, perche' quello e' la decisione stessa — «il tuo tetto», nella
   * scheda del lotto. Un 476 a corpo grande in cima al pannello che spiega un 18
   * contraddiceva a colpo d'occhio cio' che spiegava.
   */
  it('l affidabilita apre il pannello: niente numeri a corpo grande', () => {
    const { container } = render(<AnalysisPanel valuation={VALUATION} />);
    expect(container.querySelector('.text-3xl, .text-4xl, .text-5xl')).toBeNull();
  });

  /**
   * Le stelle sono un'immagine. Cosa misurano deve arrivare anche a chi non le vede,
   * e "3" letto da un sintetizzatore non e' un'affidabilita': serve la frase. Chi
   * guarda legge la stessa parola sotto le stelle.
   */
  it('dice l affidabilita della stima a parole, non solo in stelle', () => {
    render(<AnalysisPanel valuation={{ ...VALUATION, confidenceStars: 3 }} />);
    expect(screen.getByRole('img', { name: /affidabilità della stima: 3 su 5/i })).toBeInTheDocument();
    expect(screen.getByText('affidabilità della stima')).toBeVisible();
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

  it('senza giocatore scelto resta lo stesso pannello, con l\'invito dentro', () => {
    const { container } = render(<AnalysisPanel valuation={null} />);

    // Non un riquadro tratteggiato diverso da tutto il resto, stirato per
    // l'altezza della griglia: la colonna non cambia forma fra "nessuno scelto"
    // e "uno scelto", cambia solo quello che ci sta dentro.
    const pannello = screen.getByRole('region', { name: 'Perché questo prezzo' });
    expect(pannello).toHaveClass('panel');
    // Nessun self-start: la griglia lo stira come gli altri due pannelli della
    // riga, e i tre bordi inferiori cadono sulla stessa linea.
    expect(pannello).not.toHaveClass('self-start');
    expect(pannello).toHaveTextContent(/Cerca un giocatore o scegline uno dalla tabella/);
    expect(container.querySelector('[data-testid="hard-cap"]')).toBeNull();
  });

  /**
   * Il campo {@code contribution} non porta contributi: porta grandezze diverse
   * per ogni driver — il limite di budget in crediti, il prezzo di un'alternativa
   * in crediti, un coefficiente d'inflazione (1 = il 100% dei valori teorici),
   * una differenza di punti stagionali. Incolonnarle col segno, una sotto
   * l'altra, le faceva leggere come addendi dello stesso totale: «+476, +16, +1,
   * +0» su un prezzo consigliato di 18.
   *
   * <p>La spiegazione di ogni driver porta gia' il proprio numero, con la propria
   * unita' detta a parole. Quella resta; la colonna se ne va.
   */
  it('non incolonna i contributi: sono grandezze diverse, non addendi', () => {
    render(
      <AnalysisPanel
        valuation={{
          ...VALUATION,
          drivers: [
            { label: 'Inflazione', contribution: 1, explanation: 'il mercato viaggia al 100% dei valori teorici' },
            { label: 'Budget', contribution: 476, explanation: 'restano 500 crediti e 25 slot da coprire' },
          ],
        }}
      />,
    );

    expect(screen.queryByText('+1')).not.toBeInTheDocument();
    expect(screen.queryByText('+476')).not.toBeInTheDocument();
    // Il numero non sparisce: vive nella frase, dove ha un'unita'.
    expect(screen.getByText(/il mercato viaggia al 100%/)).toBeInTheDocument();
    expect(screen.getByText(/restano 500 crediti/)).toBeInTheDocument();
  });

  it('non e una live region: la pagina ne ha gia una sola', () => {
    const { container } = render(<AnalysisPanel valuation={VALUATION} />);
    expect(container.querySelector('[role="status"]')).toBeNull();
  });
});
