import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryProvider } from '../api/QueryProvider';
import { LoginRoute } from './LoginRoute';

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/accedi', element: <LoginRoute /> },
      { path: '/leghe', element: <p>le mie leghe</p> },
      { path: '/', element: <p>inizio</p> },
    ],
    { initialEntries: [path] },
  );
  render(<QueryProvider><RouterProvider router={router} /></QueryProvider>);
  return router;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' },
  });
}

describe('LoginRoute', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('dopo l\'accesso torna dove si voleva andare', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      json({ id: 'u1', email: 'anna@example.com', displayName: 'Anna', emailVerified: true }),
    ));
    const router = renderAt('/accedi?dopo=%2Fleghe');

    await userEvent.type(screen.getByLabelText('Email'), 'anna@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'una password lunga');
    await userEvent.click(screen.getByRole('button', { name: 'Accedi' }));

    expect(await screen.findByText('le mie leghe')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/leghe');
  });

  it('non segue un ritorno verso un altro sito', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      json({ id: 'u1', email: 'a@b.it', displayName: 'A', emailVerified: true }),
    ));
    const router = renderAt('/accedi?dopo=%2F%2Faltro-sito.it');

    await userEvent.type(screen.getByLabelText('Email'), 'a@b.it');
    await userEvent.type(screen.getByLabelText('Password'), 'una password lunga');
    await userEvent.click(screen.getByRole('button', { name: 'Accedi' }));

    expect(await screen.findByText('inizio')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('dice che email o password non vanno', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({
      type: 'https://fantaagent.local/problems/bad-credentials',
      detail: 'Email o password non corretti.',
    }, 401)));
    renderAt('/accedi');

    await userEvent.type(screen.getByLabelText('Email'), 'a@b.it');
    await userEvent.type(screen.getByLabelText('Password'), 'sbagliata');
    await userEvent.click(screen.getByRole('button', { name: 'Accedi' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email o password non corretti.');
  });
});
