const PROBLEM_PREFIX = 'https://fantaagent.local/problems/';

export class ProblemError extends Error {
  // Non proprieta' di costruttore: tsconfig.app.json ha erasableSyntaxOnly,
  // che vieta lo zucchero "readonly x: T" nel costruttore perche' emette
  // assegnazioni, non e' solo tipo cancellabile a compile-time.
  readonly type: string;
  readonly detail: string;
  readonly status: number;
  /**
   * Il corpo JSON intero della risposta problem, indistinto. ProblemError non deve
   * conoscere la forma di ogni corpo di errore dell'API — un campo tipizzato qui
   * costringerebbe ogni nuovo endpoint che aggiunge una proprieta' a modificare
   * questa classe. Chi chiama restringe il tipo da solo per la proprieta' che gli
   * interessa (es. `errors` per le impostazioni).
   */
  readonly body: unknown;

  constructor(type: string, detail: string, status: number, body: unknown) {
    super(detail);
    this.name = 'ProblemError';
    this.type = type;
    this.detail = detail;
    this.status = status;
    this.body = body;
  }

  /** L'ultimo segmento del type: e' su questo che l'interfaccia decide. */
  get slug(): string {
    return this.type.startsWith(PROBLEM_PREFIX)
      ? this.type.slice(PROBLEM_PREFIX.length)
      : 'unknown';
  }
}

let context = { leagueId: 'default', auctionId: '' };

export function setAuctionContext(next: { leagueId: string; auctionId: string }) {
  context = next;
}

function url(path: string): string {
  return `/api/leagues/${context.leagueId}/auctions/${context.auctionId}${path}`;
}

function leagueUrl(path: string): string {
  return `/api/leagues/${encodeURIComponent(context.leagueId)}${path}`;
}

async function toProblem(response: Response): Promise<ProblemError> {
  try {
    const body = await response.json();
    return new ProblemError(
      body.type ?? 'unknown',
      body.detail ?? response.statusText,
      response.status,
      body,
    );
  } catch {
    // Un 502 da un proxy, o la connessione caduta a meta' risposta: non c'e'
    // un corpo problem da leggere, ma chi chiama deve gestire un errore solo.
    return new ProblemError(
      'unknown',
      `Errore di rete (${response.status})`,
      response.status,
      null,
    );
  }
}

async function request<T>(resolvedUrl: string, init: RequestInit): Promise<T | null> {
  const response = await fetch(resolvedUrl, init);
  if (!response.ok) {
    throw await toProblem(response);
  }
  if (response.status === 204) {
    return null;
  }
  return (await response.json()) as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  return (await request<T>(url(path), { headers: { accept: 'application/json' } })) as T;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T | null> {
  return request<T>(url(path), {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/**
 * Gemello di {@link apiGet} che si ferma alla lega: le rotte dell'archivio
 * (l'elenco delle aste, il passaggio da una all'altra) non stanno sotto
 * un'asta particolare, quindi non passano dal segmento `/auctions/{id}`
 * che {@link url} aggiunge.
 */
export async function apiLeagueGet<T>(path: string): Promise<T> {
  return (await request<T>(leagueUrl(path), {
    headers: { accept: 'application/json' },
  })) as T;
}

/** Gemello di {@link apiPost} che si ferma alla lega. Vedi {@link apiLeagueGet}. */
export async function apiLeaguePost<T>(path: string, body?: unknown): Promise<T | null> {
  return request<T>(leagueUrl(path), {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/**
 * Gemello di {@link apiPost} che si ferma alla lega, per le scritture che vogliono
 * PUT invece di POST — le impostazioni della lega (task 10/11), che non creano una
 * risorsa nuova ogni volta ma sostituiscono quella che c'e'.
 */
export async function apiLeaguePut<T>(path: string, body: unknown): Promise<T | null> {
  return request<T>(leagueUrl(path), {
    method: 'PUT',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });
}
