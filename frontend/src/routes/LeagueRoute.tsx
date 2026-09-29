import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../AppShell';
import { fieldErrors, userMessage } from '../api/client';
import {
  useCreateAuction, useCreateInvite, useDeleteAuction, useInvites, useLeague, useLeagueAuctions,
  useRemoveMember, useRevokeInvite, useUpdateAuction,
} from '../api/leagues';
import type { LeagueDetail } from '../api/types';
import { AuctionAdminMenu } from '../domain/AuctionAdminMenu';
import { TextField } from '../domain/AuthForm';
import { DeleteAuctionDialog } from '../domain/DeleteAuctionDialog';
import { RenameAuctionDialog } from '../domain/RenameAuctionDialog';
import { ROLE_NAME_PLURAL } from '../domain/roles';

const DATE = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long' });

const SECONDARY_BUTTON =
  'min-h-11 rounded-full border border-line-strong px-4 font-medium hover:bg-line disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent';

export function LeagueRoute() {
  const { leagueId = '' } = useParams();
  const league = useLeague(leagueId);
  const auctions = useLeagueAuctions(leagueId);
  const createAuction = useCreateAuction(leagueId);
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

  // Un solo role="alert" per schermata: quello delle aste, che stanno in cima, ha la
  // precedenza; gli inviti mostrano comunque il loro messaggio, ma senza annunciarlo.
  // Gli errori di rinomina, eliminazione e rimozione stanno nelle loro modali, che
  // rendono inerte il resto della pagina.
  const auctionsAlert = auctions.isError
    || (createAuction.isError && Object.keys(fieldErrors(createAuction.error)).length === 0);

  return (
    <AppShell chrome="top">
      {/* Il nome e, accanto, le regole: valgono per tutte le aste che la lega fara',
          e le legge chiunque ne faccia parte. */}
      <div className="mx-auto mb-4 flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <h1 className="w-exp text-2xl font-semibold">{league.data.name}</h1>
        <Link to={`/leghe/${leagueId}/regole`} className={`inline-flex items-center ${SECONDARY_BUTTON}`}>
          Regole della lega
        </Link>
      </div>
      <div className="mx-auto grid max-w-5xl items-start gap-4 lg:grid-cols-2">
        <AuctionsPanel leagueId={leagueId} admin={admin} create={createAuction} />
        <MembersPanel league={league.data} />
        {admin ? <InvitesPanel leagueId={leagueId} quiet={auctionsAlert} /> : null}
      </div>
    </AppShell>
  );
}

/**
 * Le aste della lega, a tutta larghezza: e' la ragione per cui si apre la pagina.
 * Ogni riga porta all'asta; accanto, per l'amministratore, il menu con impostazioni,
 * rinomina ed elimina. Sotto, sempre per lui, il campo per crearne una nuova.
 */
function AuctionsPanel({ leagueId, admin, create }: {
  leagueId: string;
  admin: boolean;
  create: ReturnType<typeof useCreateAuction>;
}) {
  const auctions = useLeagueAuctions(leagueId);
  const update = useUpdateAuction(leagueId);
  const remove = useDeleteAuction(leagueId);
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; label: string } | null>(null);
  const errors = fieldErrors(create.error);
  const createMessage = create.isError && Object.keys(errors).length === 0
    ? userMessage(create.error, 'Non sono riuscito a creare l\'asta. Riprova fra poco.')
    : null;
  const listMessage = auctions.isError
    ? userMessage(auctions.error, 'Non riesco a caricare le aste della lega. Riprova fra poco.')
    : null;

  return (
    <section aria-labelledby="auctions-title" className="panel rounded-2xl p-6 lg:col-span-2">
      <h2 id="auctions-title" className="w-exp text-lg font-semibold">Aste</h2>
      {createMessage || listMessage ? (
        <p role="alert" className="mt-4 text-sm font-medium text-destructive">{createMessage ?? listMessage}</p>
      ) : null}
      {auctions.data && auctions.data.length === 0 ? (
        <p className="mt-4 text-sm">
          {admin ? 'Nessuna asta ancora: creane una qui sotto.' : 'Nessuna asta ancora: la crea l\'amministratore.'}
        </p>
      ) : null}
      {auctions.data && auctions.data.length > 0 ? (
        <ul aria-label="Aste" className="mt-4 grid gap-3 md:grid-cols-2">
          {auctions.data.map((a) => (
            <li key={a.id} className="flex items-stretch gap-2">
              <Link to={`/leghe/${leagueId}/aste/${a.id}`}
                className="flex min-h-20 min-w-0 flex-1 flex-col justify-center rounded-xl border border-line-strong px-4 py-3 hover:bg-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
                <span className="truncate font-semibold">{a.name}</span>
                <span className="text-sm text-muted-foreground">
                  {a.purchases} di {a.totalSlots} giocatori · {ROLE_NAME_PLURAL[a.phase]}
                  {a.myBudgetRemaining !== null ? ` · ti restano ${a.myBudgetRemaining} crediti` : ''}
                </span>
              </Link>
              {admin ? (
                <AuctionAdminMenu
                  settingsHref={`/leghe/${leagueId}/aste/${a.id}/impostazioni`}
                  onRename={() => setRenaming({ id: a.id, label: a.name })}
                  onDelete={() => setDeleting({ id: a.id, label: a.name })}
                  label={a.name}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {admin ? (
        <form className="mt-6 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(name, { onSuccess: (a) => navigate(`/leghe/${leagueId}/aste/${a.id}`) });
          }}>
          <div className="min-w-60 flex-1">
            <TextField id="new-auction-name" label="Nome della nuova asta" value={name} onChange={setName}
              errors={errors.name} />
          </div>
          <button type="submit" disabled={create.isPending || name.trim() === ''}
            className="min-h-11 rounded-full bg-accent px-5 font-semibold text-on-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground">
            Crea l'asta
          </button>
        </form>
      ) : null}
      <RenameAuctionDialog auction={renaming} pending={update.isPending}
        error={update.isError ? userMessage(update.error, 'Non sono riuscito a rinominarla. Riprova.') : null}
        onConfirm={(id, newName) => update.mutate({ auctionId: id, name: newName },
          { onSuccess: () => setRenaming(null) })}
        onCancel={() => { setRenaming(null); update.reset(); }} />
      <DeleteAuctionDialog auction={deleting} pending={remove.isPending}
        error={remove.isError ? userMessage(remove.error, 'Non sono riuscito a eliminarla. Riprova.') : null}
        onConfirm={(id) => remove.mutate(id, { onSuccess: () => setDeleting(null) })}
        onCancel={() => { setDeleting(null); remove.reset(); }} />
    </section>
  );
}

/** Chi sta per uscire dalla lega: se stessi (lascia) o un altro membro (lo toglie l'amministratore). */
interface Leaving {
  userId: string;
  teamName: string;
  self: boolean;
}

function MembersPanel({ league }: { league: LeagueDetail }) {
  const remove = useRemoveMember(league.id);
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState<Leaving | null>(null);
  const me = league.members.find((m) => m.me);

  return (
    // Senza inviti (chi non e' amministratore) il pannello occupa tutta la larghezza:
    // altrimenti la griglia a due colonne lascerebbe una colonna intera vuota accanto.
    <section aria-labelledby="members-title" className={`panel rounded-2xl p-6 ${league.admin ? '' : 'lg:col-span-2'}`}>
      <h2 id="members-title" className="w-exp text-lg font-semibold">Membri</h2>
      <ul aria-label="Membri" className="mt-4 divide-y divide-line">
        {league.members.map((m) => (
          <li key={m.userId} className="flex min-h-11 items-center gap-3 py-2">
            <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-accent font-semibold text-on-accent">
              {m.initial}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium">{m.teamName}</span>
              <span className="text-sm text-muted-foreground">
                {m.displayName}{m.role === 'ADMIN' ? ' · Amministratore' : ''}{m.me ? ' · Tu' : ''}
              </span>
            </span>
            {league.admin && !m.me ? (
              <button type="button" className={SECONDARY_BUTTON} aria-label={`Togli ${m.teamName}`}
                onClick={() => setLeaving({ userId: m.userId, teamName: m.teamName, self: false })}>
                Togli
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {!league.admin && me ? (
        <button type="button" className={`mt-4 ${SECONDARY_BUTTON}`}
          onClick={() => setLeaving({ userId: me.userId, teamName: me.teamName, self: true })}>
          Lascia la lega
        </button>
      ) : null}
      <LeaveLeagueDialog leagueName={league.name} leaving={leaving} pending={remove.isPending}
        error={remove.isError ? userMessage(remove.error, 'Operazione non riuscita. Riprova fra poco.') : null}
        onConfirm={(target) => remove.mutate(target.userId, {
          onSuccess: () => {
            setLeaving(null);
            if (target.self) navigate('/');
          },
        })}
        onCancel={() => { setLeaving(null); remove.reset(); }} />
    </section>
  );
}

/**
 * La conferma prima di uscire dalla lega o di toglierne qualcuno. Stesso
 * {@code <dialog>} nativo di DeleteAuctionDialog, con il focus su «Annulla»: un Invio
 * di troppo non deve far uscire nessuno.
 */
function LeaveLeagueDialog({ leagueName, leaving, pending, error, onConfirm, onCancel }: {
  leagueName: string;
  leaving: Leaving | null;
  pending: boolean;
  error: string | null;
  onConfirm: (target: Leaving) => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !leaving) return;
    if (!dialog.open) dialog.showModal();
    cancelRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [leaving]);

  if (!leaving) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="leave-league-title"
      onCancel={(e) => { e.preventDefault(); onCancel(); }}
      className="panel m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl p-6 text-foreground backdrop:bg-black/60"
    >
      <h2 id="leave-league-title" className="w-exp text-lg font-semibold">
        {leaving.self ? `Lasciare «${leagueName}»?` : `Togliere «${leaving.teamName}» dalla lega?`}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">Sei sicuro? L'azione è irreversibile.</p>
      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-destructive">{error}</p>
      ) : null}
      <div className="mt-5 flex justify-end gap-3">
        <button ref={cancelRef} type="button" onClick={onCancel}
          className="min-h-11 rounded-full border border-line-strong px-5 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
          Annulla
        </button>
        <button type="button" disabled={pending} onClick={() => onConfirm(leaving)}
          className="min-h-11 rounded-full bg-destructive px-5 font-semibold text-on-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground">
          {leaving.self ? 'Esci dalla lega' : 'Togli'}
        </button>
      </div>
    </dialog>
  );
}

/**
 * Il link si vede una volta, subito dopo averlo creato: il server ne conserva solo
 * un'impronta. Chi l'ha perso ne crea un altro, e ritira il vecchio se teme che sia
 * finito a chi non doveva.
 */
function InvitesPanel({ leagueId, quiet }: { leagueId: string; quiet: boolean }) {
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
        <p role={quiet ? undefined : 'alert'} className="mt-4 text-sm font-medium text-destructive">
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
