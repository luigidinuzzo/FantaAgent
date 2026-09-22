import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

export interface MenuAction {
  label: string;
  onSelect: () => void;
  /** Il colore dell'azione distruttiva: detto dal testo, il colore lo ripete. */
  destructive?: boolean;
}

/**
 * Le azioni secondarie di una riga (Rinomina, Duplica, Elimina) dietro un solo
 * bottone «⋯». Il cestino sempre visibile accanto a «Riprendi» metteva un gesto
 * distruttivo a un centimetro da quello principale, ripetuto su ogni riga.
 *
 * <p>Il modello e' il menu button di ARIA: il bottone dice aria-haspopup ed
 * aria-expanded; aperto, il focus va alla prima voce, le frecce si muovono fra le
 * voci (in cerchio), Home e Fine vanno agli estremi, Esc chiude e torna al bottone,
 * Tab chiude e prosegue. Un clic fuori chiude senza spostare il focus.
 */
export function AuctionRowMenu({ label, actions }: { label: string; actions: MenuAction[] }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
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
    const items = itemRefs.current.filter((el): el is HTMLButtonElement => el !== null);
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const move = (next: number) => {
      e.preventDefault();
      items[(next + items.length) % items.length]?.focus();
    };
    switch (e.key) {
      case 'ArrowDown': move(index + 1); break;
      case 'ArrowUp': move(index - 1); break;
      case 'Home': move(0); break;
      case 'End': move(items.length - 1); break;
      case 'Escape': e.preventDefault(); close(true); break;
      case 'Tab': close(false); break;
    }
  }

  return (
    // relative z-10: sta sopra il bersaglio che copre la riga (vedi AuctionRow), e
    // il menu aperto sopra le righe che seguono.
    <div className="relative z-10">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Altre azioni per ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-line hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
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
          aria-label={`Azioni per ${label}`}
          onKeyDown={onMenuKeyDown}
          className="panel absolute right-0 top-full z-20 mt-2 flex w-48 flex-col rounded-xl p-1.5 shadow-[0_12px_32px_rgb(0_0_0/0.45)]"
        >
          {actions.map((action, i) => (
            <button
              key={action.label}
              ref={(el) => { itemRefs.current[i] = el; }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => { close(true); action.onSelect(); }}
              className={`min-h-11 rounded-lg px-3 text-left font-bold hover:bg-line focus:bg-line focus-visible:outline-none ${
                action.destructive ? 'text-destructive' : 'text-foreground'
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
