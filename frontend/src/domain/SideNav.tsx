import { Link } from 'react-router-dom';

/** Le due sezioni della barra laterale: l'asta e il profilo dell'utente. */
export type HomeSection = 'asta' | 'profilo';

const HOME_SECTIONS: Array<{ key: HomeSection; label: string }> = [
  { key: 'asta', label: 'Asta' },
  { key: 'profilo', label: 'Profilo' },
];

/**
 * La barra laterale della home: Asta e Profilo.
 *
 * <p>Sulla home ({@code onChange} presente) sono bottoni: cambiano il contenuto
 * della pagina senza cambiarne l'indirizzo. Altrove (le impostazioni) sono link
 * verso la home, che si apre sulla sezione scelta tramite lo stato della
 * navigazione — l'indirizzo resta comunque "/". La sezione corrente e' detta con
 * aria-current, non solo con il colore.
 */
export function HomeSectionNav({
  current,
  onChange,
}: {
  current: HomeSection;
  onChange?: (section: HomeSection) => void;
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
        return onChange ? (
          <button
            key={s.key}
            type="button"
            aria-current={active ? 'true' : undefined}
            onClick={() => onChange(s.key)}
            className={className}
          >
            {s.label}
          </button>
        ) : (
          <Link
            key={s.key}
            to="/"
            state={{ section: s.key }}
            aria-current={active ? 'true' : undefined}
            className={className}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Le sezioni della barra superiore dell'asta, oltre alla home a cui porta il nome.
 * La barra laterale della home non le usa: ha le sue, {@link HOME_SECTIONS}.
 *
 * <p>(Storia) Le sezioni che la navigazione collega, oltre alla home a cui porta il nome.
 *
 * <p>Non c'e' /proiezione: si apre solo dal suo collegamento in /asta, verso il
 * secondo schermo. L'assenza e' verificata da AppShell.test.tsx, che la elenca con
 * il suo perche' invece di ignorarla in silenzio.
 *
 * <p>Non c'e' nemmeno /riepilogo: e' un reindirizzamento verso /asta (Task 7), non
 * piu' una destinazione — le rose vivono ora dentro /asta, nella scheda "Rose
 * squadre". Un collegamento qui offrirebbe due voci di menu per la stessa
 * schermata. L'assenza e' verificata anche lei da AppShell.test.tsx.
 *
 */
export const SECTIONS: Array<{ to: string; label: string }> = [
  { to: '/asta', label: 'Asta' },
  { to: '/impostazioni', label: 'Impostazioni' },
];

const LINK_BASE =
  'flex min-h-11 items-center rounded-full px-4 font-bold'
  + ' focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent';

/** Le sezioni dell'asta, in fila nella barra superiore. */
export function SectionLinks() {
  return (
    <nav aria-label="Sezioni" className="flex items-center gap-1">
      {SECTIONS.map((s) => (
        <Link key={s.to} to={s.to} className={`${LINK_BASE} hover:bg-line`}>
          {s.label}
        </Link>
      ))}
    </nav>
  );
}
