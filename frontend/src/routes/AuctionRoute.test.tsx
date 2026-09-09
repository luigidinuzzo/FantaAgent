import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setAuctionContext } from '../api/client';
import { QueryProvider } from '../api/QueryProvider';
import type { BidBroadcast } from '../domain/bidChannel';
import { subscribeBid } from '../domain/bidChannel';
import { STALE_AFTER_MS } from '../domain/ConnectionStatus';
import { AuctionRoute } from './AuctionRoute';

// setImmediate finto ma smaltito da vi.useFakeTimers({ shouldAdvanceTime:
// true }), stesso meccanismo usato in BidderDialog.test.tsx per far arrivare
// i messaggi del BroadcastChannel sotto orologio finto.
function flushChannel() {
  return new Promise<void>((resolve) => setImmediate(resolve));
}

const STATE = {
  auctionId: 'a1',
  auctionName: 'Prova',
  currentPhase: 'P',
  phases: ['P', 'D', 'C', 'A'],
  soldInPhase: 0,
  myParticipantId: 'anna',
  canUndo: false,
  participants: [
    {
      id: 'anna', name: 'Anna', initial: 'A', me: true,
      budgetRemaining: 300, slotsRemaining: 25,
      filledByRole: { P: 0, D: 0, C: 0, A: 0 },
      slotsByRole: { P: 3, D: 8, C: 8, A: 6 },
    },
  ],
};

const PHASE = {
  rows: [
    {
      id: 'p1', name: 'Giocatore Uno', team: 'AAA', role: 'P', listPrice: 1,
      maxBid: 50, expectedPrice: 10, margin: 5, fantamediaAttesa: 5.5, titolaritaPercent: 80,
    },
    {
      id: 'p2', name: 'Giocatore Due', team: 'BBB', role: 'P', listPrice: 2,
      maxBid: 80, expectedPrice: 20, margin: 8, fantamediaAttesa: 6.1, titolaritaPercent: 70,
    },
  ],
  offset: 0,
  pageSize: 25,
  total: 2,
  hasPrevious: false,
  hasNext: false,
};

function valuation(playerId: string, maxBid: number) {
  return {
    playerId,
    name: playerId === 'p1' ? 'Giocatore Uno' : 'Giocatore Due',
    team: playerId === 'p1' ? 'AAA' : 'BBB',
    role: 'P',
    listPrice: 1,
    expectedPrice: 10,
    maxBid,
    hardCap: maxBid + 10,
    margin: 5,
    walkAwayReason: '',
    worthPursuing: true,
    confidenceStars: 3,
    drivers: [],
  };
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

// timerSeconds volutamente lontano da 5: se il battitore montato dalla route
// mostrasse "5s" invece di questo valore, sarebbe la prova che qualcuno ha
// fissato la costante invece di leggerla dalle preferenze reali.
const BIDDER_SETTINGS = {
  playerId: 'p1', name: 'Giocatore Uno', team: 'AAA', role: 'P', listPrice: 1,
  timerSeconds: 12, beepEnabled: true,
};

/**
 * Un fetchMock che copre tutte le rotte usate da AuctionRoute: stato, fase,
 * valutazione dei due giocatori fissi, preferenze del battitore, e le tre
 * scritture (acquisto, cambio fase, annullamento). Le route dei nuovi test
 * (battitore, cambio fase, annullamento) hanno tutte bisogno delle stesse
 * rotte di base: costruirlo una volta evita che ogni test ripeta l'elenco e
 * dimentichi una voce.
 */
function fullFetchMock({
  purchase,
  onWriteCall,
}: {
  purchase?: unknown;
  onWriteCall?: (body: unknown) => void;
} = {}) {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const href = typeof input === 'string' ? input : input.toString();
    if (href.includes('/players/p1/valuation')) return Promise.resolve(jsonResponse(valuation('p1', 50)));
    if (href.includes('/players/p2/valuation')) return Promise.resolve(jsonResponse(valuation('p2', 80)));
    if (href.includes('/players/phase')) return Promise.resolve(jsonResponse(PHASE));
    if (href.includes('/board/bidder/p1')) return Promise.resolve(jsonResponse(BIDDER_SETTINGS));
    if (href.includes('/purchases/void-last')) return Promise.resolve(new Response(null, { status: 204 }));
    if (href.includes('/purchases')) {
      onWriteCall?.(init?.body ? JSON.parse(String(init.body)) : null);
      return Promise.resolve(jsonResponse(purchase ?? { seq: 1, playerId: 'p1', participantId: 'anna', price: 50 }));
    }
    if (href.includes('/phase')) {
      onWriteCall?.(init?.body ? JSON.parse(String(init.body)) : null);
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    if (href.endsWith('/state')) return Promise.resolve(jsonResponse(STATE));
    return Promise.reject(new Error(`URL non prevista nel test: ${href}`));
  });
}

describe('AuctionRoute', () => {
  afterEach(() => vi.unstubAllGlobals());

  // Solo la route puo' metterlo in scena: BidPanel da solo non riceve un
  // playerId con cui simulare un cambio di giocatore.
  //
  // Il primo passaggio da p1 a p2 passa comunque per un istante senza dato
  // (la query di p2 non e' ancora in cache), e quel vuoto smonta gia' la
  // scheda da solo — un falso positivo che non proverebbe nulla sulla key.
  // La prova vera e' tornare su p1: a quel punto la sua valutazione e' GIA'
  // in cache (staleTime 5s), quindi valuation.data passa da quella di p2 a
  // quella di p1 SENZA alcun istante vuoto in mezzo. Senza key, PlayerDecisionCard
  // (e con essa BidPanel) non smonterebbe mai, e il prezzo digitato per p2
  // resterebbe nel campo anche per p1.
  it('tornando su un giocatore gia visto (dato in cache, nessun vuoto) il prezzo torna comunque al suo tetto', async () => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const href = typeof input === 'string' ? input : input.toString();
      if (href.includes('/players/p1/valuation')) return Promise.resolve(jsonResponse(valuation('p1', 50)));
      if (href.includes('/players/p2/valuation')) return Promise.resolve(jsonResponse(valuation('p2', 80)));
      if (href.includes('/players/phase')) return Promise.resolve(jsonResponse(PHASE));
      if (href.endsWith('/state')) return Promise.resolve(jsonResponse(STATE));
      return Promise.reject(new Error(`URL non prevista nel test: ${href}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <QueryProvider>
        <AuctionRoute />
      </QueryProvider>,
    );

    await userEvent.click(await screen.findByRole('button', { name: /Valuta Giocatore Uno/ }));
    const price = await screen.findByLabelText('Prezzo');
    await waitFor(() => expect(price).toHaveValue(50));

    await userEvent.clear(price);
    await userEvent.type(price, '99');
    expect(price).toHaveValue(99);

    // p1 -> p2: passa per il vuoto, quindi non e' la prova che conta.
    await userEvent.click(await screen.findByRole('button', { name: /Valuta Giocatore Due/ }));
    const price2 = await screen.findByLabelText('Prezzo');
    await waitFor(() => expect(price2).toHaveValue(80));
    await userEvent.clear(price2);
    await userEvent.type(price2, '15');
    expect(price2).toHaveValue(15);

    // p2 -> p1: p1 e' gia' in cache, nessun vuoto. Questa e' la prova.
    await userEvent.click(await screen.findByRole('button', { name: /Valuta Giocatore Uno/ }));
    await waitFor(() => expect(screen.getByLabelText('Prezzo')).toHaveValue(50));
  });

  // Bug 1 (revisione): useAssign().onSuccess chiama invalidateQueries() senza
  // attenderlo. Il reducer della mutazione dispatcha 'success' (rendendo
  // assign.data visibile al componente) SOLO dopo che onSuccess si e'
  // risolto — ma se onSuccess non ritorna la promise, si risolve nello
  // stesso turno sincrono, prima che il refetch di rete possa completarsi.
  // L'annuncio si comporrebbe quindi dal budget di PRIMA dell'acquisto.
  //
  // La prova: la seconda GET /state (quella scatenata da invalidateQueries
  // dopo l'acquisto) e' artificialmente lenta (un ritardo reale, non un gate
  // liberato a mano: non serve sincronizzarsi su un istante di "in attesa"
  // che col bug e' troppo breve per essere osservato in modo affidabile). Un
  // MutationObserver registra OGNI testo che il nodo role="status" assume,
  // non solo quello finale: col bug, un testo (sbagliato) compare prima che
  // il ritardo sia scaduto; una volta corretto, il nodo non assume alcun
  // testo finche' lo stato non e' davvero fresco, quindi il primo testo che
  // assume e' gia' quello giusto.
  it("l'annuncio riporta il budget DOPO l'acquisto, mai quello di prima: composto solo da stato davvero aggiornato", async () => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });

    const STATE_BEFORE = { ...STATE, participants: [{ ...STATE.participants[0] }] };
    const STATE_AFTER = {
      ...STATE,
      participants: [{ ...STATE.participants[0], budgetRemaining: 293, slotsRemaining: 24 }],
    };
    const PURCHASE = { seq: 1, playerId: 'p1', participantId: 'anna', price: 7 };

    let stateCalls = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const href = typeof input === 'string' ? input : input.toString();
      if (href.endsWith('/state')) {
        stateCalls += 1;
        if (stateCalls === 1) return Promise.resolve(jsonResponse(STATE_BEFORE));
        // La ri-lettura scatenata dall'acquisto: un ritardo di rete vero,
        // non simulato con un gate che il test apre a mano — cosi' il test
        // non dipende da quando (o se) il codice sotto esame decide di
        // aspettare, solo da cosa mostra nel frattempo.
        return new Promise((resolve) => {
          setTimeout(() => resolve(jsonResponse(STATE_AFTER)), 30);
        });
      }
      if (href.includes('/players/phase')) return Promise.resolve(jsonResponse(PHASE));
      if (href.includes('/players/p1/valuation')) return Promise.resolve(jsonResponse(valuation('p1', 7)));
      if (href.includes('/purchases')) return Promise.resolve(jsonResponse(PURCHASE));
      return Promise.reject(new Error(`URL non prevista nel test: ${href}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <QueryProvider>
        <AuctionRoute />
      </QueryProvider>,
    );

    await userEvent.click(await screen.findByRole('button', { name: /Valuta Giocatore Uno/ }));
    await waitFor(() => expect(screen.getByLabelText('Prezzo')).toHaveValue(7));

    const status = screen.getByRole('status');
    const seenTexts: string[] = [];
    const observer = new MutationObserver(() => seenTexts.push(status.textContent ?? ''));
    observer.observe(status, { childList: true, characterData: true, subtree: true });

    await userEvent.click(screen.getByRole('button', { name: 'Aggiudica' }));

    await waitFor(() => expect(status).toHaveTextContent(/293 crediti/), { timeout: 2000 });
    observer.disconnect();

    const nonEmpty = seenTexts.filter((t) => t.trim().length > 0);
    expect(nonEmpty.length).toBeGreaterThan(0);
    // Nessun testo mai mostrato ha riportato il budget di PRIMA dell'acquisto:
    // se anche un solo testo intermedio l'avesse fatto, l'utente non vedente
    // avrebbe sentito il numero sbagliato, anche se poi corretto.
    for (const text of nonEmpty) {
      expect(text).not.toMatch(/300 crediti/);
      expect(text).toMatch(/293 crediti/);
    }
  });

  /**
   * L'invariante del canale unico. Due live region che parlano insieme si
   * sovrappongono e uno screen reader ne perde una: l'utente non vedente
   * scoprirebbe l'esito di un acquisto a meta'. Finora la controllava solo
   * Playwright, che gira a mano e vuole un backend acceso — cioe' quasi mai.
   * L'asserzione vale prima e dopo l'acquisto: e' dopo che l'annuncio esiste,
   * ed e' li' che una seconda regione potrebbe nascere.
   */
  it("la pagina espone una sola live region di stato, prima e dopo l'acquisto", async () => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });

    const PURCHASE = { seq: 1, playerId: 'p1', participantId: 'anna', price: 7 };
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const href = typeof input === 'string' ? input : input.toString();
      if (href.endsWith('/state')) return Promise.resolve(jsonResponse(STATE));
      if (href.includes('/players/phase')) return Promise.resolve(jsonResponse(PHASE));
      if (href.includes('/players/p1/valuation')) return Promise.resolve(jsonResponse(valuation('p1', 7)));
      if (href.includes('/purchases')) return Promise.resolve(jsonResponse(PURCHASE));
      return Promise.reject(new Error(`URL non prevista nel test: ${href}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <QueryProvider>
        <AuctionRoute />
      </QueryProvider>,
    );

    await userEvent.click(await screen.findByRole('button', { name: /Valuta Giocatore Uno/ }));
    await waitFor(() => expect(screen.getByLabelText('Prezzo')).toHaveValue(7));
    expect(screen.getAllByRole('status')).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: 'Aggiudica' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/aggiudicato/));
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  // Bug 2 (revisione): `announcement` viene solo IMPOSTATO, mai azzerato.
  // Se un secondo invio parte e fallisce, il messaggio di successo del primo
  // resta nella live region "status" mentre BidPanel apre il suo role="alert"
  // con l'errore: le due regioni si contraddicono nello stesso istante, il
  // caso che la mutua esclusivita' di useAssign() (data/error sempre
  // alternativi) dovrebbe escludere per costruzione.
  it("un secondo invio che fallisce non lascia in piedi l'annuncio di successo del primo", async () => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });

    const PURCHASE = { seq: 1, playerId: 'p1', participantId: 'anna', price: 7 };
    const PROBLEM = {
      type: 'https://fantaagent.local/problems/budget-insufficiente',
      detail: 'Anna ha solo 12 crediti di budget residuo',
    };

    let purchaseCalls = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const href = typeof input === 'string' ? input : input.toString();
      if (href.endsWith('/state')) return Promise.resolve(jsonResponse(STATE));
      if (href.includes('/players/phase')) return Promise.resolve(jsonResponse(PHASE));
      if (href.includes('/players/p1/valuation')) return Promise.resolve(jsonResponse(valuation('p1', 7)));
      if (href.includes('/purchases')) {
        purchaseCalls += 1;
        if (purchaseCalls === 1) return Promise.resolve(jsonResponse(PURCHASE));
        return Promise.resolve(
          new Response(JSON.stringify(PROBLEM), {
            status: 422,
            headers: { 'content-type': 'application/json' },
          }),
        );
      }
      return Promise.reject(new Error(`URL non prevista nel test: ${href}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <QueryProvider>
        <AuctionRoute />
      </QueryProvider>,
    );

    await userEvent.click(await screen.findByRole('button', { name: /Valuta Giocatore Uno/ }));
    await waitFor(() => expect(screen.getByLabelText('Prezzo')).toHaveValue(7));

    // Primo invio: riuscito, l'annuncio compare.
    await userEvent.click(screen.getByRole('button', { name: 'Aggiudica' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/aggiudicato/));

    // Secondo invio: fallisce.
    await userEvent.click(screen.getByRole('button', { name: 'Aggiudica' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Anna ha solo 12 crediti di budget residuo'),
    );

    // Nello stesso istante in cui l'alert mostra l'errore del secondo
    // tentativo, la status non deve ancora recitare il successo del primo.
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  // Addizione 1: la proiezione diventata di sola lettura toglie a BidPanel
  // il monopolio dell'aggiudicazione per un lotto conteso. Senza montare
  // BidderDialog da qualche parte, il componente scritto nel Task 5 e'
  // codice morto e la proiezione (che ascolta solo 'bidding'/'idle') non
  // riceverebbe mai nulla: aspetterebbe un messaggio che nessuno spedisce.
  it('un controllo apre il battitore per il giocatore selezionato, con le preferenze vere', async () => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
    vi.stubGlobal('fetch', fullFetchMock());

    render(
      <QueryProvider>
        <AuctionRoute />
      </QueryProvider>,
    );

    await userEvent.click(await screen.findByRole('button', { name: /Valuta Giocatore Uno/ }));
    await waitFor(() => expect(screen.getByLabelText('Prezzo')).toHaveValue(50));

    const open = await screen.findByRole('button', { name: /battitore per Giocatore Uno/i });
    await waitFor(() => expect(open).not.toBeDisabled());
    await userEvent.click(open);

    expect(screen.getByTestId('bidder-dialog')).toBeInTheDocument();
    // 12s, non 5s: se il numero letto qui fosse una costante fissa nella
    // route invece delle preferenze restituite da usePublicBidder, questa
    // asserzione lo scoprirebbe.
    expect(screen.getByText('12s')).toBeInTheDocument();
    expect(screen.getByTestId('bidder-ceiling')).toHaveTextContent('50');
  });

  it('chiudere il battitore torna al pannello di aggiudicazione diretta', async () => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
    vi.stubGlobal('fetch', fullFetchMock());

    render(
      <QueryProvider>
        <AuctionRoute />
      </QueryProvider>,
    );

    await userEvent.click(await screen.findByRole('button', { name: /Valuta Giocatore Uno/ }));
    const open = await screen.findByRole('button', { name: /battitore per Giocatore Uno/i });
    await waitFor(() => expect(open).not.toBeDisabled());
    await userEvent.click(open);
    expect(screen.getByTestId('bidder-dialog')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Chiudi' }));

    expect(screen.queryByTestId('bidder-dialog')).not.toBeInTheDocument();
    // BidPanel e' di nuovo la' — non un secondo percorso di aggiudicazione,
    // lo stesso pannello di sempre.
    expect(screen.getByLabelText('Prezzo')).toBeInTheDocument();
  });

  it("aggiudicare dal battitore passa per la stessa mutazione di BidPanel, non per una seconda", async () => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
    let purchaseBody: unknown = null;
    vi.stubGlobal(
      'fetch',
      fullFetchMock({
        purchase: { seq: 9, playerId: 'p1', participantId: 'anna', price: 1 },
        onWriteCall: (body) => { purchaseBody = body; },
      }),
    );
    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(
        <QueryProvider>
          <AuctionRoute />
        </QueryProvider>,
      );

      await user.click(await screen.findByRole('button', { name: /Valuta Giocatore Uno/ }));
      const open = await screen.findByRole('button', { name: /battitore per Giocatore Uno/i });
      await waitFor(() => expect(open).not.toBeDisabled());
      await user.click(open);

      // La barra spaziatrice e' il gesto che avvia il countdown (si veda
      // BidderDialog): senza, il tempo resta fermo al valore pieno e non
      // scade mai da solo.
      await user.keyboard(' ');

      // Il countdown (12 s, dalle preferenze) deve scadere prima che il form
      // "Aggiudica a" del battitore compaia.
      await act(async () => {
        vi.advanceTimersByTime(12_100);
      });

      await user.click(screen.getByRole('button', { name: 'Aggiudica' }));

      await waitFor(() => expect(purchaseBody).not.toBeNull());
      expect(purchaseBody).toMatchObject({ playerId: 'p1', participantId: 'anna' });
    } finally {
      vi.useRealTimers();
    }
  });

  describe('il battito di vita verso la proiezione', () => {
    afterEach(() => vi.useRealTimers());

    // Addizione 2: finche' nessuno pubblica MAI nulla quando non c'e' un
    // lotto in corso, la proiezione (Task 6) non puo' distinguere "non
    // connesso" da "nessun lotto aperto": in entrambi i casi il canale resta
    // silenzioso. Il battito rompe l'ambiguita'.
    it('pubblica un segno di vita a intervalli regolari quando nessun lotto e aperto', async () => {
      setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
      vi.stubGlobal('fetch', fullFetchMock());
      vi.useFakeTimers({ shouldAdvanceTime: true });

      const seen: BidBroadcast[] = [];
      const unsubscribe = subscribeBid((m) => seen.push(m));

      render(
        <QueryProvider>
          <AuctionRoute />
        </QueryProvider>,
      );

      // Un intervallo comodamente piu' corto della soglia di staleness
      // (STALE_AFTER_MS) usata dalla proiezione: qui basta avanzare di un
      // terzo di quella soglia per essere certi che almeno un battito sia
      // scattato, qualunque sia l'esatta cadenza scelta dalla route.
      await act(async () => {
        vi.advanceTimersByTime(STALE_AFTER_MS / 3);
      });
      await flushChannel();

      expect(seen.some((m) => m.kind === 'idle')).toBe(true);
      unsubscribe();
    });

    it('smette di pubblicare il battito mentre il battitore privato e aperto', async () => {
      setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
      vi.stubGlobal('fetch', fullFetchMock());
      vi.useFakeTimers({ shouldAdvanceTime: true });

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(
        <QueryProvider>
          <AuctionRoute />
        </QueryProvider>,
      );

      await user.click(await screen.findByRole('button', { name: /Valuta Giocatore Uno/ }));
      const open = await screen.findByRole('button', { name: /battitore per Giocatore Uno/i });
      await waitFor(() => expect(open).not.toBeDisabled());
      await user.click(open);
      expect(screen.getByTestId('bidder-dialog')).toBeInTheDocument();

      // Solo ORA si comincia ad ascoltare: il battito emesso prima
      // dell'apertura (durante il caricamento delle preferenze) non conta,
      // quello che conta e' cosa arriva mentre il lotto e' aperto.
      const seen: BidBroadcast[] = [];
      const unsubscribe = subscribeBid((m) => seen.push(m));

      await act(async () => {
        vi.advanceTimersByTime(STALE_AFTER_MS);
      });
      await flushChannel();

      expect(seen.some((m) => m.kind === 'idle')).toBe(false);
      unsubscribe();
    });
  });

  it('il cambio fase invia il ruolo scelto a /phase', async () => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
    let phaseBody: unknown = null;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const href = typeof input === 'string' ? input : input.toString();
      if (href.includes('/players/phase')) return Promise.resolve(jsonResponse(PHASE));
      if (href.endsWith('/state')) return Promise.resolve(jsonResponse(STATE));
      if (href.endsWith('/phase')) {
        phaseBody = init?.body ? JSON.parse(String(init.body)) : null;
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.reject(new Error(`URL non prevista nel test: ${href}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <QueryProvider>
        <AuctionRoute />
      </QueryProvider>,
    );

    const button = await screen.findByRole('button', { name: /^difensori$/i });
    await userEvent.click(button);

    await waitFor(() => expect(phaseBody).toEqual({ role: 'D' }));
  });

  it("l'annullamento invia la richiesta di void-last", async () => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
    const STATE_UNDOABLE = { ...STATE, canUndo: true };
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const href = typeof input === 'string' ? input : input.toString();
      if (href.includes('/players/phase')) return Promise.resolve(jsonResponse(PHASE));
      if (href.endsWith('/state')) return Promise.resolve(jsonResponse(STATE_UNDOABLE));
      if (href.includes('/purchases/void-last')) return Promise.resolve(new Response(null, { status: 204 }));
      return Promise.reject(new Error(`URL non prevista nel test: ${href}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <QueryProvider>
        <AuctionRoute />
      </QueryProvider>,
    );

    const button = await screen.findByRole('button', { name: /annulla/i });
    await waitFor(() => expect(button).not.toBeDisabled());
    await userEvent.click(button);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/purchases/void-last'),
        expect.anything(),
      ),
    );
  });
});
