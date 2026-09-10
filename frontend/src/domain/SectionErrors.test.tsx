import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SectionErrors } from './SectionErrors';

describe('SectionErrors', () => {
  it('non rende niente quando non ci sono errori', () => {
    const { container } = render(<SectionErrors id="x" errors={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('elenca gli errori sotto un id che la sezione puo citare', () => {
    render(<SectionErrors id="x" errors={['Primo problema.', 'Secondo problema.']} />);
    const list = screen.getByRole('list');
    expect(list).toHaveAttribute('id', 'x');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Primo problema.')).toBeInTheDocument();
  });

  it("non e' una live region: annunciarli tre volte sovrapporrebbe gli annunci", () => {
    render(<SectionErrors id="x" errors={['Uno.']} />);
    expect(screen.getByRole('list')).not.toHaveAttribute('role', 'alert');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
