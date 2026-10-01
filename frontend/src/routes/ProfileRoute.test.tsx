import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryProvider } from '../api/QueryProvider';
import { ProfileRoute } from './ProfileRoute';

const ME = { id: 'u1', email: 'anna@example.com', displayName: 'Anna', emailVerified: true };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' },
  });
}

/** /api/me risponde con `me`; il PATCH con `patch` (per difetto, il nome salvato). */
function stub(me = ME, patch?: (body: { displayName: string }) => Response,
  posts: Record<string, () => Response> = {}) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const href = typeof input === 'string' ? input : input.toString();
    if (init?.method === 'POST' && posts[href]) return Promise.resolve(posts[href]());
    if (href === '/api/me' && init?.method === 'PATCH') {
      const body = JSON.parse(init.body as string) as { displayName: string };
      return Promise.resolve(patch ? patch(body) : json({ ...me, displayName: body.displayName }));
    }
    if (href === '/api/me') return Promise.resolve(json(me));
    return Promise.resolve(json({ type: 'about:blank' }, 404));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderProfile() {
  render(<QueryProvider><MemoryRouter><ProfileRoute /></MemoryRouter></QueryProvider>);
}

describe('ProfileRoute', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sezioni Il tuo nome e Accesso nello schema delle impostazioni', async () => {
    stub();
    renderProfile();
    await screen.findByRole('textbox', { name: 'Nome' });
    expect(screen.getByRole('heading', { level: 1, name: 'Il tuo profilo' })).toBeInTheDocument();
    expect(screen.getByText('anna@example.com', { selector: 'header p' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Il tuo nome' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Accesso' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Sezioni' })).toBeInTheDocument();
    expect(screen.getByText('Tutto salvato')).toBeInTheDocument();
  });

  it('il nome si salva dalla barra', async () => {
    const fetchMock = stub();
    renderProfile();
    const field = await screen.findByRole('textbox', { name: 'Nome' });
    expect(screen.getByRole('button', { name: 'Salva il nome' })).toBeDisabled();
    await userEvent.type(field, 'lisa');
    expect(screen.getByText('Modifiche non salvate')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Salva il nome' }));

    expect(await screen.findByText('Tutto salvato')).toBeInTheDocument();
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(JSON.parse(patch![1]!.body as string)).toEqual({ displayName: 'Annalisa' });
    expect(field).toHaveValue('Annalisa');
  });

  it('Annulla riporta il nome salvato', async () => {
    stub();
    renderProfile();
    const field = await screen.findByRole('textbox', { name: 'Nome' });
    await userEvent.type(field, 'lisa');
    await userEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(field).toHaveValue('Anna');
    expect(screen.getByText('Tutto salvato')).toBeInTheDocument();
  });

  it('un errore che non e\' del campo sta nella barra, come unico alert', async () => {
    stub(ME, () => json({ type: 'about:blank', detail: 'Riprova fra poco.' }, 500));
    renderProfile();
    await userEvent.type(await screen.findByRole('textbox', { name: 'Nome' }), 'lisa');
    await userEvent.click(screen.getByRole('button', { name: 'Salva il nome' }));
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(1));
  });

  it('Esci sta in fondo, staccato, bottone normale', async () => {
    stub();
    renderProfile();
    const esci = await screen.findByRole('button', { name: 'Esci' });
    expect(esci.className).not.toContain('bg-accent');
    expect(esci.className).not.toContain('w-full');
    expect(esci.closest('[data-testid="settings-footer"]')).not.toBeNull();
  });

  it('chi non ha confermato l\'indirizzo puo\' farsi rimandare la conferma', async () => {
    stub({ ...ME, emailVerified: false });
    renderProfile();
    expect(await screen.findByText('Indirizzo non ancora confermato.')).toBeInTheDocument();
    const resend = screen.getByRole('button', { name: 'Mandami di nuovo la conferma' });
    expect(resend.className).not.toContain('bg-accent');
  });

  it('mentre carica, sotto il titolo una riga vuota che tiene l\'altezza dell\'indirizzo', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    renderProfile();
    const context = screen.getByRole('heading', { level: 1, name: 'Il tuo profilo' }).nextElementSibling;
    expect(context?.tagName).toBe('P');
    expect(context?.textContent).toBe('\u00a0');
  });

  const FAIL = () => json({ type: 'about:blank', detail: 'x' }, 500);

  it('se Esci non riesce lo dice accanto al bottone, come unico alert', async () => {
    stub(ME, undefined, { '/api/auth/logout': FAIL });
    renderProfile();
    await userEvent.click(await screen.findByRole('button', { name: 'Esci' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Non sono riuscito a farti uscire. Riprova.');
    expect(alert.closest('[data-testid="settings-footer"]')).not.toBeNull();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('se la conferma non parte lo dice accanto al bottone', async () => {
    stub({ ...ME, emailVerified: false }, undefined, { '/api/me/verification': FAIL });
    renderProfile();
    await userEvent.click(await screen.findByRole('button', { name: 'Mandami di nuovo la conferma' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Non sono riuscito a mandare l\'email. Riprova fra poco.');
    expect(screen.getByRole('button', { name: 'Mandami di nuovo la conferma' })).toBeEnabled();
  });

  it('con l\'errore della barra gia\' detto, quello di Esci si legge senza annunciarsi', async () => {
    stub(ME, () => json({ type: 'about:blank', detail: 'x' }, 500), { '/api/auth/logout': FAIL });
    renderProfile();
    await userEvent.type(await screen.findByRole('textbox', { name: 'Nome' }), 'lisa');
    await userEvent.click(screen.getByRole('button', { name: 'Salva il nome' }));
    await screen.findByRole('alert');
    await userEvent.click(screen.getByRole('button', { name: 'Esci' }));
    expect(await screen.findByText('Non sono riuscito a farti uscire. Riprova.')).toBeInTheDocument();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });
});
