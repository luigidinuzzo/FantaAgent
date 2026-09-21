import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerSearchBox } from './PlayerSearchBox';

const calls: string[] = [];
let resolvers: Array<(rows: unknown[]) => void> = [];

function renderBox(
  onSelect: (playerId: string) => void = () => {},
  onActiveChange?: (active: boolean) => void,
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <PlayerSearchBox onSelect={onSelect} onActiveChange={onActiveChange} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  calls.length = 0;
  resolvers = [];
  vi.stubGlobal('fetch', (input: string) => {
    calls.push(input);
    return new Promise((resolve) => {
      resolvers.push((rows) =>
        resolve(new Response(JSON.stringify(rows), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })));
    });
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// userEvent usa i propri setTimeout interni: con i timer finti va configurato a
// far avanzare l'orologio di vitest, altrimenti resta in attesa per sempre.
function setupUser() {
  return userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime.bind(vi) });
}

function field() {
  return screen.getByRole('searchbox', { name: /cerca giocatore/i });
}

/** Digita, lascia scadere l'attesa e risponde con quei giocatori. */
async function search(user: ReturnType<typeof setupUser>, text: string, rows: unknown[]) {
  await user.type(field(), text);
  await vi.advanceTimersByTimeAsync(300);
  await waitFor(() => expect(calls.length).toBeGreaterThan(0));
  resolvers[resolvers.length - 1](rows);
}

describe('PlayerSearchBox', () => {
  it('il campo ha un\'etichetta raggiungibile, non solo un placeholder', () => {
    renderBox();
    // Il placeholder sparisce appena si scrive: chi ascolta resterebbe con un
    // campo senza nome.
    expect(field()).toBeInTheDocument();
  });

  it('a riposo e\' una barra e basta: nessun filtro e nessun elenco in scena', () => {
    renderBox();
    expect(screen.queryByRole('group', { name: /filtra per ruolo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('i nomi si leggono su un pannello, mai direttamente sull\'erba', async () => {
    const user = setupUser();
    const { container } = renderBox();

    // La regola sta scritta in index.css: tutto cio' che si legge sta dentro un
    // pannello. In linea sul campo, le righe del disegno passavano attraverso i
    // nomi. Un pannello solo per barra e risultati: due (uno attorno alla barra,
    // uno attorno all'elenco) sarebbero il doppio contorno di prima.
    const radice = container.firstElementChild;
    expect(radice).toHaveClass('panel');

    await search(user, 'ros', [{ id: 'a1', name: 'Rossini', team: 'Roma', role: 'A', listPrice: 10 }]);
    await waitFor(() => expect(screen.getByRole('button', { name: /rossini/i })).toBeInTheDocument());

    expect(screen.getByRole('list', { name: /risultati/i }).closest('.panel')).toBe(radice);
    expect(field().className).not.toContain('border');
  });

  it('l\'elenco non cresce con i risultati: si ferma e si scorre', async () => {
    const user = setupUser();
    renderBox();

    // Venti nomi non fanno un pannello alto venti nomi: senza un tetto, la riga
    // della griglia si allungherebbe e con essa le colonne accanto — a ogni
    // lettera digitata.
    await search(user, 'a', Array.from({ length: 20 }, (_, i) => ({
      id: `p${i}`,
      name: `Giocatore ${i}`,
      team: 'Roma',
      role: 'A',
      listPrice: 10,
    })));
    const elenco = await screen.findByRole('list', { name: /risultati/i });

    expect(elenco).toHaveClass('max-h-60');
    expect(elenco).toHaveClass('overflow-y-auto');
  });

  it('i cinque filtri compaiono cercando, con "Tutti" selezionato', async () => {
    const user = setupUser();
    renderBox();

    await search(user, 'ros', []);

    const group = screen.getByRole('group', { name: /filtra per ruolo/i });
    expect(within(group).getAllByRole('radio')).toHaveLength(5);
    expect(screen.getByRole('radio', { name: /tutti/i })).toBeChecked();
  });

  it('ogni filtro di ruolo garantisce un bersaglio di almeno 44px', async () => {
    const user = setupUser();
    renderBox();

    await search(user, 'ros', []);

    // Un radio nascosto e la sua pillola: il bersaglio cliccabile e' la
    // <label>, non l'input, quindi e' la label a dover portare min-h-11 e
    // min-w-11. Senza min-w-11 sui quattro ruoli il bersaglio si stringe
    // alla larghezza del RoleBadge (24px) che contengono.
    for (const name of [/tutti/i, /portiere/i, /difensore/i, /centrocampista/i, /attaccante/i]) {
      const label = screen.getByRole('radio', { name }).closest('label');
      expect(label).toHaveClass('min-h-11');
      expect(label).toHaveClass('min-w-11');
    }
  });

  it('nel gruppo dei ruoli solo un elemento resta nel flusso di tabulazione', async () => {
    const user = setupUser();
    renderBox();

    await search(user, 'ros', [{ id: 'a1', name: 'Rossini', team: 'Roma', role: 'A', listPrice: 10 }]);
    await waitFor(() => expect(screen.getByRole('button', { name: /rossini/i })).toBeInTheDocument());

    field().focus();

    // "Tutti" e' selezionato all'avvio: e' l'unico radio del suo gruppo che il
    // browser include nella tabulazione. Un radiogroup ARIA finto (bottoni con
    // role="radio") si sarebbe fermato cinque volte prima di raggiungere il
    // risultato: una fermata sola e' il punto del test.
    await user.tab();
    expect(screen.getByRole('radio', { name: /tutti/i })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: /rossini/i })).toHaveFocus();
  });

  it('selezionare un ruolo e cercare produce una chiamata con quel ruolo', async () => {
    const user = setupUser();
    renderBox();

    await search(user, 'ros', []);
    await user.click(screen.getByRole('radio', { name: /attaccante/i }));
    await vi.advanceTimersByTimeAsync(300);

    await waitFor(() => expect(calls[calls.length - 1]).toContain('role=A'));
    expect(calls[calls.length - 1]).toContain('q=ros');
  });

  it('scegliere un risultato invoca onSelect e chiude la ricerca', async () => {
    const onSelect = vi.fn();
    const user = setupUser();
    renderBox(onSelect);

    await search(user, 'ros', [{ id: 'a1', name: 'Rossini', team: 'Roma', role: 'A', listPrice: 10 }]);
    await waitFor(() => expect(screen.getByRole('button', { name: /rossini/i })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /rossini/i }));

    expect(onSelect).toHaveBeenCalledWith('a1');
    // Scelto il nome, la barra torna vuota e l'elenco lascia la pagina: si e'
    // finito di cercare, e il posto torna a chi stava sotto.
    expect(field()).toHaveValue('');
    expect(screen.queryByRole('button', { name: /rossini/i })).not.toBeInTheDocument();
  });

  it('Esc svuota campo e filtro: la via d\'uscita da una ricerca aperta per sbaglio', async () => {
    const user = setupUser();
    renderBox();

    await search(user, 'ros', []);
    await user.click(screen.getByRole('radio', { name: /attaccante/i }));

    await user.keyboard('{Escape}');

    expect(field()).toHaveValue('');
    expect(screen.queryByRole('group', { name: /filtra per ruolo/i })).not.toBeInTheDocument();
  });

  it('dice a chi la monta quando si sta cercando e quando si e\' finito', async () => {
    const onActiveChange = vi.fn();
    const user = setupUser();
    renderBox(() => {}, onActiveChange);

    // Al montaggio dichiara di non star cercando: chi ascolta questo stato deve
    // poter decidere cosa mostrare senza prima aspettare una digitazione.
    expect(onActiveChange).toHaveBeenLastCalledWith(false);

    await search(user, 'ros', []);
    expect(onActiveChange).toHaveBeenLastCalledWith(true);

    await user.keyboard('{Escape}');
    expect(onActiveChange).toHaveBeenLastCalledWith(false);
  });

  it('il prezzo nel risultato porta l\'unita\', non solo il numero nudo', async () => {
    const user = setupUser();
    renderBox();

    await search(user, 'ros', [{ id: 'a1', name: 'Rossini', team: 'Roma', role: 'A', listPrice: 20 }]);

    // Senza l'unita' chi ascolta sente "Rossini Roma 20": un numero nudo,
    // indistinguibile da un altro dato qualsiasi della riga.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /rossini.*roma.*20 crediti/i })).toBeInTheDocument(),
    );
  });

  it('mentre la richiesta e\' in volo lo dice anche a chi ascolta', async () => {
    const user = setupUser();
    renderBox();

    await user.type(field(), 'ros');
    await vi.advanceTimersByTimeAsync(300);
    await waitFor(() => expect(calls).toHaveLength(1));

    expect(screen.getByText(/ricerca in corso/i)).toBeInTheDocument();
  });

  it('zero risultati mostra una frase, non una lista vuota silenziosa', async () => {
    const user = setupUser();
    renderBox();

    await search(user, 'zzz', []);

    await waitFor(() => expect(screen.getByText(/nessun giocatore trovato/i)).toBeInTheDocument());
  });
});
