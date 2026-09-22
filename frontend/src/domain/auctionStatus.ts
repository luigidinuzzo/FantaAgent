import type { AuctionCard } from '../api/types';

/**
 * A che punto e' un'asta, dai soli numeri della sua riga: nessun acquisto, alcuni,
 * o tutti i posti delle rose pieni. {@code totalSlots} a zero vuol dire che il
 * totale non e' noto: senza, un'asta non si puo' dire conclusa.
 */
export type AuctionStatus = 'da-iniziare' | 'in-corso' | 'conclusa';

export function auctionStatus(a: Pick<AuctionCard, 'purchases' | 'totalSlots'>): AuctionStatus {
  if (a.purchases === 0) return 'da-iniziare';
  if (a.totalSlots > 0 && a.purchases >= a.totalSlots) return 'conclusa';
  return 'in-corso';
}

export const STATUS_LABEL: Record<AuctionStatus, string> = {
  'da-iniziare': 'Da iniziare',
  'in-corso': 'In corso',
  conclusa: 'Conclusa',
};

/**
 * Il verbo del bottone di ogni riga: «Riprendi» su un'asta mai cominciata o gia'
 * finita prometteva qualcosa da riprendere che non c'era.
 */
export const STATUS_VERB: Record<AuctionStatus, string> = {
  'da-iniziare': 'Inizia',
  'in-corso': 'Riprendi',
  conclusa: 'Apri',
};

const TIME = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' });
const DAY_MONTH = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' });
const DAY_MONTH_YEAR = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric', month: 'short', year: 'numeric',
});
export const FULL_DATE = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

/** Giorni di calendario fra due istanti, nel fuso di chi guarda: non ore diviso 24. */
function calendarDaysBetween(earlier: Date, later: Date): number {
  const a = new Date(earlier.getFullYear(), earlier.getMonth(), earlier.getDate());
  const b = new Date(later.getFullYear(), later.getMonth(), later.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * Quando l'asta e' stata toccata l'ultima volta, detto come lo direbbe una persona:
 * «oggi, 13:13», «ieri, 09:28», «3 giorni fa», poi la data. La data completa resta
 * disponibile a parte (FULL_DATE), per chi la vuole esatta.
 */
export function whenLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const days = calendarDaysBetween(date, now);
  if (days <= 0) return `oggi, ${TIME.format(date)}`;
  if (days === 1) return `ieri, ${TIME.format(date)}`;
  if (days < 7) return `${days} giorni fa`;
  return date.getFullYear() === now.getFullYear()
    ? DAY_MONTH.format(date)
    : DAY_MONTH_YEAR.format(date);
}

/** Quanti colori ha lo stemma: tanti quanti i token crest-1…crest-N della palette. */
export const CREST_COLORS = 6;

/**
 * Il colore dello stemma di un'asta, stabile: dipende dall'identificativo, non dal
 * nome (che si puo' cambiare) ne' dalla posizione nell'elenco (che cambia a ogni uso).
 */
export function crestIndex(id: string): number {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash % CREST_COLORS;
}

/** La lettera dello stemma: la prima lettera o cifra del nome. */
export function crestLetter(label: string): string {
  const match = label.match(/[\p{L}\p{N}]/u);
  return match ? match[0].toUpperCase() : '?';
}
