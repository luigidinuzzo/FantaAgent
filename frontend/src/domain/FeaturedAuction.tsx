import { Link } from 'react-router-dom';
import type { MyAuction } from '../api/types';
import { AuctionStatusPill } from './AuctionStatusPill';
import { BUTTON_PRIMARY } from './controls';
import { RoleBadge } from './RoleBadge';
import { ROLE_NAME_PLURAL_CAPITALIZED } from './roles';

/**
 * L'asta in evidenza della home: quella toccata per ultima fra le non concluse.
 * Un riquadro largo, alto quanto il suo contenuto con un titolo su una riga:
 * 206px sul telefono, 146px da md (misurati), uguale con qualunque numero di aste;
 * un titolo lungo va a capo e lo allunga. Dal computer il testo a sinistra e
 * «Entra nell'asta» a destra, largo fisso; sul telefono uno sotto l'altro, il
 * bottone a tutta larghezza. Il bottone e' l'unico oro della pagina.
 */
export function FeaturedAuction({ auction: a }: { auction: MyAuction }) {
  const titleId = `featured-auction-${a.id}`;
  return (
    <article aria-labelledby={titleId}
      className="panel flex min-h-[12.875rem] flex-col gap-5 p-5 md:min-h-[9.125rem] md:flex-row md:items-center md:gap-8 md:p-6">
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3 md:justify-start">
          <p className="min-w-0 break-words pt-0.5 text-sm text-muted-foreground">{a.leagueName}</p>
          <AuctionStatusPill status={a.status} />
        </div>
        <h3 id={titleId} className="w-exp mt-1 break-words text-2xl font-bold">{a.name}</h3>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="flex items-center gap-2">
            <RoleBadge role={a.phase} />
            <span>{ROLE_NAME_PLURAL_CAPITALIZED[a.phase]}</span>
          </span>
          <span className="tnum">{`${a.budgetRemaining} crediti · ${a.slotsRemaining} posti`}</span>
        </p>
      </div>
      <Link to={`/leghe/${a.leagueId}/aste/${a.id}`} aria-label={`Entra nell'asta ${a.name}`}
        className={`min-h-12 shrink-0 px-5 max-md:w-full md:w-56 ${BUTTON_PRIMARY}`}>
        Entra nell&apos;asta
      </Link>
    </article>
  );
}
