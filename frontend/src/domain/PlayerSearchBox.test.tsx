import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerSearchBox } from './PlayerSearchBox';

const calls: string[] = [];
let resolvers: Array<(rows: unknown[]) => void> = [];

function renderBox(onSelect: (playerId: string) => void = () => {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <PlayerSearchBox onSelect={onSelect} />
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

describe('PlayerSearchBox', () => {
  it('il campo ha un\'etichetta raggiungibile, non solo un placeholder', () => {
    renderBox();
    expect(screen.getByRole('searchbox', { name: /cerca giocatore/i })).toBeInTheDocument();
  });

  it('i cinque filtri sono un gruppo di radio nativi, con "Tutti" selezionato all\'avvio', () => {
    renderBox();
    const group = screen.getByRole('group', { name: /filtra per ruolo/i });
    const radios = screen.getAllByRole('radio');
    expect(group).toBeInTheDocument();
    expect(radios).toHaveLength(5);
    expect(screen.getByRole('radio', { name: /tutti/i })).toBeChecked();
  });

  it('ogni filtro di ruolo garantisce un bersaglio di almeno 44px', () => {
    renderBox();
    // Un radio nascosto e la sua pillola: il bersaglio cliccabile e' la
    // <label>, non l'input, quindi e' la label a dover portare min-h-11 e
    // min-w-11. Senza min-w-11 sui quattro ruoli il bersaglio si stringe
    // alla larghezza del RoleBadge (24px) che contengono — lo stesso debito
    // gia' chiuso per la tabella di fase, dove pero' dipendeva
    // dall'auto-layout e reggeva per caso.
    for (const name of [/tutti/i, /portiere/i, /difensore/i, /centrocampista/i, /attaccante/i]) {
      const radio = screen.getByRole('radio', { name });
      const label = radio.closest('label');
      expect(label).toHaveClass('min-h-11');
      expect(label).toHaveClass('min-w-11');
    }
  });

  it('nel gruppo dei ruoli solo un elemento resta nel flusso di tabulazione', async () => {
    const user = setupUser();
    renderBox();

    await user.type(screen.getByRole('searchbox', { name: /cerca giocatore/i }), 'ros');
    await vi.advanceTimersByTimeAsync(300);
    await waitFor(() => expect(calls).toHaveLength(1));
    resolvers[0]([{ id: 'a1', name: 'Rossini', team: 'Roma', role: 'A', listPrice: 10 }]);
    await waitFor(() => expect(screen.getByRole('button', { name: /rossini/i })).toBeInTheDocument());

    screen.getByRole('searchbox', { name: /cerca giocatore/i }).focus();

    // "Tutti" e' selezionato all'avvio: e' l'unico radio del gruppo che il
    // browser include nella tabulazione. Un radiogroup ARIA finto (bottoni
    // con role="radio") si sarebbe fermato qui cinque volte prima di
    // raggiungere il risultato.
    await user.tab();
    expect(screen.getByRole('radio', { name: /tutti/i })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: /rossini/i })).toHaveFocus();
  });

  it('selezionare un ruolo e cercare produce una chiamata con quel ruolo', async () => {
    const user = setupUser();
    renderBox();

    await user.click(screen.getByRole('radio', { name: /attaccante/i }));
    await user.type(screen.getByRole('searchbox', { name: /cerca giocatore/i }), 'ros');
    await vi.advanceTimersByTimeAsync(300);

    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    expect(calls[calls.length - 1]).toContain('role=A');
    expect(calls[calls.length - 1]).toContain('q=ros');
  });

  it('scegliere un risultato invoca onSelect con l\'identificativo del giocatore', async () => {
    const onSelect = vi.fn();
    const user = setupUser();
    renderBox(onSelect);

    await user.type(screen.getByRole('searchbox', { name: /cerca giocatore/i }), 'ros');
    await vi.advanceTimersByTimeAsync(300);
    await waitFor(() => expect(calls).toHaveLength(1));

    resolvers[0]([{ id: 'a1', name: 'Rossini', team: 'Roma', role: 'A', listPrice: 10 }]);
    await waitFor(() => expect(screen.getByRole('button', { name: /rossini/i })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /rossini/i }));
    expect(onSelect).toHaveBeenCalledWith('a1');
  });

  it('il prezzo nel risultato porta l\'unita\', non solo il numero nudo', async () => {
    const user = setupUser();
    renderBox();

    await user.type(screen.getByRole('searchbox', { name: /cerca giocatore/i }), 'ros');
    await vi.advanceTimersByTimeAsync(300);
    await waitFor(() => expect(calls).toHaveLength(1));

    resolvers[0]([{ id: 'a1', name: 'Rossini', team: 'Roma', role: 'A', listPrice: 20 }]);
    // Senza l'unita' chi ascolta sente "Rossini Roma 20": un numero nudo,
    // indistinguibile da un altro dato qualsiasi della riga.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /rossini.*roma.*20 crediti/i })).toBeInTheDocument(),
    );
  });

  it('mentre la richiesta e\' in volo lo dice anche a chi ascolta', async () => {
    const user = setupUser();
    renderBox();

    await user.type(screen.getByRole('searchbox', { name: /cerca giocatore/i }), 'ros');
    await vi.advanceTimersByTimeAsync(300);
    await waitFor(() => expect(calls).toHaveLength(1));

    expect(screen.getByText(/ricerca in corso/i)).toBeInTheDocument();
  });

  it('zero risultati mostra una frase, non una lista vuota silenziosa', async () => {
    const user = setupUser();
    renderBox();

    await user.type(screen.getByRole('searchbox', { name: /cerca giocatore/i }), 'zzz');
    await vi.advanceTimersByTimeAsync(300);
    await waitFor(() => expect(calls).toHaveLength(1));

    resolvers[0]([]);
    await waitFor(() => expect(screen.getByText(/nessun giocatore trovato/i)).toBeInTheDocument());
  });
});
