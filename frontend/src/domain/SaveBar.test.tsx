import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SaveBar, SETTINGS_W } from './SaveBar';

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

  // Sugli schermi larghi i bottoni stanno al bordo destro del contenuto delle
  // impostazioni (66rem), non a quello di una pagina da 96rem: la larghezza e'
  // quella del contenuto, il margine ai lati fuori (box-content), come la pagina.
  it('il contenuto della barra e\' largo quanto quello delle impostazioni', () => {
    const { container } = render(<SaveBar {...base} dirty={false} />);
    const inner = container.firstElementChild!.firstElementChild as HTMLElement;
    expect(SETTINGS_W).toBe('max-w-[66rem]');
    expect(inner.className).toContain(SETTINGS_W);
    expect(inner.className).toContain('box-content');
    expect(inner.className).toContain('md:px-6');
  });

  // Sul telefono stretto la frase non si taglia: va a capo, al piu' su due righe,
  // e il bottone oro dice solo «Salva» per lasciarle spazio.
  it('sul telefono l errore va a capo invece di tagliarsi', () => {
    render(<SaveBar {...base} dirty error="1 errore: 1 in crediti per squadra." />);
    const status = screen.getByRole('alert').closest('p') as HTMLElement;
    expect(status.className).not.toContain('truncate');
    expect(status.className).toContain('line-clamp-2');
    const save = screen.getByRole('button', { name: 'Salva le regole' });
    expect(within(save).getByText('Salva').className).toContain('sm:hidden');
    expect(within(save).getByText('Salva le regole').className).toContain('max-sm:hidden');
  });
});
