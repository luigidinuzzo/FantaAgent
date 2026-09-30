import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { RouteErrorRoute } from './RouteErrorRoute';

function renderAt(path: string) {
  const router = createMemoryRouter(
    [{ errorElement: <RouteErrorRoute />, children: [{ path: '/', element: <p>inizio</p> }] }],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
}

describe('RouteErrorRoute', () => {
  it('un indirizzo che non c\'e\' mostra una pagina nostra con la strada per tornare', () => {
    renderAt('/asta');

    expect(screen.getByRole('heading', { name: 'Questa pagina non c’è' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Vai alle tue leghe' })).toHaveAttribute('href', '/');
    expect(screen.queryByText(/Hey developer/)).not.toBeInTheDocument();
  });
});
