import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CorrectPurchaseDialog } from './CorrectPurchaseDialog';

const PURCHASE = { seq: 7, playerName: 'Bastoni', participantId: 'anna', price: 20 };
const PARTICIPANTS = [{ id: 'anna', name: 'Anna' }, { id: 'bruno', name: 'Bruno' }];

function renderDialog(overrides: Partial<Parameters<typeof CorrectPurchaseDialog>[0]> = {}) {
  const props = {
    purchase: PURCHASE,
    participants: PARTICIPANTS,
    pending: false,
    error: null,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  render(<CorrectPurchaseDialog {...props} />);
  return props;
}

describe('CorrectPurchaseDialog', () => {
  it("si apre con la squadra e il prezzo dell'acquisto", () => {
    renderDialog();
    const dialog = screen.getByRole('dialog', { name: "Correggi l'acquisto" });
    expect(dialog).toHaveTextContent('Bastoni');
    expect(screen.getByLabelText('Squadra')).toHaveValue('anna');
    expect(screen.getByLabelText('Prezzo')).toHaveValue('20');
  });

  it('con prezzo zero o vuoto non si salva', async () => {
    renderDialog();
    const price = screen.getByLabelText('Prezzo');
    const save = screen.getByRole('button', { name: 'Salva la correzione' });
    await userEvent.clear(price);
    expect(save).toBeDisabled();
    await userEvent.type(price, '0');
    expect(save).toBeDisabled();
  });

  it('salva con numero, squadra e prezzo scelti', async () => {
    const { onConfirm } = renderDialog();
    await userEvent.selectOptions(screen.getByLabelText('Squadra'), 'bruno');
    await userEvent.clear(screen.getByLabelText('Prezzo'));
    await userEvent.type(screen.getByLabelText('Prezzo'), '33');
    await userEvent.click(screen.getByRole('button', { name: 'Salva la correzione' }));
    expect(onConfirm).toHaveBeenCalledWith(7, 'bruno', 33);
  });

  it('Esc e Annulla chiudono senza salvare', async () => {
    const { onConfirm, onCancel } = renderDialog();
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('in corso dice Salvo… e non si ripreme', () => {
    renderDialog({ pending: true });
    expect(screen.getByRole('button', { name: 'Salvo…' })).toBeDisabled();
  });

  it("un errore resta dentro la modale come unico alert", () => {
    renderDialog({ error: 'Solo l\'amministratore della lega può farlo.' });
    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(screen.getByRole('dialog')).toContainElement(alerts[0]);
  });

  it('chiusa non rende niente', () => {
    renderDialog({ purchase: null });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
