/**
 * Il logo provvisorio, in attesa di quello vero: la parola "FantaAgent" disegnata
 * come un marchio — Archivo al massimo della larghezza e del peso, in corsivo, con
 * "Agent" nel colore d'accento e un pallone davanti.
 *
 * <p>Il nome accessibile resta "FantaAgent", una parola sola: i due span sono in
 * linea e il pallone e' aria-hidden, quindi chi ascolta non sente "Fanta Agent"
 * ne' un'immagine senza nome. Quando arrivera' il logo vero, cambia solo questo
 * file.
 */
export function Wordmark({ size }: { size: 'lg' | 'md' }) {
  const large = size === 'lg';
  return (
    <span
      data-testid="wordmark"
      className={`inline-flex items-center gap-2 font-black italic uppercase leading-none tracking-tight [font-stretch:125%] ${
        large ? 'text-[1.625rem]' : 'text-2xl'
      }`}
    >
      <BallIcon className={large ? 'h-8 w-8' : 'h-7 w-7'} />
      <span>
        <span className="text-foreground">Fanta</span>
        <span className="text-accent">Agent</span>
      </span>
    </span>
  );
}

function BallIcon({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className={`shrink-0 ${className}`}>
      <circle cx="16" cy="16" r="14" fill="var(--foreground)" />
      <path
        d="M16 9.5l5.5 4-2.1 6.5h-6.8l-2.1-6.5z"
        fill="var(--surface)"
      />
      <path
        d="M16 2v7.5M21.5 13.5l7-2.5M19.4 20l4.3 6M12.6 20l-4.3 6M10.5 13.5l-7-2.5"
        stroke="var(--surface)"
        strokeWidth="1.6"
        fill="none"
      />
    </svg>
  );
}
