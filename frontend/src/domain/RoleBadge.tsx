import type { Role } from '../api/types';

const LETTER_CLASS: Record<Role, string> = {
  P: 'text-role-p border-role-p',
  D: 'text-role-d border-role-d',
  C: 'text-role-c border-role-c',
  A: 'text-role-a border-role-a',
};

const FILLED_CLASS: Record<Role, string> = {
  P: 'bg-role-p text-on-accent',
  D: 'bg-role-d text-on-accent',
  C: 'bg-role-c text-on-accent',
  A: 'bg-role-a text-on-accent',
};

const NAME: Record<Role, string> = {
  P: 'portiere',
  D: 'difensore',
  C: 'centrocampista',
  A: 'attaccante',
};

/**
 * La pillola di ruolo. Il colore e la LETTERA insieme, sempre: il colore da solo
 * non dice niente a chi non lo distingue, e i mockup hanno gia' ragione su questo
 * — la lettera sta dentro la pillola in ognuno di loro.
 *
 * <p>Il nome per esteso in {@code sr-only} e' la terza copia dello stesso fatto,
 * ed e' quella che chi ascolta riceve: "D" letto da un sintetizzatore e' una
 * lettera, non un ruolo.
 *
 * <p>{@code filled} e' la fascia piena della griglia delle rose; senza, e' il
 * contorno che appare accanto a un nome. Il testo scuro sopra il pieno e'
 * {@code on-accent}, verificato a 4.5:1 sopra tutti e quattro in contrast.test.ts.
 */
export function RoleBadge({ role, filled = false }: { role: Role; filled?: boolean }) {
  return (
    <span
      className={[
        'inline-flex items-center justify-center rounded-full text-xs font-extrabold',
        filled ? FILLED_CLASS[role] : `border ${LETTER_CLASS[role]}`,
        filled ? 'px-2 py-0.5' : 'h-6 w-6',
      ].join(' ')}
    >
      {role}
      <span className="sr-only">{NAME[role]}</span>
    </span>
  );
}
