import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  apiGet,
  apiLeagueDelete,
  apiLeagueGet,
  apiLeaguePatch,
  apiLeaguePost,
  apiLeaguePut,
  apiPost,
  apiPostToAuction,
} from './client';
import type {
  AuctionCard,
  AuctionStateResponse,
  BoardResponse,
  PhasePageResponse,
  PublicBidderResponse,
  PurchaseResponse,
  Role,
  SaveSettingsRequest,
  SaveSettingsResult,
  SettingsResponse,
  TargetView,
  ValuationResponse,
} from './types';

const KEYS = {
  state: ['state'] as const,
  phase: (offset: number) => ['phase', offset] as const,
  valuation: (playerId: string) => ['valuation', playerId] as const,
  board: ['board'] as const,
  publicBidder: (playerId: string) => ['public-bidder', playerId] as const,
  auctions: ['auctions'] as const,
};

/**
 * L'elenco delle aste della lega: non sta sotto il contesto dell'asta
 * corrente, quindi passa da {@link apiLeagueGet} e non da {@link apiGet}.
 */
export function useAuctions() {
  return useQuery({
    queryKey: KEYS.auctions,
    queryFn: () => apiLeagueGet<AuctionCard[]>('/auctions'),
  });
}

export function useSelectAuction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (auctionId: string) =>
      apiLeaguePost(`/auctions/${encodeURIComponent(auctionId)}/select`),
    onSuccess: () => client.invalidateQueries(),
  });
}

export function useLeaveAuction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => apiLeaguePost('/auctions/current/leave'),
    onSuccess: () => client.invalidateQueries(),
  });
}

export function useDeleteAuction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (auctionId: string) =>
      apiLeagueDelete(`/auctions/${encodeURIComponent(auctionId)}`),
    // Nessun aggiornamento ottimistico: l'elenco si rilegge dal server.
    onSuccess: () => client.invalidateQueries(),
  });
}

/** Il nuovo nome di un'asta, aperta o no: l'elenco si rilegge dal server. */
export function useRenameAuction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiLeaguePatch(`/auctions/${encodeURIComponent(id)}`, { name }),
    onSuccess: () => client.invalidateQueries(),
  });
}

/** Una copia dell'asta senza acquisti; quella aperta resta aperta. */
export function useDuplicateAuction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiLeaguePost<{ id: string }>(`/auctions/${encodeURIComponent(id)}/duplicate`),
    onSuccess: () => client.invalidateQueries({ queryKey: KEYS.auctions }),
  });
}

/**
 * Le impostazioni di un'asta esistente, come punto di partenza per una nuova: le
 * chiede la schermata di creazione quando si sceglie «Parti da». Una mutazione e
 * non una query: e' un gesto dell'utente che riempie il modulo, non un dato da
 * tenere aggiornato.
 */
export function useSettingsFrom() {
  return useMutation({
    mutationFn: (auctionId: string) =>
      apiLeagueGet<SettingsResponse>(`/settings/from/${encodeURIComponent(auctionId)}`),
  });
}

export function useAuctionState() {
  return useQuery({
    queryKey: KEYS.state,
    queryFn: () => apiGet<AuctionStateResponse>('/state'),
  });
}

export function usePhasePlayers(offset: number) {
  return useQuery({
    queryKey: KEYS.phase(offset),
    queryFn: () => apiGet<PhasePageResponse>(`/players/phase?offset=${offset}&limit=25`),
  });
}

/**
 * Le occasioni della fase corrente, dalla migliore: riempiono il pannello dei
 * consigli finche' nessun giocatore e' sul battitore. Ogni acquisto e cambio di
 * fase invalida tutte le query, quindi si rileggono da sole.
 */
export function useTargets(enabled: boolean) {
  return useQuery({
    queryKey: ['targets'] as const,
    queryFn: () => apiGet<TargetView[]>('/players/targets?limit=5'),
    enabled,
  });
}

export function useValuation(playerId: string | null) {
  return useQuery({
    queryKey: KEYS.valuation(playerId ?? ''),
    queryFn: () => apiGet<ValuationResponse>(`/players/${playerId}/valuation`),
    enabled: playerId !== null,
  });
}

export function useBoard() {
  return useQuery({
    queryKey: KEYS.board,
    queryFn: () => apiGet<BoardResponse>('/board'),
  });
}

/**
 * Nome, squadra e ruolo del giocatore all'asta, dall'endpoint del tabellone.
 *
 * Non arrivano dal canale fra le finestre di proposito: sono dati di dominio, e il
 * browser non e' la loro fonte. Il canale porta solo cio' che sul server non esiste —
 * quale lotto e' aperto, a che prezzo, quanto manca.
 */
export function usePublicBidder(playerId: string | null) {
  return useQuery({
    queryKey: KEYS.publicBidder(playerId ?? ''),
    queryFn: () => apiGet<PublicBidderResponse>(`/board/bidder/${playerId}`),
    enabled: playerId !== null,
  });
}

export interface AssignInput {
  playerId: string;
  /**
   * Non viaggia sul filo: l'API vuole identificativi, non nomi. Sta qui perche'
   * chi annuncia l'esito lo ritrova in `variables` accanto a `data`, appaiato
   * proprio a QUESTA mutazione. Leggerlo invece dalla valutazione in corso
   * significherebbe nominare il giocatore selezionato adesso, che puo' essere
   * un altro: un clic su un'altra riga mentre l'aggiudicazione e' in volo
   * farebbe annunciare l'acquisto sbagliato.
   */
  playerName: string;
  participantId: string;
  price: number;
}

export function useAssign() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: AssignInput) =>
      apiPost<PurchaseResponse>('/purchases', {
        // Generata qui, una per invio: se la risposta si perde e l'utente
        // ripreme, quella e' una richiesta NUOVA con una chiave nuova. La chiave
        // protegge dal doppio invio della STESSA richiesta — un tentativo del
        // browser, non un secondo clic deliberato.
        requestId: crypto.randomUUID(),
        playerId: input.playerId,
        participantId: input.participantId,
        price: input.price,
      }),
    // Nessun aggiornamento ottimistico: mostrare l'acquisto come riuscito prima
    // che il registro abbia fatto fsync significa mentire nel momento in cui
    // conta di piu'. Si aspetta la conferma, che costa decine di millisecondi.
    //
    // La promise di invalidateQueries() va RITORNATA, non solo invocata:
    // Mutation#execute (query-core) dispatcha 'success' — l'evento che rende
    // data visibile a chi chiama useAssign() — solo DOPO che onSuccess si e'
    // risolto. Scartare quella promise (un corpo con le graffe, invece di
    // un'espressione) fa risolvere onSuccess nello stesso turno sincrono, cioe'
    // prima che il refetch di rete possa completarsi: chi legge assign.data
    // lo vedrebbe insieme a uno stato ancora vecchio. Ritornarla fa aspettare
    // 'success' finche' anche le altre query attive (stato, fase, valutazione)
    // non hanno riletto — e' cosi' che AuctionRoute (Task 17) puo' comporre
    // l'annuncio dell'acquisto dal budget DOPO, non da quello di prima.
    onSuccess: () => client.invalidateQueries(),
  });
}

/**
 * Il cambio fase: era gia' stato scritto e poi rimosso come codice morto
 * durante la revisione finale delle tappe 1-3, perche' nessuna schermata lo
 * chiamava. Ora la schermata privata (Task 7) lo chiama.
 */
export function useChangePhase() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (role: Role) => apiPost('/phase', { role }),
    onSuccess: () => client.invalidateQueries(),
  });
}

/**
 * Annulla l'ultimo acquisto. Stessa storia di {@link useChangePhase}: scritto,
 * rimosso perche' inutilizzato, riportato perche' la schermata ora esiste.
 */
export function useUndoLast() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost('/purchases/void-last'),
    onSuccess: () => client.invalidateQueries(),
  });
}

export interface VoidPurchaseInput {
  /**
   * L'asta a cui appartiene {@code seq}, NON quella del contesto della finestra
   * (pinnato a {@link AuctionGuard#CURRENT} da main.tsx): {@code seq} e' un numero
   * per registro, e un tab di riepilogo lasciato aperto su un'asta mentre altrove
   * si passa a un'altra manderebbe altrimenti quel numero al registro sbagliato,
   * dove puo' coincidere con l'acquisto di un giocatore diverso. Va letto dalla
   * risposta della board ({@link BoardResponse#auctionId}), non dal contesto.
   */
  auctionId: string;
  seq: number;
}

/**
 * Revoca un acquisto preciso, per {@code seq} — non l'ultimo per forza: il riepilogo
 * (Task 13) lascia scegliere quale, riga per riga, cosa che {@link useUndoLast} non
 * puo' fare perche' parla solo dell'ultimo evento del registro.
 */
export function useVoidPurchase() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: VoidPurchaseInput) =>
      apiPostToAuction(input.auctionId, `/purchases/${input.seq}/void`),
    onSuccess: () => client.invalidateQueries(),
  });
}

/**
 * Le impostazioni della lega — battitore, partecipanti, punteggio — non dell'asta
 * corrente, quindi {@link apiLeagueGet} e non {@link apiGet}.
 */
export function useSettings() {
  return useQuery({
    queryKey: ['settings'] as const,
    queryFn: () => apiLeagueGet<SettingsResponse>('/settings'),
    // Le impostazioni non cambiano da sole: nessuno le riscrive mentre le guardi.
    // Interrogare il server ogni cinque secondi per un modulo fermo e' solo rumore.
    refetchInterval: false,
  });
}

export function useSaveSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveSettingsRequest) =>
      apiLeaguePut<SaveSettingsResult>('/settings', input),
    onSuccess: () => client.invalidateQueries(),
  });
}
