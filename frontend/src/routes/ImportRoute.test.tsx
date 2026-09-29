import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryProvider } from '../api/QueryProvider';
import { ImportRoute } from './ImportRoute';

const LEAGUE = {
  id: 'l1', name: 'Lega del Bar', admin: true, members: [
    { userId: 'u1', displayName: 'Anna', teamName: 'Anna FC', initial: 'A', role: 'ADMIN', me: true },
    { userId: 'u2', displayName: 'Marco', teamName: 'Marco FC', initial: 'M', role: 'MEMBER', me: false },
  ],
};
const PREVIEW = { name: 'Asta del 2025', purchases: 12, participants: [
  { id: 'me', name: 'Io', initial: 'I' }, { id: 'p2', name: 'Marco', initial: 'M' },
] };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' },
  });
}

function stub(importResponse: () => Response = () => json({ auctionId: 'a9' }, 201)) {
  const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const key = `${(init?.method ?? 'GET').toUpperCase()} ${url}`;
    const routes: Record<string, () => Response> = {
      'GET /api/me': () => json({ id: 'u1', email: 'a@b.it', displayName: 'Anna', emailVerified: true }),
      'GET /api/leagues/l1': () => json(LEAGUE),
      'POST /api/leagues/l1/imports/preview': () => json(PREVIEW),
      'POST /api/leagues/l1/imports': importResponse,
    };
    if (!routes[key]) throw new Error(`chiamata inattesa: ${key}`);
    return Promise.resolve(routes[key]());
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderImport() {
  const router = createMemoryRouter([
    { path: '/leghe/:leagueId/importa', element: <ImportRoute /> },
    { path: '/leghe/:leagueId/aste/:auctionId', element: <p>asta importata</p> },
  ], { initialEntries: ['/leghe/l1/importa'] });
  render(<QueryProvider><RouterProvider router={router} /></QueryProvider>);
  return router;
}

const FILES = [
  new File(['{}'], 'events.jsonl'),
  new File(['x'], 'league-members.yml'),
  new File(['x'], 'rose.csv'),
];

describe('ImportRoute', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('legge la cartella, propone gli abbinamenti per nome e importa', async () => {
    const fetchMock = stub();
    const router = renderImport();

    await userEvent.upload(await screen.findByLabelText('Scegli la cartella dell\'asta'), FILES);
    expect(await screen.findByText('Asta del 2025')).toBeInTheDocument();

    const table = screen.getByRole('table', { name: 'Abbinamenti' });
    expect(within(table).getByLabelText('Membro per Marco')).toHaveValue('u2');
    await userEvent.selectOptions(within(table).getByLabelText('Membro per Io'), 'u1');
    await userEvent.click(screen.getByRole('button', { name: 'Importa l\'asta' }));

    expect(await screen.findByText('asta importata')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/leghe/l1/aste/a9');
    const preview = fetchMock.mock.calls.find(([url]) => url === '/api/leagues/l1/imports/preview');
    const sent = (preview![1].body as FormData).getAll('files') as File[];
    expect(sent.map((f) => f.name).sort()).toEqual(['events.jsonl', 'league-members.yml']);
  });

  it('non importa finche\' manca un abbinamento', async () => {
    stub();
    renderImport();
    await userEvent.upload(await screen.findByLabelText('Scegli la cartella dell\'asta'), FILES);
    await screen.findByText('Asta del 2025');
    expect(screen.getByRole('button', { name: 'Importa l\'asta' })).toBeDisabled();
  });

  it('due partecipanti allo stesso membro: pulsante spento', async () => {
    stub();
    renderImport();
    await userEvent.upload(await screen.findByLabelText('Scegli la cartella dell\'asta'), FILES);
    await screen.findByText('Asta del 2025');
    await userEvent.selectOptions(await screen.findByLabelText('Membro per Io'), 'u2');
    await userEvent.selectOptions(screen.getByLabelText('Membro per Marco'), 'u2');
    expect(screen.getByRole('button', { name: 'Importa l\'asta' })).toBeDisabled();
  });

  it('una cartella senza asta lo dice', async () => {
    stub();
    renderImport();
    await userEvent.upload(await screen.findByLabelText('Scegli la cartella dell\'asta'), [new File(['x'], 'foto.jpg')]);
    expect(await screen.findByRole('alert')).toHaveTextContent('In questa cartella non c\'è un\'asta di FantaAgent.');
  });

  it('se le rose non coincidono lo dice e non va avanti', async () => {
    stub(() => json({
      type: 'https://fantaagent.local/problems/import-mismatch',
      detail: 'Le rose ricostruite non coincidono con quelle dell\'asta originale: l\'importazione è stata annullata.',
    }, 409));
    renderImport();
    await userEvent.upload(await screen.findByLabelText('Scegli la cartella dell\'asta'), FILES);
    await userEvent.selectOptions(await screen.findByLabelText('Membro per Io'), 'u1');
    await userEvent.click(screen.getByRole('button', { name: 'Importa l\'asta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('non coincidono');
  });
});
