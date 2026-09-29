import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiUpload } from './client';
import type {
  BidderSettings, CreatedInvite, ImportPreview, ImportResult, InvitePreview, InviteView, LeagueAuctionCard,
  LeagueCard, LeagueDetail, LeagueRulesResponse, SaveLeagueRulesRequest, SeatInput, SeatsView,
} from './types';

const path = (id: string) => `/api/leagues/${encodeURIComponent(id)}`;

export const LEAGUE_KEYS = {
  all: ['leagues'] as const,
  one: (id: string) => ['leagues', id] as const,
  invites: (id: string) => ['leagues', id, 'invites'] as const,
  auctions: (id: string) => ['leagues', id, 'auctions'] as const,
  rules: (id: string) => ['leagues', id, 'rules'] as const,
  seats: (id: string, auctionId: string) => ['leagues', id, 'auctions', auctionId, 'seats'] as const,
  invite: (token: string) => ['invite', token] as const,
};

/** Le leghe cambiano quando qualcuno entra o ne crea una: niente interrogazioni periodiche. */
const STILL = { refetchInterval: false as const };

export function useLeagues() {
  return useQuery({ queryKey: LEAGUE_KEYS.all, queryFn: () => api<LeagueCard[]>('/api/leagues'), ...STILL });
}

export function useCreateLeague() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; teamName: string; initial: string }) =>
      api<LeagueDetail>('/api/leagues', { method: 'POST', body }),
    onSuccess: () => client.invalidateQueries({ queryKey: LEAGUE_KEYS.all }),
  });
}

export function useLeague(id: string) {
  return useQuery({ queryKey: LEAGUE_KEYS.one(id), queryFn: () => api<LeagueDetail>(path(id)), ...STILL });
}

export function useRenameLeague(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api<LeagueDetail>(path(id), { method: 'PATCH', body: { name } }),
    onSuccess: (league) => {
      client.setQueryData(LEAGUE_KEYS.one(id), league);
      client.invalidateQueries({ queryKey: LEAGUE_KEYS.all });
    },
  });
}

export function useInvites(id: string, enabled: boolean) {
  return useQuery({
    queryKey: LEAGUE_KEYS.invites(id),
    queryFn: () => api<InviteView[]>(`${path(id)}/invites`),
    enabled,
    ...STILL,
  });
}

export function useCreateInvite(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api<CreatedInvite>(`${path(id)}/invites`, { method: 'POST' }),
    onSuccess: () => client.invalidateQueries({ queryKey: LEAGUE_KEYS.invites(id) }),
  });
}

export function useRevokeInvite(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) =>
      api<null>(`${path(id)}/invites/${encodeURIComponent(inviteId)}`, { method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries({ queryKey: LEAGUE_KEYS.invites(id) }),
  });
}

export function useInvitePreview(token: string) {
  return useQuery({
    queryKey: LEAGUE_KEYS.invite(token),
    queryFn: () => api<InvitePreview>(`/api/invites/${encodeURIComponent(token)}`),
    retry: false,
    ...STILL,
  });
}

export function useAcceptInvite(token: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { teamName: string; initial: string }) =>
      api<LeagueCard>(`/api/invites/${encodeURIComponent(token)}/accept`, { method: 'POST', body }),
    onSuccess: () => client.invalidateQueries({ queryKey: LEAGUE_KEYS.all }),
  });
}

export function useLeagueAuctions(leagueId: string) {
  return useQuery({
    queryKey: LEAGUE_KEYS.auctions(leagueId),
    queryFn: () => api<LeagueAuctionCard[]>(`${path(leagueId)}/auctions`),
  });
}

export function useCreateAuction(leagueId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api<LeagueAuctionCard>(`${path(leagueId)}/auctions`, { method: 'POST', body: { name } }),
    onSuccess: () => client.invalidateQueries({ queryKey: LEAGUE_KEYS.auctions(leagueId) }),
  });
}

export function useUpdateAuction(leagueId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ auctionId, ...body }: { auctionId: string; name?: string; bidder?: BidderSettings }) =>
      api<null>(`${path(leagueId)}/auctions/${encodeURIComponent(auctionId)}`, { method: 'PATCH', body }),
    onSuccess: () => client.invalidateQueries({ queryKey: LEAGUE_KEYS.auctions(leagueId) }),
  });
}

export function useDeleteAuction(leagueId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (auctionId: string) =>
      api<null>(`${path(leagueId)}/auctions/${encodeURIComponent(auctionId)}`, { method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries({ queryKey: LEAGUE_KEYS.auctions(leagueId) }),
  });
}

export function useSeats(leagueId: string, auctionId: string) {
  return useQuery({
    queryKey: LEAGUE_KEYS.seats(leagueId, auctionId),
    queryFn: () => api<SeatsView>(`${path(leagueId)}/auctions/${encodeURIComponent(auctionId)}/seats`),
    ...STILL,
  });
}

export function useSaveSeats(leagueId: string, auctionId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (seats: SeatInput[]) =>
      api<SeatsView>(`${path(leagueId)}/auctions/${encodeURIComponent(auctionId)}/seats`,
        { method: 'PUT', body: seats }),
    onSuccess: (view) => {
      client.setQueryData(LEAGUE_KEYS.seats(leagueId, auctionId), view);
      return client.invalidateQueries({ queryKey: LEAGUE_KEYS.auctions(leagueId) });
    },
  });
}

export function useRemoveMember(leagueId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api<null>(`${path(leagueId)}/members/${encodeURIComponent(userId)}`, { method: 'DELETE' }),
    // Non si aspetta il ricaricamento: chi ha appena lasciato la lega non puo' piu'
    // rileggerla (404, piu' un tentativo), e aspettarlo lo terrebbe su una pagina
    // d'errore per un secondo prima di portarlo all'elenco delle leghe.
    onSuccess: () => { void client.invalidateQueries({ queryKey: LEAGUE_KEYS.all }); },
  });
}

/**
 * Le regole con cui nasceranno le prossime aste della lega. Nessuno le riscrive
 * mentre le si guarda, e la schermata e' un modulo: un refetch sotto le dita
 * riscriverebbe quello che si sta scrivendo.
 */
export function useLeagueRules(leagueId: string) {
  return useQuery({
    queryKey: LEAGUE_KEYS.rules(leagueId),
    queryFn: () => api<LeagueRulesResponse>(`${path(leagueId)}/rules`),
    ...STILL,
  });
}

export function useSaveLeagueRules(leagueId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: SaveLeagueRulesRequest) =>
      api<LeagueRulesResponse>(`${path(leagueId)}/rules`, { method: 'PUT', body }),
    onSuccess: (saved) => client.setQueryData(LEAGUE_KEYS.rules(leagueId), saved),
  });
}

/** I soli documenti che servono: il resto della cartella non parte nemmeno. */
export const IMPORT_FILES = ['events.jsonl', 'league-members.yml', 'league-rules.yml',
  'league-settings.yml', 'auction-settings.yml'];

function importForm(files: File[]): FormData {
  const form = new FormData();
  files.filter((f) => IMPORT_FILES.includes(f.name)).forEach((f) => form.append('files', f, f.name));
  return form;
}

export function useImportPreview(leagueId: string) {
  return useMutation({
    mutationFn: (files: File[]) => apiUpload<ImportPreview>(`${path(leagueId)}/imports/preview`, importForm(files)),
  });
}

export function useImportAuction(leagueId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ files, mapping }: { files: File[]; mapping: Record<string, string> }) => {
      const form = importForm(files);
      form.append('mapping', new Blob([JSON.stringify(mapping)], { type: 'application/json' }));
      return apiUpload<ImportResult>(`${path(leagueId)}/imports`, form);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: LEAGUE_KEYS.auctions(leagueId) }),
  });
}
