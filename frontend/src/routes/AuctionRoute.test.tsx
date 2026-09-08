import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setAuctionContext } from '../api/client';
import { QueryProvider } from '../api/QueryProvider';
import { AuctionRoute } from './AuctionRoute';

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
});
