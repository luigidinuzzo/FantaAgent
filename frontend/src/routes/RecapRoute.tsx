import { useState } from 'react';
import { AppShell } from '../AppShell';
import { ProblemError } from '../api/client';
import { useBoard, useVoidPurchase } from '../api/hooks';
import type { BoardColumn, Role } from '../api/types';

const ROLES: Role[] = ['P', 'D', 'C', 'A'];

const ROLE_NAMES: Record<Role, string> = {
  P: 'Portieri', D: 'Difensori', C: 'Centrocampisti', A: 'Attaccanti',
};

/**
 * Le rose comprate, con la revoca riga per riga.
 *
 * <p>Legge da {@code /board}, che porta gia' esattamente questi dati. Una seconda API
 * che assembla gli stessi eventi sarebbe una seconda verita' da tenere d'accordo con
 * la prima — e {@code /board} sta nel package che la regola ArchUnit tiene lontano
 * dalle valutazioni, quindi questa schermata non puo' mostrare per sbaglio un prezzo
 * consigliato accanto a uno pagato. Il riepilogo dice cosa e' stato speso, non cosa
 * valeva.
 */
export function RecapRoute() {
  const board = useBoard();
  const voidPurchase = useVoidPurchase();
  // Solo la riga in volo si disabilita: `voidPurchase.isPending` da solo e' un
  // booleano UNICO condiviso da ogni riga di ogni colonna, e disabiliterebbe anche
  // il bottone di un acquisto diverso da quello che si sta annullando.
  const [pendingSeq, setPendingSeq] = useState<number | null>(null);

  const voidError =
    voidPurchase.error instanceof ProblemError ? voidPurchase.error : null;

  // Un solo alert, mai due insieme: stessa disciplina delle impostazioni
  // (SettingsRoute), qui applicata ai due possibili — l'errore della revoca e
  // l'errore di caricamento della board. L'errore della revoca ha la precedenza
  // perche' e' il piu' recente dei due gesti dell'utente.
  const alertMessage = voidError
    ? voidErrorMessage(voidError)
    : board.isError
      ? 'Non riesco a caricare le rose.'
      : null;

  function handleVoid(seq: number) {
    if (!board.data) return;
    setPendingSeq(seq);
    voidPurchase.mutate(
      // L'asta a cui appartiene questo seq e' quella che LA BOARD ha appena letto,
      // non necessariamente quella del contesto della finestra: un riepilogo
      // lasciato aperto su un'asta mentre altrove si e' passati a un'altra
      // spedirebbe altrimenti il seq al registro sbagliato — vedi useVoidPurchase.
      { auctionId: board.data.auctionId, seq },
      { onSettled: () => setPendingSeq(null) },
    );
  }

  return (
    <AppShell>
      <h1 className="w-exp mb-4 text-xl font-extrabold">Riepilogo</h1>

      {alertMessage ? (
        // role="alert", non un secondo role="status": l'unica live region
        // ambientale della pagina resta AuctionAnnouncer.
        <p role="alert" className="mb-4 text-sm font-bold text-destructive">
          {alertMessage}
        </p>
      ) : null}

      {board.isLoading ? (
        <p className="text-sm text-muted-foreground">Carico le rose…</p>
      ) : board.isError ? null : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {(board.data?.columns ?? []).map((column) => (
            <Roster
              key={column.participantId}
              column={column}
              onVoid={handleVoid}
              pendingSeq={pendingSeq}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}

/**
 * I tre rifiuti possibili della revoca dicono cose diverse, e la schermata deve
 * dirle diverse:
 * <ul>
 *   <li>{@code unknown-auction}: la guardia lato server ha rifiutato l'asta
 *       indirizzata — il tab e' stantio, l'asta aperta e' cambiata altrove. Non e'
 *       lo stesso caso di "l'acquisto non c'e' piu'": qui e' l'ASTA a non essere
 *       (piu') quella giusta, e ricaricare la pagina la fa riallineare.
 *   <li>{@code purchase-not-found}: l'acquisto non esiste nel registro giusto —
 *       forse un altro dispositivo l'ha gia' revocato.
 *   <li>{@code purchase-already-revoked}: c'e', ma e' gia' stato annullato —
 *       ripetere il tentativo non servirebbe a niente.
 * </ul>
 */
function voidErrorMessage(error: ProblemError): string {
  switch (error.slug) {
    case 'unknown-auction':
      return "L'asta aperta è cambiata: ricarica la pagina.";
    case 'purchase-not-found':
      return "Quell'acquisto non c'è più: ricarica la pagina.";
    default:
      return error.detail;
  }
}

/** «✕», ma come tratto vettoriale: il vincolo vuole icone SVG, mai emoji. */
function CancelIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <line x1="3" y1="3" x2="13" y2="13" />
      <line x1="13" y1="3" x2="3" y2="13" />
    </svg>
  );
}

function Roster({
  column,
  onVoid,
  pendingSeq,
}: {
  column: BoardColumn;
  onVoid: (seq: number) => void;
  pendingSeq: number | null;
}) {
  const empty = ROLES.every((r) => column.byRole[r].length === 0);

  return (
    <section aria-labelledby={`roster-${column.participantId}`} className="border border-line p-4">
      <h2 id={`roster-${column.participantId}`} className="flex items-baseline justify-between">
        <span className="font-bold">{column.participantName}</span>
        <span className="tnum w-exp font-bold">
          {column.budgetRemaining}
          <span className="sr-only"> crediti residui</span>
        </span>
      </h2>

      {empty ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {column.participantName} non ha ancora comprato nessuno.
        </p>
      ) : (
        ROLES.map((role) =>
          column.byRole[role].length === 0 ? null : (
            <table key={role} className="mt-3 w-full text-sm">
              <caption className="text-left text-muted-foreground">{ROLE_NAMES[role]}</caption>
              <tbody>
                {column.byRole[role].map((slot) => (
                  <tr key={slot.seq}>
                    <td className="py-1">{slot.playerName}</td>
                    <td className="tnum py-1 text-right text-muted-foreground">
                      {slot.price}
                      <span className="sr-only"> crediti pagati</span>
                    </td>
                    <td className="py-1 text-right">
                      <button
                        type="button"
                        disabled={pendingSeq === slot.seq}
                        onClick={() => onVoid(slot.seq)}
                        aria-label={`Annulla l'acquisto di ${slot.playerName}`}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center px-2 text-muted-foreground disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        <CancelIcon />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ),
        )
      )}
    </section>
  );
}
