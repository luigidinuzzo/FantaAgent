import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppShell } from '../AppShell';
import { fieldErrors, userMessage } from '../api/client';
import { useCreateLeague, useLeagues } from '../api/leagues';
import { PRIMARY_BUTTON, TextField } from '../domain/AuthForm';
import { InitialField } from '../domain/InitialField';

export function LeaguesRoute() {
  const leagues = useLeagues();
  const create = useCreateLeague();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [initial, setInitial] = useState('');
  const errors = fieldErrors(create.error);

  const createErrorMessage = create.isError && Object.keys(errors).length === 0
    ? userMessage(create.error, 'Non sono riuscito a creare la lega. Riprova fra poco.')
    : null;
  // Un solo alert, mai due insieme: l'errore di creazione ha la precedenza perche'
  // e' il gesto piu' recente dell'utente (stessa disciplina di RosterGrid). Se
  // anche l'elenco non si carica, il suo messaggio resta visibile ma senza
  // role="alert" — lo ha gia' annunciato l'altro.
  const listErrorMessage = leagues.isError
    ? userMessage(leagues.error, 'Non riesco a caricare le tue leghe. Riprova fra poco.')
    : null;

  return (
    <AppShell chrome="top">
      {/* Uno sotto l'altro, non affiancati: con poche leghe la colonna dell'elenco
          restava mezza vuota accanto al modulo, piu' alto di lei. Il modulo sotto
          mette i tre campi su una riga e la pagina resta compatta. */}
      <div className="mx-auto grid max-w-5xl gap-4">
        <section aria-labelledby="leagues-title" className="panel rounded-2xl p-6">
          <h1 id="leagues-title" className="w-exp text-lg font-semibold">Le mie leghe</h1>
          {listErrorMessage ? (
            <p
              role={createErrorMessage ? undefined : 'alert'}
              className="mt-4 text-sm font-medium text-destructive"
            >
              {listErrorMessage}
            </p>
          ) : null}
          {leagues.data && leagues.data.length === 0 ? (
            <p className="mt-4 text-sm">
              Non fai ancora parte di nessuna lega. Creane una qui sotto, oppure apri il link
              d'invito che ti hanno mandato.
            </p>
          ) : null}
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {leagues.data?.map((league) => (
              <li key={league.id}>
                <Link
                  to={`/leghe/${league.id}`}
                  className="flex min-h-20 flex-col justify-center rounded-xl border border-line-strong px-4 py-3 hover:bg-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <span className="font-semibold">{league.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {league.teamName} · {league.initial}
                    {league.admin ? ' · Amministratore' : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="create-league-title" className="panel rounded-2xl p-6">
          <h2 id="create-league-title" className="w-exp text-lg font-semibold">Nuova lega</h2>
          <form
            className="mt-4"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate({ name, teamName, initial },
                { onSuccess: (league) => navigate(`/leghe/${league.id}`) });
            }}
          >
            <div className="grid gap-x-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:[&>*]:mt-0">
              <TextField id="league-name" label="Nome della lega" value={name} onChange={setName}
                errors={errors.name} />
              <TextField id="league-team" label="La tua squadra" value={teamName} onChange={setTeamName}
                errors={errors.teamName} />
              <InitialField id="league-initial" value={initial} onChange={setInitial}
                errors={errors.initial} />
            </div>
            {createErrorMessage ? (
              <p role="alert" className="mt-4 text-sm font-medium text-destructive">
                {createErrorMessage}
              </p>
            ) : null}
            <button type="submit" disabled={create.isPending} className={`${PRIMARY_BUTTON} md:w-auto`}>
              {create.isPending ? 'Creo…' : 'Crea la lega'}
            </button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
