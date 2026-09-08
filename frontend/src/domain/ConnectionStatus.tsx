/**
 * Dopo quanto un dato smette di poter essere creduto.
 *
 * <p>Il triplo dell'intervallo di aggiornamento (5 s): un solo giro saltato e'
 * una latenza, tre di fila sono una connessione che non c'e' piu'.
 */
export const STALE_AFTER_MS = 15_000;

export function isStale({
  updatedAt,
  isError,
  now,
}: {
  updatedAt: number | undefined;
  isError: boolean;
  now: number;
}): boolean {
  if (isError) return true;
  if (updatedAt === undefined) return true;
  return now - updatedAt > STALE_AFTER_MS;
}

function ago(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

export function ConnectionStatus({
  updatedAt,
  isError,
  now,
}: {
  updatedAt: number | undefined;
  isError: boolean;
  now: number;
}) {
  const stale = isStale({ updatedAt, isError, now });

  return (
    // Deliberatamente NON una live region. Ogni aggiudicazione cambia budget,
    // slot, composizione e disponibilita' insieme: se ogni pannello annunciasse
    // il proprio pezzo, un lettore di schermo riceverebbe quattro frasi in
    // competizione. L'unico annuncio della pagina e' AuctionAnnouncer.
    <p
      data-testid="connection-status"
      className={`flex items-center gap-2 text-sm ${
        stale ? 'text-accent' : 'text-muted-foreground'
      }`}
    >
      <span
        aria-hidden
        // Il pallino non pulsa: un'animazione che continuasse a lampeggiare
        // ignorerebbe prefers-reduced-motion, gia' gestito globalmente per
        // spegnere durate e transizioni, non colori statici come questo.
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          stale ? 'bg-accent' : 'bg-positive'
        }`}
      />
      {stale
        ? `Connessione persa, ultimo dato ${
            updatedAt === undefined ? 'mai ricevuto' : `${ago(now - updatedAt)} fa`
          }`
        : 'In diretta'}
    </p>
  );
}
