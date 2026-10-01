import type { MyAuction } from '../api/types';

const STATUS: Record<MyAuction['status'], string> = {
  NOT_STARTED: 'Da iniziare', IN_PROGRESS: 'In corso', CONCLUDED: 'Conclusa',
};

/** Lo stato di un'asta della home: un'etichetta, verde se e' in corso. */
export function AuctionStatusPill({ status }: { status: MyAuction['status'] }) {
  return (
    <span className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-meta font-semibold ${
      status === 'IN_PROGRESS' ? 'border-positive text-positive' : 'border-line-strong text-muted-foreground'
    }`}>{STATUS[status]}</span>
  );
}
