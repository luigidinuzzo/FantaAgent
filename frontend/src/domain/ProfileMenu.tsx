import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLogout, type Me } from '../api/auth';

const ITEM =
  'flex min-h-11 w-full items-center rounded-lg px-3 text-left font-medium hover:bg-line focus:bg-line focus-visible:outline-none';

/**
 * «Profilo» nella barra: apre un menu con la pagina del profilo e l'uscita.
 *
 * <p>Stesso modello ARIA di AuctionAdminMenu (menu button): aria-haspopup ed
 * aria-expanded sul bottone; aperto, il focus va alla prima voce, le frecce si
 * muovono fra le voci, Home e Fine agli estremi, Esc chiude e torna al bottone, Tab
 * chiude e prosegue, un clic fuori chiude.
 *
 * <p>In cima al menu nome ed email, che non sono voci: la barra non mostra piu' il
 * nome, e qui si vede con quale account si e' dentro prima di uscire.
 */
export function ProfileMenu({ me, current }: { me: Me; current: boolean }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);
  const menuId = useId();
  const logout = useLogout();
  const navigate = useNavigate();

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
    <div className="relative sm:order-last">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={`flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent sm:px-4 ${
          current ? 'border-accent bg-accent text-on-accent' : 'border-control-border hover:bg-line'
        }`}
      >
        <PersonIcon />
        {/* Sul telefono solo l'omino: accanto al marchio la parola mandava il
            bottone a capo. La parola resta per i lettori di schermo. */}
        <span className="max-sm:sr-only">Profilo</span>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 max-sm:hidden" fill="none"
          stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d={open ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
        </svg>
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Profilo"
          onKeyDown={onMenuKeyDown}
          className="panel absolute right-0 top-full z-40 mt-2 flex w-64 flex-col p-1.5 text-base shadow-[0_12px_32px_rgb(0_0_0/0.45)]"
        >
          <div className="mb-1.5 border-b border-line px-3 pb-2.5 pt-1.5">
            <p className="truncate font-semibold">{me.displayName}</p>
            <p className="truncate text-sm text-muted-foreground">{me.email}</p>
          </div>
          <Link
            ref={(el) => { itemRefs.current[0] = el; }}
            to="/profilo"
            role="menuitem"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className={`${ITEM} text-foreground`}
          >
            Il tuo profilo
          </Link>
          <button
            ref={(el) => { itemRefs.current[1] = el; }}
            type="button"
            role="menuitem"
            tabIndex={-1}
            disabled={logout.isPending}
            onClick={() => logout.mutate(undefined, {
              onSuccess: () => navigate('/accedi', { replace: true }),
            })}
            className={`${ITEM} text-destructive disabled:opacity-50`}
          >
            {logout.isPending ? 'Esco…' : 'Esci'}
          </button>
          {logout.isError ? (
            <p role="alert" className="px-3 pb-1.5 pt-1 text-sm font-medium text-destructive">
              Non sono riuscito a farti uscire. Riprova.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** L'omino accanto a «Profilo». Decorazione: il nome del bottone e' la parola. */
function PersonIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}
