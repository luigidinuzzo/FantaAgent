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
  const roleGroupName = useId();

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

      {/* Radio nativi, non bottoni con role="radio": un radiogroup ARIA finto
          promette le frecce e un solo fermo in tabulazione, e non le mantiene
          senza gestire la tastiera a mano. Un <input type="radio"> vero le
          regala gratis (roving tabindex, frecce), e <fieldset>/<legend> danno
          al gruppo il nome accessibile senza aria-label — lo stesso schema di
          "sei tu" in ParticipantsFieldset. L'input resta sr-only (non hidden,
          non display:none): deve restare a fuoco raggiungibile, e' la
          <label> a portare la pillola visibile e il bersaglio cliccabile. */}
      <fieldset className="m-0 border-0 p-0">
        <legend className="sr-only">Filtra per ruolo</legend>
        <div className="flex flex-wrap gap-2">
          <label
            className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border px-3 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
              role === null ? 'border-accent bg-accent font-bold text-on-accent' : 'border-line-strong text-muted-foreground'
            }`}
          >
            <input
              type="radio"
              name={roleGroupName}
              checked={role === null}
              onChange={() => setRole(null)}
              className="sr-only"
            />
            Tutti
          </label>
          {ROLES.map((r) => (
            <label
              key={r}
              // min-w-11 qui non e' decorativo: senza, il bersaglio tattile
              // della pillola sarebbe largo quanto RoleBadge (24px), molto
              // sotto i 44px richiesti su ogni controllo — lo stesso debito
              // gia' chiuso per la tabella di fase (PlayerTable.tsx), dove
              // pero' dipendeva dall'auto-layout della cella. Qui e' esplicito.
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent"
            >
              <input
                type="radio"
                name={roleGroupName}
                checked={role === r}
                onChange={() => setRole(r)}
                className="sr-only"
              />
              <RoleBadge role={r} filled={role === r} />
            </label>
          ))}
        </div>
      </fieldset>

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
                <span className="tnum text-sm text-muted-foreground">
                  {/* Lo spazio sta DOPO il numero, nello stesso nodo di testo: un
                      nodo separato che iniziasse per spazio (o uno spazio soltanto,
                      come suo unico contenuto) verrebbe scartato dal calcolo del
                      nome accessibile, che rifila gli spazi iniziali/finali di ogni
                      sottoalbero prima di concatenare. Cosi' "20" e "crediti" non
                      si saldano in "20crediti". */}
                  {`${player.listPrice} `}
                  <span className="sr-only">crediti</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
