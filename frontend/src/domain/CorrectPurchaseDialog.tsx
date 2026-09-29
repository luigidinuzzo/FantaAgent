import { useEffect, useRef, useState } from 'react';

export interface CorrectablePurchase {
  seq: number;
  playerName: string;
  participantId: string;
  price: number;
}

/**
 * Il secondo potere dell'amministratore: il banco ha sbagliato squadra o prezzo, e
 * si corregge senza annullare e rifare. Stesso {@code <dialog>} nativo delle altre
 * modali; il giocatore non si cambia — per quello si annulla l'acquisto.
 */
export function CorrectPurchaseDialog({
  purchase, participants, pending, error, onConfirm, onCancel,
}: {
  purchase: CorrectablePurchase | null;
  participants: { id: string; name: string }[];
  pending: boolean;
  error: string | null;
  onConfirm: (seq: number, participantId: string, price: number) => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [participantId, setParticipantId] = useState(purchase?.participantId ?? '');
  const [price, setPrice] = useState(String(purchase?.price ?? ''));

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !purchase) return;
    setParticipantId(purchase.participantId);
    setPrice(String(purchase.price));
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [purchase]);

  if (!purchase) return null;
  const parsed = Number.parseInt(price, 10);
  const valid = Number.isInteger(parsed) && parsed >= 1;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="correct-purchase-title"
      onCancel={(e) => { e.preventDefault(); onCancel(); }}
      className="panel m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl p-6 text-foreground backdrop:bg-black/60"
    >
      <form onSubmit={(e) => { e.preventDefault(); if (valid) onConfirm(purchase.seq, participantId, parsed); }}>
        <h2 id="correct-purchase-title" className="w-exp text-lg font-semibold">Correggi l'acquisto</h2>
        <p className="mt-2 text-sm">{purchase.playerName}</p>
        <label htmlFor="correct-participant" className="mt-4 block text-sm font-medium">Squadra</label>
        <select id="correct-participant" value={participantId} onChange={(e) => setParticipantId(e.target.value)}
          className="mt-2 min-h-11 w-full rounded-xl border border-line-strong bg-surface px-4 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
          {participants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <label htmlFor="correct-price" className="mt-4 block text-sm font-medium">Prezzo</label>
        <input id="correct-price" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)}
          className="mt-2 min-h-11 w-32 rounded-xl border border-line-strong bg-surface px-4 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" />
        {error ? <p role="alert" className="mt-3 text-sm font-medium text-destructive">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onCancel}
            className="min-h-11 rounded-full border border-line-strong px-5 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
            Annulla
          </button>
          <button type="submit" disabled={pending || !valid}
            className="min-h-11 rounded-full bg-accent px-5 font-semibold text-on-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground">
            {pending ? 'Salvo…' : 'Salva la correzione'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
