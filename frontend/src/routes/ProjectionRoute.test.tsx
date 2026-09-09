import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryProvider } from '../api/QueryProvider';
import { ProjectionRoute } from './ProjectionRoute';

function renderProjection() {
  render(
    <QueryProvider>
      <MemoryRouter>
        <ProjectionRoute />
      </MemoryRouter>
    </QueryProvider>,
  );
}

describe('ProjectionRoute', () => {
  it('si presenta come la schermata proiettata', () => {
    renderProjection();
    expect(screen.getByRole('heading', { name: /proiezione/i })).toBeInTheDocument();
  });

  it('non offre nessuna azione: si guarda soltanto', () => {
    renderProjection();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  });
});
