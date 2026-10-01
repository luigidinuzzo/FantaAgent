import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

/**
 * Le azioni dell'amministratore su un membro della lega dietro un bottone «⋯» per
 * riga. Togliere qualcuno e' raro e non si annulla: non sta in vista accanto a ogni
 * nome, sta qui dentro e poi chiede conferma.
 *
 * <p>Stessa struttura di AuctionAdminMenu (menu button): aria-haspopup ed
 * aria-expanded sul bottone; aperto, il focus va alla voce; Esc chiude e torna al
 * bottone, Tab chiude e prosegue, un clic fuori chiude.
 */
export function MemberMenu({ teamName, onRemove }: { teamName: string; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    itemRef.current?.focus();
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }

  function onMenuKeyDown(e: KeyboardEvent) {
    switch (e.key) {
      // Una voce sola: le frecce, Home e Fine restano su di lei.
      case 'ArrowDown': case 'ArrowUp': case 'Home': case 'End':
        e.preventDefault(); itemRef.current?.focus(); break;
      case 'Escape': e.preventDefault(); close(true); break;
      case 'Tab': close(false); break;
    }
  }

  return (
    <div className="relative flex shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Azioni per ${teamName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="flex size-11 items-center justify-center rounded-lg border border-control-border text-foreground hover:bg-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={`Azioni per ${teamName}`}
          onKeyDown={onMenuKeyDown}
          className="panel absolute right-0 top-full z-20 mt-2 flex w-56 flex-col p-1.5 shadow-[0_12px_32px_rgb(0_0_0/0.45)]"
        >
          <button
            ref={itemRef}
            type="button"
            role="menuitem"
            tabIndex={-1}
            onClick={() => { close(true); onRemove(); }}
            className="flex min-h-11 items-center rounded-lg px-3 text-left font-medium text-destructive hover:bg-line focus:bg-line focus-visible:outline-none"
          >
            Togli dalla lega
          </button>
        </div>
      ) : null}
    </div>
  );
}
