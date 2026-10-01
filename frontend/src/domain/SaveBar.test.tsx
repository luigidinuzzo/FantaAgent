import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SaveBar } from './SaveBar';

const base = { pending: false, error: null, saveLabel: 'Salva le regole', onSave: () => {}, onReset: () => {} };

describe('SaveBar', () => {
  it('senza modifiche dice Tutto salvato e i bottoni non sono attivi', () => {
    render(<SaveBar {...base} dirty={false} />);
    expect(screen.getByText('Tutto salvato')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salva le regole' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Annulla' })).toBeDisabled();
  });

  it('con modifiche dice Modifiche non salvate e salva', async () => {
    const onSave = vi.fn();
    render(<SaveBar {...base} dirty onSave={onSave} />);
    expect(screen.getByText('Modifiche non salvate')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Salva le regole' }));
    expect(onSave).toHaveBeenCalled();
  });

  it('Annulla torna a cio che e salvato', async () => {
    const onReset = vi.fn();
    render(<SaveBar {...base} dirty onReset={onReset} />);
    await userEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(onReset).toHaveBeenCalled();
  });

  it('l errore e l unico alert', () => {
    render(<SaveBar {...base} dirty error="Non sono riuscito a salvare." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Non sono riuscito a salvare.');
  });

  // Due stati della stessa misura: la barra non salta quando si comincia a scrivere.
  it('ha un altezza fissa ed e ferma in fondo alla finestra', () => {
    const { container } = render(<SaveBar {...base} dirty={false} />);
    const bar = container.firstElementChild as HTMLElement;
    expect(bar.className).toContain('fixed');
    expect(bar.className).toContain('bottom-0');
    expect(bar.className).toContain('h-18');
  });
});
