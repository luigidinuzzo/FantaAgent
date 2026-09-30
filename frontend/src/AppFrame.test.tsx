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
  // Dal bordo in alto: le pagine d'ingresso non hanno la barra, e un campo che
  // partiva sotto di essa lasciava lassu' una fascia senza strisce.
  it('disegna il campo una volta sola, per tutta la finestra', () => {
    const { container, getByTestId } = withRoutes();
    expect(container.querySelectorAll('[data-testid="pitch"]')).toHaveLength(1);
    expect(getByTestId('pitch').className).toContain('inset-0');
  });

  it('mostra dentro di se la pagina della rotta', () => {
    withRoutes();
    expect(screen.getByText('home')).toBeInTheDocument();
  });

  /**
   * E' il motivo per cui il campo sta qui e non in AppShell: cambiando pagina la
   * rotta si smonta, e con lei si rifaceva anche il campo — che si rimisura dopo il
   * primo fotogramma, e per un istante disegnava linee di un'altra misura.
   */
  it('cambiando pagina il campo resta lo stesso elemento, non viene rifatto', async () => {
    const { getByTestId } = withRoutes();
    const before = getByTestId('pitch');

    await userEvent.click(screen.getByRole('link', { name: 'vai' }));

    expect(screen.getByText('asta')).toBeInTheDocument();
    expect(getByTestId('pitch')).toBe(before);
  });
});
