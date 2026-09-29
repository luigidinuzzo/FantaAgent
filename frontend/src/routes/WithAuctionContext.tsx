import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { setAuctionContext } from '../api/client';

/**
 * Lega e asta vengono dall'indirizzo, non piu' da una variabile d'ambiente fissata
 * all'avvio. Si impostano durante il render, prima dei figli: le loro query leggono il
 * contesto quando partono, e un effetto arriverebbe dopo la prima richiesta.
 */
export function WithAuctionContext({ children }: { children: ReactNode }) {
  const { leagueId = '', auctionId = '' } = useParams();
  setAuctionContext({ leagueId, auctionId });
  return <>{children}</>;
}
