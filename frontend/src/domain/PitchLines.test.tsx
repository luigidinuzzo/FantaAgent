import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PitchLines, APP_OPACITY, PROJECTION_OPACITY } from './PitchLines';

describe('PitchLines', () => {
  it('e nascosto a chi ascolta: e decorazione, non contenuto', () => {
    const { container } = render(<PitchLines variant="app" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('non intercetta i clic dei controlli che ci stanno sopra', () => {
    const { container } = render(<PitchLines variant="app" />);
    expect(container.firstElementChild?.className).toContain('pointer-events-none');
  });

  /**
   * Il numero non e' arbitrario ed e' l'unico modo di difenderlo: il test di
   * contrasto misura coppie di token, non una texture sovrapposta, quindi il
   * limite vive qui.
   */
  it("nell'applicazione resta sotto la soglia in cui potrebbe intaccare il testo", () => {
    expect(APP_OPACITY).toBeLessThanOrEqual(0.05);
  });

  it('sulla proiezione puo alzare il tono, perche nessun testo piccolo ci passa sopra', () => {
    expect(PROJECTION_OPACITY).toBeGreaterThan(APP_OPACITY);
  });
});
