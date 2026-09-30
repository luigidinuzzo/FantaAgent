import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryProvider } from '../api/QueryProvider';
import { KnownPathContext } from './knownPath';
import { RegisterRoute } from './RegisterRoute';

describe('RegisterRoute', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('mostra gli errori accanto al campo a cui appartengono', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      type: 'https://fantaagent.local/problems/invalid-account',
      detail: 'Alcuni dati non sono validi.',
      errors: { password: ['La password deve avere almeno 10 caratteri.'] },
    }), { status: 422, headers: { 'content-type': 'application/problem+json' } })));
    render(<QueryProvider><MemoryRouter><RegisterRoute /></MemoryRouter></QueryProvider>);

    await userEvent.type(screen.getByLabelText('Il tuo nome'), 'Anna');
    await userEvent.type(screen.getByLabelText('Email'), 'anna@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'corta');
    await userEvent.click(screen.getByRole('button', { name: 'Crea l\'account' }));

    const password = screen.getByLabelText('Password');
    const described = await screen.findByText('La password deve avere almeno 10 caratteri.');
    expect(password.getAttribute('aria-describedby')).toContain(described.closest('ul')!.id);
    expect(password).toHaveAttribute('aria-invalid', 'true');
  });

  function registered() {
    return new Response(JSON.stringify(
      { id: 'u1', email: 'anna@example.com', displayName: 'Anna', emailVerified: false },
    ), { status: 201, headers: { 'content-type': 'application/json' } });
  }

  function renderAt(path: string, isKnown: (path: string) => boolean = () => true) {
    const router = createMemoryRouter(
      [
        { path: '/registrati', element: <RegisterRoute /> },
        { path: '/', element: <p>le mie leghe</p> },
        { path: '/invito/:token', element: <p>invito</p> },
      ],
      { initialEntries: [path] },
    );
    render(
      <KnownPathContext.Provider value={isKnown}>
        <QueryProvider><RouterProvider router={router} /></QueryProvider>
      </KnownPathContext.Provider>,
    );
    return router;
  }

  async function fillAndSubmit() {
    await userEvent.type(screen.getByLabelText('Il tuo nome'), 'Anna');
    await userEvent.type(screen.getByLabelText('Email'), 'anna@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'una password lunga');
    await userEvent.click(screen.getByRole('button', { name: 'Crea l\'account' }));
  }

  // L'account si usa subito (la conferma serve a recuperare la password), ma chi si
  // e' appena registrato deve sapere che l'email e' partita e dove.
  it('dopo la registrazione dice di controllare la posta, e poi porta alle leghe', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(registered()));
    const router = renderAt('/registrati');

    await fillAndSubmit();

    expect(await screen.findByRole('heading', { name: 'Controlla la posta' })).toBeInTheDocument();
    expect(screen.getByText('anna@example.com')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/registrati');

    await userEvent.click(screen.getByRole('button', { name: 'Vai alle tue leghe' }));
    expect(router.state.location.pathname).toBe('/');
  });

  it('chi arriva da un invito ci torna, dopo la pagina della posta', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(registered()));
    const router = renderAt('/registrati?dopo=%2Finvito%2Fabc');

    await fillAndSubmit();
    await userEvent.click(await screen.findByRole('button', { name: 'Continua' }));

    expect(router.state.location.pathname).toBe('/invito/abc');
  });

  // Il caso vero: una scheda della versione vecchia mandava all'accesso con
  // ?dopo=/asta, e dopo la registrazione si finiva su una pagina che non c'e' piu'.
  it('un ritorno verso una pagina che non esiste diventa l\'inizio', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(registered()));
    const router = renderAt('/registrati?dopo=%2Fasta', (path) => path !== '/asta');

    await fillAndSubmit();
    await userEvent.click(await screen.findByRole('button', { name: 'Vai alle tue leghe' }));

    expect(router.state.location.pathname).toBe('/');
  });
});
