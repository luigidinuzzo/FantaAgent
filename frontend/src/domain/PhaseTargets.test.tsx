import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { TargetView } from '../api/types';
import { PhaseTargets } from './PhaseTargets';

const T: TargetView = {
  id: 'f1', name: 'Falcone', team: 'Lecce', role: 'P', listPrice: 8,
  maxBid: 34, expectedPrice: 16, margin: 18, worthPursuing: true,
};

describe('PhaseTargets', () => {
  it('ogni occasione mette il giocatore sul banco', async () => {
    const onSelect = vi.fn();
    render(<PhaseTargets phase="P" targets={[T]} loading={false} disabled={false} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: /^Falcone, Lecce: mercato 16, tetto 34, margine \+18/ }));
    expect(onSelect).toHaveBeenCalledWith('f1');
    expect(screen.getByText(/I portieri liberi/)).toBeInTheDocument();
  });

  /** Un caricamento fallito non e' «non ci sono occasioni»: e' stato un difetto vero. */
  it('se le occasioni non arrivano lo dice, invece di dire che non ce ne sono', () => {
    render(<PhaseTargets phase="P" targets={[]} loading={false} failed disabled={false} onSelect={() => {}} />);
    expect(screen.getByText(/non si sono caricate/)).toBeInTheDocument();
    expect(screen.queryByText(/non restano giocatori liberi/)).not.toBeInTheDocument();
  });

  it('senza occasioni invita a passare alla fase successiva', () => {
    render(<PhaseTargets phase="P" targets={[]} loading={false} disabled={false} onSelect={() => {}} />);
    expect(screen.getByText(/non restano giocatori liberi/)).toBeInTheDocument();
  });

  /**
   * Dentro il banco, sotto i controlli del lotto: e' il posto dove si decide se
   * spingere o lasciare, ed e' anche il vuoto piu' grande della schermata —
   * trecento pixel di niente sotto «Avvia il conto alla rovescia».
   */
  describe('dentro il banco, accanto al lotto aperto', () => {
    const OTHER: TargetView = { ...T, id: 'c1', name: 'Caprile', team: 'Cagliari', maxBid: 22, margin: 11 };

    /**
     * Il difetto: l'elenco era alto una riga sola e il contenuto tre — cinque
     * occasioni, due visibili, tre dietro uno scorrimento che non si annunciava.
     * Uno scorrimento che nasconde senza dirlo non e' una scorciatoia, e' roba
     * persa: nel banco non ce n'e' piu'.
     */
    it('nel banco non nasconde niente dietro uno scorrimento', () => {
      const cinque = [T, OTHER,
        { ...T, id: 'm1', name: 'Meret' },
        { ...T, id: 'm2', name: 'Muric' },
        { ...T, id: 'm3', name: 'Falcone' }];
      render(
        <PhaseTargets phase="P" targets={cinque} loading={false} disabled={false} onSelect={() => {}} bare />,
      );

      expect(screen.getAllByRole('button')).toHaveLength(5);
      const elenco = screen.getByRole('list');
      expect(elenco.className).not.toContain('overflow-y-auto');
    });

    /**
     * Erano righe di elenco separate da un filetto: si leggevano come testo, non
     * come qualcosa da premere. Il linguaggio a pillole con il contorno e' lo
     * stesso dei bottoni squadra del conto alla rovescia, che nessuno ha mai
     * scambiato per una lista.
     */
    it('ogni alternativa e un bersaglio con il suo contorno, non una riga di elenco', () => {
      render(
        <PhaseTargets phase="P" targets={[T]} loading={false} disabled={false} onSelect={() => {}} bare />,
      );
      const bottone = screen.getByRole('button', { name: /^Falcone/ });
      expect(bottone.className).toContain('border');
      expect(bottone.className).toContain('rounded-lg');
    });

    it('senza cornice propria: il banco porta gia bordo, fondo e titolo', () => {
      const { container } = render(
        <PhaseTargets phase="P" targets={[T]} loading={false} disabled={false} onSelect={() => {}} bare />,
      );
      // Due cornici concentriche dello stesso colore erano solo rumore attorno al
      // numero che conta: la stessa disciplina di PlayerDecisionCard.
      expect(container.querySelector('.panel')).toBeNull();
    });

    it('non ripropone il giocatore che e gia sul banco', () => {
      render(
        <PhaseTargets
          phase="P" targets={[T, OTHER]} loading={false} disabled={false} onSelect={() => {}}
          bare excludeId="f1"
        />,
      );
      // Sarebbe un'alternativa a se stesso, e prenderebbe il posto di una vera.
      expect(screen.queryByRole('button', { name: /^Falcone/ })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Caprile/ })).toBeInTheDocument();
    });

    it('si chiama «Invece di lui»: e la via d uscita, non un secondo elenco', () => {
      render(
        <PhaseTargets
          phase="P" targets={[T]} loading={false} disabled={false} onSelect={() => {}}
          bare excludeId="x"
        />,
      );
      expect(screen.getByRole('heading', { name: 'Invece di lui' })).toBeInTheDocument();
      // Il criterio non si ripete: accanto c'e' gia' il lotto con il suo margine.
      expect(screen.queryByText(/I portieri liberi/)).not.toBeInTheDocument();
    });

    it('esaurite le alternative lo dice, invece di lasciare il vuoto', () => {
      render(
        <PhaseTargets
          phase="P" targets={[T]} loading={false} disabled={false} onSelect={() => {}}
          bare excludeId="f1"
        />,
      );
      expect(screen.getByText(/nessun altro portiere/i)).toBeInTheDocument();
    });
  });

  it('a conto alla rovescia aperto le occasioni non si possono scegliere', () => {
    render(<PhaseTargets phase="P" targets={[T]} loading={false} disabled onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: /^Falcone/ })).toBeDisabled();
  });

  it("impilate nel banco restano pillole, e dicono anche squadra e mercato", () => {
    render(
      <PhaseTargets phase="P" targets={[T]} loading={false} disabled={false} onSelect={() => {}} bare stacked />,
    );
    const bottone = screen.getByRole('button', { name: /^Falcone/ });
    expect(bottone.className).toContain('rounded-lg');
    expect(bottone).toHaveTextContent('Lecce · mercato 16 · tetto 34');
    expect(screen.getByRole('list').className).toContain('grid-cols-1');
    expect(screen.getByRole('list').className).not.toContain('overflow-y-auto');
  });
});
