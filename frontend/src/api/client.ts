const PROBLEM_PREFIX = 'https://fantaagent.local/problems/';

export class ProblemError extends Error {
  // Non proprieta' di costruttore: tsconfig.app.json ha erasableSyntaxOnly,
  // che vieta lo zucchero "readonly x: T" nel costruttore perche' emette
  // assegnazioni, non e' solo tipo cancellabile a compile-time.
  readonly type: string;
  readonly detail: string;
  readonly status: number;

  constructor(type: string, detail: string, status: number) {
    super(detail);
    this.name = 'ProblemError';
    this.type = type;
    this.detail = detail;
    this.status = status;
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

async function toProblem(response: Response): Promise<ProblemError> {
  try {
    const body = await response.json();
    return new ProblemError(
      body.type ?? 'unknown',
      body.detail ?? response.statusText,
      response.status,
    );
  } catch {
    // Un 502 da un proxy, o la connessione caduta a meta' risposta: non c'e'
    // un corpo problem da leggere, ma chi chiama deve gestire un errore solo.
    return new ProblemError('unknown', `Errore di rete (${response.status})`, response.status);
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T | null> {
  const response = await fetch(url(path), init);
  if (!response.ok) {
    throw await toProblem(response);
  }
  if (response.status === 204) {
    return null;
  }
  return (await response.json()) as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  return (await request<T>(path, { headers: { accept: 'application/json' } })) as T;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T | null> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
