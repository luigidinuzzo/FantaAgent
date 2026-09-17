/**
 * La X dei bottoni che tolgono una riga da un modulo (partecipanti, soglie).
 * Decorazione: il nome del bottone sta in uno sr-only accanto, che dice cosa
 * toglie.
 */
export function RemoveIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
