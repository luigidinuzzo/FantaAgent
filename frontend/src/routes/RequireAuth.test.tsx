import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryProvider } from '../api/QueryProvider';
import { RequireAuth } from './RequireAuth';

describe('RequireAuth', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('senza accesso porta alla pagina di accesso e ricorda da dove', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      type: 'https://fantaagent.local/problems/unauthenticated', detail: 'Serve l\'accesso.',
    }), { status: 401, headers: { 'content-type': 'application/problem+json' } })));
    const router = createMemoryRouter([
      { path: '/leghe/:id', element: <RequireAuth><p>segreto</p></RequireAuth> },
      { path: '/accedi', element: <p>pagina di accesso</p> },
    ], { initialEntries: ['/leghe/abc?x=1'] });
    render(<QueryProvider><RouterProvider router={router} /></QueryProvider>);

    expect(await screen.findByText('pagina di accesso')).toBeInTheDocument();
    expect(screen.queryByText('segreto')).not.toBeInTheDocument();
    expect(router.state.location.search).toBe('?dopo=%2Fleghe%2Fabc%3Fx%3D1');
  });

  it('con l\'accesso mostra la pagina', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'u1', email: 'a@b.it', displayName: 'A', emailVerified: true,
    }), { status: 200, headers: { 'content-type': 'application/json' } })));
    const router = createMemoryRouter([
      { path: '/', element: <RequireAuth><p>segreto</p></RequireAuth> },
    ]);
    render(<QueryProvider><RouterProvider router={router} /></QueryProvider>);

    expect(await screen.findByText('segreto')).toBeInTheDocument();
  });
});
