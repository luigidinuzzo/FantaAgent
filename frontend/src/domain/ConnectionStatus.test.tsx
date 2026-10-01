import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConnectionLost, ConnectionStatus, STALE_AFTER_MS, isStale } from './ConnectionStatus';

const NOW = 1_700_000_000_000;

describe('isStale', () => {
  it('un dato appena arrivato non e stantio', () => {
    expect(isStale({ updatedAt: NOW - 1_000, isError: false, now: NOW })).toBe(false);
  });

  it('oltre la soglia diventa stantio', () => {
    expect(isStale({ updatedAt: NOW - STALE_AFTER_MS - 1, isError: false, now: NOW })).toBe(true);
  });

  it("un errore rende stantio anche un dato appena arrivato", () => {
    expect(isStale({ updatedAt: NOW, isError: true, now: NOW })).toBe(true);
  });

  it('senza alcun dato lo stato e stantio', () => {
    expect(isStale({ updatedAt: undefined, isError: false, now: NOW })).toBe(true);
  });
});

describe('ConnectionStatus', () => {
  it('in diretta lo dice', () => {
    render(<ConnectionStatus updatedAt={NOW - 2_000} isError={false} now={NOW} />);
    expect(screen.getByTestId('connection-status')).toHaveTextContent('In diretta');
  });

  // Sul telefono la testata ha posto per il pallino, non per la parola: chi
  // ascolta la sente lo stesso.
  it('compatto e in diretta: la parola c e per chi ascolta, il pallino per chi guarda', () => {
    render(<ConnectionStatus compact updatedAt={NOW} isError={false} now={NOW} />);
    expect(screen.getByText('In diretta').className).toContain('max-sm:sr-only');
  });

  // Persa, la frase intera non sta nella testata del telefono: la porterebbe su
  // due righe. Sotto sm la dice la riga sotto la testata (ConnectionLost), e qui
  // resta il pallino; da sm la frase torna qui. Mai due volte alla stessa misura.
  it('compatto ma con la connessione persa: la frase sparisce sotto sm, resta da sm', () => {
    render(<ConnectionStatus compact updatedAt={NOW - 60_000} isError={false} now={NOW} />);
    const phrase = screen.getByText(/Connessione persa/);
    expect(phrase.className).toContain('max-sm:hidden');
    expect(phrase.className).not.toContain('sr-only');
  });

  it('la riga del telefono dice la stessa frase, solo sotto sm', () => {
    render(<ConnectionLost updatedAt={NOW - 72_000} isError={false} now={NOW} />);
    const line = screen.getByTestId('connection-lost');
    expect(line).toHaveTextContent('Connessione persa, ultimo dato 1 min 12 s fa');
    expect(line.className).toContain('sm:hidden');
    expect(line).not.toHaveAttribute('role');
    expect(line).not.toHaveAttribute('aria-live');
  });

  it('la riga del telefono non c e finche la connessione e viva', () => {
    render(<ConnectionLost updatedAt={NOW - 2_000} isError={false} now={NOW} />);
    expect(screen.queryByTestId('connection-lost')).not.toBeInTheDocument();
  });

  it('quando e stantio dice da quanto', () => {
    render(<ConnectionStatus updatedAt={NOW - 72_000} isError now={NOW} />);
    expect(screen.getByTestId('connection-status')).toHaveTextContent(
      'Connessione persa, ultimo dato 1 min 12 s fa',
    );
  });

  it("non e' una live region: l'annuncio spetta ad AuctionAnnouncer", () => {
    render(<ConnectionStatus updatedAt={NOW} isError={false} now={NOW} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
