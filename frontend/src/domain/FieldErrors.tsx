/**
 * Gli errori di una sezione, accanto alla sezione.
 *
 * <p>Deliberatamente NON una live region. Tre sezioni possono fallire insieme, e tre
 * annunci nello stesso istante se ne mangiano due: l'annuncio lo fa un solo
 * {@code role="alert"} accanto al pulsante, che dice quanti errori ci sono e dove.
 * Questo elenco e' il dettaglio, raggiungibile con {@code aria-describedby} dal titolo
 * della sezione.
 */
export function SectionErrors({ id, errors }: { id: string; errors: string[] }) {
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
