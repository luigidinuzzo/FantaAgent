import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { LeagueRulesView } from '../api/types';
import { ConfigChips } from './ConfigChips';

// Valori scelti apposta diversi fra loro: due chips a "8" (partecipanti e uno
// slot) avrebbero reso ambiguo un getByText('8') nei test qui sotto.
const RULES: LeagueRulesView = {
  participants: 8,
  budget: 500,
  slots: { P: 3, D: 9, C: 10, A: 6 },
};

describe('ConfigChips', () => {
  it('mostra i crediti e le squadre con la loro etichetta, non nudi', () => {
    render(<ConfigChips rules={RULES} />);
    expect(screen.getByText('500')).toBeInTheDocument();
    expect(screen.getByText('crediti')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('squadre')).toBeInTheDocument();
  });

  it('mostra i quattro limiti per ruolo', () => {
    render(<ConfigChips rules={RULES} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
  });

  /**
   * Nessun controllo: sono numeri di sola lettura. Un <input disabled>
   * prometterebbe una modifica futura che non esiste — il server non scrive
   * mai questo campo.
   */
  it('non porta nessun controllo modificabile', () => {
    render(<ConfigChips rules={RULES} />);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
  });

  it('la provenienza si sente a parole, nel nome accessibile del gruppo', () => {
    render(<ConfigChips rules={RULES} />);
    expect(screen.getByRole('region', { name: /configurazione/i })).toBeInTheDocument();
  });
});
