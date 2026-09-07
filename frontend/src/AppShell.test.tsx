import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppShell } from './AppShell';

describe('AppShell', () => {
  it('mostra il contenuto dentro un landmark main', () => {
    render(<AppShell><p>contenuto</p></AppShell>);
    expect(screen.getByRole('main')).toHaveTextContent('contenuto');
  });

  it('espone la barra superiore come banner', () => {
    render(<AppShell><p>x</p></AppShell>);
    expect(screen.getByRole('banner')).toHaveTextContent('FantaAgent');
  });

  it('ospita lo slot di stato nella barra', () => {
    render(<AppShell slotStatus={<span>in diretta</span>}><p>x</p></AppShell>);
    expect(screen.getByRole('banner')).toHaveTextContent('in diretta');
  });
});
