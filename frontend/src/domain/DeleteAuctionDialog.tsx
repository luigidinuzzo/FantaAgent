import { useEffect, useRef } from 'react';
import type { AuctionCard } from '../api/types';

/**
 * La conferma prima di cancellare un'asta.
 *
 * <p>{@code <dialog>} nativo aperto con showModal(): il browser intrappola il focus,
 * rende inerte lo sfondo e trasforma Esc in un evento cancel. Il focus parte da
 * «Annulla», non da «Elimina»: un Invio di troppo non deve cancellare niente.
 */
export function DeleteAuctionDialog({
  auction, pending, error, onConfirm, onCancel,
}: {
  auction: AuctionCard | null;
  pending: boolean;
  error: string | null;
  onConfirm: (auctionId: string) => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !auction) return;
    if (!dialog.open) dialog.showModal();
    cancelRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [auction]);

  if (!auction) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="delete-auction-title"
      onCancel={(e) => { e.preventDefault(); onCancel(); }}
      className="panel m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl p-6 text-foreground backdrop:bg-black/60"
    >
      <h2 id="delete-auction-title" className="w-exp text-lg font-extrabold">
        Eliminare «{auction.label}»?
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">Sei sicuro? L'azione è irreversibile.</p>
      {error ? (
        <p role="alert" className="mt-3 text-sm font-bold text-destructive">{error}</p>
      ) : null}
      <div className="mt-5 flex justify-end gap-3">
        <button ref={cancelRef} type="button" onClick={onCancel}
          className="min-h-11 rounded-full border border-line-strong px-5 font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
          Annulla
        </button>
        <button type="button" disabled={pending} onClick={() => onConfirm(auction.id)}
          className="min-h-11 rounded-full bg-destructive px-5 font-extrabold text-on-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground">
          {pending ? 'Elimino…' : 'Elimina'}
        </button>
      </div>
    </dialog>
  );
}
