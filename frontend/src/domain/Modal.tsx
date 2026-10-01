import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { FOCUS_RING } from './controls';
import { RemoveIcon } from './RemoveIcon';

/**
 * Una finestra sopra la pagina: {@code <dialog>} nativo con showModal(), che
 * intrappola il fuoco, rende inerte lo sfondo e trasforma Esc in cancel. Chiusa,
 * il fuoco torna a chi l'ha aperta. Sotto sm a tutto schermo; da sm
 * larga 32rem. L'altezza la decide chi la usa, sul suo stato piu' alto.
 */
export function Modal({
  open, titleId, title, onClose, children, initialFocusRef, returnFocusRef, className = '',
}: {
  open: boolean;
  titleId: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
  /**
   * Dove torna il fuoco alla chiusura: il bottone che l'ha aperta. Senza, quello
   * che aveva il fuoco all'apertura — che in Safari, dove un clic non da' il fuoco
   * a un bottone, e' il body.
   */
  returnFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    // Chi l'ha aperta, da ricordare prima che il fuoco entri nella finestra: chi
    // la usa lo dice (returnFocusRef), se no chi aveva il fuoco.
    const opener = returnFocusRef?.current
      ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    if (!dialog.open) dialog.showModal();
    initialFocusRef?.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
      // Chiusa, la finestra e' gia' fuori dalla pagina (open=false la smonta)
      // e il browser lascerebbe il fuoco sul body: lo si riporta a mano.
      if (opener?.isConnected) opener.focus();
    };
  }, [open, initialFocusRef, returnFocusRef]);

  if (!open) return null;

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      className={`panel m-auto flex flex-col p-0 text-foreground backdrop:bg-black/60 max-sm:h-dvh max-sm:max-h-none max-sm:w-screen max-sm:max-w-none max-sm:rounded-none sm:w-[32rem] ${className}`}
    >
      <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
        <h2 id={titleId} className="w-exp text-xl font-bold">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Chiudi"
          className={`grid size-11 shrink-0 place-items-center rounded-lg border border-control-border hover:bg-line ${FOCUS_RING}`}>
          <RemoveIcon />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-5">{children}</div>
    </dialog>
  );
}
