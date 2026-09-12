import { useId } from 'react';

/** La freccia che torna indietro: tratto vettoriale, mai un'emoji. */
function UndoIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 7H4v6" />
      <path d="M4.6 17a8 8 0 1 0 1.5-11.3L4 9" />
    </svg>
  );
}

/**
 * Annulla l'ultimo acquisto. Non cancella niente: il registro e' append-only e
 * l'annullamento e' un evento che ne compensa un altro.
 *
 * <p>Uno dei tre pulsanti icona della barra superiore dell'asta: l'icona e'
 * decorativa (aria-hidden), il testo che nomina l'azione resta ma solo per
 * chi ascolta (sr-only) — chi vede legge la freccia, non una parola.
 *
 * <p>Quando non c'e' niente da annullare il bottone e' disabilitato E lo dice: un
 * bottone spento che tace lascia chi ascolta senza sapere perche' ha smesso di
 * funzionare.
 */
export function UndoLastButton({
  canUndo, onUndo, pending, error,
}: {
  canUndo: boolean;
  onUndo: () => void;
  pending: boolean;
  /**
   * Un annullamento rifiutato dal server. Senza mostrarlo, il bottone si
   * riattiva e nulla dice che il tentativo non e' andato a buon fine.
   */
  error?: string | null;
}) {
  const hintId = useId();
  // Stessa disciplina di BidPanel/BidderDialog: un bottone disabilitato e'
  // annunciato come "non disponibile" e basta, e le due ragioni (attesa,
  // niente da annullare) non sono la stessa situazione per chi ascolta.
  const disabledReason = pending
    ? 'Invio in corso: attendi la conferma del server.'
    : !canUndo
      ? 'Nessun acquisto da annullare.'
      : null;

  return (
    <>
      <button
        type="button"
        disabled={!canUndo || pending}
        aria-describedby={disabledReason ? hintId : undefined}
        onClick={onUndo}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line-strong disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <UndoIcon />
        <span className="sr-only">
          {pending ? 'Annullo l’ultimo acquisto…' : 'Annulla ultimo acquisto'}
        </span>
      </button>
      {disabledReason ? <span id={hintId} className="sr-only">{disabledReason}</span> : null}
      {error ? (
        // role="alert", non un secondo role="status": l'unica live region
        // ambientale della pagina resta AuctionAnnouncer.
        <p role="alert" className="w-full text-sm font-bold text-destructive">
          {error}
        </p>
      ) : null}
    </>
  );
}
