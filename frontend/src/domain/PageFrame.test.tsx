import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageFrame } from './PageFrame';

describe('PageFrame', () => {
  it('contiene la pagina, centrata e non piu larga di 96rem', () => {
    const { container } = render(<PageFrame><p>contenuto</p></PageFrame>);
    expect(screen.getByText('contenuto')).toBeInTheDocument();
    expect(container.firstElementChild?.className).toContain('max-w-[96rem]');
    expect(container.firstElementChild?.className).toContain('mx-auto');
  });

  // Niente perimetro in gesso, niente archi d'angolo: il campo non incornicia piu'
  // le pagine dell'app.
  it('non disegna nessuna riga del campo', () => {
    const { container } = render(<PageFrame><p>x</p></PageFrame>);
    expect(container.querySelector('[aria-hidden]')).toBeNull();
    expect(container.innerHTML).not.toContain('chalk');
  });
});
