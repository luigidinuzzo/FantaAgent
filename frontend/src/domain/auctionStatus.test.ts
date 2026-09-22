import { describe, expect, it } from 'vitest';
import { auctionStatus, crestIndex, crestLetter, CREST_COLORS, whenLabel } from './auctionStatus';

describe('auctionStatus', () => {
  it('senza acquisti e da iniziare, con tutti i posti pieni e conclusa', () => {
    expect(auctionStatus({ purchases: 0, totalSlots: 200 })).toBe('da-iniziare');
    expect(auctionStatus({ purchases: 48, totalSlots: 200 })).toBe('in-corso');
    expect(auctionStatus({ purchases: 200, totalSlots: 200 })).toBe('conclusa');
  });

  it('senza il totale dei posti non si dice mai conclusa', () => {
    expect(auctionStatus({ purchases: 500, totalSlots: 0 })).toBe('in-corso');
  });
});

describe('whenLabel', () => {
  const now = new Date(2026, 8, 22, 15, 0);

  it('dice oggi e ieri con l ora, poi i giorni, poi la data', () => {
    expect(whenLabel(new Date(2026, 8, 22, 9, 5).toISOString(), now)).toBe('oggi, 09:05');
    expect(whenLabel(new Date(2026, 8, 21, 23, 59).toISOString(), now)).toBe('ieri, 23:59');
    expect(whenLabel(new Date(2026, 8, 18, 12, 0).toISOString(), now)).toBe('4 giorni fa');
    expect(whenLabel(new Date(2026, 8, 1, 12, 0).toISOString(), now)).toBe('1 set');
    expect(whenLabel(new Date(2025, 7, 30, 12, 0).toISOString(), now)).toBe('30 ago 2025');
  });

  it('conta i giorni di calendario, non le ore', () => {
    // Undici ore prima, ma gia' il giorno prima.
    expect(whenLabel(new Date(2026, 8, 22, 1, 0).toISOString(), new Date(2026, 8, 22, 12, 0))).toBe('oggi, 01:00');
    expect(whenLabel(new Date(2026, 8, 21, 23, 0).toISOString(), new Date(2026, 8, 22, 1, 0))).toBe('ieri, 23:00');
  });
});

describe('stemma', () => {
  it('il colore dipende dall identificativo ed e sempre uno dei disponibili', () => {
    expect(crestIndex('2026-09-01')).toBe(crestIndex('2026-09-01'));
    for (const id of ['a', 'b', '2026-09-22', 'zzz']) {
      expect(crestIndex(id)).toBeGreaterThanOrEqual(0);
      expect(crestIndex(id)).toBeLessThan(CREST_COLORS);
    }
  });

  it('la lettera e la prima lettera o cifra del nome', () => {
    expect(crestLetter('lega del bar')).toBe('L');
    expect(crestLetter('«Élite» 2026')).toBe('É');
    expect(crestLetter('2026-09-01')).toBe('2');
    expect(crestLetter('!!!')).toBe('?');
  });
});
