import { Link } from 'react-router-dom';
import type { MyAuction } from '../api/types';
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from './controls';
import { RoleBadge } from './RoleBadge';
import { ROLE_NAME_PLURAL_CAPITALIZED } from './roles';

const STATUS: Record<MyAuction['status'], string> = {
  NOT_STARTED: 'Da iniziare', IN_PROGRESS: 'In corso', CONCLUDED: 'Conclusa',
};

/**
 * Un'asta della home: tutte le schede hanno la stessa altezza (min-h-52), e il
 * bottone sta sempre in fondo. Oro solo sulla prima, l'asta toccata per ultima.
 */
export function MyAuctionCard({ auction: a, primary }: { auction: MyAuction; primary: boolean }) {
  const titleId = `my-auction-${a.id}`;
  return (
    <article aria-labelledby={titleId} className="panel flex min-h-52 flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{a.leagueName}</p>
          <h3 id={titleId} className="w-exp text-xl font-bold">{a.name}</h3>
        </div>
        <span className={`shrink-0 rounded-full border px-3 py-1 text-meta font-semibold ${
          a.status === 'IN_PROGRESS' ? 'border-positive text-positive' : 'border-line-strong text-muted-foreground'
        }`}>{STATUS[a.status]}</span>
      </div>
      <p className="flex items-center gap-2 text-sm">
        <RoleBadge role={a.phase} />
        <span>{ROLE_NAME_PLURAL_CAPITALIZED[a.phase]}</span>
      </p>
      <p className="tnum text-sm">{`${a.budgetRemaining} crediti · ${a.slotsRemaining} posti`}</p>
      <Link to={`/leghe/${a.leagueId}/aste/${a.id}`} aria-label={`Entra nell'asta ${a.name}`}
        className={`mt-auto w-full ${primary ? BUTTON_PRIMARY : BUTTON_SECONDARY}`}>
        Entra nell&apos;asta
      </Link>
    </article>
  );
}
