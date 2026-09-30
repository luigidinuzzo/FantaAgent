// Scritte per intero: Tailwind trova le classi leggendo il sorgente.
const CRESTS = ['bg-crest-1', 'bg-crest-2', 'bg-crest-3', 'bg-crest-4', 'bg-crest-5', 'bg-crest-6'];

/**
 * Lo stemma di una lega: la sua prima lettera su uno dei sei colori, sempre lo stesso
 * per la stessa lega. Serve a ritrovarla a colpo d'occhio fra le altre, come la
 * maglia di una squadra.
 */
export function Crest({ id, name, muted = false, size = 'md' }: {
  id: string;
  name: string;
  muted?: boolean;
  /** md nelle righe di un elenco, lg in testa alla pagina della lega. */
  size?: 'md' | 'lg';
}) {
  let hash = 0;
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  const letter = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <span
      aria-hidden="true"
      className={`w-exp grid shrink-0 place-items-center rounded-xl font-bold ${
        size === 'lg' ? 'size-14 text-2xl' : 'size-11 text-lg'
      } ${
        muted
          ? 'border border-dashed border-line-strong text-muted-foreground'
          : `${CRESTS[hash % CRESTS.length]} text-on-accent`
      }`}
    >
      {letter}
    </span>
  );
}
