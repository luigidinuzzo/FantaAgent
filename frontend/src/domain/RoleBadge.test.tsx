import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RoleBadge } from './RoleBadge';

describe('RoleBadge', () => {
  it('porta la lettera del ruolo, non solo il colore', () => {
    render(<RoleBadge role="D" />);
    expect(screen.getByText('D')).toBeInTheDocument();
  });

  it('dice per esteso di che ruolo si tratta, per chi non vede il colore', () => {
    render(<RoleBadge role="C" />);
    expect(screen.getByText('centrocampista')).toHaveClass('sr-only');
  });

  it.each([
    ['P', 'role-p'],
    ['D', 'role-d'],
    ['C', 'role-c'],
    ['A', 'role-a'],
  ] as const)('usa il token del ruolo %s', (role, token) => {
    const { container } = render(<RoleBadge role={role} />);
    expect(container.firstElementChild?.className).toContain(token);
  });

  /**
   * size sostituisce lo scale-150 esterno che PublicBidderDialog usava prima:
   * qui la taglia grande ridimensiona davvero la scatola (una classe di
   * testo diversa), non solo il disegno con un trasforma CSS.
   */
  it('senza size resta alla taglia di sempre (md, predefinita)', () => {
    const { container } = render(<RoleBadge role="D" />);
    expect(container.firstElementChild?.className).toContain('text-xs');
  });

  it('con size="lg" ingrandisce il testo, senza cambiare lettera, nome o colore', () => {
    const { container } = render(<RoleBadge role="D" filled size="lg" />);
    const badge = container.firstElementChild;
    expect(badge?.className).toContain('text-2xl');
    expect(badge?.className).toContain('bg-role-d');
    expect(screen.getByText('D')).toBeInTheDocument();
    expect(screen.getByText('difensore')).toHaveClass('sr-only');
  });
});
