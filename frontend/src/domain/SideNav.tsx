import { Link } from 'react-router-dom';

/**
 * Le sezioni che la navigazione collega, oltre alla home a cui porta il nome.
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
 * <p>Elenco unico, reso in due forme: un secondo elenco per la barra superiore
 * sarebbe una seconda cosa da tenere d'accordo con questa, ed e' esattamente il
 * tipo di coppia che diverge in silenzio.
 */
export const SECTIONS: Array<{ to: string; label: string }> = [
  { to: '/asta', label: 'Asta' },
  { to: '/impostazioni', label: 'Impostazioni' },
];

const LINK_BASE =
  'flex min-h-11 items-center rounded-full px-4 font-bold hover:bg-surface'
  + ' focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent';

export function SectionLinks({ orientation }: { orientation: 'vertical' | 'horizontal' }) {
  const vertical = orientation === 'vertical';
  return (
    <nav
      aria-label="Sezioni"
      className={vertical ? 'flex flex-col gap-1' : 'flex items-center gap-1'}
    >
      {SECTIONS.map((s) => (
        <Link key={s.to} to={s.to} className={`${LINK_BASE} ${vertical ? 'w-full' : ''}`}>
          {s.label}
        </Link>
      ))}
    </nav>
  );
}
