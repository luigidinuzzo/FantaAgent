import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PitchGrass } from './PitchGrass';

describe('PitchGrass', () => {
  it('e nascosto a chi ascolta: e decorazione, non contenuto', () => {
    const { getByTestId } = render(<PitchGrass />);
    expect(getByTestId('pitch')).toHaveAttribute('aria-hidden', 'true');
  });

  it('non intercetta i clic dei controlli che ci stanno sopra', async () => {
    let clicked = false;
    const { getByRole } = render(
      <div>
        <PitchGrass />
        <button type="button" onClick={() => { clicked = true; }}>premi</button>
      </div>,
    );
    await userEvent.click(getByRole('button', { name: 'premi' }));
    expect(clicked).toBe(true);
  });

  it('e erba a strisce, e nient altro', () => {
    const { container, getByTestId } = render(<PitchGrass />);

    // Le linee in gesso — cerchio di centrocampo, aree, archi — sono spente: fra
    // un pannello e l'altro spuntavano pezzi di disegno, e il cerchio che
    // affiorava sotto il banco si leggeva come un difetto di resa, non come
    // un'identita'. Restano le strisce di taglio, che sono uno sfondo e basta.
    expect(getByTestId('pitch').className).toContain('pitch-grass');
    expect(container.querySelector('svg')).toBeNull();
  });

  it('chi lo monta sceglie da dove comincia', () => {
    const { getByTestId } = render(<PitchGrass className="inset-x-0 bottom-0 top-10" />);
    expect(getByTestId('pitch').className).toContain('top-10');
  });
});
