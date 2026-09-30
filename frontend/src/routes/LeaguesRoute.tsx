import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppShell } from '../AppShell';
import { fieldErrors, userMessage } from '../api/client';
import {
  MIN_SEARCH, useCreateLeague, useLeagues, useLeagueSearch, useMyJoinRequests, useRequestJoin,
  useWithdrawJoin,
} from '../api/leagues';
import type { LeagueCard, LeagueMatch, MyJoinRequest } from '../api/types';
import { PRIMARY_BUTTON, TextField } from '../domain/AuthForm';
import { Crest } from '../domain/Crest';
import { BUTTON_SECONDARY } from '../domain/controls';
import { PageFrame } from '../domain/PageFrame';

const SECONDARY_BUTTON = `shrink-0 text-sm ${BUTTON_SECONDARY}`;

/**
 * L'inizio: le mie leghe, e le due porte per entrare in una nuova — crearla, o
 * cercarla per nome e chiedere di entrare.
 *
 * <p>Una pagina dell'app come quella della lega, non la pagina divisa delle
 * schermate d'ingresso: li' il campo a destra presenta il prodotto a chi non lo
 * conosce, qui chi arriva ha gia' fatto l'accesso e il campo teneva due terzi dello
 * schermo per ripetere il marchio della barra, schiacciando elenco e modulo in una
 * colonna.
 *
 * <p>Due colonne: a sinistra le leghe, in una colonna che non spinge fuori
 * dalla finestra il resto; a destra le due porte per una nuova, una sopra l'altra. Sul telefono tutto in fila: leghe, poi le due porte.
 *
 * <p>L'iniziale non si chiede: la sceglie il server (vedi {@code LeagueService.initialOr}).
 */
export function LeaguesRoute() {
  const leagues = useLeagues();
  const myRequests = useMyJoinRequests();
  const create = useCreateLeague();

  const createFailed = formMessage(create.error, CREATE_FIELDS, '') !== null;
  // Un solo alert, mai due insieme: l'errore di creazione ha la precedenza perche'
  // e' il gesto piu' recente dell'utente (stessa disciplina di RosterGrid). Se
  // anche l'elenco non si carica, il suo messaggio resta visibile ma senza
  // role="alert" — lo ha gia' annunciato l'altro.
  const listErrorMessage = leagues.isError
    ? userMessage(leagues.error, 'Non riesco a caricare le tue leghe. Riprova fra poco.')
    : null;

  const cards = leagues.data ?? [];
  const pending = myRequests.data ?? [];
  const empty = leagues.isSuccess && cards.length === 0 && pending.length === 0;

  return (
    <AppShell chrome="top">
      <PageFrame>
        <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Sul computer la colonna e' alta quanto i pannelli accanto e non di piu'
              (h-0 min-h-full: non conta nell'altezza della riga): con molte leghe
              scorre l'elenco, non la pagina. */}
          <section
            aria-labelledby="leagues-title"
            className="panel flex flex-col overflow-hidden lg:h-0 lg:min-h-full"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 pb-4 pt-5">
              <h1 id="leagues-title" className="w-exp text-2xl font-bold">Le mie leghe</h1>
              {cards.length > 0 ? (
                <p className="text-sm text-muted-foreground">{plural(cards.length, 'lega', 'leghe')}</p>
              ) : null}
              {listErrorMessage ? (
                <p role={createFailed ? undefined : 'alert'} className="w-full text-sm font-medium text-destructive">
                  {listErrorMessage}
                </p>
              ) : null}
            </div>
            {empty ? <FirstSteps /> : null}
            {cards.length > 0 || pending.length > 0 ? (
              <ul aria-label="Leghe" className="min-h-0 flex-1 divide-y divide-line overflow-y-auto border-t border-line">
                {cards.map((league) => <LeagueRow key={league.id} league={league} />)}
                {pending.map((request) => <PendingRow key={request.leagueId} request={request} />)}
              </ul>
            ) : null}
          </section>
          {/* Crea in alto, compatto; Unisciti prende il resto dell'altezza, e il suo
              riquadro dei risultati con lui. */}
          <div className="flex flex-col gap-6">
            <CreateLeaguePanel create={create} />
            <JoinLeaguePanel />
          </div>
        </div>
      </PageFrame>
    </AppShell>
  );
}

const ROW = 'flex items-center gap-4 px-5 py-3';

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

/** Nome e squadra, e sotto i numeri della lega. Le richieste da decidere, a destra. */
function LeagueRow({ league }: { league: LeagueCard }) {
  const requests = league.pendingRequests;
  const facts = [
    league.admin ? 'Amministri tu' : null,
    plural(league.members, 'membro', 'membri'),
    plural(league.auctions, 'asta', 'aste'),
  ].filter(Boolean).join(', ');
  return (
    <li>
      <Link
        to={`/leghe/${league.id}`}
        className={`${ROW} hover:bg-surface-raised focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent`}
      >
        <Crest id={league.id} name={league.name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{league.name}</span>
          <span className="block truncate text-sm">{league.teamName}</span>
          <span className="block truncate text-meta text-muted-foreground">{facts}</span>
        </span>
        {requests > 0 ? (
          <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-meta font-semibold text-on-accent">
            {plural(requests, 'richiesta', 'richieste')}
          </span>
        ) : null}
      </Link>
    </li>
  );
}

/** Una lega in cui si e' chiesto di entrare: sta nell'elenco finche' l'amministratore non decide. */
function PendingRow({ request }: { request: MyJoinRequest }) {
  const withdraw = useWithdrawJoin();
  return (
    <li className={ROW}>
      <Crest id={request.leagueId} name={request.leagueName} muted />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{request.leagueName}</span>
        <span className="block truncate text-sm">{request.teamName}</span>
        <span className="block truncate text-meta text-muted-foreground">
          {withdraw.isError
            ? <span role="alert" className="font-medium text-destructive">Non sono riuscito a ritirarla. Riprova.</span>
            : 'Richiesta inviata, in attesa'}
        </span>
      </span>
      <button
        type="button"
        disabled={withdraw.isPending}
        onClick={() => withdraw.mutate(request.leagueId)}
        aria-label={`Ritira la richiesta per ${request.leagueName}`}
        className={SECONDARY_BUTTON}
      >
        Ritira
      </button>
    </li>
  );
}

const PANEL = 'panel flex flex-col p-5 md:p-6';

const CREATE_FIELDS = ['name', 'teamName'];

/**
 * Il messaggio sotto un modulo, o null. Gli errori dei campi che il modulo mostra
 * stanno sotto i campi; quelli di un campo che il modulo non ha (l'iniziale, che non
 * si chiede piu') si dicono qui, invece di sparire: un rifiuto senza una parola
 * lascia chi ha premuto il bottone a chiedersi se l'ha premuto.
 */
function formMessage(error: unknown, shown: string[], fallback: string): string | null {
  if (!error) return null;
  const errors = fieldErrors(error);
  const keys = Object.keys(errors);
  if (keys.length === 0) return userMessage(error, fallback);
  const orphans = keys.filter((k) => !shown.includes(k)).flatMap((k) => errors[k] ?? []);
  return orphans.length > 0 ? orphans.join(' ') : null;
}

const FIRST_STEPS = [
  'Crei una lega, o entri in quella dei tuoi amici: cercandola qui accanto o dal link d\'invito.',
  'L\'amministratore sceglie le regole: crediti, rose e punteggi.',
  'Crea l\'asta e la apre a tutta la lega: ogni acquisto compare sulle rose di tutti.',
];

/**
 * La colonna delle leghe quando non ce n'e' ancora nessuna: al posto di un elenco
 * vuoto, come si comincia. E' una sequenza, per questo i numeri.
 */
function FirstSteps() {
  return (
    <div className="grid flex-1 content-center gap-5 border-t border-line px-5 py-6">
      <p className="text-sm">Non fai ancora parte di nessuna lega.</p>
      <ol aria-label="Come si comincia" className="grid gap-4 text-sm text-muted-foreground">
        {FIRST_STEPS.map((step, i) => (
          <li key={step} className="flex items-baseline gap-3">
            <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full border border-line-strong text-meta font-semibold text-foreground">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}

function CreateLeaguePanel({ create }: { create: ReturnType<typeof useCreateLeague> }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [teamName, setTeamName] = useState('');
  const errors = fieldErrors(create.error);
  const message = formMessage(create.error, CREATE_FIELDS, 'Non sono riuscito a creare la lega. Riprova fra poco.');

  return (
    <section aria-labelledby="create-league-title" className={`${PANEL} shrink-0`}>
      <h2 id="create-league-title" className="w-exp text-xl font-bold">Crea una lega</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Ne diventi l&apos;amministratore: inviti gli altri con un link e prepari le aste.
      </p>
      <form
        className="mt-5"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ name, teamName }, { onSuccess: (league) => navigate(`/leghe/${league.id}`) });
        }}
      >
        {/* I due campi affiancati dove c'e' larghezza: il pannello resta basso e
            l'altezza va alla ricerca sotto. Ognuno nel suo div, dove e' il primo e
            non prende il margine di chi ne segue un altro. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <TextField id="league-name" label="Nome della lega" value={name} onChange={setName}
              errors={errors.name} />
          </div>
          <div>
            <TextField id="league-team" label="La tua squadra" value={teamName} onChange={setTeamName}
              errors={errors.teamName} />
          </div>
        </div>
        {message ? <p role="alert" className="mt-4 text-sm font-medium text-destructive">{message}</p> : null}
        <div className="flex justify-end">
          <button type="submit" disabled={create.isPending} className={`${PRIMARY_BUTTON} sm:w-auto sm:px-8`}>
            {create.isPending ? 'Creo…' : 'Crea la lega'}
          </button>
        </div>
      </form>
    </section>
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

/**
 * Cercare la lega e chiedere di entrare. Il riquadro sotto il campo prende l'altezza
 * che resta sotto «Crea una lega», che e' un modulo e non cambia mentre si scrive, e
 * mai meno di due righe: l'elenco scorre dentro, e lo stesso riquadro ospita il
 * modulo della richiesta quando si sceglie una lega. Scrivere non cambia la statura
 * del pannello.
 */
function JoinLeaguePanel() {
  const [text, setText] = useState('');
  const query = useDebounced(text, 250);
  const search = useLeagueSearch(query);
  const [chosen, setChosen] = useState<LeagueMatch | null>(null);
  const [sentTo, setSentTo] = useState<LeagueMatch | null>(null);
  const tooShort = text.trim().length < MIN_SEARCH;

  return (
    <section aria-labelledby="join-league-title" className={`${PANEL} flex-1`}>
      <h2 id="join-league-title" className="w-exp text-xl font-bold">Unisciti a una lega</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Cercala per nome e chiedi di entrare, o usa il link d&apos;invito che ti hanno mandato.
      </p>
      <div className="mt-5">
        <label htmlFor="league-search" className="block text-sm font-medium">Cerca la lega</label>
        <input
          id="league-search"
          type="search"
          autoComplete="off"
          value={text}
          onChange={(e) => { setText(e.target.value); setChosen(null); setSentTo(null); }}
          aria-describedby="league-search-status"
          className="mt-2 min-h-11 w-full rounded-lg border border-control-border bg-surface px-4 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        />
      </div>
      <div className="mt-4 min-h-[7rem] flex-1 basis-0 overflow-y-auto rounded-lg border border-line">
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
    </section>
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
 * dice quella pagina.
 */
function InviteLinkForm() {
  const navigate = useNavigate();
  const [link, setLink] = useState('');
  const [invalid, setInvalid] = useState(false);
  return (
    <form
      className="mt-4 border-t border-line pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        const token = inviteToken(link);
        if (token) navigate(`/invito/${token}`);
        else setInvalid(true);
      }}
    >
      <label htmlFor="invite-link-input" className="block text-sm font-medium">Hai un link d&apos;invito?</label>
      <div className="mt-2 flex flex-wrap gap-3">
        <input
          id="invite-link-input"
          type="text"
          inputMode="url"
          autoComplete="off"
          placeholder="Incolla qui il link"
          value={link}
          onChange={(e) => { setLink(e.target.value); setInvalid(false); }}
          aria-invalid={invalid ? 'true' : undefined}
          aria-describedby={invalid ? 'invite-link-error' : undefined}
          className="min-h-11 min-w-48 flex-1 rounded-lg border border-control-border bg-surface px-4 text-base placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        />
        <button type="submit" disabled={link.trim() === ''} className={`${SECONDARY_BUTTON} px-5`}>
          Entra con il link
        </button>
      </div>
      {invalid ? (
        <p id="invite-link-error" role="alert" className="mt-2 text-sm font-medium text-destructive">
          Questo non sembra un link d&apos;invito: copialo per intero dal messaggio che ti hanno mandato.
        </p>
      ) : null}
    </form>
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

  // Prima di scrivere il riquadro non e' un elenco vuoto: dice cosa ci comparira'.
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
            <li key={league.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{league.name}</span>
                <span className="block truncate text-sm text-muted-foreground">
                  {league.adminName ? `Amministra ${league.adminName}, ` : ''}
                  {league.members === 1 ? '1 membro' : `${league.members} membri`}
                </span>
              </span>
              {league.status === 'MEMBER' ? (
                <Link to={`/leghe/${league.id}`} className={`inline-flex items-center ${SECONDARY_BUTTON}`}>
                  Apri
                </Link>
              ) : league.status === 'PENDING' ? (
                <span className="shrink-0 text-sm font-medium text-muted-foreground">Richiesta inviata</span>
              ) : (
                <button type="button" onClick={() => onChoose(league)} className={SECONDARY_BUTTON}
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
        <button type="button" onClick={onCancel} className={`flex-1 ${SECONDARY_BUTTON}`}>Indietro</button>
        <button type="submit" disabled={send.isPending}
          className="min-h-11 flex-[2] rounded-lg bg-accent px-5 font-semibold text-on-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground">
          {send.isPending ? 'Invio…' : 'Manda la richiesta'}
        </button>
      </div>
    </form>
  );
}
