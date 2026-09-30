import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';

const ITEM =
  'flex min-h-11 items-center rounded-lg px-3 text-left font-medium hover:bg-line focus:bg-line focus-visible:outline-none';

/**
 * Le azioni dell'amministratore su un'asta della lega (impostazioni, rinomina,
 * elimina) dietro un solo bottone «⋯», accanto alla riga che porta all'asta.
 *
 * <p>Copia la struttura di AuctionRowMenu invece di importarlo: quello se ne va con
 * la home vecchia. Stesso modello ARIA del menu button: aria-haspopup ed
 * aria-expanded sul bottone; aperto, il focus va alla prima voce, le frecce si
 * muovono fra le voci (in cerchio), Home e Fine agli estremi, Esc chiude e torna al
 * bottone, Tab chiude e prosegue, un clic fuori chiude.
 *
 * <p>«Impostazioni dell'asta» e' un collegamento vero, non un bottone che naviga:
 * si puo' aprire in un'altra scheda come ogni indirizzo.
 */
export function AuctionAdminMenu({
  label, settingsHref, onRename, onDelete,
}: {
  label: string;
  settingsHref: string;
  onRename: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);
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
    const items = itemRefs.current.filter((el): el is HTMLElement => el !== null);
    const index = items.indexOf(document.activeElement as HTMLElement);
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
    // Il bottone ha il bordo e l'altezza della riga accanto: e' un comando che si deve
    // vedere, non tre puntini grigi da scoprire passandoci sopra.
    <div className="relative flex">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Altre azioni per ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="flex h-full min-h-11 w-11 items-center justify-center rounded-lg border border-control-border text-foreground hover:bg-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
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
          className="panel absolute right-0 top-full z-20 mt-2 flex w-56 flex-col p-1.5 shadow-[0_12px_32px_rgb(0_0_0/0.45)]"
        >
          <Link
            ref={(el) => { itemRefs.current[0] = el; }}
            to={settingsHref}
            role="menuitem"
            tabIndex={-1}
            className={`${ITEM} text-foreground`}
          >
            Impostazioni dell'asta
          </Link>
          <button
            ref={(el) => { itemRefs.current[1] = el; }}
            type="button"
            role="menuitem"
            tabIndex={-1}
            onClick={() => { close(true); onRename(); }}
            className={`${ITEM} text-foreground`}
          >
            Rinomina
          </button>
          <button
            ref={(el) => { itemRefs.current[2] = el; }}
            type="button"
            role="menuitem"
            tabIndex={-1}
            onClick={() => { close(true); onDelete(); }}
            className={`${ITEM} text-destructive`}
          >
            Elimina
          </button>
        </div>
      ) : null}
    </div>
  );
}
