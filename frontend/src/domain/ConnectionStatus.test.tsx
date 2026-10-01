import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConnectionStatus, STALE_AFTER_MS, isStale } from './ConnectionStatus';

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

  it('compatto ma con la connessione persa: la frase resta intera', () => {
    render(<ConnectionStatus compact updatedAt={NOW - 60_000} isError={false} now={NOW} />);
    expect(screen.getByText(/Connessione persa/).className).not.toContain('sr-only');
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
