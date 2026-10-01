import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../AppShell';
import { userMessage } from '../api/client';
import { useLeagues, useMyAuctions, useMyJoinRequests, useWithdrawJoin } from '../api/leagues';
import type { LeagueCard, MyAuction, MyJoinRequest } from '../api/types';
import { CreateLeagueDialog } from '../domain/CreateLeagueDialog';
import { Crest } from '../domain/Crest';
import { JoinLeagueDialog } from '../domain/JoinLeagueDialog';
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from '../domain/controls';
import { MyAuctionCard } from '../domain/MyAuctionCard';
import { PageFrame } from '../domain/PageFrame';
import { PageHeader } from '../domain/PageHeader';

/** Le concluse che si vedono prima di «Mostra tutte». */
const CONCLUDED_SHOWN = 3;

/**
 * La home: le tue aste in cima, di tutte le leghe, perche' e' li' che si torna;
 * sotto le concluse, poi le leghe. Crearne una o entrarci sono gesti rari: due
 * bottoni normali nell'intestazione, che aprono una finestra.
 *
 * <p>L'oro e' uno solo: «Entra nell'asta» dell'asta toccata per ultima. Senza aste
 * in corso non c'e' oro; senza leghe e' «Crea una lega» nello stato vuoto.
 */
export function LeaguesRoute() {
  const leagues = useLeagues();
  const auctions = useMyAuctions();
  const requests = useMyJoinRequests();
  const [dialog, setDialog] = useState<'create' | 'join' | null>(null);
  // Il bottone che ha aperto la finestra, per riportarci il fuoco alla chiusura:
  // in Safari un clic non da' il fuoco al bottone, e la finestra non puo' saperlo.
  const opener = useRef<HTMLButtonElement | null>(null);
  const openDialog = (kind: 'create' | 'join') => (e: MouseEvent<HTMLButtonElement>) => {
    opener.current = e.currentTarget;
    setDialog(kind);
  };
  const [allConcluded, setAllConcluded] = useState(false);

  const live = (auctions.data ?? []).filter((a) => a.status !== 'CONCLUDED');
  const concluded = (auctions.data ?? []).filter((a) => a.status === 'CONCLUDED');
  const cards = leagues.data ?? [];
  const pending = requests.data ?? [];
  const hasLeagues = cards.length > 0 || pending.length > 0;
  const firstAdminLeague = cards.find((l) => l.admin);

  // Un solo alert per schermata: l'elenco delle leghe prima delle aste. Con una
  // finestra aperta l'alert e' suo (il suo errore e' il gesto piu' recente), e il
  // messaggio della pagina resta visibile senza annunciarsi di nuovo.
  const failed = leagues.isError ? leagues : auctions.isError ? auctions : null;
  const errorMessage = failed
    ? userMessage(failed.error, 'Non riesco a caricare le tue aste e le tue leghe. Riprova fra poco.')
    : null;

  return (
    <AppShell chrome="top" trail={[{ label: 'Le mie leghe' }]}>
      <PageFrame>
        <PageHeader
          title="Le tue aste"
          actions={<>
            <button type="button" className={HEADER_BUTTON} onClick={openDialog('create')}>Crea una lega</button>
            <button type="button" className={HEADER_BUTTON} onClick={openDialog('join')}>Unisciti a una lega</button>
          </>}
        />
        {errorMessage ? (
          <p role={dialog ? undefined : 'alert'} className="mb-6 text-sm font-medium text-destructive">{errorMessage}</p>
        ) : null}
        {leagues.isSuccess && requests.isSuccess && !hasLeagues ? (
          <NoLeagues onCreate={openDialog('create')} onJoin={openDialog('join')} />
        ) : (
          <>
            <section aria-labelledby="live-title" className="mb-8">
              <h2 id="live-title" className="sr-only">Aste in corso e da iniziare</h2>
              {auctions.isPending ? (
                <div aria-hidden="true" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <div className="panel min-h-52" />
                  <div className="panel min-h-52 max-md:hidden" />
                </div>
              ) : live.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {live.map((a, i) => <MyAuctionCard key={a.id} auction={a} primary={i === 0} />)}
                </div>
              ) : auctions.isSuccess ? (
                <div className="panel flex min-h-16 flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <p className="text-sm text-muted-foreground">Nessuna asta in corso</p>
                  {firstAdminLeague ? (
                    <Link to={`/leghe/${firstAdminLeague.id}`} className={BUTTON_SECONDARY}>Prepara un&apos;asta</Link>
                  ) : null}
                </div>
              ) : null}
            </section>
            {concluded.length > 0 ? (
              <ConcludedAuctions
                auctions={allConcluded ? concluded : concluded.slice(0, CONCLUDED_SHOWN)}
                hidden={allConcluded ? 0 : Math.max(0, concluded.length - CONCLUDED_SHOWN)}
                onShowAll={() => setAllConcluded(true)}
              />
            ) : null}
            <section aria-labelledby="leagues-title" className="panel overflow-hidden">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 pb-4 pt-5">
                <h2 id="leagues-title" className="w-exp text-xl font-bold">Le tue leghe</h2>
                {cards.length > 0 ? (
                  <p className="text-sm text-muted-foreground">{plural(cards.length, 'lega', 'leghe')}</p>
                ) : null}
              </div>
              {hasLeagues ? (
                <ul aria-label="Leghe" className="divide-y divide-line border-t border-line">
                  {cards.map((league) => <LeagueRow key={league.id} league={league} />)}
                  {pending.map((request) => (
                    <PendingRow key={request.leagueId} request={request} quiet={errorMessage !== null} />
                  ))}
                </ul>
              ) : null}
            </section>
          </>
        )}
        <CreateLeagueDialog open={dialog === 'create'} onClose={() => setDialog(null)} returnFocusRef={opener} />
        <JoinLeagueDialog open={dialog === 'join'} onClose={() => setDialog(null)} returnFocusRef={opener} />
      </PageFrame>
    </AppShell>
  );
}

/** Sul telefono i due bottoni stanno a meta' larghezza: testo piu' piccolo, su una riga. */
const HEADER_BUTTON = `${BUTTON_SECONDARY} max-sm:px-3 max-sm:text-sm`;

const ROW = 'flex min-h-16 items-center gap-4 px-5 py-3';
const ROW_LINK = `${ROW} hover:bg-surface-raised focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent`;

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

const DAY = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });

/** Le concluse, compatte: la riga apre l'asta, che da conclusa mostra il riepilogo. */
function ConcludedAuctions({ auctions, hidden, onShowAll }: {
  auctions: MyAuction[];
  hidden: number;
  onShowAll: () => void;
}) {
  // «Mostra tutte» sparisce col clic: il fuoco va alla prima riga che era nascosta,
  // da dove si continua a leggere.
  const firstHidden = useRef<HTMLAnchorElement>(null);
  const expanding = useRef(false);
  useEffect(() => {
    if (!expanding.current || !firstHidden.current) return;
    expanding.current = false;
    firstHidden.current.focus();
  });
  return (
    <section aria-labelledby="done-title" className="panel mb-8 overflow-hidden">
      <h2 id="done-title" className="w-exp px-5 pb-4 pt-5 text-xl font-bold">Concluse</h2>
      <ul aria-label="Aste concluse" className="divide-y divide-line border-t border-line">
        {auctions.map((a, i) => (
          <li key={a.id}>
            <Link to={`/leghe/${a.leagueId}/aste/${a.id}`} className={ROW_LINK}
              ref={i === CONCLUDED_SHOWN ? firstHidden : undefined}>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{a.name}</span>
                <span className="block text-sm text-muted-foreground">{a.leagueName}</span>
              </span>
              <span className="shrink-0 text-sm text-muted-foreground max-sm:hidden">
                Conclusa il {DAY.format(new Date(a.lastActivity))}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {hidden > 0 ? (
        <div className="border-t border-line px-5 py-3">
          <button type="button" className={BUTTON_SECONDARY}
            onClick={() => { expanding.current = true; onShowAll(); }}>Mostra tutte</button>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Senza leghe, al posto di aste e leghe: alto quanto il suo contenuto, con le due
 * strade dell'intestazione ripetute in grande. Crearne una e' il passo che fa
 * cominciare, per questo l'oro.
 */
function NoLeagues({ onCreate, onJoin }: {
  onCreate: (e: MouseEvent<HTMLButtonElement>) => void;
  onJoin: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <section aria-labelledby="no-leagues-title" className="panel p-6">
      <h2 id="no-leagues-title" className="w-exp text-xl font-bold">Non sei ancora in nessuna lega</h2>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">
        Creane una e invita gli amici con un link, o entra in quella dei tuoi amici cercandola per nome.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
        <button type="button" onClick={onCreate} className={`min-h-14 ${BUTTON_PRIMARY}`}>Crea una lega</button>
        <button type="button" onClick={onJoin} className={`min-h-14 ${BUTTON_SECONDARY}`}>Unisciti a una lega</button>
      </div>
    </section>
  );
}

/**
 * Nome e squadra, e sotto i numeri della lega. Le richieste da decidere, a destra.
 * I testi vanno a capo fra le parole, mai troncati: distinguono due leghe simili
 * (§3.2). break-words spezza solo una parola piu' larga della riga intera.
 */
function LeagueRow({ league }: { league: LeagueCard }) {
  const requests = league.pendingRequests;
  const facts = [
    league.admin ? 'Amministri tu' : null,
    plural(league.members, 'membro', 'membri'),
    plural(league.auctions, 'asta', 'aste'),
  ].filter(Boolean).join(', ');
  return (
    <li>
      <Link to={`/leghe/${league.id}`} className={ROW_LINK}>
        <Crest id={league.id} name={league.name} />
        <span className="min-w-0 flex-1">
          <span className="block break-words font-semibold">{league.name}</span>
          <span className="block break-words text-sm">{league.teamName}</span>
          <span className="block text-meta text-muted-foreground">{facts}</span>
        </span>
        {/* Un avviso, non un'azione: contorno oro, non il pieno del bottone della pagina. */}
        {requests > 0 ? (
          <span className="shrink-0 rounded-full border border-accent px-2.5 py-0.5 text-meta font-semibold text-accent">
            {plural(requests, 'richiesta', 'richieste')}
          </span>
        ) : null}
      </Link>
    </li>
  );
}

/**
 * Una lega in cui si e' chiesto di entrare: sta nell'elenco finche' l'amministratore
 * non decide. Con un errore di pagina gia' annunciato (quiet) il proprio si legge
 * senza annunciarsi: un solo alert per schermata.
 */
function PendingRow({ request, quiet }: { request: MyJoinRequest; quiet: boolean }) {
  const withdraw = useWithdrawJoin();
  return (
    <li className={ROW}>
      <Crest id={request.leagueId} name={request.leagueName} muted />
      <span className="min-w-0 flex-1">
        <span className="block break-words font-semibold">{request.leagueName}</span>
        <span className="block break-words text-sm">{request.teamName}</span>
        <span className="block text-meta text-muted-foreground">
          {withdraw.isError
            ? <span role={quiet ? undefined : 'alert'} className="font-medium text-destructive">Non sono riuscito a ritirarla. Riprova.</span>
            : 'Richiesta inviata, in attesa'}
        </span>
      </span>
      <button
        type="button"
        disabled={withdraw.isPending}
        onClick={() => withdraw.mutate(request.leagueId)}
        aria-label={`Ritira la richiesta per ${request.leagueName}`}
        className={`shrink-0 text-sm ${BUTTON_SECONDARY}`}
      >
        Ritira
      </button>
    </li>
  );
}
