/**
 * Il distintivo di cio' che vede solo chi guarda: il tetto, il margine, il perche'
 * del prezzo. Accanto alla proiezione, che mostra rose e crediti a tutta la sala, la
 * differenza va detta e non lasciata indovinare. E' un'etichetta, per questo tonda.
 */
export function OnlyYouBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-accent/40 px-2.5 py-0.5 text-meta font-semibold text-accent">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth={2.4}>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
      {label}
    </span>
  );
}
