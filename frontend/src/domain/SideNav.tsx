/** Le due sezioni della barra laterale: l'asta e il profilo dell'utente. */
export type HomeSection = 'asta' | 'profilo';

const HOME_SECTIONS: Array<{ key: HomeSection; label: string }> = [
  { key: 'asta', label: 'Asta' },
  { key: 'profilo', label: 'Profilo' },
];

/**
 * La barra laterale della home: Asta e Profilo.
 *
 * <p>Sono bottoni, non link: cambiano il contenuto della pagina senza cambiarne
 * l'indirizzo. La barra laterale vive solo sulla home — ogni altra schermata porta
 * la barra compatta in alto — quindi non esiste un «altrove» da cui tornare qui con
 * un link. La sezione corrente e' detta con aria-current, non solo con il colore.
 */
export function HomeSectionNav({
  current,
  onChange,
}: {
  current: HomeSection;
  onChange: (section: HomeSection) => void;
}) {
  return (
    // Voci grandi come il resto dell'interfaccia: nella barra laterale sono le uniche
    // due, e con la misura dei link della barra superiore sembravano minute.
    <nav aria-label="Sezioni" className="flex flex-col gap-2">
      {HOME_SECTIONS.map((s) => {
        const active = s.key === current;
        // L'hover solo sulle voci inattive: sulla voce corrente un fondo
        // chiaro sopra bg-accent lascerebbe il testo scuro su grigio.
        const className = `${LINK_BASE} w-full min-h-12 px-5 text-lg ${
          active ? 'bg-accent text-on-accent' : 'hover:bg-line'
        }`;
        return (
          <button
            key={s.key}
            type="button"
            aria-current={active ? 'true' : undefined}
            onClick={() => onChange(s.key)}
            className={className}
          >
            {s.label}
          </button>
        );
      })}
    </nav>
  );
}

const LINK_BASE =
  'flex min-h-11 items-center rounded-full px-4 font-bold'
  + ' focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent';
