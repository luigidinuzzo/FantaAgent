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
});
