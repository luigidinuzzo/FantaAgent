import { useRef } from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useActiveSection } from './useActiveSection';

const IDS = ['a', 'b', 'c'] as const;

/** Le sezioni con la posizione del loro inizio rispetto alla finestra, simulata. */
function Page({ tops }: { tops: Record<string, number> }) {
  const active = useActiveSection(IDS, true);
  return (
    <>
      {IDS.map((id) => (
        <div
          key={id}
          id={id}
          ref={(el) => {
            if (el) el.getBoundingClientRect = () => ({ top: tops[id] } as DOMRect);
          }}
        />
      ))}
      <p data-testid="active">{active ?? 'nessuna'}</p>
    </>
  );
}

async function nextFrame() {
  await act(async () => { await new Promise((r) => requestAnimationFrame(() => r(null))); });
}

describe('useActiveSection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.scrollY = 0;
  });

  it('e la sezione il cui inizio e gia salito sopra la linea sotto la barra', async () => {
    // Pagina lunga, a meta': a e b sono salite, c e' ancora sotto.
    vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(5000);
    Object.defineProperty(window, 'scrollY', { value: 800, configurable: true, writable: true });
    render(<Page tops={{ a: -700, b: 60, c: 900 }} />);
    await nextFrame();
    expect(screen.getByTestId('active')).toHaveTextContent('b');
  });

  it('in cima alla pagina e la prima', async () => {
    vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(5000);
    render(<Page tops={{ a: 180, b: 700, c: 1400 }} />);
    await nextFrame();
    expect(screen.getByTestId('active')).toHaveTextContent('a');
  });

  /** Una sezione corta alla fine non sale mai fino alla linea: in fondo vince lei. */
  it('in fondo alla pagina e l ultima, anche se non e salita fin lassu', async () => {
    vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(1500);
    Object.defineProperty(window, 'scrollY', { value: 800, configurable: true, writable: true });
    render(<Page tops={{ a: -700, b: 20, c: 400 }} />);
    await nextFrame();
    expect(screen.getByTestId('active')).toHaveTextContent('c');
  });

  /**
   * Da tablet in su il modulo scorre dentro il suo riquadro, non la pagina: la
   * linea sta poco sotto il bordo alto del riquadro, e conta il suo scorrimento.
   */
  it('dentro un riquadro che scorre misura rispetto al riquadro', async () => {
    function Boxed() {
      const box = useRef<HTMLDivElement>(null);
      const active = useActiveSection(IDS, true, box);
      const tops: Record<string, number> = { a: -300, b: 120, c: 700 };
      return (
        <>
          <div
            ref={(el) => {
              box.current = el;
              if (!el) return;
              el.getBoundingClientRect = () => ({ top: 100 } as DOMRect);
              Object.defineProperty(el, 'scrollHeight', { value: 3000, configurable: true });
              Object.defineProperty(el, 'clientHeight', { value: 700, configurable: true });
              Object.defineProperty(el, 'scrollTop', { value: 400, configurable: true });
            }}
            style={{ overflowY: 'auto' }}
          >
            {IDS.map((id) => (
              <div
                key={id}
                id={id}
                ref={(el) => {
                  if (el) el.getBoundingClientRect = () => ({ top: tops[id] } as DOMRect);
                }}
              />
            ))}
          </div>
          <p data-testid="active">{active ?? 'nessuna'}</p>
        </>
      );
    }
    render(<Boxed />);
    await nextFrame();
    // La linea e' a 100 + 48: b (120) e' gia' salita sopra, c (700) no.
    expect(screen.getByTestId('active')).toHaveTextContent('b');
  });
});
