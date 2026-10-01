import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Role } from '../api/types';
import { BUTTON_SECONDARY } from './controls';
import { ROLE_NAME_PLURAL_CAPITALIZED } from './roles';

const ITEM =
  'flex min-h-11 w-full items-center rounded-lg px-3 text-left font-medium hover:bg-line focus:bg-line focus-visible:outline-none';

/** Una voce spenta resta nella lista (e raggiungibile con le frecce) ma non fa niente. */
const ITEM_OFF = 'aria-disabled:opacity-50 aria-disabled:hover:bg-transparent';

/**
 * «Comandi» del banditore: sul telefono la barra dei comandi non c'e', quindi il
 * cambio di fase, l'annullamento dell'ultimo acquisto, la proiezione e le
 * impostazioni dell'asta stanno in questo menu. Lo monta solo chi e' banditore.
 *
 * <p>Stesso modello ARIA di ProfileMenu (menu button): all'apertura il focus va alla
 * prima voce non spenta, le frecce si muovono fra tutte le voci (anche le spente,
 * che restano focalizzabili con aria-disabled), Home e Fine agli estremi, Esc chiude
 * e torna al bottone, Tab chiude e prosegue, un clic fuori chiude.
 */
export function CommandsMenu({
  phases, current, onChangePhase, phasePending, canUndo, onUndo, undoPending,
  projectionHref, settingsHref,
}: {
  phases: Role[];
  current: Role;
  onChangePhase: (role: Role) => void;
  phasePending: boolean;
  canUndo: boolean;
  onUndo: () => void;
  undoPending: boolean;
  projectionHref: string;
  settingsHref: string;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const items = itemRefs.current.filter((el): el is HTMLElement => el !== null);
    (items.find((el) => el.getAttribute('aria-disabled') !== 'true') ?? items[0])?.focus();
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
    // Solo all'apertura: un cambio di stato a menu aperto non deve rubare il focus.
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

  const undoOff = !canUndo || undoPending;
  const undoIndex = phases.length;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={`${BUTTON_SECONDARY} min-w-11`}
      >
        <DotsIcon />
        {/* Sul telefono solo i tre puntini; la parola resta per i lettori di schermo. */}
        <span className="max-sm:sr-only">Comandi</span>
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Comandi dell'asta"
          onKeyDown={onMenuKeyDown}
          className="panel absolute right-0 top-full z-40 mt-2 flex w-64 flex-col p-1 text-base shadow-[0_12px_32px_rgb(0_0_0/0.45)]"
        >
          <div role="group" aria-label="Fase" className="flex flex-col">
            {phases.map((role, i) => {
              const isCurrent = role === current;
              const off = isCurrent || phasePending;
              return (
                <button
                  key={role}
                  ref={(el) => { itemRefs.current[i] = el; }}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isCurrent}
                  aria-disabled={off ? 'true' : undefined}
                  tabIndex={-1}
                  onClick={() => {
                    if (off) return;
                    onChangePhase(role);
                    close(true);
                  }}
                  className={`${ITEM} ${ITEM_OFF} justify-between text-foreground`}
                >
                  {ROLE_NAME_PLURAL_CAPITALIZED[role]}
                  {isCurrent ? <CheckIcon /> : null}
                </button>
              );
            })}
          </div>
          <div role="separator" className="my-1 border-t border-line" />
          <button
            ref={(el) => { itemRefs.current[undoIndex] = el; }}
            type="button"
            role="menuitem"
            aria-disabled={undoOff ? 'true' : undefined}
            tabIndex={-1}
            onClick={() => {
              if (undoOff) return;
              onUndo();
              close(true);
            }}
            className={`${ITEM} ${ITEM_OFF} text-foreground`}
          >
            Annulla ultimo acquisto
          </button>
          <a
            ref={(el) => { itemRefs.current[undoIndex + 1] = el; }}
            href={projectionHref}
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className={`${ITEM} text-foreground`}
          >
            {/* Lo spazio sta fra i due span, nello stesso sottoalbero di entrambi:
                messo in testa al secondo, il calcolo del nome accessibile lo
                rifila e le due parti si saldano. */}
            <span>
              <span>Apri la proiezione</span>
              {' '}
              <span className="sr-only">sul secondo schermo</span>
            </span>
          </a>
          <Link
            ref={(el) => { itemRefs.current[undoIndex + 2] = el; }}
            to={settingsHref}
            role="menuitem"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className={`${ITEM} text-foreground`}
          >
            Impostazioni dell'asta
          </Link>
        </div>
      ) : null}
    </div>
  );
}

/** I tre puntini del bottone. Decorazione: il nome del bottone e' la parola. */
function DotsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="currentColor">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

/** La spunta sulla fase in corso: il segno che accompagna aria-checked. */
function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12l5 5 9-9" />
    </svg>
  );
}
