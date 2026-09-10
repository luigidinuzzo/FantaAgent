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

  const error =
    voidPurchase.error instanceof ProblemError ? voidPurchase.error : null;

  return (
    <AppShell>
      <h1 className="w-exp mb-4 text-xl font-extrabold">Riepilogo</h1>

      {error ? (
        // role="alert", non un secondo role="status": l'unica live region
        // ambientale della pagina resta AuctionAnnouncer.
        //
        // I due rifiuti del task 12 dicono cose diverse e vanno mostrati diversi:
        // "not-found" invita a ricaricare (l'acquisto non esiste più, forse un
        // altro dispositivo l'ha già revocato), "already-revoked" dice che è
        // già fatto — ripetere il tentativo non servirebbe a niente.
        <p role="alert" className="mb-4 text-sm font-bold text-destructive">
          {error.slug === 'purchase-not-found'
            ? "Quell'acquisto non c'è più: ricarica la pagina."
            : error.detail}
        </p>
      ) : null}

      {board.isLoading ? (
        <p className="text-sm text-muted-foreground">Carico le rose…</p>
      ) : board.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Non riesco a caricare le rose.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {(board.data?.columns ?? []).map((column) => (
            <Roster
              key={column.participantId}
              column={column}
              onVoid={(seq) => voidPurchase.mutate(seq)}
              pending={voidPurchase.isPending}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
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
  pending,
}: {
  column: BoardColumn;
  onVoid: (seq: number) => void;
  pending: boolean;
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
                        disabled={pending}
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
