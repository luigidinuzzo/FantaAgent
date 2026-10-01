import { useEffect, useRef, type KeyboardEvent } from 'react';
import { FOCUS_RING } from './controls';

// Perche' una barra in basso: sul telefono la griglia del computer messa in
// colonna era alta piu' di tremila pixel. Quattro viste, ognuna in una
// schermata sola, e la barra le tiene sempre a portata di pollice.

export type PhoneView = 'banco' | 'giocatori' | 'squadre' | 'rose';

export const PHONE_VIEWS: Array<{ key: PhoneView; label: string }> = [
  { key: 'banco', label: 'Banco' },
  { key: 'giocatori', label: 'Giocatori' },
  { key: 'squadre', label: 'Squadre' },
  { key: 'rose', label: 'Rose' },
];

export function PhoneViewBar({
  view,
  onChange,
  controls,
}: {
  view: PhoneView;
  onChange: (view: PhoneView) => void;
  /** L'id dell'elemento che ogni vista mostra, per aria-controls. */
  controls: Record<PhoneView, string>;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<PhoneView, HTMLButtonElement | null>>({
    banco: null,
    giocatori: null,
    squadre: null,
    rose: null,
  });

  // La vista la decide chi ci monta: il fuoco segue la scelta solo se era gia'
  // dentro la barra, cosi' un cambio fatto altrove non lo porta via.
  useEffect(() => {
    if (listRef.current?.contains(document.activeElement)) {
      tabRefs.current[view]?.focus();
    }
  }, [view]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, key: PhoneView) {
    const index = PHONE_VIEWS.findIndex((v) => v.key === key);
    const last = PHONE_VIEWS.length - 1;
    let nextIndex: number;
    if (event.key === 'ArrowRight') nextIndex = index === last ? 0 : index + 1;
    else if (event.key === 'ArrowLeft') nextIndex = index === 0 ? last : index - 1;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = last;
    else return;
    event.preventDefault();
    onChange(PHONE_VIEWS[nextIndex].key);
  }

  return (
    // Inchiodata in fondo allo schermo, da bordo a bordo, in ogni vista e a ogni
    // scorrimento: sticky la lasciava sotto il contenuto quando una vista era piu'
    // corta dello schermo. Chi la monta lascia in fondo alla pagina il suo posto.
    // Il margine sotto e' la zona sicura dei telefoni con la barra del sistema.
    <div className="lg:hidden max-lg:fixed inset-x-0 bottom-0 z-30 border-t border-panel-border bg-bar pb-[env(safe-area-inset-bottom)]">
      <div ref={listRef} role="tablist" aria-label="Viste dell'asta" className="grid grid-cols-4">
        {PHONE_VIEWS.map(({ key, label }) => {
          const selected = view === key;
          return (
            <button
              key={key}
              ref={(el) => {
                tabRefs.current[key] = el;
              }}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={controls[key]}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(key)}
              onKeyDown={(e) => handleKeyDown(e, key)}
              className={`min-h-16 text-sm font-semibold ${FOCUS_RING} ${
                selected
                  ? 'text-accent shadow-[inset_0_2px_0_var(--color-accent)]'
                  : 'text-muted-foreground'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
