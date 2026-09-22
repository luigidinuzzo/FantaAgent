import { useEffect, useRef, useState } from 'react';
import type { AuctionCard } from '../api/types';

/** Lo stesso limite del nome dato alla creazione. */
const MAX_NAME = 60;

/**
 * Il nuovo nome di un'asta. Stesso {@code <dialog>} nativo di DeleteAuctionDialog:
 * focus intrappolato, sfondo inerte, Esc che annulla. Il focus parte dal campo, con
 * il nome attuale gia' selezionato: si riscrive da capo o si corregge.
 *
 * <p>Il nome vuoto non si puo' salvare: il bottone resta spento invece di far
 * partire una richiesta che il server rifiuterebbe comunque.
 */
export function RenameAuctionDialog({
  auction, pending, error, onConfirm, onCancel,
}: {
  auction: AuctionCard | null;
  pending: boolean;
  error: string | null;
  onConfirm: (auctionId: string, name: string) => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Il campo riparte dal nome dell'asta ogni volta che la modale si apre su
  // un'asta diversa: lo stato si azzera cambiando la key del modulo, qui sotto.
  const [name, setName] = useState(auction?.label ?? '');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !auction) return;
    if (!dialog.open) dialog.showModal();
    inputRef.current?.select();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [auction]);

  if (!auction) return null;
  const trimmed = name.trim();

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="rename-auction-title"
      onCancel={(e) => { e.preventDefault(); onCancel(); }}
      className="panel m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl p-6 text-foreground backdrop:bg-black/60"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed) onConfirm(auction.id, trimmed);
        }}
      >
        <h2 id="rename-auction-title" className="w-exp text-lg font-extrabold">
          Rinomina l'asta
        </h2>
        <label htmlFor="rename-auction-name" className="mt-4 block text-sm font-bold">
          Nome dell'asta
        </label>
        <input
          ref={inputRef}
          id="rename-auction-name"
          value={name}
          maxLength={MAX_NAME}
          onChange={(e) => setName(e.target.value)}
          className="mt-2 min-h-11 w-full rounded-xl border border-line-strong bg-surface px-4 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        />
        {error ? (
          <p role="alert" className="mt-3 text-sm font-bold text-destructive">{error}</p>
        ) : null}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onCancel}
            className="min-h-11 rounded-full border border-line-strong px-5 font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
            Annulla
          </button>
          <button type="submit" disabled={pending || !trimmed}
            className="min-h-11 rounded-full bg-accent px-5 font-extrabold text-on-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground">
            {pending ? 'Salvo…' : 'Salva nome'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
