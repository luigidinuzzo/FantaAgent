import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPostToAuction, auctionContext } from './client';
import type {
  AuctionStateResponse,
  BoardResponse,
  PhasePageResponse,
  PublicBidderResponse,
  PurchaseResponse,
  PhaseSort,
  Role,
  SortDir,
  TargetView,
  ValuationResponse,
} from './types';

/**
 * Ogni chiave porta lega e asta: passando da un'asta all'altra nella stessa scheda,
 * la cache non deve restituire per un istante i dati della precedente.
 */
function scoped(...parts: readonly unknown[]) {
  const { leagueId, auctionId } = auctionContext();
  return ['auction', leagueId, auctionId, ...parts] as const;
}

const KEYS = {
  state: () => scoped('state'),
  phase: (offset: number, sort: string, dir: string) => scoped('phase', offset, sort, dir),
  valuation: (playerId: string) => scoped('valuation', playerId),
  board: () => scoped('board'),
  publicBidder: (playerId: string) => scoped('public-bidder', playerId),
  targets: () => scoped('targets'),
};

export function useAuctionState() {
  return useQuery({
    queryKey: KEYS.state(),
    queryFn: () => apiGet<AuctionStateResponse>('/state'),
  });
}

/**
 * Una pagina della tabella di fase, nell'ordine chiesto.
 *
 * <p>L'ordine lo fa il SERVER: la pagina e' di venticinque righe su una fase che
 * ne ha centinaia, e rimetterle in fila qui vorrebbe dire ordinare quelle
 * venticinque e dire una bugia su tutte le altre. Per questo colonna e verso
 * entrano nella chiave della query: sono due pagine diverse, non la stessa
 * guardata da un'altra angolazione.
 */
export function usePhasePlayers(offset: number, sort: PhaseSort = 'quotazione', dir: SortDir = 'desc',
  enabled = true) {
  return useQuery({
    queryKey: KEYS.phase(offset, sort, dir),
    queryFn: () => apiGet<PhasePageResponse>(
      `/players/phase?offset=${offset}&limit=25&sort=${sort}&dir=${dir}`),
    enabled,
  });
}

/**
 * Le occasioni della fase corrente, dalla migliore: riempiono il pannello dei
 * consigli finche' nessun giocatore e' sul banco. Ogni acquisto e cambio di
 * fase invalida tutte le query, quindi si rileggono da sole.
 */
export function useTargets(enabled: boolean) {
  return useQuery({
    queryKey: KEYS.targets(),
    queryFn: () => apiGet<TargetView[]>('/players/targets?limit=5'),
    enabled,
  });
}

/**
 * {@code enabled} falso per chi non ha un posto in quest'asta: il server
 * risponderebbe {@code no-seat}, e la schermata lo dice gia' a parole.
 */
export function useValuation(playerId: string | null, enabled = true) {
  return useQuery({
    queryKey: KEYS.valuation(playerId ?? ''),
    queryFn: () => apiGet<ValuationResponse>(`/players/${playerId}/valuation`),
    enabled: enabled && playerId !== null,
  });
}

export function useBoard() {
  return useQuery({
    queryKey: KEYS.board(),
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
   * (fissato dall'indirizzo da WithAuctionContext): {@code seq} e' un numero
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

export interface CorrectPurchaseInput {
  /** Come per la revoca: l'asta della board che si sta guardando, non quella del contesto. */
  auctionId: string;
  seq: number;
  participantId: string;
  price: number;
}

/**
 * Corregge squadra o prezzo di un acquisto gia' registrato, senza annullarlo e
 * rifarlo: il registro aggiunge la correzione, non riscrive l'acquisto.
 */
export function useCorrectPurchase() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CorrectPurchaseInput) =>
      apiPostToAuction(input.auctionId, `/purchases/${input.seq}/correct`,
        { participantId: input.participantId, price: input.price }),
    onSuccess: () => client.invalidateQueries(),
  });
}
