import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PitchLines } from './PitchLines';
import { GRASS, STRIPES } from './pitch';

describe('PitchLines', () => {
  it('e nascosto a chi ascolta: e decorazione, non contenuto', () => {
    const { container } = render(<PitchLines />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('non intercetta i clic dei controlli che ci stanno sopra', () => {
    const { container } = render(<PitchLines />);
    expect(container.firstElementChild?.className).toContain('pointer-events-none');
  });

  it("disegna l'erba a strisce con i token della palette, su tutto lo sfondo", () => {
    // Sul valore e non sullo stile calcolato: jsdom scarta i gradienti con var(),
    // che il browser invece applica.
    expect(GRASS.backgroundImage).toContain('var(--grass-stripe)');
    expect(GRASS.backgroundImage).toContain('var(--background)');
    // Due strisce per ripetizione del gradiente: STRIPES strisce in tutto.
    expect(GRASS.backgroundSize).toBe(`calc(200% / ${STRIPES}) 100%`);
  });

  /**
   * Il campo resta intero a ogni dimensione della finestra: con "slice" le linee
   * venivano tagliate in modo diverso da uno schermo all'altro.
   */
  it('le linee si scalano per restare intere, non tagliate', () => {
    const { container } = render(<PitchLines />);
    expect(container.querySelector('svg')).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet');
  });

  it('chi lo monta sceglie da dove comincia', () => {
    const { getByTestId } = render(<PitchLines className="inset-y-0 right-0 left-80" />);
    expect(getByTestId('pitch').className).toContain('left-80');
    expect(getByTestId('pitch').className).not.toContain('inset-0');
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
