import { Link } from 'react-router-dom';
import { auctionExportUrl } from '../api/client';
import type { BoardResponse, ParticipantView, Role } from '../api/types';
import { RoleBadge } from './RoleBadge';

/** Quanti acquisti mostra la classifica dei piu' cari. */
const TOP = 5;

/**
 * L'asta finita: tutte le rose sono complete. Prima la schermata restava quella
 * della serata — battitore vuoto, ricerca che non trovava nessuno, una tabella con
 * «tetto 0» in rosso su ogni riga — e un'asta conclusa sembrava un'asta rotta.
 *
 * <p>Qui si dice che e' finita e si mostrano i fatti della serata, tutti letti dal
 * registro: quanti giocatori, quanti crediti spesi, i tuoi rimasti, gli acquisti piu'
 * cari. Le rose complete stanno subito sotto (RosterGrid, montata dalla rotta).
 */
export function AuctionRecap({ participants, board }: {
  participants: ParticipantView[];
  board: BoardResponse | undefined;
}) {
  const me = participants.find((p) => p.me);
  const purchases = (board?.columns ?? []).flatMap((c) =>
    (Object.keys(c.byRole) as Role[]).flatMap((role) =>
      c.byRole[role].map((slot) => ({ ...slot, role, buyer: c.participantName }))),
  );
  const spent = purchases.reduce((sum, p) => sum + p.price, 0);
  const priciest = [...purchases].sort((a, b) => b.price - a.price).slice(0, TOP);

  return (
    <div className="grid grid-cols-1 gap-5 lg:h-[39rem] lg:grid-cols-[1fr_24rem]">
      <section
        aria-labelledby="recap-heading"
        className="flex flex-col justify-center gap-8 rounded-2xl border-2 border-accent bg-surface-raised p-6 sm:p-10"
      >
        <div>
          <h2 id="recap-heading" className="w-exp text-3xl font-extrabold sm:text-5xl">
            Asta conclusa
          </h2>
          <p className="mt-3 max-w-[60ch] text-lg text-muted-foreground">
            Tutte le rose sono complete: qui sotto le trovi squadra per squadra, e puoi scaricarle in un file.
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-6 sm:grid-cols-3">
          <Figure label="giocatori comprati" value={purchases.length} />
          <Figure label="crediti spesi dalla lega" value={spent} />
          {me ? <Figure label={`crediti rimasti a ${me.name}`} value={me.budgetRemaining} accent /> : null}
        </dl>

        <div className="flex flex-wrap gap-3">
          {board ? (
            <a
              href={auctionExportUrl(board.auctionId)}
              download
              className="flex min-h-14 items-center rounded-full bg-accent px-8 text-lg font-extrabold text-on-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground"
            >
              Scarica le rose
            </a>
          ) : null}
          <Link
            to="/"
            className="flex min-h-14 items-center rounded-full border border-line-strong px-8 text-lg font-bold hover:bg-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            Torna alle aste
          </Link>
        </div>
      </section>

      <section aria-labelledby="recap-top-heading" className="panel flex min-h-0 flex-col rounded-2xl p-5">
        <h2 id="recap-top-heading" className="text-sm font-bold text-muted-foreground">
          Gli acquisti più cari
        </h2>
        <ol className="mt-3 flex flex-1 flex-col justify-around">
          {priciest.map((p, i) => (
            <li key={p.seq} className="flex items-center gap-3 border-b border-line py-3 last:border-b-0">
              <span aria-hidden="true" className="tnum w-exp w-6 text-lg font-extrabold text-muted-foreground">
                {i + 1}
              </span>
              <span aria-hidden="true"><RoleBadge role={p.role} /></span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-bold">{p.playerName}</span>
                <span className="truncate text-xs text-muted-foreground">{p.buyer}</span>
              </span>
              <span className="tnum w-exp shrink-0 text-xl font-extrabold text-accent">
                {`${p.price} `}
                <span className="sr-only">crediti</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Figure({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex flex-col-reverse gap-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={`tnum w-exp text-4xl font-extrabold leading-none ${accent ? 'text-accent' : ''}`}>{value}</dd>
    </div>
  );
}
