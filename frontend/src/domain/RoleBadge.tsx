import type { Role } from '../api/types';
import { BG_ROLE_CLASS, ROLE_NAME_SINGULAR } from './roles';

const LETTER_CLASS: Record<Role, string> = {
  P: 'text-role-p border-role-p',
  D: 'text-role-d border-role-d',
  C: 'text-role-c border-role-c',
  A: 'text-role-a border-role-a',
};

/**
 * Le taglie del testo, e — per il contorno senza {@code filled}, che ha una
 * scatola fissa invece del padding del pieno — la scatola che la contiene.
 */
const SIZE_TEXT_CLASS: Record<'md' | 'lg', string> = {
  md: 'text-xs',
  lg: 'text-2xl',
};

const SIZE_BOX_CLASS: Record<'md' | 'lg', string> = {
  md: 'h-6 w-6',
  lg: 'h-10 w-10',
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
 *
 * <p>{@code size} sceglie la taglia del TESTO dentro la pillola — non uno
 * {@code scale()} CSS applicato da fuori, che trasforma il disegno ma non la
 * scatola di layout riservata dal flex: la non-sovrapposizione con un vicino
 * sarebbe allora una coincidenza delle misure attuali, non una garanzia, e su
 * alcuni motori il testo scalato si sfoca. {@code md} e' la taglia di sempre
 * ed e' quella predefinita: nessun chiamante esistente cambia aspetto.
 */
export function RoleBadge({
  role,
  filled = false,
  size = 'md',
}: {
  role: Role;
  filled?: boolean;
  /** 'md' (predefinita, la taglia di sempre) o 'lg' per una lettura da lontano. */
  size?: 'md' | 'lg';
}) {
  return (
    <span
      className={[
        'inline-flex items-center justify-center rounded-full font-extrabold',
        SIZE_TEXT_CLASS[size],
        filled ? `${BG_ROLE_CLASS[role]} text-on-accent` : `border ${LETTER_CLASS[role]}`,
        filled ? 'px-2 py-0.5' : SIZE_BOX_CLASS[size],
      ].join(' ')}
    >
      {role}
      <span className="sr-only">{ROLE_NAME_SINGULAR[role]}</span>
    </span>
  );
}
