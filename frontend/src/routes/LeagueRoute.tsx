import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../AppShell';
import { fieldErrors, userMessage } from '../api/client';
import {
  useCreateAuction, useCreateInvite, useDecideJoin, useDeleteAuction, useInvites, useJoinRequests, useLeague,
  useLeagueAuctions, useRemoveMember, useRevokeInvite, useUpdateAuction,
} from '../api/leagues';
import type { LeagueDetail } from '../api/types';
import { AuctionAdminMenu } from '../domain/AuctionAdminMenu';
import { TextField } from '../domain/AuthForm';
import { DeleteAuctionDialog } from '../domain/DeleteAuctionDialog';
import { RenameAuctionDialog } from '../domain/RenameAuctionDialog';
import { Crest } from '../domain/Crest';
import { PageFrame } from '../domain/PageFrame';
import { ROLE_NAME_PLURAL } from '../domain/roles';
import { BUTTON_SECONDARY } from '../domain/controls';

const DATE = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long' });

const SECONDARY_BUTTON = BUTTON_SECONDARY;

export function LeagueRoute() {
  const { leagueId = '' } = useParams();
  const league = useLeague(leagueId);
  const auctions = useLeagueAuctions(leagueId);
  const createAuction = useCreateAuction(leagueId);
  const admin = league.data?.admin ?? false;

  if (league.isError) {
    return (
      <AppShell chrome="top">
        <PageFrame>
          <div className="grid flex-1 place-items-center">
            <p role="alert" className="panel max-w-xl p-4 text-sm font-medium text-destructive">
              {userMessage(league.error, 'Questa lega non esiste, o non ne fai parte.')}
            </p>
          </div>
        </PageFrame>
      </AppShell>
    );
  }

  // Un solo role="alert" per schermata: quello delle aste, che stanno in cima, ha la
  // precedenza; gli inviti mostrano comunque il loro messaggio, ma senza annunciarlo.
  // Gli errori di rinomina, eliminazione e rimozione stanno nelle loro modali, che
  // rendono inerte il resto della pagina.
  const auctionsAlert = auctions.isError
    || (createAuction.isError && Object.keys(fieldErrors(createAuction.error)).length === 0);
  // Mentre si carica (o finche' arrivano i membri, se nome e ruolo li ha gia' dati
  // l'elenco delle leghe) la pagina ha gia' la sua forma: le scatole sono della
  // pagina, non del contenuto, e niente si sposta quando il contenuto arriva.
  const loaded = league.data && !league.isPlaceholderData ? league.data : null;

  return (
    <AppShell chrome="top">
      <PageFrame>
        <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Colonna sinistra: la lega e le sue aste, la ragione per cui si apre
              la pagina. */}
          <div className="flex flex-col gap-6">
            <LeagueHeader leagueId={leagueId} name={league.data?.name ?? ''} admin={admin}
              members={loaded?.members.length} auctions={auctions.data?.length} />
            <AuctionsPanel leagueId={leagueId} admin={admin} create={createAuction} />
          </div>
          {/* Colonna destra: le persone. Chi chiede di entrare, chi c'e', come
              invitarne altri. */}
          <div className="flex flex-col gap-6">
            {admin ? <JoinRequestsPanel leagueId={leagueId} quiet={auctionsAlert} /> : null}
            <MembersPanel league={loaded} />
            {admin ? <InvitesPanel leagueId={leagueId} quiet={auctionsAlert} /> : null}
          </div>
        </div>
      </PageFrame>
    </AppShell>
  );
}

/**
 * La testata: stemma, nome, e in una riga cosa c'e' nella lega. Accanto le regole,
 * che valgono per tutte le aste che la lega fara' e le legge chiunque ne faccia parte.
 * I numeri compaiono quando arrivano, senza spostare niente: la riga c'e' gia'.
 */
function LeagueHeader({ leagueId, name, admin, members, auctions }: {
  leagueId: string;
  name: string;
  admin: boolean;
  members: number | undefined;
  auctions: number | undefined;
}) {
  const facts = members === undefined || auctions === undefined
    ? '\u00a0'
    : [admin ? 'Amministri tu' : null,
      members === 1 ? '1 membro' : `${members} membri`,
      auctions === 1 ? '1 asta' : `${auctions} aste`].filter(Boolean).join(', ');
  return (
    <section aria-labelledby="league-title" className="panel flex flex-wrap items-center gap-4 p-5 md:p-6">
      {name ? <Crest id={leagueId} name={name} size="lg" /> : <span className="size-14 shrink-0" />}
      {/* Largo almeno 12rem: sul telefono le regole vanno a capo invece di tagliare il nome. */}
      <div className="min-w-0 flex-1 basis-48">
        <h1 id="league-title" className="w-exp truncate text-2xl font-bold md:text-3xl">{name || '\u00a0'}</h1>
        <p className="truncate text-sm text-muted-foreground">{facts}</p>
      </div>
      <Link to={`/leghe/${leagueId}/regole`} className={`inline-flex items-center ${SECONDARY_BUTTON}`}>
        Regole della lega
      </Link>
    </section>
  );
}

/**
 * Le aste della lega, in un elenco che prende l'altezza della colonna. Ogni riga
 * porta all'asta; accanto, per l'amministratore, il menu con impostazioni, rinomina
 * ed elimina. In cima, sempre per lui, il campo per crearne una nuova.
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
    <section aria-labelledby="auctions-title" className="panel flex flex-1 flex-col overflow-hidden">
      <div className="flex items-baseline justify-between gap-4 px-5 pb-4 pt-5 md:px-6">
        <h2 id="auctions-title" className="w-exp text-xl font-bold">Aste</h2>
        {admin ? (
          <Link to={`/leghe/${leagueId}/importa`} className={`inline-flex items-center ${SECONDARY_BUTTON}`}>
            Importa un&apos;asta
          </Link>
        ) : null}
      </div>
      {createMessage || listMessage ? (
        <p role="alert" className="px-5 pb-4 text-sm font-medium text-destructive md:px-6">{createMessage ?? listMessage}</p>
      ) : null}
      {/* La nuova asta in cima, subito sotto il titolo: e' il gesto con cui la pagina
          si comincia, e in fondo a un elenco lungo si perdeva. */}
      {admin ? (
        <form className="flex flex-wrap items-end gap-3 border-t border-line px-5 pb-5 pt-4 md:px-6"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(name, { onSuccess: (a) => navigate(`/leghe/${leagueId}/aste/${a.id}`) });
          }}>
          <div className="min-w-48 flex-1">
            <TextField id="new-auction-name" label="Nome della nuova asta" value={name} onChange={setName}
              errors={errors.name} />
          </div>
          <button type="submit" disabled={create.isPending || name.trim() === ''}
            className="min-h-11 rounded-lg bg-accent px-5 font-semibold text-on-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground">
            Crea l'asta
          </button>
        </form>
      ) : null}
      <div className="min-h-40 flex-1 border-t border-line">
        {auctions.data && auctions.data.length === 0 ? (
          <div className="grid h-full content-center justify-items-center gap-1 px-6 py-8 text-center">
            <p className="font-medium">Nessuna asta ancora.</p>
            <p className="text-sm text-muted-foreground">
              {admin ? 'Creane una qui sopra: parte con le regole della lega.' : 'La crea l\'amministratore: la trovi qui.'}
            </p>
          </div>
        ) : null}
        {auctions.data && auctions.data.length > 0 ? (
          <ul aria-label="Aste" className="divide-y divide-line">
            {auctions.data.map((a) => (
              <li key={a.id} className="flex items-center gap-3 pr-5 md:pr-6">
                <Link to={`/leghe/${leagueId}/aste/${a.id}`}
                  className="flex min-h-18 min-w-0 flex-1 flex-col justify-center py-3 pl-5 hover:bg-surface-raised focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent md:pl-6">
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
      </div>
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

/**
 * Chi ha cercato la lega per nome e chiede di entrare. Solo per l'amministratore, e
 * solo quando c'e' qualcuno da decidere: e' una cosa da fare, e sta in cima alla
 * colonna delle persone; senza richieste non occupa posto.
 */
function JoinRequestsPanel({ leagueId, quiet }: { leagueId: string; quiet: boolean }) {
  const requests = useJoinRequests(leagueId, true);
  const decide = useDecideJoin(leagueId);
  if (!requests.data || requests.data.length === 0) return null;

  return (
    <section aria-labelledby="join-requests-title" className="panel p-5 md:p-6">
      <h2 id="join-requests-title" className="w-exp text-xl font-bold">Richieste di ingresso</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Hanno trovato la lega cercandone il nome. Chi accetti entra con la squadra che ha scritto.
      </p>
      {decide.isError ? (
        <p role={quiet ? undefined : 'alert'} className="mt-4 text-sm font-medium text-destructive">
          {userMessage(decide.error, 'Operazione non riuscita. Riprova fra poco.')}
        </p>
      ) : null}
      <ul aria-label="Richieste di ingresso" className="mt-4 divide-y divide-line">
        {requests.data.map((r) => (
          <li key={r.userId} className="flex min-h-11 flex-wrap items-center gap-3 py-2">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium">{r.teamName}</span>
              <span className="text-sm text-muted-foreground">
                {r.displayName}, dal {DATE.format(new Date(r.requestedAt))}
              </span>
            </span>
            <button type="button" className={SECONDARY_BUTTON} disabled={decide.isPending}
              aria-label={`Rifiuta ${r.teamName}`}
              onClick={() => decide.mutate({ userId: r.userId, accept: false })}>
              Rifiuta
            </button>
            <button type="button" disabled={decide.isPending}
              aria-label={`Accetta ${r.teamName}`}
              onClick={() => decide.mutate({ userId: r.userId, accept: true })}
              className="min-h-11 rounded-lg bg-accent px-5 font-semibold text-on-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground">
              Accetta
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Chi sta per uscire dalla lega: se stessi (lascia) o un altro membro (lo toglie l'amministratore). */
interface Leaving {
  userId: string;
  teamName: string;
  self: boolean;
}

/** @param league null finche' i membri non sono arrivati: il pannello c'e' gia', vuoto. */
function MembersPanel({ league }: { league: LeagueDetail | null }) {
  const { leagueId = '' } = useParams();
  const remove = useRemoveMember(leagueId);
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState<Leaving | null>(null);
  const members = league?.members ?? [];
  const me = members.find((m) => m.me);

  return (
    // Prende l'altezza che resta nella colonna: con molti membri si allunga la
    // pagina, con pochi il pannello resta pieno fino in fondo.
    <section aria-labelledby="members-title" className="panel flex flex-1 flex-col overflow-hidden">
      <div className="flex items-baseline justify-between gap-4 px-5 pb-4 pt-5 md:px-6">
        <h2 id="members-title" className="w-exp text-xl font-bold">Membri</h2>
        {league ? <p className="text-sm text-muted-foreground">{members.length}</p> : null}
      </div>
      <ul aria-label="Membri" className="flex-1 divide-y divide-line border-t border-line">
        {members.map((m) => (
          <li key={m.userId} className="flex min-h-16 items-center gap-3 px-5 py-2 md:px-6">
            <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-accent font-semibold text-on-accent">
              {m.initial}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium">{m.teamName}</span>
              <span className="truncate text-sm text-muted-foreground">
                {m.displayName}{m.role === 'ADMIN' ? ' · Amministratore' : ''}{m.me ? ' · Tu' : ''}
              </span>
            </span>
            {league?.admin && !m.me ? (
              <button type="button" className={SECONDARY_BUTTON} aria-label={`Togli ${m.teamName}`}
                onClick={() => setLeaving({ userId: m.userId, teamName: m.teamName, self: false })}>
                Togli
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {league && !league.admin && me ? (
        <div className="border-t border-line px-5 py-4 md:px-6">
          <button type="button" className={SECONDARY_BUTTON}
            onClick={() => setLeaving({ userId: me.userId, teamName: me.teamName, self: true })}>
            Lascia la lega
          </button>
        </div>
      ) : null}
      <LeaveLeagueDialog leagueName={league?.name ?? ''} leaving={leaving} pending={remove.isPending}
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
      className="panel m-auto w-[min(32rem,calc(100vw-2rem))] p-6 text-foreground backdrop:bg-black/60"
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
          className="min-h-11 rounded-lg border border-control-border px-5 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
          Annulla
        </button>
        <button type="button" disabled={pending} onClick={() => onConfirm(leaving)}
          className="min-h-11 rounded-lg bg-destructive px-5 font-semibold text-on-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground">
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
    <section aria-labelledby="invites-title" className="panel shrink-0 p-5 md:p-6">
      <h2 id="invites-title" className="w-exp text-xl font-bold">Inviti</h2>
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
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-control-border bg-surface px-4 text-sm" />
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
