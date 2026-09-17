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
      errors={{}}
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
   * Le soglie hanno un campo adesso (task 18, {@link ThresholdsTable}): l'errore
   * di riga (chiave {@code "thresholds[1]"}, la seconda riga) sta accanto al SUO
   * controllo, non piu' nell'elenco generico del fieldset — e non vi finisce
   * anche una seconda volta.
   */
  it("descrive gli errori delle soglie accanto alla riga che li causa, non sul fieldset", () => {
    const scoring: ScoringSection = {
      ...SCORING,
      defenceModifierEnabled: true,
      thresholds: [{ minAverage: 0, bonus: 0 }, { minAverage: 3, bonus: 1 }],
    };
    render(
      <ScoringFieldset
        value={scoring}
        onChange={() => {}}
        errors={{ 'thresholds[1]': ['Riga 2: la media non può essere negativa.'] }}
        disabled={false}
      />,
    );

    const field = screen.getByLabelText(/soglia da media, riga 2/i);
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription(/riga 2/i);

    const group = screen.getByRole('group', { name: 'Punteggio' });
    expect(group).not.toHaveAccessibleDescription(/riga 2/i);
  });

  /**
   * A modificatore spento i suoi parametri non hanno effetto sul calcolo: non
   * vengono mostrati affatto, invece di restare li' disattivati.
   */
  it('a modificatore spento nasconde difensori conteggiati e soglie', () => {
    render(
      <ScoringFieldset value={SCORING} onChange={() => {}} errors={{}} disabled={false} />,
    );

    expect(screen.queryByLabelText(/difensori conteggiati/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/soglia da media, riga 1/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /aggiungi soglia/i })).not.toBeInTheDocument();
  });

  /**
   * Il checkbox mostra e nasconde i parametri, e li manda al salvataggio intatti:
   * spegnere e riaccendere non deve azzerare soglie gia' scritte.
   */
  it('il checkbox del modificatore mostra e nasconde i suoi parametri, senza perderli', async () => {
    const captured: { value: ScoringSection | null } = { value: null };
    render(<Harness onCommit={(v) => { captured.value = v; }} />);

    const checkbox = screen.getByRole('checkbox', { name: /modificatore di difesa attivo/i });
    expect(checkbox).not.toBeChecked();

    await userEvent.click(checkbox);

    expect(captured.value?.defenceModifierEnabled).toBe(true);
    const minField = screen.getByLabelText(/soglia da media, riga 1/i);
    expect(minField).not.toBeDisabled();
    expect(screen.getByLabelText(/difensori conteggiati/i)).toHaveValue(3);
    await userEvent.clear(minField);
    await userEvent.type(minField, '6.5');

    await userEvent.click(checkbox);
    expect(screen.queryByLabelText(/soglia da media, riga 1/i)).not.toBeInTheDocument();
    expect(captured.value?.thresholds[0].minAverage).toBe(6.5);

    await userEvent.click(checkbox);
    expect(screen.getByLabelText(/soglia da media, riga 1/i)).toHaveValue(6.5);
  });

  /**
   * Il server valida «difensori conteggiati» anche a modificatore spento: un suo
   * errore nascosto lascerebbe un salvataggio rifiutato senza campo da correggere.
   */
  it('a modificatore spento mostra comunque difensori conteggiati se ha un errore', () => {
    render(
      <ScoringFieldset
        value={SCORING}
        onChange={() => {}}
        errors={{ defendersCounted: ['I difensori conteggiati devono essere fra 1 e 10: indicato 0.'] }}
        disabled={false}
      />,
    );

    expect(screen.getByLabelText(/difensori conteggiati/i)).toHaveAccessibleDescription(/fra 1 e 10/);
  });

  /**
   * Ad asta aperta il checkbox si blocca come ogni altro campo della sezione
   * (stesso {@code lockId} di "Difensori conteggiati" qui sopra), non perche'
   * la tabella lo sia: e' "asta in corso" a bloccarlo, non "modificatore spento".
   */
  it('blocca il checkbox del modificatore ad asta aperta, e dice perche', () => {
    render(
      <ScoringFieldset value={SCORING} onChange={() => {}} errors={{}} disabled />,
    );

    const checkbox = screen.getByRole('checkbox', { name: /modificatore di difesa attivo/i });
    expect(checkbox).toBeDisabled();
    expect(checkbox).toHaveAccessibleDescription(/asta in corso/i);
  });

  /**
   * Un campo con un input proprio (task 16) riceve l'errore accanto al SUO
   * controllo, non in un elenco generico in coda al fieldset — stesso idioma del
   * nome dell'asta in SettingsRoute.
   */
  it('descrive un campo numerico sul suo controllo', () => {
    render(
      <ScoringFieldset
        value={SCORING}
        onChange={() => {}}
        errors={{ assist: ['Il valore per «assist» non è un numero valido.'] }}
        disabled={false}
      />,
    );

    const field = screen.getByLabelText(/^assist$/i);
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription(/assist.*non è un numero/i);
  });
});
