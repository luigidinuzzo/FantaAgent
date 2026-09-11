import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FieldErrors } from './FieldErrors';

describe('FieldErrors', () => {
  it('non rende niente quando non ci sono errori', () => {
    const { container } = render(<FieldErrors id="x" errors={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('elenca gli errori sotto un id che il campo puo citare', () => {
    render(<FieldErrors id="x" errors={['Primo problema.', 'Secondo problema.']} />);
    const list = screen.getByRole('list');
    expect(list).toHaveAttribute('id', 'x');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Primo problema.')).toBeInTheDocument();
  });

  it("non e' una live region: annunciarli piu' volte sovrapporrebbe gli annunci", () => {
    render(<FieldErrors id="x" errors={['Uno.']} />);
    expect(screen.getByRole('list')).not.toHaveAttribute('role', 'alert');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
