import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from './client';
import type {
  AuctionStateResponse,
  PhasePageResponse,
  PurchaseResponse,
  ValuationResponse,
} from './types';

const KEYS = {
  state: ['state'] as const,
  phase: (offset: number) => ['phase', offset] as const,
  valuation: (playerId: string) => ['valuation', playerId] as const,
};

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

export function useValuation(playerId: string | null) {
  return useQuery({
    queryKey: KEYS.valuation(playerId ?? ''),
    queryFn: () => apiGet<ValuationResponse>(`/players/${playerId}/valuation`),
    enabled: playerId !== null,
  });
}

export interface AssignInput {
  playerId: string;
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
        ...input,
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
