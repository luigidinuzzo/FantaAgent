import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type {
  CreatedInvite, InvitePreview, InviteView, LeagueCard, LeagueDetail,
} from './types';

const path = (id: string) => `/api/leagues/${encodeURIComponent(id)}`;

export const LEAGUE_KEYS = {
  all: ['leagues'] as const,
  one: (id: string) => ['leagues', id] as const,
  invites: (id: string) => ['leagues', id, 'invites'] as const,
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
