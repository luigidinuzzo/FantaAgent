import { useParams } from 'react-router-dom';
import { AppShell } from '../AppShell';
import { userMessage } from '../api/client';
import { useCreateInvite, useInvites, useLeague, useRevokeInvite } from '../api/leagues';

const DATE = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long' });

const SECONDARY_BUTTON =
  'min-h-11 rounded-full border border-line-strong px-4 font-medium hover:bg-line disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent';

export function LeagueRoute() {
  const { leagueId = '' } = useParams();
  const league = useLeague(leagueId);
  const admin = league.data?.admin ?? false;

  if (league.isError) {
    return (
      <AppShell chrome="top">
        <p role="alert" className="panel mx-auto max-w-xl rounded-xl p-4 text-sm font-medium text-destructive">
          {userMessage(league.error, 'Questa lega non esiste, o non ne fai parte.')}
        </p>
      </AppShell>
    );
  }
  if (!league.data) return <AppShell chrome="top"><p className="text-sm">Un attimo…</p></AppShell>;

  return (
    <AppShell chrome="top">
      <h1 className="w-exp mx-auto mb-4 max-w-5xl text-2xl font-semibold">{league.data.name}</h1>
      <div className="mx-auto grid max-w-5xl items-start gap-4 lg:grid-cols-2">
        {/* Senza inviti (chi non e' amministratore) il pannello occupa tutta la
            larghezza: altrimenti la griglia a due colonne lascerebbe una colonna
            intera vuota accanto, sproporzionata rispetto al contenuto. */}
        <section aria-labelledby="members-title" className={`panel rounded-2xl p-6 ${admin ? '' : 'lg:col-span-2'}`}>
          <h2 id="members-title" className="w-exp text-lg font-semibold">Membri</h2>
          <ul aria-label="Membri" className="mt-4 divide-y divide-line">
            {league.data.members.map((m) => (
              <li key={m.userId} className="flex min-h-11 items-center gap-3 py-2">
                <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-accent font-semibold text-on-accent">
                  {m.initial}
                </span>
                <span className="flex flex-col">
                  <span className="font-medium">{m.teamName}</span>
                  <span className="text-sm text-muted-foreground">
                    {m.displayName}{m.role === 'ADMIN' ? ' · Amministratore' : ''}{m.me ? ' · Tu' : ''}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
        {admin ? <InvitesPanel leagueId={leagueId} /> : null}
      </div>
    </AppShell>
  );
}

/**
 * Il link si vede una volta, subito dopo averlo creato: il server ne conserva solo
 * un'impronta. Chi l'ha perso ne crea un altro, e ritira il vecchio se teme che sia
 * finito a chi non doveva.
 */
function InvitesPanel({ leagueId }: { leagueId: string }) {
  const invites = useInvites(leagueId, true);
  const create = useCreateInvite(leagueId);
  const revoke = useRevokeInvite(leagueId);
  const link = create.data?.link;

  return (
    <section aria-labelledby="invites-title" className="panel rounded-2xl p-6">
      <h2 id="invites-title" className="w-exp text-lg font-semibold">Inviti</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Un link solo per tutto il gruppo: vale due settimane, chiunque lo apra può entrare.
      </p>
      <button type="button" disabled={create.isPending} onClick={() => create.mutate()}
        className={`mt-4 ${SECONDARY_BUTTON}`}>
        Crea un link d'invito
      </button>
      {link ? (
        <div className="mt-4">
          <label htmlFor="invite-link" className="block text-sm font-medium">Link d'invito</label>
          <div className="mt-2 flex gap-2">
            <input id="invite-link" readOnly value={link} onFocus={(e) => e.target.select()}
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-line-strong bg-surface px-4 text-sm" />
            <button type="button" className={SECONDARY_BUTTON}
              onClick={() => { void navigator.clipboard?.writeText(link); }}>
              Copia
            </button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Copialo adesso: dopo non si potrà rivedere.
          </p>
        </div>
      ) : null}
      {create.isError || revoke.isError ? (
        <p role="alert" className="mt-4 text-sm font-medium text-destructive">
          {userMessage(create.error ?? revoke.error, 'Operazione non riuscita. Riprova fra poco.')}
        </p>
      ) : null}
      {invites.data && invites.data.length > 0 ? (
        <>
          <h3 className="mt-6 text-sm font-semibold">Link attivi</h3>
          <ul className="mt-2 divide-y divide-line">
            {invites.data.map((invite) => (
              <li key={invite.id} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm">
                <span>Creato il {DATE.format(new Date(invite.createdAt))}, vale fino al {DATE.format(new Date(invite.expiresAt))}</span>
                <button type="button" className={SECONDARY_BUTTON} disabled={revoke.isPending}
                  onClick={() => revoke.mutate(invite.id)}>
                  Ritira
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
