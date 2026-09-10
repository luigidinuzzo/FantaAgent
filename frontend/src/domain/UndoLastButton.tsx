import { useId } from 'react';

/**
 * Annulla l'ultimo acquisto. Non cancella niente: il registro e' append-only e
 * l'annullamento e' un evento che ne compensa un altro.
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
  const reason = !canUndo ? 'Nessun acquisto da annullare.' : null;

  return (
    <>
      <button
        type="button"
        disabled={!canUndo || pending}
        aria-describedby={reason ? hintId : undefined}
        onClick={onUndo}
        className="min-h-11 border border-line px-4 text-sm disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        {pending ? 'Annullo…' : 'Annulla ultimo'}
      </button>
      {reason ? <span id={hintId} className="sr-only">{reason}</span> : null}
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
