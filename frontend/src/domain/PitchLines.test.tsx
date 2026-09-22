import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PITCH_INSET, PitchLines } from './PitchLines';

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

  /**
   * Il campo riempie lo spazio: il disegno ha le misure dello spazio stesso, non una
   * forma fissa scalata che lascerebbe fasce d'erba vuote ai lati.
   */
  it('il campo ha le misure dello spazio in cui sta', () => {
    const { container } = render(<PitchLines />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
    const outer = svg?.querySelector('rect');
    expect(Number(outer?.getAttribute('width'))).toBe(window.innerWidth - 2 * PITCH_INSET);
    expect(Number(outer?.getAttribute('height'))).toBe(window.innerHeight - 2 * PITCH_INSET);
  });

  /** Dritto sugli schermi orizzontali, con le porte ai lati; girato su quelli verticali. */
  it('le porte stanno sui lati corti: ai lati se lo schermo e largo, in alto e in basso se e alto', () => {
    const { container } = render(<PitchLines />);
    const svg = container.querySelector('svg');
    const wide = window.innerWidth >= window.innerHeight;
    expect(svg).toHaveAttribute('data-orientation', wide ? 'landscape' : 'portrait');
    const line = svg?.querySelector('line');
    // La linea di meta' campo va di traverso alle porte.
    if (wide) expect(line?.getAttribute('x1')).toBe(line?.getAttribute('x2'));
    else expect(line?.getAttribute('y1')).toBe(line?.getAttribute('y2'));
  });

  /** Il cerchio di centrocampo resta un cerchio, non un ovale, qualunque sia la finestra. */
  it('il cerchio di centrocampo e un cerchio, al centro del campo', () => {
    const { container } = render(<PitchLines />);
    const circle = container.querySelector('g[fill="none"] circle');
    expect(circle?.tagName.toLowerCase()).toBe('circle');
    expect(Number(circle?.getAttribute('cx'))).toBeCloseTo(window.innerWidth / 2);
    expect(Number(circle?.getAttribute('cy'))).toBeCloseTo(window.innerHeight / 2);
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

  /**
   * Cambiando pagina il campo rinasce: deve ripartire dalla misura che aveva, non
   * dalla finestra intera, o per un fotogramma si vede un campo diverso. Qui la
   * pagina precedente aveva misurato uno spazio piu' basso della finestra.
   */
  it('un campo nuovo riparte dalla misura dell ultimo, non dalla finestra', () => {
    const original = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function () {
      return { width: 1000, height: 600, top: 0, left: 0, right: 1000, bottom: 600, x: 0, y: 0 } as DOMRect;
    };
    try {
      const first = render(<PitchLines />);
      expect(first.container.querySelector('svg')).toHaveAttribute('viewBox', '0 0 1000 600');
      first.unmount();
      HTMLElement.prototype.getBoundingClientRect = original;
      // Il secondo non puo' misurare (jsdom da' zero): resta sulla misura condivisa.
      const second = render(<PitchLines />);
      expect(second.container.querySelector('svg')).toHaveAttribute('viewBox', '0 0 1000 600');
    } finally {
      HTMLElement.prototype.getBoundingClientRect = original;
    }
  });
});
