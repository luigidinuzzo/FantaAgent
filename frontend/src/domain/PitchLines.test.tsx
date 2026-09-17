import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PitchLines } from './PitchLines';

// Letto da disco e non con ?raw: in vitest l'import di un .css arriva vuoto.
const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

describe('PitchLines', () => {
  it('e nascosto a chi ascolta: e decorazione, non contenuto', () => {
    const { container } = render(<PitchLines />);
    container.querySelectorAll('svg').forEach((svg) => {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });

  it('non intercetta i clic dei controlli che ci stanno sopra', () => {
    const { container } = render(<PitchLines />);
    expect(container.firstElementChild?.className).toContain('pointer-events-none');
  });

  /**
   * L'erba sta in index.css (jsdom non applica i gradienti con var()): il test ne
   * legge il sorgente. Strisce verticali col campo dritto, orizzontali col campo
   * ruotato, sempre con i token della palette.
   */
  it("disegna l'erba a strisce con i token, di traverso al campo in entrambi gli orientamenti", () => {
    const { getByTestId } = render(<PitchLines />);
    expect(getByTestId('pitch').className).toContain('pitch-grass');
    expect(css).toContain('linear-gradient(90deg, var(--background) 50%, var(--grass-stripe) 50%)');
    expect(css).toMatch(
      /@media \(orientation: portrait\)\s*\{\s*\.pitch-grass\s*\{\s*background-image: linear-gradient\(180deg, var\(--background\) 50%, var\(--grass-stripe\) 50%\)/,
    );
  });

  /** Il campo resta intero a ogni dimensione: con "slice" le linee venivano tagliate. */
  it('le linee si scalano per restare intere, non tagliate', () => {
    const { container } = render(<PitchLines />);
    container.querySelectorAll('svg').forEach((svg) => {
      expect(svg).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet');
    });
  });

  /**
   * Dritto sugli schermi orizzontali, ruotato su quelli verticali: uno solo dei due
   * si vede per volta, e quello verticale e' davvero piu' alto che largo.
   */
  it('sugli schermi verticali mostra il campo ruotato, su quelli orizzontali quello dritto', () => {
    const { container } = render(<PitchLines />);
    const landscape = container.querySelector('svg[data-orientation="landscape"]');
    const portrait = container.querySelector('svg[data-orientation="portrait"]');
    expect(landscape?.getAttribute('class')).toContain('portrait:hidden');
    expect(portrait?.getAttribute('class')).toContain('landscape:hidden');
    expect(landscape).toHaveAttribute('viewBox', '0 0 1200 800');
    expect(portrait).toHaveAttribute('viewBox', '0 0 800 1200');
    expect(portrait?.querySelector('g')).toHaveAttribute('transform', 'translate(800 0) rotate(90)');
  });

  it('chi lo monta sceglie da dove comincia', () => {
    const { getByTestId } = render(<PitchLines className="inset-y-0 right-0 left-80" />);
    expect(getByTestId('pitch').className).toContain('left-80');
    expect(getByTestId('pitch').className).not.toContain('inset-0');
  });

  /** Guardia contro un colore letterale che sostituisca il token. */
  it('colora le linee con token, non con colori letterali', () => {
    const { container } = render(<PitchLines />);
    const painted = container.querySelectorAll('[stroke], [fill]:not([fill="none"])');
    expect(painted.length).toBeGreaterThan(0);
    painted.forEach((el) => {
      const value = el.getAttribute('stroke') ?? el.getAttribute('fill');
      expect(value).toMatch(/^var\(--/);
    });
  });
});
