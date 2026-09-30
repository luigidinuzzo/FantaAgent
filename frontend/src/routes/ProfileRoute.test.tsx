import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryProvider } from '../api/QueryProvider';
import { ProfileRoute } from './ProfileRoute';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json' },
  });
}

describe('ProfileRoute', () => {
  afterEach(() => vi.unstubAllGlobals());

  /**
   * Due soli pannelli, corti: senza centrarli nell'area sotto la barra restava un
   * vuoto enorme sulle finestre larghe (fix round 1). Il layout vero si vede solo
   * negli screenshot; qui si controlla solo che il contenitore porti le classi che
   * lo centrano, sopravvivendo a un refactor involontario che le togliesse.
   */
  it("centra i pannelli nell'area sotto la barra, invece di lasciarli in cima", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({
      id: 'u1', email: 'anna@example.com', displayName: 'Anna', emailVerified: true,
    })));
    render(<QueryProvider><MemoryRouter><ProfileRoute /></MemoryRouter></QueryProvider>);

    // Il contenitore (PageFrame) e' alto quanto la finestra; dentro, i pannelli
    // stanno nel contenitore che ne prende tutta l'altezza (flex-1) e li centra.
    const heading = await screen.findByRole('heading', { name: 'Il tuo profilo' });
    const frame = heading.closest('main')?.firstElementChild;
    expect(frame?.className).toContain('min-h-[calc(100dvh-var(--header-h)-2rem)]');
    const container = heading.closest('.flex-1.items-center');
    expect(container?.className).toContain('justify-center');
  });
});
