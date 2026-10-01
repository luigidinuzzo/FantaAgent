import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { CommandsMenu } from './CommandsMenu';

function renderMenu(overrides: Partial<Parameters<typeof CommandsMenu>[0]> = {}) {
  const props = {
    phases: ['P', 'D', 'C', 'A'] as const,
    current: 'C' as const,
    onChangePhase: vi.fn(),
    phasePending: false,
    canUndo: true,
    onUndo: vi.fn(),
    undoPending: false,
    projectionHref: '/leghe/l1/aste/a1/proiezione',
    settingsHref: '/leghe/l1/aste/a1/impostazioni',
    ...overrides,
  };
  render(<MemoryRouter><CommandsMenu {...props} phases={[...props.phases]} /></MemoryRouter>);
  return props;
}

describe('CommandsMenu', () => {
  // Sotto sm la sola icona in un quadrato di 44px: con la parola la testata non
  // stava su una riga a 360px.
  it('sotto sm il bottone e un quadrato di 44px, col nome per chi ascolta', () => {
    renderMenu();
    const button = screen.getByRole('button', { name: /Comandi/ });
    expect(button.className).toContain('max-sm:px-0');
    expect(button.className).toContain('min-w-11');
  });

  it('apre un menu con le fasi, l annullamento, la proiezione e le impostazioni', async () => {
    renderMenu();
    const button = screen.getByRole('button', { name: /Comandi/ });
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
    await userEvent.click(button);
    const menu = screen.getByRole('menu', { name: /Comandi/ });
    expect(within(menu).getByRole('menuitemradio', { name: 'Centrocampisti' })).toHaveAttribute('aria-checked', 'true');
    expect(within(menu).getByRole('menuitemradio', { name: 'Portieri' })).toHaveAttribute('aria-checked', 'false');
    expect(within(menu).getByRole('menuitem', { name: 'Annulla ultimo acquisto' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /Apri la proiezione/ })).toHaveAttribute('href', '/leghe/l1/aste/a1/proiezione');
    expect(within(menu).getByRole('menuitem', { name: 'Impostazioni dell\'asta' })).toHaveAttribute('href', '/leghe/l1/aste/a1/impostazioni');
  });

  it('scegliere una fase la cambia e chiude il menu', async () => {
    const props = renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /Comandi/ }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Attaccanti' }));
    expect(props.onChangePhase).toHaveBeenCalledWith('A');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('senza acquisti da annullare la voce e spenta', async () => {
    const props = renderMenu({ canUndo: false });
    await userEvent.click(screen.getByRole('button', { name: /Comandi/ }));
    const undo = screen.getByRole('menuitem', { name: 'Annulla ultimo acquisto' });
    expect(undo).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(undo);
    expect(props.onUndo).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('la fase corrente e spenta e un clic non cambia niente', async () => {
    const props = renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /Comandi/ }));
    const current = screen.getByRole('menuitemradio', { name: 'Centrocampisti' });
    expect(current).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(current);
    expect(props.onChangePhase).not.toHaveBeenCalled();
  });

  it('durante il cambio di fase tutte le fasi sono spente', async () => {
    renderMenu({ phasePending: true });
    await userEvent.click(screen.getByRole('button', { name: /Comandi/ }));
    for (const name of ['Portieri', 'Difensori', 'Centrocampisti', 'Attaccanti']) {
      expect(screen.getByRole('menuitemradio', { name })).toHaveAttribute('aria-disabled', 'true');
    }
  });

  it('annullare l ultimo acquisto esegue e chiude', async () => {
    const props = renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /Comandi/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Annulla ultimo acquisto' }));
    expect(props.onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('la proiezione si apre in una nuova finestra', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /Comandi/ }));
    const link = screen.getByRole('menuitem', { name: 'Apri la proiezione sul secondo schermo' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('all apertura il fuoco va alla prima voce abilitata', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /Comandi/ }));
    expect(screen.getByRole('menuitemradio', { name: 'Portieri' })).toHaveFocus();
  });

  it('con la prima fase corrente il fuoco salta la voce spenta', async () => {
    renderMenu({ current: 'P' });
    await userEvent.click(screen.getByRole('button', { name: /Comandi/ }));
    expect(screen.getByRole('menuitemradio', { name: 'Difensori' })).toHaveFocus();
  });

  it('Esc chiude e riporta il fuoco al bottone', async () => {
    renderMenu();
    const button = screen.getByRole('button', { name: /Comandi/ });
    await userEvent.click(button);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(button).toHaveFocus();
  });

  it('Tab chiude il menu', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /Comandi/ }));
    await userEvent.keyboard('{Tab}');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('un clic fuori chiude il menu', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /Comandi/ }));
    await userEvent.click(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('le frecce spostano il fuoco fra le voci, comprese quelle spente', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /Comandi/ }));
    const first = document.activeElement;
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).not.toBe(first);
    expect(screen.getByRole('menu')).toContainElement(document.activeElement as HTMLElement);
    await userEvent.keyboard('{ArrowDown}');
    // Terza voce: la fase corrente (spenta) resta raggiungibile con le frecce.
    expect(screen.getByRole('menuitemradio', { name: 'Centrocampisti' })).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: 'Impostazioni dell\'asta' })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('menuitemradio', { name: 'Portieri' })).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Impostazioni dell\'asta' })).toHaveFocus();
  });
});
