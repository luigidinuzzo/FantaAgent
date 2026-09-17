import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PitchLines, STRIPES } from './PitchLines';

describe('PitchLines', () => {
  it('e nascosto a chi ascolta: e decorazione, non contenuto', () => {
    const { container } = render(<PitchLines />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('non intercetta i clic dei controlli che ci stanno sopra', () => {
    const { container } = render(<PitchLines />);
    expect(container.firstElementChild?.className).toContain('pointer-events-none');
  });

  it("disegna l'erba a strisce di taglio alterne", () => {
    const { getAllByTestId } = render(<PitchLines />);
    expect(getAllByTestId('grass-stripe')).toHaveLength(STRIPES / 2);
  });

  /**
   * Guardia contro un colore letterale che sostituisca il token: erba e gesso
   * devono restare della palette, cosi' il test di contrasto li vede.
   */
  it('colora erba e linee con token, non con colori letterali', () => {
    const { container } = render(<PitchLines />);
    const painted = container.querySelectorAll('[stroke], [fill]:not([fill="none"])');
    expect(painted.length).toBeGreaterThan(0);
    painted.forEach((el) => {
      const value = el.getAttribute('stroke') ?? el.getAttribute('fill');
      expect(value).toMatch(/^var\(--/);
    });
  });
});
