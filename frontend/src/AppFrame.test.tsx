import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppFrame } from './AppFrame';

function withRoutes(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppFrame />}>
          <Route path="/" element={<><p>home</p><Link to="/asta">vai</Link></>} />
          <Route path="/asta" element={<p>asta</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppFrame', () => {
  // L'erba a strisce non copre piu' la finestra: resta solo nella meta' campo
  // delle pagine d'ingresso.
  it('il fondo e uniforme: nessun campo dietro le pagine', () => {
    const { container, getByTestId } = withRoutes();
    expect(container.querySelector('[data-testid="pitch"]')).toBeNull();
    expect(getByTestId('app-frame').className).toContain('bg-background');
  });

  it('mostra dentro di se la pagina della rotta', () => {
    withRoutes();
    expect(screen.getByText('home')).toBeInTheDocument();
  });

  it('cambiando pagina la cornice resta lo stesso elemento, non viene rifatta', async () => {
    const { getByTestId } = withRoutes();
    const before = getByTestId('app-frame');

    await userEvent.click(screen.getByRole('link', { name: 'vai' }));

    expect(screen.getByText('asta')).toBeInTheDocument();
    expect(getByTestId('app-frame')).toBe(before);
  });
});
