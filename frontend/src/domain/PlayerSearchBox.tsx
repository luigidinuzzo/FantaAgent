import { useId, useState } from 'react';
import type { Role } from '../api/types';
import { usePlayerSearch } from '../api/usePlayerSearch';
import { EmptyState } from './EmptyState';
import { RoleBadge } from './RoleBadge';

const ROLES: Role[] = ['P', 'D', 'C', 'A'];

/**
 * La ricerca per nome del mockup: un campo di testo, quattro pillole di ruolo
 * (piu' "Tutti") e l'elenco dei risultati come bottoni.
 *
 * <p>Non conosce il tabellone: sceglie solo un identificativo e lo passa a
 * {@code onSelect}. Il Task 6 collega quella scelta a {@code setSelectedId} dentro
 * {@code AuctionRoute}, dove la valutazione arriva da {@code useValuation}.
 */
export function PlayerSearchBox({ onSelect }: { onSelect: (playerId: string) => void }) {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<Role | null>(null);
  const searchId = useId();

  const { data, isFetching } = usePlayerSearch(query, role);

  const trimmed = query.trim();
  const noResults = trimmed !== '' && !isFetching && data !== undefined && data.length === 0;

  // Statico, non una live region: la pagina ne ha una sola (AuctionAnnouncer),
  // e una seconda competerebbe con quella. "Nessun risultato" ha gia' una frase
  // visibile (sotto, con EmptyState) che chi ascolta raggiunge da sola: qui
  // serve solo lo stato che altrimenti non avrebbe alcuna traccia testuale,
  // "sto cercando".
  const searchingHint = isFetching ? 'Ricerca in corso.' : '';

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label htmlFor={searchId} className="block text-sm text-muted-foreground">
          Cerca giocatore
        </label>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mt-1 min-h-11 w-full border border-line-strong bg-transparent px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        />
      </div>

      <div role="radiogroup" aria-label="Filtra per ruolo" className="flex flex-wrap gap-2">
        <button
          type="button"
          role="radio"
          aria-checked={role === null}
          onClick={() => setRole(null)}
          className={`min-h-11 min-w-11 rounded-full border px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
            role === null ? 'border-accent bg-accent font-bold text-on-accent' : 'border-line-strong text-muted-foreground'
          }`}
        >
          Tutti
        </button>
        {ROLES.map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={role === r}
            onClick={() => setRole(r)}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <RoleBadge role={r} filled={role === r} />
          </button>
        ))}
      </div>

      <span className="sr-only">{searchingHint}</span>

      {noResults ? (
        <EmptyState>Nessun giocatore trovato.</EmptyState>
      ) : (
        <ul className="flex flex-col">
          {(data ?? []).map((player) => (
            <li key={player.id}>
              <button
                type="button"
                onClick={() => onSelect(player.id)}
                className="flex min-h-11 w-full items-center gap-3 border-b border-line px-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <RoleBadge role={player.role} />
                <span className="flex-1 truncate">{player.name}</span>
                <span className="text-sm text-muted-foreground">{player.team}</span>
                <span className="tnum text-sm text-muted-foreground">{player.listPrice}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
