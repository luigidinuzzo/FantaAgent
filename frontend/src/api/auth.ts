import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export interface Me {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
}

export const ME_KEY = ['me'] as const;

/** Chi ha fatto l'accesso. Non si riaggiorna da sola: cambia solo con un gesto dell'utente. */
export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: () => api<Me>('/api/me'),
    retry: false,
    refetchInterval: false,
    staleTime: 60_000,
  });
}

/**
 * Dopo un accesso o una registrazione i dati in cache si buttano: le risposte di
 * prima appartenevano a nessuno (o a un altro utente sullo stesso browser). Solo le
 * query, non {@code clear()}: quello toglierebbe anche questa mutazione, e con lei
 * il callback che porta alla pagina successiva.
 */
function useSignIn(path: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, string>) => api<Me>(path, { method: 'POST', body }),
    onSuccess: (me) => {
      client.removeQueries();
      client.setQueryData(ME_KEY, me);
    },
  });
}

export function useLogin() {
  return useSignIn('/api/auth/login');
}

export function useRegister() {
  return useSignIn('/api/auth/register');
}

export function useLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api<null>('/api/auth/logout', { method: 'POST' }),
    onSuccess: () => client.removeQueries(),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => api<null>('/api/auth/password/forgot', { method: 'POST', body: { email } }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (body: { token: string; password: string }) =>
      api<null>('/api/auth/password/reset', { method: 'POST', body }),
  });
}

export function useVerifyEmail() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => api<null>('/api/auth/verify', { method: 'POST', body: { token } }),
    onSuccess: () => client.invalidateQueries({ queryKey: ME_KEY }),
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: () => api<null>('/api/me/verification', { method: 'POST' }),
  });
}

export function useRenameMe() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (displayName: string) => api<Me>('/api/me', { method: 'PATCH', body: { displayName } }),
    onSuccess: (me) => client.setQueryData(ME_KEY, me),
  });
}
