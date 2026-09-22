import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AuctionCard } from '../api/types';
import { DeleteAuctionDialog } from './DeleteAuctionDialog';

const AUCTION: AuctionCard = {
  id: '2026-09-02', label: 'Lega No Name', lastWritten: null, purchases: 3, phase: 'D', selected: false,
  teams: 8, budget: 500, totalSlots: 200, myName: null, myBudgetRemaining: null,
};

describe('DeleteAuctionDialog', () => {
  /**
   * Un prodotto per chi gioca: il testo dice cosa succede, non dove finiscono i file.
   * Nessun percorso, nessun nome di cartella.
   */
  it('chiede conferma nominando l asta, con il focus su Annulla', () => {
    render(<DeleteAuctionDialog auction={AUCTION} pending={false} error={null} onConfirm={() => {}} onCancel={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'Eliminare «Lega No Name»?' });
    expect(dialog).toHaveTextContent("Sei sicuro? L'azione è irreversibile.");
    expect(dialog).not.toHaveTextContent(/res\/|cartella|cestino/i);
    expect(screen.getByRole('button', { name: 'Annulla' })).toHaveFocus();
  });

  it('Elimina conferma, Annulla ed Esc no', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<DeleteAuctionDialog auction={AUCTION} pending={false} error={null} onConfirm={onConfirm} onCancel={onCancel} />);

    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onConfirm).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Elimina' }));
    expect(onConfirm).toHaveBeenCalledWith('2026-09-02');
  });

  it('in corso dice Elimino… e non si ripreme', () => {
    render(<DeleteAuctionDialog auction={AUCTION} pending error={null} onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole('button', { name: 'Elimino…' })).toBeDisabled();
  });

  it("un errore resta dentro la modale come unico alert", () => {
    render(<DeleteAuctionDialog auction={AUCTION} pending={false} error="Asta non trovata." onConfirm={() => {}} onCancel={() => {}} />);
    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(screen.getByRole('dialog')).toContainElement(alerts[0]);
  });

  it('chiusa non rende niente di interattivo', () => {
    render(<DeleteAuctionDialog auction={null} pending={false} error={null} onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
