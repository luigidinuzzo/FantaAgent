import { fireEvent, render, screen, within } from '@testing-library/react';
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

    await userEvent.upload(await screen.findByLabelText('Scegli la cartella', { selector: 'input' }), FILES);
    expect(await screen.findByText('Asta del 2025')).toBeInTheDocument();

    const table = screen.getByRole('list', { name: 'Abbinamenti' });
    expect(within(table).getByLabelText('Membro per Marco')).toHaveValue('u2');
    await userEvent.selectOptions(within(table).getByLabelText('Membro per Io'), 'u1');
    await userEvent.click(screen.getByRole('button', { name: 'Importa l\'asta' }));

    expect(await screen.findByText('asta importata')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/leghe/l1/aste/a9');
    const preview = fetchMock.mock.calls.find(([url]) => url === '/api/leagues/l1/imports/preview');
    const sent = (preview![1].body as FormData).getAll('files') as File[];
    expect(sent.map((f) => f.name).sort()).toEqual(['events.jsonl', 'league-members.yml']);
  });

  /**
   * Sul telefono a 360px «Atletico Ma Non Troppo · Diego» non stava nella tendina:
   * il riquadro degli abbinamenti perde i margini di lato e la tendina un po' del
   * suo, cosi' il nome scelto si legge intero; l'anello del fuoco va dentro il bordo. Il testo resta a 16px: piu'
   * piccolo, Safari ingrandirebbe la pagina al tocco.
   */
  it('sul telefono la tendina ha tutta la larghezza del riquadro', async () => {
    stub();
    renderImport();
    await userEvent.upload(await screen.findByLabelText('Scegli la cartella', { selector: 'input' }), FILES);
    const list = await screen.findByRole('list', { name: 'Abbinamenti' });
    const box = list.parentElement!;
    expect(box.className).toContain('max-sm:px-0');
    expect(box.className).toContain('max-sm:border-x-0');
    const select = within(list).getByLabelText('Membro per Marco');
    expect(select.className).toContain('max-sm:px-3');
    // Senza margine di lato, l'anello del fuoco sta dentro il bordo o il riquadro lo taglia.
    expect(select.className).toContain('max-sm:-outline-offset-2');
    expect(select.className).toContain('text-base');
  });

  it('non importa finche\' manca un abbinamento', async () => {
    stub();
    renderImport();
    await userEvent.upload(await screen.findByLabelText('Scegli la cartella', { selector: 'input' }), FILES);
    await screen.findByText('Asta del 2025');
    expect(screen.getByRole('button', { name: 'Importa l\'asta' })).toBeDisabled();
  });

  it('due partecipanti allo stesso membro: pulsante spento', async () => {
    stub();
    renderImport();
    await userEvent.upload(await screen.findByLabelText('Scegli la cartella', { selector: 'input' }), FILES);
    await screen.findByText('Asta del 2025');
    await userEvent.selectOptions(await screen.findByLabelText('Membro per Io'), 'u2');
    await userEvent.selectOptions(screen.getByLabelText('Membro per Marco'), 'u2');
    expect(screen.getByRole('button', { name: 'Importa l\'asta' })).toBeDisabled();
  });

  it('dice il nome della cartella scelta, dal percorso dei suoi file', async () => {
    stub();
    renderImport();
    const inFolder = FILES.map((f) => {
      const copy = new File([f], f.name);
      Object.defineProperty(copy, 'webkitRelativePath', { value: `Asta di settembre/${f.name}` });
      return copy;
    });
    await userEvent.upload(await screen.findByLabelText('Scegli la cartella', { selector: 'input' }), inFolder);
    await screen.findByText('Asta del 2025');
    expect(screen.getByText('Asta di settembre')).toBeInTheDocument();
  });

  it('una cartella senza asta lo dice', async () => {
    stub();
    renderImport();
    await userEvent.upload(await screen.findByLabelText('Scegli la cartella', { selector: 'input' }), [new File(['x'], 'foto.jpg')]);
    expect(await screen.findByRole('alert')).toHaveTextContent('In questa cartella non c\'è un\'asta di FantaAgent.');
  });

  it('una cartella senza asta scelta dopo una valida cancella l\'anteprima precedente', async () => {
    stub();
    renderImport();
    const input = await screen.findByLabelText('Scegli la cartella', { selector: 'input' });
    await userEvent.upload(input, FILES);
    expect(await screen.findByText('Asta del 2025')).toBeInTheDocument();

    await userEvent.upload(screen.getByLabelText('Scegli la cartella', { selector: 'input' }), [new File(['x'], 'foto.jpg')]);

    expect(await screen.findByRole('alert')).toHaveTextContent('In questa cartella non c\'è un\'asta di FantaAgent.');
    expect(screen.queryByText('Asta del 2025')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Abbinamenti' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Importa l\'asta' })).not.toBeInTheDocument();
  });

  it('se le rose non coincidono lo dice e non va avanti', async () => {
    stub(() => json({
      type: 'https://fantaagent.local/problems/import-mismatch',
      detail: 'Le rose ricostruite non coincidono con quelle dell\'asta originale: l\'importazione è stata annullata.',
    }, 409));
    renderImport();
    await userEvent.upload(await screen.findByLabelText('Scegli la cartella', { selector: 'input' }), FILES);
    await userEvent.selectOptions(await screen.findByLabelText('Membro per Io'), 'u1');
    await userEvent.click(screen.getByRole('button', { name: 'Importa l\'asta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('non coincidono');
  });

  it('due passaggi numerati, il secondo spento finche non c e una cartella', async () => {
    stub();
    renderImport();
    const steps = screen.getByRole('list', { name: 'Passaggi' });
    expect(within(steps).getAllByRole('listitem').map((li) => li.textContent)).toEqual(
      [expect.stringContaining('Scegli la cartella'), expect.stringContaining('Abbina i partecipanti')]);
    // Spento a vista, non con aria-disabled: un <li> non e' un controllo, e prima della
    // cartella il passaggio non ne ha. Lo dice la frase, i controlli arrivano dopo.
    const step2 = screen.getByTestId('import-step-2');
    expect(step2).not.toHaveAttribute('aria-disabled');
    expect(step2.className).toContain('text-muted-foreground');
    expect(within(step2).queryByRole('combobox')).toBeNull();
    expect(within(step2).queryByRole('button')).toBeNull();
    await userEvent.upload(await screen.findByLabelText('Scegli la cartella', { selector: 'input' }), FILES);
    await screen.findByText('Asta del 2025');
    expect(step2).not.toHaveAttribute('aria-disabled');
    expect(step2.className).not.toContain('text-muted-foreground');
  });

  it('prima della scelta spiega cosa deve contenere la cartella', () => {
    stub();
    renderImport();
    expect(screen.getByText(/cartella di un'asta giocata con FantaAgent/)).toBeInTheDocument();
  });

  it('il riquadro ha da subito l altezza del passaggio piu alto', () => {
    stub();
    renderImport();
    expect(screen.getByTestId('import-box').className).toContain('min-h-[55rem]');
  });

  it('prima della scelta: la zona della cartella, niente abbinamenti, niente oro', () => {
    stub();
    renderImport();
    expect(screen.getByText(/l'elenco dei partecipanti/)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Abbinamenti' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Importa l\'asta' })).not.toBeInTheDocument();
    expect(document.body.querySelectorAll('.bg-accent')).toHaveLength(0);
  });

  it('Importa l asta e l unico oro', async () => {
    stub();
    renderImport();
    const container = document.body;
    await userEvent.upload(await screen.findByLabelText('Scegli la cartella', { selector: 'input' }), FILES);
    await screen.findByText('Asta del 2025');
    expect(container.querySelectorAll('.bg-accent')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Importa l\'asta' }).className).toContain('bg-accent');
  });

  // La scelta arriva come la manda il browser, con un change sul campo: il fuoco
  // resta sul bottone che l'ha aperta (userEvent.upload lo sposterebbe sul campo).
  const pick = (files: File[]) => fireEvent.change(
    screen.getByLabelText('Scegli la cartella', { selector: 'input' }), { target: { files } });

  it('la scelta della cartella e\' un solo bottone nei due stati: il fuoco resta li\'', async () => {
    stub();
    renderImport();
    const button = screen.getByRole('button', { name: 'Scegli la cartella' });
    button.focus();
    pick(FILES);
    await screen.findByText('Asta del 2025');
    expect(screen.getByRole('button', { name: 'Scegli la cartella' })).toBe(button);
    expect(button).toHaveFocus();
  });

  it('mentre legge una seconda cartella dice «Leggo l\'asta…» e il bottone tiene il fuoco', async () => {
    const fetchMock = stub();
    renderImport();
    pick(FILES);
    await screen.findByText('Asta del 2025');
    const button = screen.getByRole('button', { name: 'Scegli la cartella' });
    button.focus();
    fetchMock.mockImplementation((url: string) => (url.endsWith('/imports/preview')
      ? new Promise(() => {}) : Promise.resolve(json(LEAGUE))));
    pick(FILES);
    expect(await screen.findByText('Leggo l\'asta…')).toBeInTheDocument();
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });

  it('l\'errore dell\'importazione sta accanto a «Importa l\'asta»', async () => {
    stub(() => json({
      type: 'https://fantaagent.local/problems/import-mismatch',
      detail: 'Le rose ricostruite non coincidono con quelle dell\'asta originale: l\'importazione è stata annullata.',
    }, 409));
    renderImport();
    await userEvent.upload(await screen.findByLabelText('Scegli la cartella', { selector: 'input' }), FILES);
    await userEvent.selectOptions(await screen.findByLabelText('Membro per Io'), 'u1');
    await userEvent.click(screen.getByRole('button', { name: 'Importa l\'asta' }));
    const alert = await screen.findByRole('alert');
    expect(screen.getByTestId('import-step-2')).toContainElement(alert);
    expect(alert.parentElement).toContainElement(screen.getByRole('button', { name: 'Importa l\'asta' }));
  });
});
