import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { ScoringSection } from '../api/types';
import { ScoringFieldset } from './ScoringFieldset';

const SCORING: ScoringSection = {
  defenceModifierEnabled: false,
  defendersCounted: 3,
  thresholds: [{ minAverage: 0, bonus: 0 }],
  goalBonus: { P: 0, D: 0, C: 0, A: 0 },
  assist: 1, penaltyScored: 3, penaltyMissed: -3, penaltySaved: 3,
  yellowCard: -0.5, redCard: -1, goalConceded: -1, cleanSheet: 1,
  confirmed: true,
};

/** Espone l'ultimo valore commesso, cosi' un test puo' verificarlo senza duplicare lo stato. */
function Harness({ onCommit }: { onCommit: (v: ScoringSection) => void }) {
  const [value, setValue] = useState(SCORING);
  return (
    <ScoringFieldset
      value={value}
      onChange={(next) => {
        setValue(next);
        onCommit(next);
      }}
      errors={[]}
      disabled={false}
    />
  );
}

describe('ScoringFieldset', () => {
  /**
   * Number(e.target.value) su un <input type="number"> controllato: l'algoritmo di
   * sanitizzazione del valore fa leggere input.value come "" per un numero
   * parziale-ma-non-ancora-valido, quindi digitare "-" da solo dava Number("") ===
   * 0, React ridisegnava con 0, e il meno veniva spazzato via prima che il resto
   * del numero potesse seguirlo.
   */
  it('digitando un valore negativo, il segno meno non viene perso', async () => {
    // Un oggetto, non un `let` riassegnato dentro la closure: TypeScript
    // restringerebbe altrimenti il tipo di una variabile scritta solo dentro un
    // callback fino a "never" al punto di lettura, un limite noto dell'analisi del
    // flusso di controllo attraverso i confini di funzione.
    const captured: { value: ScoringSection | null } = { value: null };
    render(<Harness onCommit={(v) => { captured.value = v; }} />);

    const field = screen.getByLabelText(/rigore sbagliato/i);
    await userEvent.clear(field);
    await userEvent.type(field, '-7');

    expect(field).toHaveValue(-7);
    expect(captured.value?.penaltyMissed).toBe(-7);
  });

  /**
   * Stessa storia per il punto decimale: "0." legge come "" (non ancora un numero
   * valido secondo l'algoritmo del browser), quindi "-0.5" non era raggiungibile a
   * tastiera un carattere alla volta — al "-0." il meno veniva gia' perso.
   */
  it('digitando un valore con mezzo punto negativo, il punto non viene perso', async () => {
    const captured: { value: ScoringSection | null } = { value: null };
    render(<Harness onCommit={(v) => { captured.value = v; }} />);

    const field = screen.getByLabelText(/ammonizione/i);
    await userEvent.clear(field);
    await userEvent.type(field, '-0.5');

    expect(field).toHaveValue(-0.5);
    expect(captured.value?.yellowCard).toBe(-0.5);
  });

  /**
   * Una <legend> fornisce il NOME accessibile del fieldset; descriverla con
   * aria-describedby non e' una relazione garantita dagli screen reader. E' il
   * <fieldset> — un group — che supporta davvero una descrizione.
   */
  it('descrive gli errori sul fieldset, non sulla legend', () => {
    render(
      <ScoringFieldset
        value={SCORING}
        onChange={() => {}}
        errors={['Riga 2: la media non può essere negativa.']}
        disabled={false}
      />,
    );

    const group = screen.getByRole('group', { name: 'Punteggio' });
    expect(group).toHaveAccessibleDescription(/riga 2/i);
  });
});
