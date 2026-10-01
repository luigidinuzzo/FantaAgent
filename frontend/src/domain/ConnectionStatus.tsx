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

function lostPhrase(updatedAt: number | undefined, now: number): string {
  return `Connessione persa, ultimo dato ${
    updatedAt === undefined ? 'mai ricevuto' : `${ago(now - updatedAt)} fa`
  }`;
}

export function ConnectionStatus({
  updatedAt,
  isError,
  now,
  compact = false,
}: {
  updatedAt: number | undefined;
  isError: boolean;
  now: number;
  /**
   * Sul telefono la testata ha posto per il pallino, non per la parola: da
   * connessione viva «In diretta» resta solo per chi ascolta. Persa, la frase
   * intera porterebbe la testata su due righe: sotto sm la dice ConnectionLost,
   * sotto la testata, e qui resta il pallino.
   */
  compact?: boolean;
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
      <span className={compact ? (stale ? 'max-sm:hidden' : 'max-sm:sr-only') : undefined}>
        {stale ? lostPhrase(updatedAt, now) : 'In diretta'}
      </span>
    </p>
  );
}

/**
 * L'avviso di ConnectionStatus compatto, sotto sm, a tutta larghezza sotto la
 * testata. Nascosto (non sr-only) da sm in su, dove la frase sta nella testata:
 * chi ascolta la sente una volta sola. Come ConnectionStatus, non e' una live
 * region.
 */
export function ConnectionLost({
  updatedAt,
  isError,
  now,
}: {
  updatedAt: number | undefined;
  isError: boolean;
  now: number;
}) {
  if (!isStale({ updatedAt, isError, now })) return null;
  return (
    <p
      data-testid="connection-lost"
      className="mb-3 rounded-lg border border-accent/40 px-3 py-2 text-sm text-accent sm:hidden"
    >
      {lostPhrase(updatedAt, now)}
    </p>
  );
}
