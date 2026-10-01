import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SettingsLayout } from './SettingsLayout';

const sections = [
  { id: 's-a', label: 'Banditore' },
  { id: 's-b', label: 'Crediti e posti', shortLabel: 'Crediti' },
];

function renderLayout() {
  return render(
    <SettingsLayout title="Regole della lega" context="Valgono per le prossime aste." sections={sections} ready
      saveBar={<div data-testid="bar" />}>
      <section id="s-a" aria-labelledby="h-a"><h2 id="h-a">Banditore</h2></section>
      <section id="s-b" aria-labelledby="h-b"><h2 id="h-b">Crediti e posti</h2></section>
    </SettingsLayout>,
  );
}

describe('SettingsLayout', () => {
  it('ha l intestazione con h1', () => {
    renderLayout();
    expect(screen.getByRole('heading', { level: 1, name: 'Regole della lega' })).toBeInTheDocument();
  });

  it('un indice solo, con un link per sezione', () => {
    renderLayout();
    const nav = screen.getByRole('navigation', { name: 'Sezioni' });
    expect(nav.querySelectorAll('a[href="#s-a"]')).toHaveLength(2); // computer + telefono
    expect(screen.getAllByRole('link', { name: 'Banditore' }).length).toBeGreaterThan(0);
  });

  it('la fila del telefono usa le etichette corte e non scorre di lato', () => {
    renderLayout();
    const phone = screen.getByTestId('settings-index-phone');
    expect(phone.className).toContain('lg:hidden');
    expect(phone.className).not.toContain('overflow-x-auto');
    expect(phone).toHaveTextContent('Crediti');
  });

  it('il contenuto lascia in fondo lo spazio della barra', () => {
    renderLayout();
    expect(screen.getByTestId('settings-content').className).toContain('pb-24');
    expect(screen.getByTestId('bar')).toBeInTheDocument();
  });
});
