import { render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryProvider } from '../api/QueryProvider';
import { VerifyEmailRoute } from './VerifyEmailRoute';

describe('VerifyEmailRoute', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('conferma una volta sola, anche col doppio effetto di StrictMode', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    render(
      <StrictMode>
        <QueryProvider>
          <MemoryRouter initialEntries={['/verifica-email?token=abc']}>
            <VerifyEmailRoute />
          </MemoryRouter>
        </QueryProvider>
      </StrictMode>,
    );

    expect(await screen.findByText('Indirizzo confermato.')).toBeInTheDocument();
    const verifyCalls = fetchMock.mock.calls.filter(([url]) => url === '/api/auth/verify');
    expect(verifyCalls).toHaveLength(1);
    expect(JSON.parse(verifyCalls[0][1].body)).toEqual({ token: 'abc' });
  });

  it('dice quando il link non vale piu\'', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      type: 'https://fantaagent.local/problems/invalid-token', detail: 'Il link non è valido o è scaduto.',
    }), { status: 400, headers: { 'content-type': 'application/problem+json' } })));
    render(
      <QueryProvider>
        <MemoryRouter initialEntries={['/verifica-email?token=vecchio']}>
          <VerifyEmailRoute />
        </MemoryRouter>
      </QueryProvider>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Il link non è valido o è scaduto.');
  });
});
