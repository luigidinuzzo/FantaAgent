import { Link } from 'react-router-dom';

/**
 * Il bottone tondo con la freccia, accanto al titolo di una pagina, che riporta a
 * quella da cui si e' arrivati. Il nome sta in aria-label: la freccia da sola non
 * dice dove porta. Stesso aspetto di quello delle regole della lega.
 */
export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      aria-label={label}
      className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-line-strong hover:bg-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
    </Link>
  );
}
