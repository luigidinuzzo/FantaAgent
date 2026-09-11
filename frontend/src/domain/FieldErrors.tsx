/**
 * Gli errori di un campo, accanto al campo.
 *
 * <p>Deliberatamente NON una live region. Piu' campi possono fallire insieme, e
 * annunci simultanei se ne mangiano tutti tranne uno: sulla schermata delle
 * impostazioni l'annuncio lo fa un solo {@code role="alert"} accanto al pulsante,
 * che dice quanti errori ci sono e dove. Questo elenco e' il dettaglio,
 * raggiungibile con {@code aria-describedby} dal campo (o dal gruppo, per gli
 * errori che riguardano l'insieme e non un campo preciso — l'iniziale duplicata,
 * ad esempio).
 *
 * <p>Si chiamava {@code SectionErrors}: le chiavi degli errori erano sezioni
 * (punteggio, partecipanti…). Ora sono campi (task 16), ma il componente e la sua
 * disciplina — niente live region, l'elenco completo e non solo il primo — non
 * cambiano.
 */
export function FieldErrors({ id, errors }: { id: string; errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <ul
      id={id}
      className="mt-2 space-y-1 border-l-2 border-destructive pl-3 text-sm text-destructive"
    >
      {errors.map((e) => (
        <li key={e}>{e}</li>
      ))}
    </ul>
  );
}
