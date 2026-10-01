import { useEffect, useRef, useState, type RefObject } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fieldErrors, formMessage, userMessage } from '../api/client';
import { MIN_SEARCH, useLeagueSearch, useRequestJoin } from '../api/leagues';
import type { LeagueMatch } from '../api/types';
import { TextField } from './AuthForm';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, FIELD } from './controls';
import { Modal } from './Modal';

/** L'azione di ogni riga trovata: stessa colonna, stessa larghezza, qualunque sia. */
const ACTION = `w-40 shrink-0 text-sm ${BUTTON_SECONDARY}`;

/**
 * Unisciti a una lega, in una finestra sopra la home: cercarla per nome e chiedere
 * di entrare, o incollare il link d'invito.
 *
 * <p>La finestra ha l'altezza dello stato con piu' risultati: l'area dei risultati
 * e' alta sei righe (24rem) in ogni stato — prima di scrivere, mentre cerca, senza
 * risultati, con la richiesta da mandare — e oltre le sei righe scorre dentro. Sul
 * telefono l'area e' alta cinque righe (20rem), fissa anch'essa: cosi' il link
 * d'invito sta nello schermo anche a 360x740.
 */
export function JoinLeagueDialog({ open, onClose, returnFocusRef }: {
  open: boolean;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const searchRef = useRef<HTMLInputElement>(null);
  return (
    <Modal open={open} titleId="join-league-title" title="Unisciti a una lega" onClose={onClose}
      initialFocusRef={searchRef} returnFocusRef={returnFocusRef}>
      <JoinLeagueBody searchRef={searchRef} />
    </Modal>
  );
}

function useDebounced(value: string, ms: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

function JoinLeagueBody({ searchRef }: { searchRef: RefObject<HTMLInputElement | null> }) {
  const [text, setText] = useState('');
  const query = useDebounced(text, 250);
  const search = useLeagueSearch(query);
  const [chosen, setChosen] = useState<LeagueMatch | null>(null);
  const [sentTo, setSentTo] = useState<LeagueMatch | null>(null);
  const tooShort = text.trim().length < MIN_SEARCH;

  return (
    <div className="flex flex-col">
      <label htmlFor="league-search" className="block text-sm font-medium">Cerca la lega</label>
      <input
        ref={searchRef}
        id="league-search"
        type="search"
        autoComplete="off"
        value={text}
        onChange={(e) => { setText(e.target.value); setChosen(null); setSentTo(null); }}
        aria-describedby="league-search-status"
        className={`mt-2 ${FIELD}`}
      />
      <div
        data-testid="join-results"
        className="mt-4 box-content h-[24rem] overflow-y-auto rounded-lg border border-line max-sm:h-[20rem]"
      >
        {chosen ? (
          <RequestForm
            league={chosen}
            onCancel={() => setChosen(null)}
            onSent={() => { setSentTo(chosen); setChosen(null); }}
          />
        ) : (
          <SearchResults
            tooShort={tooShort}
            search={search}
            sentTo={sentTo}
            onChoose={(league) => { setChosen(league); setSentTo(null); }}
          />
        )}
      </div>
      <InviteLinkForm />
    </div>
  );
}

/**
 * Il codice di un link d'invito, dal link intero o dal solo codice. Si accetta
 * qualunque indirizzo che finisca in /invito/<codice>: chi copia il link da un
 * messaggio non deve preoccuparsi di cosa c'e' prima. Il codice e' in base64url.
 */
export function inviteToken(text: string): string | null {
  const clean = text.trim();
  const fromLink = clean.match(/\/invito\/([A-Za-z0-9_-]{16,})\/?(?:[?#].*)?$/);
  if (fromLink) return fromLink[1]!;
  return /^[A-Za-z0-9_-]{16,}$/.test(clean) ? clean : null;
}

/**
 * L'altra strada: il link d'invito. Porta alla pagina dell'invito, la stessa che si
 * apre cliccando il link, dove si sceglie la squadra e si entra senza aspettare
 * nessuno. Qui si ferma solo cio' che un link non e'; se e' scaduto o ritirato lo
 * dice quella pagina. L'errore prende il posto della riga di spiegazione, nella
 * stessa scatola: la finestra non cresce.
 */
function InviteLinkForm() {
  const navigate = useNavigate();
  const [link, setLink] = useState('');
  const [invalid, setInvalid] = useState(false);
  return (
    <div role="group" aria-labelledby="invite-link-title" className="mt-4 shrink-0 border-t border-line pt-4">
      <p id="invite-link-title" className="text-sm font-medium">Hai un link d&apos;invito?</p>
      <form
        className="mt-2 flex gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const token = inviteToken(link);
          if (token) navigate(`/invito/${token}`);
          else setInvalid(true);
        }}
      >
        <input
          id="invite-link-input"
          type="text"
          inputMode="url"
          autoComplete="off"
          aria-label="Il link d'invito"
          placeholder="Incolla qui il link"
          value={link}
          onChange={(e) => { setLink(e.target.value); setInvalid(false); }}
          aria-invalid={invalid ? 'true' : undefined}
          aria-describedby="invite-link-note"
          className={`min-w-0 flex-1 ${FIELD}`}
        />
        <button type="submit" disabled={link.trim() === ''} className={`min-h-12 shrink-0 text-sm ${BUTTON_SECONDARY}`}>
          Entra con il link
        </button>
      </form>
      <div className="mt-2 min-h-10">
        {invalid ? (
          <p id="invite-link-note" role="alert" className="text-sm font-medium text-destructive">
            Questo non sembra un link d&apos;invito: copialo per intero dal messaggio che ti hanno mandato.
          </p>
        ) : (
          <p id="invite-link-note" className="text-sm text-muted-foreground">
            Ti porta alla pagina dell&apos;invito, dove entri subito con la tua squadra.
          </p>
        )}
      </div>
    </div>
  );
}

function SearchResults({ tooShort, search, sentTo, onChoose }: {
  tooShort: boolean;
  search: ReturnType<typeof useLeagueSearch>;
  sentTo: LeagueMatch | null;
  onChoose: (league: LeagueMatch) => void;
}) {
  const results = search.data ?? [];
  let status: string;
  if (sentTo) {
    status = `Richiesta inviata a ${sentTo.adminName || 'l\'amministratore'}. La trovi fra le tue leghe finché non risponde.`;
  } else if (tooShort) {
    status = `Scrivi almeno ${MIN_SEARCH} lettere del nome.`;
  } else if (search.isError) {
    status = userMessage(search.error, 'Non riesco a cercare in questo momento. Riprova fra poco.');
  } else if (search.isPending || search.isFetching && results.length === 0) {
    status = 'Cerco…';
  } else if (results.length === 0) {
    status = 'Nessuna lega con questo nome. Controlla come si scrive, o chiedi il link d\'invito a chi la organizza.';
  } else {
    status = results.length === 1 ? '1 lega trovata.' : `${results.length} leghe trovate.`;
  }
  const showList = !tooShort && !search.isError && results.length > 0;

  // Prima di scrivere l'area non e' un elenco vuoto: dice cosa ci comparira'.
  if (tooShort && !sentTo) {
    return (
      <div className="grid h-full content-center justify-items-center gap-2 px-6 text-center">
        <p id="league-search-status" role="status" className="font-medium">{status}</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Qui compaiono le leghe trovate, con chi le amministra.
        </p>
      </div>
    );
  }

  return (
    <>
      <p
        id="league-search-status"
        role="status"
        className={`px-4 text-sm ${sentTo ? 'pt-4 font-medium text-positive' : 'text-muted-foreground'} ${
          showList && !sentTo ? 'sr-only' : 'py-4'
        }`}
      >
        {status}
      </p>
      {showList ? (
        <ul aria-label="Leghe trovate" className="divide-y divide-line">
          {results.map((league) => (
            <li key={league.id} className="flex min-h-16 items-center gap-3 px-4 py-2">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{league.name}</span>
                <span className="block text-sm text-muted-foreground">
                  {league.adminName ? `Amministra ${league.adminName} · ` : ''}
                  {league.members === 1 ? '1 membro' : `${league.members} membri`}
                </span>
              </span>
              {league.status === 'MEMBER' ? (
                <Link to={`/leghe/${league.id}`} className={ACTION}>Apri</Link>
              ) : league.status === 'PENDING' ? (
                <button type="button" disabled className={ACTION}>Richiesta inviata</button>
              ) : (
                <button type="button" onClick={() => onChoose(league)} className={ACTION}
                  aria-label={`Chiedi di entrare in ${league.name}`}>
                  Chiedi di entrare
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

function RequestForm({ league, onCancel, onSent }: {
  league: LeagueMatch;
  onCancel: () => void;
  onSent: () => void;
}) {
  const send = useRequestJoin();
  const [teamName, setTeamName] = useState('');
  const errors = fieldErrors(send.error);
  const message = formMessage(send.error, ['teamName'], 'Non sono riuscito a mandare la richiesta. Riprova fra poco.');

  return (
    <form
      className="flex h-full flex-col p-4"
      aria-labelledby="join-request-title"
      onSubmit={(e) => {
        e.preventDefault();
        send.mutate({ leagueId: league.id, teamName }, { onSuccess: onSent });
      }}
    >
      <h3 id="join-request-title" className="font-semibold">Chiedi di entrare in «{league.name}»</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {league.adminName ? `${league.adminName} riceve la richiesta` : 'L\'amministratore riceve la richiesta'}{' '}
        con il nome della tua squadra.
      </p>
      <div className="mt-4">
        <TextField id="join-team" label="La tua squadra" value={teamName} onChange={setTeamName}
          errors={errors.teamName} />
      </div>
      {message ? <p role="alert" className="mt-3 text-sm font-medium text-destructive">{message}</p> : null}
      <div className="mt-auto flex gap-3 pt-4">
        <button type="button" onClick={onCancel} className={`flex-1 ${BUTTON_SECONDARY}`}>Indietro</button>
        <button type="submit" disabled={send.isPending} className={`flex-[2] ${BUTTON_PRIMARY}`}>
          {send.isPending ? 'Invio…' : 'Manda la richiesta'}
        </button>
      </div>
    </form>
  );
}
