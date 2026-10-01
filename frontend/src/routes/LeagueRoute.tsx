import { useEffect, useRef, useState, type RefObject } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../AppShell';
import { fieldErrors, userMessage } from '../api/client';
import {
  useCreateAuction, useCreateInvite, useDecideJoin, useDeleteAuction, useInvites, useJoinRequests, useLeague,
  useLeagueAuctions, useRemoveMember, useRevokeInvite, useUpdateAuction,
} from '../api/leagues';
import type { LeagueAuctionCard, LeagueDetail } from '../api/types';
import { AuctionAdminMenu } from '../domain/AuctionAdminMenu';
import { TextField } from '../domain/AuthForm';
import { DeleteAuctionDialog } from '../domain/DeleteAuctionDialog';
import { RenameAuctionDialog } from '../domain/RenameAuctionDialog';
import { Crest } from '../domain/Crest';
import { PageFrame } from '../domain/PageFrame';
import { ROLE_NAME_PLURAL } from '../domain/roles';
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from '../domain/controls';
import { MemberMenu } from '../domain/MemberMenu';
import { Modal } from '../domain/Modal';
import { PageHeader } from '../domain/PageHeader';

const DATE = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long' });

/** Quanto resta «Copiato» sul bottone del link. */
const COPIED_MS = 2000;

const SECONDARY_BUTTON = BUTTON_SECONDARY;

export function LeagueRoute() {
  const { leagueId = '' } = useParams();
  const league = useLeague(leagueId);
  const auctions = useLeagueAuctions(leagueId);
  const createAuction = useCreateAuction(leagueId);
  const admin = league.data?.admin ?? false;
  const requests = useJoinRequests(leagueId, admin);
  const hasRequests = admin && (requests.data?.length ?? 0) > 0;
  const [inviting, setInviting] = useState(false);
  const inviteButton = useRef<HTMLButtonElement>(null);
  const trail = [{ label: 'Home', to: '/' }, { label: league.data?.name ?? 'Lega' }];

  if (league.isError) {
    return (
      <AppShell chrome="top" trail={trail}>
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
  // precedenza sulle richieste. Con la finestra degli inviti aperta l'alert e' suo
  // (il suo errore e' il gesto piu' recente): i messaggi della pagina restano
  // visibili senza annunciarsi, come nella home. Gli errori di rinomina,
  // eliminazione e rimozione stanno nelle loro modali, che rendono inerte il resto.
  const auctionsAlert = auctions.isError
    || (createAuction.isError && Object.keys(fieldErrors(createAuction.error)).length === 0);
  // Mentre si carica (o finche' arrivano i membri, se nome e ruolo li ha gia' dati
  // l'elenco delle leghe) la pagina ha gia' la sua forma: le scatole sono della
  // pagina, non del contenuto, e niente si sposta quando il contenuto arriva.
  const loaded = league.data && !league.isPlaceholderData ? league.data : null;

  return (
    <AppShell chrome="top" trail={trail}>
      <PageFrame>
        <PageHeader
          title={league.data?.name || '\u00a0'}
          titleId="league-title"
          leading={league.data?.name
            ? <Crest id={leagueId} name={league.data.name} size="lg" />
            : <span className="size-14 shrink-0" />}
          context={facts(admin, loaded?.members.length, auctions.data?.length)}
          actions={<>
            <Link to={`/leghe/${leagueId}/regole`} className={HEADER_BUTTON}>Regole della lega</Link>
            {admin ? (
              <button ref={inviteButton} type="button" onClick={() => setInviting(true)} className={HEADER_BUTTON}>
                Invita
              </button>
            ) : null}
          </>}
        />
        {/* Le aste sono la ragione per cui si apre la pagina. Accanto, solo quando ci
            sono, le richieste d'ingresso: una cosa da decidere. Senza, le aste vanno a
            tutta larghezza. I membri sotto, a tutta larghezza in piu' colonne; gli
            inviti in una finestra dall'intestazione. Sul telefono lo stesso ordine. */}
        <div className={`grid grid-cols-1 items-start gap-6 ${hasRequests ? 'lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]' : ''}`}>
          <AuctionsPanel leagueId={leagueId} admin={admin} create={createAuction} quiet={inviting} />
          {hasRequests ? <JoinRequestsPanel leagueId={leagueId} quiet={auctionsAlert || inviting} /> : null}
        </div>
        <div className="mt-6">
          <MembersPanel league={loaded} />
        </div>
        {admin ? (
          <InvitesDialog leagueId={leagueId} open={inviting} onClose={() => setInviting(false)}
            returnFocusRef={inviteButton} />
        ) : null}
      </PageFrame>
    </AppShell>
  );
}

/** Sul telefono i due bottoni stanno su una riga anche a 360px: testo piu' piccolo. */
const HEADER_BUTTON = `${BUTTON_SECONDARY} max-sm:px-3 max-sm:text-sm`;

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

/**
 * La riga sotto il nome: cosa c'e' nella lega. Finche' i numeri non arrivano e' uno
 * spazio, cosi' la riga c'e' gia' e niente si sposta quando arrivano.
 */
function facts(admin: boolean, members: number | undefined, auctions: number | undefined) {
  if (members === undefined || auctions === undefined) return '\u00a0';
  return [admin ? 'Amministri tu' : null, plural(members, 'membro', 'membri'), plural(auctions, 'asta', 'aste')]
    .filter(Boolean).join(' · ');
}

/** Lo stato di un'asta dai giocatori comprati: nessuno, alcuni, tutte le rose piene. */
function auctionStatus(a: LeagueAuctionCard) {
  if (a.purchases === 0) return 'Da iniziare';
  return a.purchases >= a.totalSlots ? 'Conclusa' : 'In corso';
}

const ROW = 'flex min-h-16 items-center gap-3 px-5 py-3 md:px-6';

/**
 * Le aste della lega, alte quanto il loro elenco. Ogni riga ha «Entra» a destra e,
 * per l'amministratore, il menu con impostazioni, rinomina ed elimina. In testa, per
 * lui, «Nuova asta» apre il campo del nome in cima all'elenco: l'unico oro della
 * pagina, e solo mentre il campo e' aperto.
 */
function AuctionsPanel({ leagueId, admin, create, quiet }: {
  leagueId: string;
  admin: boolean;
  create: ReturnType<typeof useCreateAuction>;
  /** Una finestra della pagina ha l'alert: il messaggio resta, senza annunciarsi. */
  quiet: boolean;
}) {
  const auctions = useLeagueAuctions(leagueId);
  const update = useUpdateAuction(leagueId);
  const remove = useDeleteAuction(leagueId);
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const [renaming, setRenaming] = useState<{ id: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; label: string } | null>(null);
  const errors = fieldErrors(create.error);
  const createMessage = create.isError && Object.keys(errors).length === 0
    ? userMessage(create.error, 'Non sono riuscito a creare l\'asta. Riprova fra poco.')
    : null;
  const listMessage = auctions.isError
    ? userMessage(auctions.error, 'Non riesco a caricare le aste della lega. Riprova fra poco.')
    : null;

  useEffect(() => {
    if (creating) nameRef.current?.focus();
  }, [creating]);

  function stopCreating() {
    setCreating(false);
    setName('');
    create.reset();
  }

  return (
    <section aria-labelledby="auctions-title" className="panel">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 pb-4 pt-5 md:px-6">
        <h2 id="auctions-title" className="w-exp text-xl font-bold">Aste</h2>
        {admin ? (
          <div className="flex gap-3">
            <button type="button" aria-expanded={creating} className={HEADER_BUTTON}
              onClick={() => (creating ? stopCreating() : setCreating(true))}>
              Nuova asta
            </button>
            <Link to={`/leghe/${leagueId}/importa`} className={HEADER_BUTTON}>Importa un&apos;asta</Link>
          </div>
        ) : null}
      </div>
      {createMessage || listMessage ? (
        <p role={quiet ? undefined : 'alert'} className="px-5 pb-4 text-sm font-medium text-destructive md:px-6">
          {createMessage ?? listMessage}
        </p>
      ) : null}
      {admin && creating ? (
        <form className="flex flex-wrap items-end gap-3 border-t border-line px-5 pb-5 pt-4 md:px-6"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(name, { onSuccess: (a) => navigate(`/leghe/${leagueId}/aste/${a.id}`) });
          }}>
          <div className="min-w-48 flex-1">
            <TextField ref={nameRef} id="new-auction-name" label="Nome della nuova asta" value={name}
              onChange={setName} errors={errors.name} />
          </div>
          <div className="flex gap-3 max-sm:w-full max-sm:[&>*]:flex-1">
            <button type="button" onClick={stopCreating} className={`min-h-12 ${BUTTON_SECONDARY}`}>Annulla</button>
            <button type="submit" disabled={create.isPending || name.trim() === ''}
              className={`min-h-12 px-5 ${BUTTON_PRIMARY}`}>
              Crea l&apos;asta
            </button>
          </div>
        </form>
      ) : null}
      {auctions.data && auctions.data.length === 0 && !creating ? (
        <p className={`${ROW} flex-wrap gap-x-2 gap-y-0 border-t border-line text-sm`}>
          <span className="font-medium">Nessuna asta ancora.</span>
          <span className="text-muted-foreground">
            {admin ? 'Creane una con «Nuova asta»: parte con le regole della lega.' : 'La crea l\'amministratore: la trovi qui.'}
          </span>
        </p>
      ) : null}
      {auctions.data && auctions.data.length > 0 ? (
        <ul aria-label="Aste" className="divide-y divide-line border-t border-line">
          {auctions.data.map((a) => {
            const status = auctionStatus(a);
            const detail = [
              status,
              status === 'Conclusa' ? null : ROLE_NAME_PLURAL[a.phase],
              a.myBudgetRemaining !== null ? `ti restano ${a.myBudgetRemaining} crediti` : null,
            ].filter(Boolean).join(' · ');
            return (
              <li key={a.id} className={ROW}>
                <span className="min-w-0 flex-1">
                  <span className="block break-words font-semibold">{a.name}</span>
                  <span className="block text-sm text-muted-foreground">{detail}</span>
                </span>
                <Link to={`/leghe/${leagueId}/aste/${a.id}`} aria-label={`Entra in ${a.name}`}
                  className={`shrink-0 ${BUTTON_SECONDARY}`}>
                  Entra
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
            );
          })}
        </ul>
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

/**
 * Chi ha cercato la lega per nome e chiede di entrare. Solo per l'amministratore, e
 * solo quando c'e' qualcuno da decidere: e' una cosa da fare, e sta accanto alle
 * aste; senza richieste non occupa posto.
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
          <li key={r.userId} className="flex min-h-16 flex-wrap items-center gap-3 py-2">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="break-words font-medium">{r.teamName}</span>
              <span className="text-sm text-muted-foreground">
                {r.displayName}, dal {DATE.format(new Date(r.requestedAt))}
              </span>
            </span>
            <button type="button" className={SECONDARY_BUTTON} disabled={decide.isPending}
              aria-label={`Rifiuta ${r.teamName}`}
              onClick={() => decide.mutate({ userId: r.userId, accept: false })}>
              Rifiuta
            </button>
            <button type="button" className={SECONDARY_BUTTON} disabled={decide.isPending}
              aria-label={`Accetta ${r.teamName}`}
              onClick={() => decide.mutate({ userId: r.userId, accept: true })}>
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
    // Alto quanto i suoi membri: righe compatte, togliere qualcuno sta nel menu della riga.
    <section aria-labelledby="members-title" className="panel">
      <div className="flex items-baseline justify-between gap-4 px-5 pb-4 pt-5 md:px-6">
        <h2 id="members-title" className="w-exp text-xl font-bold">Membri</h2>
        {league ? <p className="text-sm text-muted-foreground">{members.length}</p> : null}
      </div>
      {/* Righe compatte in una griglia: una colonna sul telefono, due dal tablet, tre
          sullo schermo largo. Niente righe di separazione: una cella vuota in fondo
          alla griglia resterebbe un riquadro a meta'. */}
      <ul aria-label="Membri" className="grid gap-x-6 border-t border-line px-5 py-2 md:grid-cols-2 md:px-6 xl:grid-cols-3">
        {members.map((m) => (
          <li key={m.userId} className="flex min-h-14 items-center gap-3 py-2">
            <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full border border-panel-border bg-surface-raised font-semibold">
              {m.initial}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block break-words font-medium">{m.teamName}</span>
              <span className="block break-words text-sm text-muted-foreground">
                {m.displayName}{m.role === 'ADMIN' ? ' · Amministratore' : ''}{m.me ? ' · Tu' : ''}
              </span>
            </span>
            {league?.admin && !m.me ? (
              <MemberMenu teamName={m.teamName}
                onRemove={() => setLeaving({ userId: m.userId, teamName: m.teamName, self: false })} />
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
function InvitesDialog({ leagueId, open, onClose, returnFocusRef }: {
  leagueId: string;
  open: boolean;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  // Alta quanto il suo stato piu' alto (link appena creato e un link attivo):
  // crearne uno non la fa crescere sotto il dito. Sul telefono e' ancorata in basso,
  // alta 27.75rem, la misura di quello stato a 390 e 360 di larghezza: a tutto
  // schermo resterebbe vuota per meta'.
  return (
    <Modal open={open} titleId="invites-title" title="Inviti" onClose={onClose}
      returnFocusRef={returnFocusRef} phone="sheet" className="max-sm:min-h-[27.75rem] sm:min-h-[30rem]">
      <InvitesContent leagueId={leagueId} />
    </Modal>
  );
}

/** Il contenuto della finestra degli inviti: si monta, e chiede gli inviti, solo quando si apre. */
function InvitesContent({ leagueId }: { leagueId: string }) {
  const invites = useInvites(leagueId, true);
  const create = useCreateInvite(leagueId);
  const revoke = useRevokeInvite(leagueId);
  const link = create.data?.link;
  // «Copiato» al posto di «Copia» per un momento: la conferma sta nel bottone, che
  // ha una larghezza fissa e non si sposta.
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <div>
      <p className="text-sm text-muted-foreground">
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
            <button type="button" className={`w-28 shrink-0 ${SECONDARY_BUTTON}`}
              onClick={() => { void navigator.clipboard?.writeText(link).then(() => setCopied(true)); }}>
              {copied ? 'Copiato' : 'Copia'}
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
                  aria-label={`Ritira il link creato il ${DATE.format(new Date(invite.createdAt))}`}
                  onClick={() => revoke.mutate(invite.id)}>
                  Ritira
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
