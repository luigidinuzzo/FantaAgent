export type Role = 'P' | 'D' | 'C' | 'A';

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
  /** Null per chi e' membro della lega ma non ha un posto in quest'asta. */
  myParticipantId: string | null;
  canUndo: boolean;
  participants: ParticipantView[];
  /** Il numero dell'ultimo evento del registro. */
  version: number;
  /** Se chi guarda e' l'amministratore della lega: solo lui scrive. */
  admin: boolean;
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

/**
 * Le colonne su cui la tabella di fase si puo' ordinare, con i nomi che viaggiano
 * nell'indirizzo. Sono tutte e sole quelle che il server sa mettere in fila senza
 * valutare l'intera fase: il tetto e il margine nascono da un calcolo completo per
 * riga, e ordinarci sopra costerebbe secondi a ogni pagina.
 */
export type PhaseSort = 'quotazione' | 'fantamedia' | 'titolarita';

export type SortDir = 'asc' | 'desc';

export interface PhaseRowView extends PlayerSummary {
  maxBid: number;
  expectedPrice: number;
  margin: number;
  fantamediaAttesa: number;
  titolaritaPercent: number;
}

/** Un'occasione della fase: specchio di {@code PlayerDtos.TargetView}. */
export interface TargetView {
  id: string;
  name: string;
  team: string;
  role: Role;
  listPrice: number;
  maxBid: number;
  expectedPrice: number;
  margin: number;
  worthPursuing: boolean;
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

export interface ScoringStep {
  minAverage: number;
  bonus: number;
}

/**
 * `thresholds` ha il suo editor in `ThresholdsTable` (task 18): righe che si
 * aggiungono e si tolgono, entrambe le colonne decimali. Il valore che arriva da
 * {@link LeagueRulesResponse} torna al server dentro {@link SaveLeagueRulesRequest}
 * con qualunque modifica l'utente gli abbia fatto — non riscritto o appiattito.
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

/**
 * Crediti e posti per ruolo con cui nasce un'asta. Le squadre no: sono i membri che
 * partecipano.
 */
export interface RulesSection {
  budget: number;
  slots: Record<Role, number>;
}

/** Le regole con cui nasceranno le prossime aste della lega. */
export interface LeagueRulesResponse {
  bidder: BidderSettings;
  scoring: ScoringSection;
  rules: RulesSection;
  /** Solo l'amministratore le cambia: gli altri membri le leggono. */
  canEdit: boolean;
}

export interface SaveLeagueRulesRequest {
  bidder: BidderSettings;
  scoring: ScoringSection;
  rules: RulesSection;
}

/**
 * Le chiavi sono di campo, non di sezione (task 16: {@code bidTimerSeconds},
 * {@code defendersCounted}, {@code slots[P]}…), e una chiave compare solo se ha
 * davvero un errore — un indice di riga non si puo' elencare in anticipo come le
 * quattro sezioni fisse di prima.
 */
export type SettingsErrors = Record<string, string[]>;

/** Una lega fra le mie. Specchio di {@code LeagueDtos.LeagueCard}. */
export interface LeagueCard {
  id: string;
  name: string;
  admin: boolean;
  teamName: string;
  initial: string;
  members: number;
  auctions: number;
  /** Le richieste d'ingresso da decidere: sempre 0 per chi non amministra. */
  pendingRequests: number;
}

/**
 * Un'asta in cui ho un posto, di una qualunque delle mie leghe: la home le
 * mostra tutte insieme. Specchio di {@code MyAuctionView}.
 */
export interface MyAuction {
  id: string;
  leagueId: string;
  leagueName: string;
  name: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'CONCLUDED';
  phase: Role;
  budgetRemaining: number;
  slotsRemaining: number;
  lastActivity: string;
  /** Vero se amministro la lega dell'asta. */
  admin: boolean;
}

/** Una lega trovata cercandone il nome. Specchio di {@code LeagueDtos.LeagueMatchView}. */
export interface LeagueMatch {
  id: string;
  name: string;
  adminName: string;
  members: number;
  status: 'NONE' | 'PENDING' | 'MEMBER';
}

/** Una richiesta d'ingresso mandata, vista da chi l'ha mandata. */
export interface MyJoinRequest {
  leagueId: string;
  leagueName: string;
  teamName: string;
  requestedAt: string;
}

/** Una richiesta d'ingresso da decidere, vista dall'amministratore. */
export interface JoinRequestView {
  userId: string;
  displayName: string;
  teamName: string;
  requestedAt: string;
}

export interface MemberView {
  userId: string;
  displayName: string;
  teamName: string;
  initial: string;
  role: 'ADMIN' | 'MEMBER';
  me: boolean;
}

export interface LeagueDetail {
  id: string;
  name: string;
  admin: boolean;
  members: MemberView[];
}

export interface InviteView {
  id: string;
  createdAt: string;
  expiresAt: string;
}

/** Il link si vede solo qui, nella risposta alla creazione. */
export interface CreatedInvite {
  id: string;
  link: string;
  expiresAt: string;
}

export interface InvitePreview {
  leagueId: string;
  leagueName: string;
  invitedBy: string;
  alreadyMember: boolean;
  takenInitials: string[];
}

/** Un'asta nella pagina della lega. Specchio di {@code LeagueDtos.AuctionCardView}. */
export interface LeagueAuctionCard {
  id: string;
  name: string;
  createdAt: string;
  lastWritten: string | null;
  purchases: number;
  phase: Role;
  teams: number;
  budget: number;
  totalSlots: number;
  /** Null per chi non ha un posto in quest'asta. */
  myBudgetRemaining: number | null;
  bidder: BidderSettings;
}

export interface SeatView {
  userId: string;
  displayName: string;
  teamName: string;
  initial: string;
  position: number;
}

export interface SeatsView {
  /** Vero dal primo acquisto: da li' si cambia solo l'ordine. */
  locked: boolean;
  seats: SeatView[];
}

export interface SeatInput {
  userId: string;
  teamName: string;
  initial: string;
}

export interface ImportPreview {
  name: string;
  purchases: number;
  participants: { id: string; name: string; initial: string }[];
}

export interface ImportResult {
  auctionId: string;
}
