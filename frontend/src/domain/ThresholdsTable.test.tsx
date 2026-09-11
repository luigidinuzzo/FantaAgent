import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { ScoringStep } from '../api/types';
import { ThresholdsTable } from './ThresholdsTable';

const STEPS: ScoringStep[] = [
  { minAverage: 0, bonus: 0 },
  { minAverage: 6, bonus: 1 },
];

/** Espone l'ultimo valore commesso, cosi' un test puo' verificarlo senza duplicare lo stato. */
function Harness({
  initial,
  errors,
  disabled,
  onCommit,
}: {
  initial: ScoringStep[];
  errors?: Record<string, string[]>;
  disabled?: boolean;
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
      disabled={disabled ?? false}
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

    await userEvent.click(screen.getByRole('button', { name: /togli riga 1/i }));

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
    render(<Harness initial={STEPS} disabled />);

    const minField = screen.getByLabelText(/soglia da media, riga 1/i);
    const bonusField = screen.getByLabelText(/bonus, riga 1/i);
    expect(minField).toBeDisabled();
    expect(bonusField).toBeDisabled();
    expect(screen.getByRole('button', { name: /aggiungi soglia/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /togli riga 1/i })).toBeDisabled();

    // Il perche' e' raggiungibile da chi ascolta, non solo da chi vede: e' la
    // descrizione accessibile del campo, non solo un testo a schermo.
    expect(minField).toHaveAccessibleDescription(/modificatore di difesa/i);
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
   * quindi resta un elenco a fine tabella — stesso idioma di "participants" in
   * ParticipantsFieldset.
   */
  it("mostra l'errore dell'insieme in coda alla tabella", () => {
    render(
      <Harness
        initial={[]}
        errors={{ thresholds: ['Il modificatore è attivo ma la tabella è vuota: serve almeno una soglia.'] }}
      />,
    );

    expect(screen.getByText(/la tabella è vuota/i)).toBeInTheDocument();
  });
});
