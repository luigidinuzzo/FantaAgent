import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryProvider } from '../api/QueryProvider';
import { RegisterRoute } from './RegisterRoute';

describe('RegisterRoute', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('mostra gli errori accanto al campo a cui appartengono', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      type: 'https://fantaagent.local/problems/invalid-account',
      detail: 'Alcuni dati non sono validi.',
      errors: { password: ['La password deve avere almeno 10 caratteri.'] },
    }), { status: 422, headers: { 'content-type': 'application/problem+json' } })));
    render(<QueryProvider><MemoryRouter><RegisterRoute /></MemoryRouter></QueryProvider>);

    await userEvent.type(screen.getByLabelText('Il tuo nome'), 'Anna');
    await userEvent.type(screen.getByLabelText('Email'), 'anna@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'corta');
    await userEvent.click(screen.getByRole('button', { name: 'Crea l\'account' }));

    const password = screen.getByLabelText('Password');
    const described = await screen.findByText('La password deve avere almeno 10 caratteri.');
    expect(password.getAttribute('aria-describedby')).toContain(described.closest('ul')!.id);
    expect(password).toHaveAttribute('aria-invalid', 'true');
  });
});
