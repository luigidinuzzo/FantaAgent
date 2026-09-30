import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiUpload } from './client';
import type {
  BidderSettings, CreatedInvite, ImportPreview, ImportResult, InvitePreview, InviteView, JoinRequestView,
  LeagueAuctionCard, LeagueCard, LeagueDetail, LeagueMatch, MyJoinRequest, LeagueRulesResponse, SaveLeagueRulesRequest, SeatInput, SeatsView,
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
  joinRequests: (id: string) => ['leagues', id, 'join-requests'] as const,
  search: (text: string) => ['league-search', text] as const,
  myRequests: ['my-join-requests'] as const,
};

/** Le leghe cambiano quando qualcuno entra o ne crea una: niente interrogazioni periodiche. */
const STILL = { refetchInterval: false as const };

export function useLeagues() {
  return useQuery({ queryKey: LEAGUE_KEYS.all, queryFn: () => api<LeagueCard[]>('/api/leagues'), ...STILL });
}

export function useCreateLeague() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; teamName: string }) =>
      api<LeagueDetail>('/api/leagues', { method: 'POST', body }),
    onSuccess: () => client.invalidateQueries({ queryKey: LEAGUE_KEYS.all }),
  });
}

/**
 * Arrivando dall'elenco, nome e ruolo sono gia' noti: la pagina li mostra subito,
 * mentre i membri arrivano. Senza, la testata restava vuota per un istante e poi
 * compariva, e il passaggio dall'elenco scattava.
 */
export function useLeague(id: string) {
  const client = useQueryClient();
  return useQuery({
    queryKey: LEAGUE_KEYS.one(id),
    queryFn: () => api<LeagueDetail>(path(id)),
    placeholderData: () => {
      const card = client.getQueryData<LeagueCard[]>(LEAGUE_KEYS.all)?.find((l) => l.id === id);
      return card ? { id: card.id, name: card.name, admin: card.admin, members: [] } : undefined;
    },
    ...STILL,
  });
}

/**
 * Il nome della lega se e' gia' noto — dalla sua pagina o dall'elenco — senza
 * chiederlo. Serve al percorso nella barra delle pagine che della lega non leggono
 * altro: un'etichetta non vale una chiamata in piu'. Chi arriva su una di quelle
 * pagine ricaricando non lo trova, e il percorso dice «Lega».
 */
export function useLeagueName(id: string): string | undefined {
  const client = useQueryClient();
  return client.getQueryData<LeagueDetail>(LEAGUE_KEYS.one(id))?.name
    ?? client.getQueryData<LeagueCard[]>(LEAGUE_KEYS.all)?.find((l) => l.id === id)?.name;
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
    mutationFn: (body: { teamName: string }) =>
      api<LeagueCard>(`/api/invites/${encodeURIComponent(token)}/accept`, { method: 'POST', body }),
    onSuccess: () => client.invalidateQueries({ queryKey: LEAGUE_KEYS.all }),
  });
}

/** Sotto le tre lettere non si chiede niente: il server risponderebbe con un elenco vuoto. */
export const MIN_SEARCH = 3;

export function useLeagueSearch(text: string) {
  const clean = text.trim();
  return useQuery({
    queryKey: LEAGUE_KEYS.search(clean.toLowerCase()),
    queryFn: () => api<LeagueMatch[]>(`/api/leagues/search?q=${encodeURIComponent(clean)}`),
    enabled: clean.length >= MIN_SEARCH,
    // Mentre si scrive resta l'elenco di prima invece di un vuoto a ogni lettera.
    placeholderData: (previous) => previous,
    ...STILL,
  });
}

export function useMyJoinRequests() {
  return useQuery({
    queryKey: LEAGUE_KEYS.myRequests,
    queryFn: () => api<MyJoinRequest[]>('/api/join-requests'),
    ...STILL,
  });
}

/** Mandare o ritirare cambia lo stato delle righe trovate: la ricerca si rilegge. */
function afterMyRequestChanged(client: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    client.invalidateQueries({ queryKey: LEAGUE_KEYS.myRequests }),
    client.invalidateQueries({ queryKey: ['league-search'] }),
  ]);
}

export function useRequestJoin() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ leagueId, teamName }: { leagueId: string; teamName: string }) =>
      api<null>(`/api/join-requests/${encodeURIComponent(leagueId)}`, { method: 'POST', body: { teamName } }),
    onSuccess: () => afterMyRequestChanged(client),
  });
}

export function useWithdrawJoin() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (leagueId: string) =>
      api<null>(`/api/join-requests/${encodeURIComponent(leagueId)}`, { method: 'DELETE' }),
    onSuccess: () => afterMyRequestChanged(client),
  });
}

export function useJoinRequests(leagueId: string, enabled: boolean) {
  return useQuery({
    queryKey: LEAGUE_KEYS.joinRequests(leagueId),
    queryFn: () => api<JoinRequestView[]>(`${path(leagueId)}/join-requests`),
    enabled,
    ...STILL,
  });
}

/** Accettare cambia i membri della lega; accettare o rifiutare, il numero sulla sua scheda. */
export function useDecideJoin(leagueId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, accept }: { userId: string; accept: boolean }) => {
      const at = `${path(leagueId)}/join-requests/${encodeURIComponent(userId)}`;
      return accept
        ? api<null>(`${at}/approve`, { method: 'POST' })
        : api<null>(at, { method: 'DELETE' });
    },
    onSettled: () => Promise.all([
      client.invalidateQueries({ queryKey: LEAGUE_KEYS.joinRequests(leagueId) }),
      client.invalidateQueries({ queryKey: LEAGUE_KEYS.one(leagueId), exact: true }),
      client.invalidateQueries({ queryKey: LEAGUE_KEYS.all, exact: true }),
    ]),
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
