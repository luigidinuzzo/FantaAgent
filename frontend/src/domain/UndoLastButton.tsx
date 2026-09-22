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
      {/* La freccia che torna indietro a U: la freccia circolare di prima si
          leggeva come «ricarica». */}
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
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
 *
 * <p>Un annullamento rifiutato dal server non ha piu' un {@code role="alert"} qui:
 * lo rende {@code AuctionRoute}, nello stesso canale condiviso con il cambio fase
 * (stessa barra, stessa schermata), con la precedenza al gesto piu' recente — si
 * veda il commento su {@code PhaseSwitcher} per il perche'.
 */
export function UndoLastButton({
  canUndo, onUndo, pending,
}: {
  canUndo: boolean;
  onUndo: () => void;
  pending: boolean;
}) {
  const hintId = useId();
  // Stessa disciplina di BidPanel/BidderDialog: un bottone disabilitato e'
  // annunciato come "non disponibile" e basta, e le due ragioni (attesa,
  // niente da annullare) non sono la stessa situazione per chi ascolta.
  const disabledReason = pending
    ? 'Invio in corso: attendi la conferma.'
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
        className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-line-strong font-bold disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent md:px-4"
      >
        <UndoIcon />
        {/* Detto a parole accanto all'icona da tablet in su: e' un gesto che si fa
            di rado e in fretta, quando si e' sbagliato, e non si deve indovinare
            quale dei tondi sia. Sul telefono resta l'icona, col nome per chi ascolta. */}
        <span className="max-md:sr-only">
          {pending ? 'Annullo l’ultimo acquisto…' : 'Annulla ultimo acquisto'}
        </span>
      </button>
      {disabledReason ? <span id={hintId} className="sr-only">{disabledReason}</span> : null}
    </>
  );
}
