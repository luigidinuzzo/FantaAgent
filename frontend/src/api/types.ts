export type Role = 'P' | 'D' | 'C' | 'A';

/**
 * Una riga della home: quanto basta a riconoscere un'asta fra le altre.
 * Specchio del record Java {@code AuctionsDtos.AuctionCard}.
 */
export interface AuctionCard {
  id: string;
  label: string;
  lastWritten: string | null;
  purchases: number;
  phase: Role;
  selected: boolean;
}

export interface ParticipantView {
  id: string;
  name: string;
  initial: string;
  me: boolean;
  budgetRemaining: number;
  slotsRemaining: number;
  filledByRole: Record<Role, number>;
  slotsByRole: Record<Role, number>;
}

export interface AuctionStateResponse {
  auctionId: string;
  auctionName: string;
  currentPhase: Role;
  phases: Role[];
  soldInPhase: number;
  myParticipantId: string;
  canUndo: boolean;
  participants: ParticipantView[];
}

export interface PlayerSummary {
  id: string;
  name: string;
  team: string;
  role: Role;
  listPrice: number;
}

export interface DriverView {
  label: string;
  contribution: number;
  explanation: string;
}

/**
 * Non estende PlayerSummary: il DTO Java identifica il giocatore con
 * `playerId`, non con `id`, e ereditare porterebbe in TypeScript un campo che
 * dal filo non arriva mai.
 */
export interface ValuationResponse {
  playerId: string;
  name: string;
  team: string;
  role: Role;
  listPrice: number;
  expectedPrice: number;
  maxBid: number;
  hardCap: number;
  margin: number;
  walkAwayReason: string;
  worthPursuing: boolean;
  confidenceStars: number;
  drivers: DriverView[];
}

export interface PhaseRowView extends PlayerSummary {
  maxBid: number;
  expectedPrice: number;
  margin: number;
  fantamediaAttesa: number;
  titolaritaPercent: number;
}

export interface PhasePageResponse {
  rows: PhaseRowView[];
  offset: number;
  pageSize: number;
  total: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface PurchaseResponse {
  seq: number;
  playerId: string;
  participantId: string;
  price: number;
}

export interface BoardSlot {
  seq: number;
  playerName: string;
  price: number;
}

export interface BoardColumn {
  participantId: string;
  participantName: string;
  me: boolean;
  budgetRemaining: number;
  slotsRemaining: number;
  byRole: Record<Role, BoardSlot[]>;
}

export interface BoardResponse {
  auctionId: string;
  currentPhase: Role;
  columns: BoardColumn[];
}

/**
 * Lo specchio del record Java {@code PublicBidderResponse} — senza campi di
 * valutazione, perche' l'originale non ne ha. E' il secondo dei quattro posti
 * in cui la garanzia "il tetto non raggiunge la proiezione" deve reggere.
 */
export interface PublicBidderResponse {
  playerId: string;
  name: string;
  team: string;
  role: Role;
  listPrice: number;
  timerSeconds: number;
  beepEnabled: boolean;
}

export interface BidderSettings {
  bidTimerSeconds: number;
  beepEnabled: boolean;
}

export interface ParticipantSettings {
  id: string;
  name: string;
  initial: string;
  me: boolean;
}

export interface ScoringStep {
  minAverage: number;
  bonus: number;
}

/**
 * `thresholds` ha il suo editor in `ThresholdsTable` (task 18): righe che si
 * aggiungono e si tolgono, entrambe le colonne decimali. Il valore che arriva da
 * {@link SettingsResponse} torna al server dentro {@link SaveSettingsRequest} con
 * qualunque modifica l'utente gli abbia fatto — non riscritto o appiattito.
 */
export interface ScoringSection {
  defenceModifierEnabled: boolean;
  defendersCounted: number;
  thresholds: ScoringStep[];
  goalBonus: Record<Role, number>;
  assist: number;
  penaltyScored: number;
  penaltyMissed: number;
  penaltySaved: number;
  yellowCard: number;
  redCard: number;
  goalConceded: number;
  cleanSheet: number;
  confirmed: boolean;
}

export interface SettingsResponse {
  bidder: BidderSettings;
  participants: ParticipantSettings[];
  scoring: ScoringSection;
  /** Ad asta aperta i parametri di punteggio sono bloccati: cambiarli riscriverebbe
   *  i numeri con cui una rosa gia' pagata era stata valutata. */
  auctionOpen: boolean;
}

export interface SaveSettingsRequest {
  auctionName: string;
  bidder: BidderSettings;
  participants: ParticipantSettings[];
  scoring: ScoringSection;
}

export interface SaveSettingsResult {
  /** L'id dell'asta appena nata, oppure null se ne era gia' aperta una. */
  auctionId: string | null;
}

/**
 * Le chiavi sono di campo, non di sezione (task 16: {@code bidTimerSeconds},
 * {@code defendersCounted}, {@code participants[<id>].name}…), e una chiave compare
 * solo se ha davvero un errore — un id di partecipante o un indice di riga non si
 * possono elencare tutti in anticipo come le quattro sezioni fisse di prima.
 */
export type SettingsErrors = Record<string, string[]>;
