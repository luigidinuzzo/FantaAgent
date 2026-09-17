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

/**
 * Come {@link url}, ma con l'identificativo dell'asta passato dal chiamante invece
 * di quello fissato in {@link context}. Vedi {@link apiPostToAuction}.
 */
function auctionUrl(auctionId: string, path: string): string {
  return `/api/leagues/${encodeURIComponent(context.leagueId)}/auctions/`
    + `${encodeURIComponent(auctionId)}${path}`;
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
 * Gemello di {@link apiPost} che indirizza un'asta precisa invece di quella del
 * {@link context} — pinnato per l'intera sessione dalla finestra (vedi
 * {@code main.tsx}), non necessariamente quella a cui appartiene il dato che si
 * sta scrivendo.
 *
 * <p>Esiste per la revoca di un acquisto dal riepilogo (task 13): {@code seq} e'
 * un numero PER REGISTRO, e la risposta del tabellone porta gia' l'{@code
 * auctionId} a cui appartiene. Indirizzarla con {@link apiPost} — che risolve
 * sempre sul letterale {@link AuctionGuard#CURRENT} o sull'ultima asta selezionata
 * — significherebbe che una schermata di riepilogo lasciata aperta su un'asta,
 * mentre da un'altra finestra si passa a un'asta diversa, spedirebbe quel {@code
 * seq} al registro sbagliato: la guardia lato server lo respinge con 404
 * unknown-auction quando i due id non coincidono, ma solo se la richiesta porta
 * per davvero l'id giusto DEL RIEPILOGO, non quello — possibilmente cambiato nel
 * frattempo — della finestra.
 */
export async function apiPostToAuction<T>(
  auctionId: string,
  path: string,
  body?: unknown,
): Promise<T | null> {
  return request<T>(auctionUrl(auctionId, path), {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/**
 * L'indirizzo dell'esportazione CSV per un'asta precisa, per l'{@code <a href>} del
 * riepilogo — non una fetch: e' il browser a dover gestire il salvataggio, vedi
 * RosterGrid. Prende {@code auctionId} dal chiamante come {@link apiPostToAuction},
 * per lo stesso motivo: deve restare quello della board che il riepilogo ha appena
 * letto, non quello (possibilmente cambiato altrove) del {@link context} della
 * finestra.
 */
export function auctionExportUrl(auctionId: string): string {
  return auctionUrl(auctionId, '/export.csv');
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

/** Gemello di {@link apiLeaguePost} per le cancellazioni: un'asta si toglie dall'archivio. */
export async function apiLeagueDelete(path: string): Promise<null> {
  await request<null>(leagueUrl(path), {
    method: 'DELETE',
    headers: { accept: 'application/json' },
  });
  return null;
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
