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
