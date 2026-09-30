import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryProvider } from '../api/QueryProvider';
import { InviteRoute } from './InviteRoute';

const PREVIEW = { leagueId: 'l1', leagueName: 'Lega del Bar', invitedBy: 'Anna',
  alreadyMember: false, takenInitials: ['A'] };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' },
  });
}

function stub(routes: Record<string, () => Response>) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const key = `${(init?.method ?? 'GET').toUpperCase()} ${url}`;
    if (!routes[key]) throw new Error(`chiamata inattesa: ${key}`);
    return Promise.resolve(routes[key]());
  }));
}

const UNAUTH = () => json({ type: 'https://fantaagent.local/problems/unauthenticated', detail: 'x' }, 401);

function renderInvite() {
  const router = createMemoryRouter([
    { path: '/invito/:token', element: <InviteRoute /> },
    { path: '/leghe/:leagueId', element: <p>pagina della lega</p> },
  ], { initialEntries: ['/invito/abc'] });
  render(<QueryProvider><RouterProvider router={router} /></QueryProvider>);
  return router;
}

describe('InviteRoute', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('senza account porta a registrarsi e poi torna qui', async () => {
    stub({ 'GET /api/invites/abc': () => json(PREVIEW), 'GET /api/me': UNAUTH });
    renderInvite();

    expect(await screen.findByText(/Anna ti invita in/)).toHaveTextContent('Lega del Bar');
    expect(screen.getByRole('link', { name: 'Registrati' }))
      .toHaveAttribute('href', '/registrati?dopo=%2Finvito%2Fabc');
    expect(screen.getByRole('link', { name: 'Accedi' }))
      .toHaveAttribute('href', '/accedi?dopo=%2Finvito%2Fabc');
  });

  it('con l\'accesso si sceglie la squadra e si entra', async () => {
    stub({
      'GET /api/invites/abc': () => json(PREVIEW),
      'GET /api/me': () => json({ id: 'u2', email: 'b@c.it', displayName: 'Bruno', emailVerified: true }),
      'POST /api/invites/abc/accept': () => json(
        { id: 'l1', name: 'Lega del Bar', admin: false, teamName: 'Bruno FC', initial: 'B' }, 201),
    });
    const router = renderInvite();

    await userEvent.type(await screen.findByLabelText('La tua squadra'), 'Bruno FC');
    await userEvent.click(screen.getByRole('button', { name: 'Entra nella lega' }));

    expect(await screen.findByText('pagina della lega')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/leghe/l1');
  });

  it('un invito scaduto lo dice', async () => {
    stub({
      'GET /api/invites/abc': () => json({
        type: 'https://fantaagent.local/problems/invite-unavailable',
        detail: 'Questo invito è scaduto o è stato ritirato: chiedine uno nuovo a chi ti ha invitato.',
      }, 410),
      'GET /api/me': UNAUTH,
    });
    renderInvite();

    expect(await screen.findByRole('alert')).toHaveTextContent('Questo invito è scaduto');
  });

  // L'iniziale la sceglie il server: chi entra scrive solo il nome della squadra.
  it('per entrare basta il nome della squadra: l\'iniziale non si chiede', async () => {
    stub({
      'GET /api/invites/abc': () => json(PREVIEW),
      'GET /api/me': () => json({ id: 'u2', email: 'b@c.it', displayName: 'Bruno', emailVerified: true }),
    });
    renderInvite();

    expect(await screen.findByLabelText('La tua squadra')).toBeInTheDocument();
    expect(screen.queryByLabelText('La tua iniziale')).not.toBeInTheDocument();
  });
});
