import type { Role } from '../api/types';

/**
 * L'ordine canonico dei quattro ruoli: portieri, difensori, centrocampisti,
 * attaccanti. Nasceva ripetuto uguale in cinque file (ricerca, chip delle
 * regole, card squadra, griglia rose, proiezione) — una sola fonte qui,
 * perche' un sesto file che lo scrivesse in un ordine diverso passerebbe
 * inosservato finche' qualcosa non si mostrasse fuori sequenza.
 */
export const ROLES: Role[] = ['P', 'D', 'C', 'A'];

/**
 * Il nome per esteso, al singolare. Nasceva identico carattere per carattere
 * in {@code RoleBadge} e {@code PlayerDecisionCard} — due copie della stessa
 * frase, non due frasi che per caso coincidevano.
 */
export const ROLE_NAME_SINGULAR: Record<Role, string> = {
  P: 'portiere',
  D: 'difensore',
  C: 'centrocampista',
  A: 'attaccante',
};

/**
 * Il nome per esteso, al plurale minuscolo — «i portieri», non «i Portieri»:
 * e' la forma che finisce dentro una frase (l'annuncio del cambio fase, il
 * nome accessibile di {@code PhaseSwitcher}), non un'intestazione.
 */
export const ROLE_NAME_PLURAL: Record<Role, string> = {
  P: 'portieri',
  D: 'difensori',
  C: 'centrocampisti',
  A: 'attaccanti',
};

/**
 * Lo stesso plurale, ma come intestazione — «Portieri», non dentro una
 * frase. Nasceva identica carattere per carattere in {@code RosterGrid} e
 * {@code ProjectionRoute}: stesso testo, stessa capitalizzazione, stesso
 * motivo (l'annuncio esteso del gruppo di ruolo in una sezione).
 */
export const ROLE_NAME_PLURAL_CAPITALIZED: Record<Role, string> = {
  P: 'Portieri',
  D: 'Difensori',
  C: 'Centrocampisti',
  A: 'Attaccanti',
};

/**
 * Il fondo pieno del ruolo (i quattro token {@code --role-*}), verificato a
 * 4.5:1 sopra {@code on-accent} in contrast.test.ts. Nasceva ripetuto in
 * {@code RoleBadge}, {@code SquadCards}, {@code RosterGrid} e
 * {@code ProjectionRoute} — la stessa coppia di colori per ruolo, scritta
 * quattro volte.
 */
export const BG_ROLE_CLASS: Record<Role, string> = {
  P: 'bg-role-p',
  D: 'bg-role-d',
  C: 'bg-role-c',
  A: 'bg-role-a',
};
