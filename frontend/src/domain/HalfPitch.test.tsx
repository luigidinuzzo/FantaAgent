import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HalfPitch } from './HalfPitch';

describe('HalfPitch', () => {
  // L'erba vive solo qui: e' la firma delle pagine d'ingresso. Sul telefono la
  // meta' campo non c'e', e l'erba con lei.
  it('porta con se la sua erba, solo da schermo largo', () => {
    const { getAllByTestId } = render(<HalfPitch><p>dentro</p></HalfPitch>);
    const pitch = getAllByTestId('pitch');
    expect(pitch).toHaveLength(1);
    expect(pitch[0].className).toContain('pitch-grass');
    expect(pitch[0].className).toContain('max-lg:hidden');
    // Dentro la sua colonna, non su tutta la finestra.
    expect(pitch[0].className).toContain('absolute');
    expect(pitch[0].className).not.toContain('fixed');
  });
});
