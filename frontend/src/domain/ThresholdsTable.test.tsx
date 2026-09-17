import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { ScoringStep } from '../api/types';
import { ThresholdsTable, type ThresholdsTableDisabledReason } from './ThresholdsTable';

const STEPS: ScoringStep[] = [
  { minAverage: 0, bonus: 0 },
  { minAverage: 6, bonus: 1 },
];

/** Espone l'ultimo valore commesso, cosi' un test puo' verificarlo senza duplicare lo stato. */
function Harness({
  initial,
  errors,
  disabledReason,
  onCommit,
}: {
  initial: ScoringStep[];
  errors?: Record<string, string[]>;
  disabledReason?: ThresholdsTableDisabledReason | null;
  onCommit?: (v: ScoringStep[]) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <ThresholdsTable
      value={value}
      onChange={(next) => {
        setValue(next);
        onCommit?.(next);
      }}
      disabledReason={disabledReason ?? null}
      errors={errors ?? {}}
    />
  );
}

describe('ThresholdsTable', () => {
  it('aggiunge una riga', async () => {
    render(<Harness initial={STEPS} />);
    expect(screen.getAllByRole('row')).toHaveLength(1 + STEPS.length);

    await userEvent.click(screen.getByRole('button', { name: /aggiungi soglia/i }));

    expect(screen.getAllByRole('row')).toHaveLength(1 + STEPS.length + 1);
  });

  it('toglie una riga', async () => {
    render(<Harness initial={STEPS} />);

    const remove = screen.getByRole('button', { name: 'Togli riga 1' });
    // A vista e' solo una X: nessun testo fuori dallo sr-only.
    expect(
      Array.from(remove.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim()),
    ).toHaveLength(0);
    await userEvent.click(remove);

    expect(screen.getAllByRole('row')).toHaveLength(1 + STEPS.length - 1);
    // La riga rimasta e' la seconda originale, non un duplicato della prima.
    expect(screen.getByLabelText(/soglia da media, riga 1/i)).toHaveValue(6);
  });

  /**
   * Stessa insidia di NumberField gia' vista in ScoringFieldset: Number(e.target.value)
   * su un controllato legge "" per un numero a meta' digitazione ("6." non e' ancora
   * valido), quindi il punto decimale andrebbe perso se il campo non usasse NumberField.
   */
  it('la colonna "da media" accetta un valore decimale senza perdere il punto', async () => {
    const captured: { value: ScoringStep[] | null } = { value: null };
    render(<Harness initial={STEPS} onCommit={(v) => { captured.value = v; }} />);

    const field = screen.getByLabelText(/soglia da media, riga 2/i);
    await userEvent.clear(field);
    await userEvent.type(field, '6.75');

    expect(field).toHaveValue(6.75);
    expect(captured.value?.[1].minAverage).toBe(6.75);
  });

  /**
   * Il bonus di una riga puo' essere negativo (nessun limite nel validatore, solo
   * l'ordine relativo fra righe conta): lo stesso "-" che NumberField esiste per
   * proteggere in ScoringFieldset deve sopravvivere anche qui.
   */
  it('la colonna "bonus" accetta un valore negativo senza perdere il segno meno', async () => {
    const captured: { value: ScoringStep[] | null } = { value: null };
    render(<Harness initial={STEPS} onCommit={(v) => { captured.value = v; }} />);

    const field = screen.getByLabelText(/bonus, riga 1/i);
    await userEvent.clear(field);
    await userEvent.type(field, '-0.5');

    expect(field).toHaveValue(-0.5);
    expect(captured.value?.[0].bonus).toBe(-0.5);
  });

  it('a modificatore disattivo la tabella e disabilitata e dice perche', () => {
    render(<Harness initial={STEPS} disabledReason="modifier-off" />);

    const minField = screen.getByLabelText(/soglia da media, riga 1/i);
    const bonusField = screen.getByLabelText(/bonus, riga 1/i);
    expect(minField).toBeDisabled();
    expect(bonusField).toBeDisabled();
    expect(screen.getByRole('button', { name: /aggiungi soglia/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /togli riga 1/i })).toBeDisabled();

    // Il perche' e' raggiungibile da chi ascolta, non solo da chi vede: e' la
    // descrizione accessibile del campo, non solo un testo a schermo. Dice
    // QUALE delle due cause si applica ("modificatore"), non una frase che
    // vale per entrambe indistintamente.
    expect(minField).toHaveAccessibleDescription(/modificatore di difesa non è attivo/i);
  });

  /**
   * L'altra causa possibile ha un testo diverso e distinguibile: chi ascolta deve
   * poter sapere che qui e' l'asta, non il modificatore, a bloccare la tabella —
   * altrimenti "disattivata e dice perche'" direbbe sempre la stessa mezza verita'.
   */
  it("ad asta aperta la tabella e disabilitata con un motivo diverso da quello del modificatore spento", () => {
    render(<Harness initial={STEPS} disabledReason="auction-open" />);

    const minField = screen.getByLabelText(/soglia da media, riga 1/i);
    expect(minField).toBeDisabled();
    expect(minField).toHaveAccessibleDescription(/asta in corso/i);
    expect(minField).not.toHaveAccessibleDescription(/modificatore di difesa non è attivo/i);
  });

  /**
   * Chiave di riga del task 16, 0-based: thresholds[2] e' la TERZA riga (indice 2),
   * mostrata all'utente come "riga 3".
   */
  it('mostra l\'errore del validatore accanto alla riga che lo causa (thresholds[2])', () => {
    const steps: ScoringStep[] = [
      { minAverage: 0, bonus: 0 },
      { minAverage: 6, bonus: 1 },
      { minAverage: 5, bonus: 0.5 },
    ];
    render(
      <Harness
        initial={steps}
        errors={{
          'thresholds[2]': [
            'Riga 3: la media 5.0 non è maggiore della precedente 6.0. Le soglie vanno in ordine crescente.',
          ],
        }}
      />,
    );

    const field = screen.getByLabelText(/soglia da media, riga 3/i);
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription(/riga 3.*ordine crescente/i);

    // La prima riga, che l'errore non riguarda, resta pulita.
    const firstField = screen.getByLabelText(/soglia da media, riga 1/i);
    expect(firstField).toHaveAttribute('aria-invalid', 'false');
  });

  /**
   * "thresholds" senza indice riguarda la tabella nel suo insieme (tabella vuota
   * col modificatore attivo), non una riga: non ha un controllo a cui accostarsi,
   * quindi il gruppo che avvolge la tabella la descrive con aria-describedby —
   * stesso idioma del <fieldset> di ParticipantsFieldset. getByText da solo non
   * lo proverebbe: il testo potrebbe stare sullo schermo senza che nessun
   * controllo lo referenzi, che e' esattamente il difetto che questo test
   * doveva scoprire e non scopriva.
   */
  it("descrive l'errore dell'insieme sul gruppo che avvolge la tabella", () => {
    render(
      <Harness
        initial={[]}
        errors={{ thresholds: ['Il modificatore è attivo ma la tabella è vuota: serve almeno una soglia.'] }}
      />,
    );

    const group = screen.getByRole('group');
    expect(group).toHaveAccessibleDescription(/la tabella è vuota/i);
  });

  /**
   * A differenza del <fieldset>/<legend> che questo idioma copia, un role="group"
   * senza aria-label non ha un nome accessibile: uno screen reader comunemente non
   * annuncia nemmeno il confine del gruppo, e allora l'aria-describedby del test
   * sopra potrebbe non raggiungere mai nessuno che ascolta — non basta che il testo
   * sia collegato, il gruppo che lo porta deve prima essere trovabile.
   */
  it('il gruppo ha un nome accessibile, uguale alla caption della tabella', () => {
    render(<Harness initial={STEPS} />);

    const group = screen.getByRole('group');
    expect(group).toHaveAccessibleName('Modificatore di difesa: da questa media in su, questo bonus');
  });
});
