import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParticipantView, ValuationResponse } from '../api/types';
import type { BidBroadcast } from './bidChannel';
import { subscribeBid } from './bidChannel';
import { BidderDialog } from './BidderDialog';

// setImmediate qui e' FINTO, non reale: vi.useFakeTimers fa il fake di ogni
// timer tranne nextTick e queueMicrotask, e setImmediate non e' fra le
// eccezioni. Funziona comunque perche' ogni describe che chiama flushChannel
// usa vi.useFakeTimers({ shouldAdvanceTime: true }): quel flag tiene un
// intervallo REALE in background che fa avanzare l'orologio finto, e prima o
// poi smaltisce anche l'immediate finto in coda, consegnando il messaggio del
// BroadcastChannel. Non e' certo che sia esattamente questo il meccanismo end
// to end (jsdom non e' stato letto riga per riga) — quel che e' verificato per
// ripetizione e' che senza shouldAdvanceTime non arriva niente, e con
// shouldAdvanceTime arriva in modo affidabile.
function flushChannel() {
  return new Promise<void>((resolve) => setImmediate(resolve));
}

const VALUATION: ValuationResponse = {
  playerId: 'd1', name: 'Bastoni', team: 'Inter', role: 'D', listPrice: 20,
  expectedPrice: 38, maxBid: 47, hardCap: 90, margin: 9,
  walkAwayReason: 'oltre 47 il completamento perde più di quanto guadagni',
  worthPursuing: true, confidenceStars: 4,
  drivers: [{ label: 'budget', contribution: 3, explanation: 'budget capiente' }],
};

const PARTICIPANTS: ParticipantView[] = [
  {
    id: 'anna', name: 'Anna', initial: 'A', me: true,
    budgetRemaining: 312, slotsRemaining: 17,
    filledByRole: { P: 1, D: 3, C: 0, A: 0 },
    slotsByRole: { P: 3, D: 8, C: 8, A: 6 },
  },
];

/**
 * Tre squadre per i casi del tavolo: Anna (tu), Diego, Bruno con pochi crediti e
 * molti posti liberi, Carla con i difensori gia' tutti presi.
 */
const TEAMS: ParticipantView[] = [
  PARTICIPANTS[0],
  { id: 'diego', name: 'Diego', initial: 'D', me: false, budgetRemaining: 300, slotsRemaining: 20,
    filledByRole: { P: 1, D: 2, C: 1, A: 1 }, slotsByRole: { P: 3, D: 8, C: 8, A: 6 } },
  { id: 'bruno', name: 'Bruno', initial: 'B', me: false, budgetRemaining: 20, slotsRemaining: 10,
    filledByRole: { P: 3, D: 4, C: 5, A: 3 }, slotsByRole: { P: 3, D: 8, C: 8, A: 6 } },
  { id: 'carla', name: 'Carla', initial: 'C', me: false, budgetRemaining: 200, slotsRemaining: 9,
    filledByRole: { P: 3, D: 8, C: 3, A: 2 }, slotsByRole: { P: 3, D: 8, C: 8, A: 6 } },
];

function open(overrides = {}) {
  const onAssign = vi.fn();
  render(
    <BidderDialog
      valuation={VALUATION}
      participants={PARTICIPANTS}
      timerSeconds={5}
      beepEnabled={false}
      error={null}
      onAssign={onAssign}
      onClose={() => {}}
      {...overrides}
    />,
  );
  return onAssign;
}

describe('BidderDialog', () => {
  it('il conto parte all\'apertura, non al primo rilancio', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    open();

    // Il difetto che questo blocca: il battitore si apriva col numero pieno e
    // fermo — sembrava avviato e non lo era. Su un lotto che nessuno contende
    // (nessun rilancio) il tempo non sarebbe mai partito.
    expect(screen.getByTestId('bidder-remaining')).toHaveTextContent('5');
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(screen.getByTestId('bidder-remaining')).toHaveTextContent('3');

    vi.useRealTimers();
  });

  it('l\'offerta diretta porta il prezzo al numero scritto e fa ripartire il conto', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime.bind(vi) });
    open();

    await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });

    // «Offri», non «Rilancia»: il numero scritto diventa l'offerta, non ci si
    // somma. Al tavolo si grida un prezzo, non un incremento.
    await user.type(screen.getByLabelText('Offerta diretta'), '20');
    await user.click(screen.getByRole('button', { name: 'Offri' }));

    expect(screen.getByTestId('bidder-price')).toHaveTextContent('20');
    expect(screen.getByTestId('bidder-remaining')).toHaveTextContent('5');
    expect(screen.getByLabelText('Offerta diretta')).toHaveValue(null);

    vi.useRealTimers();
  });

  it('la riga «in testa» dice chi sta vincendo, e non finge nessuno quando non c\'e\'', () => {
    open({ leader: { name: 'Anna' } });
    expect(screen.getByText('in testa')).toBeInTheDocument();
    expect(screen.getByTestId('bidder-leader')).toHaveTextContent('Anna');
  });

  it('senza offerte da altre postazioni la riga «in testa» dice Nessuno', () => {
    open();
    // Finche' a battere e' una persona sola per tutto il tavolo nessuno "sta
    // vincendo": si sta chiamando un prezzo. Mostrare li' una squadra sarebbe
    // inventare un dato che non c'e'.
    expect(screen.getByText('Nessuno')).toBeInTheDocument();
  });

  /**
   * Chi batte al portatile chiama i prezzi per tutto il tavolo: un rilancio premuto
   * non dice chi l'ha fatto. Prima metteva in testa la propria squadra, e allo
   * scadere si proponeva di aggiudicare a se' un giocatore vinto da un altro.
   */
  it('rilanciare non inventa chi e in testa: lo dice la squadra toccata', async () => {
    open({ participants: TEAMS });
    await userEvent.click(screen.getByRole('button', { name: /Rilancia \+1/ }));
    expect(screen.getByTestId('bidder-leader')).toHaveTextContent('Nessuno');

    await userEvent.click(screen.getByRole('button', { name: /^Diego/ }));
    expect(screen.getByTestId('bidder-leader')).toHaveTextContent('Diego');
    expect(screen.getByRole('button', { name: /^Diego/ })).toHaveAttribute('aria-pressed', 'true');
  });

  /** La prima squadra prende il prezzo d'apertura; le successive rilanciano di uno. */
  it('la prima squadra prende il prezzo d apertura, le altre rilanciano di uno', async () => {
    open({ participants: TEAMS });
    await userEvent.click(screen.getByRole('button', { name: /^Diego/ }));
    expect(screen.getByTestId('bidder-price')).toHaveTextContent('1');
    await userEvent.click(screen.getByRole('button', { name: /^Anna/ }));
    expect(screen.getByTestId('bidder-price')).toHaveTextContent('2');
    expect(screen.getByTestId('bidder-leader')).toHaveTextContent('Anna');
  });

  /** I tasti numerici: la squadra in quella posizione fa l'offerta. */
  it('il tasto con il numero della squadra la mette in testa', async () => {
    open({ participants: TEAMS });
    await userEvent.keyboard('2');
    expect(screen.getByTestId('bidder-leader')).toHaveTextContent('Diego');
  });

  /**
   * Chi non puo' permettersi l'offerta successiva — crediti meno uno per ogni altro
   * posto da riempire — o ha gia' pieni i posti del ruolo non si puo' toccare, e
   * dice perche'.
   */
  it('le squadre che non possono permettersi l offerta restano spente, col motivo', async () => {
    open({ participants: TEAMS });
    // Bruno: 20 crediti, 10 posti liberi -> al massimo 11.
    const bruno = screen.getByRole('button', { name: /^Bruno/ });
    expect(bruno).toHaveTextContent('max 11');
    expect(bruno).not.toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /^Diego/ }));
    const offer = screen.getByLabelText('Offerta diretta');
    await userEvent.type(offer, '11');
    await userEvent.click(screen.getByRole('button', { name: 'Offri' }));
    // Alla prossima offerta servirebbero 12: Bruno non puo'.
    expect(screen.getByRole('button', { name: /^Bruno/ })).toBeDisabled();
    // Carla ha gia' tutti i difensori.
    expect(screen.getByRole('button', { name: /^Carla/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Carla/ })).toHaveTextContent('posti difensori pieni');
  });

  it('accanto all offerta dice quanto manca al tuo tetto', async () => {
    open();
    expect(screen.getByTestId('bidder-ceiling-distance')).toHaveTextContent('46 sotto il tuo tetto');
  });

  it('Esc chiude il conto alla rovescia', async () => {
    const onClose = vi.fn();
    open({ onClose });

    // Il bottone «Chiudi» nell'intestazione se n'e' andato: accanto a «Togli
    // dal battitore» sembrava il suo doppione. La via di ritorno resta, sulla
    // tastiera — senza, per tornare all'aggiudicazione diretta bisognerebbe
    // togliere il giocatore dal banco e riselezionarlo.
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('il ruolo accanto al nome e la pillola, e il nome per esteso resta per chi ascolta', () => {
    open();

    // La stessa pillola della tabella di fase e dei risultati della ricerca: il
    // giocatore sul banco si riconosce con lo stesso colpo d'occhio. La parola
    // non se ne va, cambia solo chi la riceve — RoleBadge la porta in sr-only.
    expect(screen.getByText('difensore')).toHaveClass('sr-only');
    expect(screen.getByText('Inter')).toBeInTheDocument();
  });

  it('i tre passi rilanciano e fanno ripartire il conto, come la barra spaziatrice', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime.bind(vi) });
    open();

    // Cinque secondi di timer: dopo tre, un rilancio deve riportare il conto
    // all'inizio. Al tavolo si rilancia anche di dieci, e farlo con dieci
    // pressioni di barra spaziatrice non e' un gesto, e' una raffica.
    await user.click(screen.getByRole('button', { name: /^\+5/ }));
    expect(screen.getByTestId('bidder-price')).toHaveTextContent('6');

    await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });
    expect(screen.getByTestId('bidder-remaining')).toHaveTextContent('2');

    await user.click(screen.getByRole('button', { name: /^\+10/ }));
    expect(screen.getByTestId('bidder-price')).toHaveTextContent('16');
    expect(screen.getByTestId('bidder-remaining')).toHaveTextContent('5');

    vi.useRealTimers();
  });

  it('secondi e offerta stanno sulla stessa riga della griglia, incolonnati', () => {
    open();

    // Il difetto che questo blocca: impilando le due colonne a mano, quella col
    // countdown e' piu' alta (ha la barra sotto) e le due cifre finivano a
    // quote diverse. Stessa riga di griglia, stesso corpo: sono incolonnate.
    expect(screen.getByTestId('bidder-remaining').parentElement).toHaveClass('row-start-1');
    expect(screen.getByTestId('bidder-price').parentElement).toHaveClass('row-start-1');
  });

  it('mostra il giocatore e il tetto: e la versione privata', () => {
    open();
    expect(screen.getByText('Bastoni')).toBeInTheDocument();
    expect(screen.getByTestId('bidder-ceiling')).toHaveTextContent('47');
  });

  it('la barra spaziatrice rilancia di uno', async () => {
    open();
    await userEvent.keyboard(' ');
    expect(screen.getByTestId('bidder-price')).toHaveTextContent('2');
  });

  it('oltre il tetto lo segnala, e lo dice anche a chi ascolta', async () => {
    open({ valuation: { ...VALUATION, maxBid: 2 } });
    await userEvent.keyboard('   ');
    expect(screen.getByTestId('bidder-dialog')).toHaveAttribute('data-over-ceiling', 'true');
    expect(screen.getByTestId('bidder-ceiling-distance')).toHaveTextContent('2 oltre il tuo tetto');
    // E per chi ascolta, una frase intera.
    expect(screen.getByText(/Sei oltre il tuo tetto di 2/)).toHaveClass('sr-only');
  });

  it('sotto il tetto non segnala niente', async () => {
    open();
    await userEvent.keyboard(' ');
    expect(screen.getByTestId('bidder-dialog')).toHaveAttribute('data-over-ceiling', 'false');
    expect(screen.queryByText(/oltre il tuo tetto/i)).not.toBeInTheDocument();
  });

  // Bug (fix round 1): il countdown scaduto lascia il form "Aggiudica"
  // visibile qui, non in BidPanel — se onAssign fallisce (budget esaurito,
  // slot pieno, fase cambiata a meta' rilancio) e il fallimento non arriva
  // in nessuna forma, l'utente puo' reinviare alla cieca o credere che sia
  // andata a buon fine.
  it("mostra l'errore dell'aggiudicazione quando arriva, anche a chi ascolta", () => {
    open({ error: 'Anna ha solo 12 crediti di budget residuo' });
    expect(screen.getByRole('alert')).toHaveTextContent('Anna ha solo 12 crediti di budget residuo');
  });

  it('senza errore non mostra nessun alert', () => {
    open({ error: null });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('la barra spaziatrice non rilancia col focus su un bottone, ma rilancia appena il focus se ne va', async () => {
    open();
    const closeButton = screen.getByRole('button', { name: 'Offri' });
    closeButton.focus();

    // Spazio sul bottone focalizzato e' il gesto normale del browser per
    // attivarlo (chiudere), non per rilanciare.
    await userEvent.keyboard(' ');
    expect(screen.getByTestId('bidder-price')).toHaveTextContent('1');

    // Appena il focus torna al caso normale (nessun controllo, si guarda il
    // tavolo), lo stesso gesto rilancia come sempre.
    closeButton.blur();
    await userEvent.keyboard(' ');
    expect(screen.getByTestId('bidder-price')).toHaveTextContent('2');
  });

  describe('allo scadere del countdown', () => {
    // shouldAdvanceTime: senza, userEvent.keyboard resta in attesa per sempre
    // in questo ambiente — un'attesa interna di userEvent non riceve mai il
    // tick di cui ha bisogno se l'orologio finto sta fermo fra un
    // advanceTimersByTime esplicito e il successivo.
    beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
    afterEach(() => vi.useRealTimers());

    it('«Riprendi le offerte» riapre il banco dal prezzo raggiunto, non da uno', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      open();

      await user.keyboard('  ');
      await act(async () => { await vi.advanceTimersByTimeAsync(6_000); });
      expect(screen.getByRole('button', { name: /^Aggiudica/ })).toBeInTheDocument();

      // Il tempo e' scaduto ma al tavolo qualcuno rilancia lo stesso. Senza
      // questa via di ritorno l'unico modo di riaprire le offerte era chiudere
      // il battitore e riaprirlo, perdendo il prezzo a cui si era arrivati.
      await user.click(screen.getByRole('button', { name: /Riprendi le offerte/ }));

      expect(screen.getByTestId('bidder-price')).toHaveTextContent('3');
      expect(screen.getByTestId('bidder-remaining')).toHaveTextContent('5');
      expect(screen.queryByRole('button', { name: /^Aggiudica/ })).not.toBeInTheDocument();
      // I rilanci tornano al loro posto: si riparte da dove si era arrivati.
      expect(screen.getByRole('button', { name: /Rilancia \+1/ })).toBeInTheDocument();
    });

    it('aggiudica al prezzo raggiunto', async () => {
      // Timer finti perche' il bottone Aggiudica compare solo a countdown
      // scaduto, e con timerSeconds: 5 il countdown non scade mai da solo
      // durante un test: bisogna farlo scadere esplicitamente. advanceTimers
      // tiene vive le gesture di userEvent (keyboard, click) mentre il tempo
      // avanza sotto i timer finti.
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onAssign = open();

      // Anna apre a 1 e poi rilancia due volte con la barra.
      await user.click(screen.getByRole('button', { name: /^Anna/ }));
      await user.keyboard('  ');
      expect(screen.getByTestId('bidder-price')).toHaveTextContent('3');

      // Oltre la scadenza del countdown, ripartito dall'ultimo rilancio.
      // In act(): il tick del countdown aggiorna lo stato React da un
      // intervallo, non da un evento, e senza act() il render non e'
      // garantito flush prima della query successiva.
      await act(async () => {
        vi.advanceTimersByTime(5100);
      });

      await user.click(screen.getByRole('button', { name: 'Aggiudica a 3' }));
      expect(onAssign).toHaveBeenCalledWith({ participantId: 'anna', price: 3 });
    });

    /** Senza nessuno in testa l'acquirente va scelto: non si propone la propria squadra. */
    it('senza nessuno in testa l acquirente va scelto prima di aggiudicare', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onAssign = open({ participants: TEAMS });
      await user.keyboard('  ');
      await act(async () => { vi.advanceTimersByTime(5100); });

      expect(screen.getByRole('alert')).toHaveTextContent('Tempo scaduto: scegli a chi va.');
      const assign = screen.getByRole('button', { name: 'Aggiudica a 3' });
      expect(assign).toBeDisabled();
      await user.selectOptions(screen.getByLabelText('Aggiudica a'), 'diego');
      expect(assign).not.toBeDisabled();
      await user.click(assign);
      expect(onAssign).toHaveBeenCalledWith({ participantId: 'diego', price: 3 });
    });

    /** Chi e' in testa e' proposto come acquirente, e l'avviso lo dice. */
    it('allo scadere propone chi e in testa', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      open({ participants: TEAMS });
      await user.click(screen.getByRole('button', { name: /^Diego/ }));
      await act(async () => { vi.advanceTimersByTime(5100); });
      expect(screen.getByRole('alert')).toHaveTextContent('Tempo scaduto: Diego è in testa a 1.');
      expect(screen.getByLabelText('Aggiudica a')).toHaveValue('diego');
    });

    /** Il server rifiuterebbe: dirlo prima evita un «Aggiudica» che torna indietro. */
    it('avvisa se l acquirente scelto non puo pagare quel prezzo', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      open({ participants: TEAMS });
      await user.click(screen.getByRole('button', { name: /^Diego/ }));
      const offer = screen.getByLabelText('Offerta diretta');
      await user.type(offer, '30');
      await user.click(screen.getByRole('button', { name: 'Offri' }));
      await act(async () => { vi.advanceTimersByTime(5100); });
      await user.selectOptions(screen.getByLabelText('Aggiudica a'), 'bruno');
      expect(screen.getByText(/Bruno non può comprarlo a 30: può offrire al massimo 11/)).toBeInTheDocument();
    });
  });

  describe('il countdown corre senza altri rilanci', () => {
    beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
    afterEach(() => vi.useRealTimers());

    it('la finestra proiettata continua a sentire il tempo scendere', async () => {
      // Fissa la regressione: se la pubblicazione dipendesse solo da
      // playerId/price/timerSeconds (non da countdown.remaining), qui non
      // arriverebbe nessun altro messaggio dopo il rilancio, e il numero
      // sull'altra finestra resterebbe fermo mentre il tempo scade davvero.
      const seen: BidBroadcast[] = [];
      const unsubscribe = subscribeBid((m) => seen.push(m));
      const biddingMessages = () => seen.filter((m) => m.kind === 'bidding');

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      open();
      await flushChannel(); // il messaggio pubblicato al montaggio

      await user.keyboard(' '); // un solo rilancio: avvia il countdown, poi silenzio
      await flushChannel();
      const afterRaiseCount = biddingMessages().length;
      const remainingAfterRaise = biddingMessages().at(-1)?.remainingMs;
      expect(remainingAfterRaise).toBeDefined();

      // Un secondo di orologio, senza toccare la tastiera.
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      await flushChannel();

      expect(biddingMessages().length).toBeGreaterThan(afterRaiseCount);
      expect(biddingMessages().at(-1)?.remainingMs).toBeLessThan(remainingAfterRaise!);

      unsubscribe();
    });
  });

  describe('quando il countdown scade, lo dice anche a chi ascolta', () => {
    beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
    afterEach(() => vi.useRealTimers());

    it('role="alert" compare solo allo scadere, non prima', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      open();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      await user.keyboard(' '); // avvia il countdown, non lo fa scadere
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(5100);
      });

      expect(screen.getByRole('alert')).toHaveTextContent(/tempo scaduto/i);
    });

  });

  // Ruling (revisione finale, seconda passata): la prima versione di questo
  // fix faceva ripartire il battito 'idle' della route allo scadere del
  // countdown. Idle fa sparire il lotto dalla proiezione: si scambiava un
  // falso allarme tardivo con uno schermo muto immediato, proprio
  // nell'istante in cui la sala guarda il prezzo per scegliere l'acquirente.
  // La correzione sta qui, non nella route: il dialogo continua a
  // pubblicare da solo lo stesso lotto (prezzo congelato, remainingMs a
  // zero) a un ritmo basso, cosi' la proiezione continua a MOSTRARE il
  // lotto — non solo a "sentire qualcosa" — per tutta la durata
  // dell'aggiudicazione. Idle resta riservato a quando il dialogo chiude
  // per davvero (si veda il cleanup-on-unmount qui sotto).
  describe('dopo la scadenza, mentre il dialogo resta aperto per l\'aggiudicazione', () => {
    beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
    afterEach(() => vi.useRealTimers());

    it('continua a pubblicare lo stesso lotto (prezzo congelato), mai idle', async () => {
      const seen: BidBroadcast[] = [];
      const unsubscribe = subscribeBid((m) => seen.push(m));

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      open();
      await flushChannel();

      await user.keyboard('  '); // prezzo a 3, avvia il countdown
      await flushChannel();

      await act(async () => {
        vi.advanceTimersByTime(5100); // scade
      });
      await flushChannel();
      const afterExpiryCount = seen.length;

      // Comodamente oltre un ciclo di ripubblicazione, ma ben dentro la
      // soglia di staleness della proiezione: deve arrivare almeno un altro
      // messaggio, e deve essere lo stesso lotto, non idle.
      await act(async () => {
        vi.advanceTimersByTime(5100);
      });
      await flushChannel();

      expect(seen.length).toBeGreaterThan(afterExpiryCount);
      expect(seen.every((m) => m.kind === 'bidding')).toBe(true);
      const last = seen.at(-1);
      expect(last).toMatchObject({ kind: 'bidding', playerId: 'd1', price: 3, remainingMs: 0 });

      unsubscribe();
    });

    it('chiudere il dialogo (smontandolo) pubblica idle, e solo allora', async () => {
      const seen: BidBroadcast[] = [];
      const unsubscribe = subscribeBid((m) => seen.push(m));

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { unmount } = render(
        <BidderDialog
          valuation={VALUATION}
          participants={PARTICIPANTS}
          timerSeconds={5}
          beepEnabled={false}
          error={null}
          onAssign={() => {}}
          onClose={() => {}}
        />,
      );
      await flushChannel();

      await user.keyboard(' ');
      await act(async () => {
        vi.advanceTimersByTime(5100);
      });
      await flushChannel();

      expect(seen.some((m) => m.kind === 'idle')).toBe(false);

      unmount();
      await flushChannel();

      expect(seen.at(-1)).toEqual({ kind: 'idle' });

      unsubscribe();
    });
  });

  // Fix round 2 (revisione finale): senza un guard su `pending`, un secondo
  // clic su Aggiudica mentre il primo invio e' ancora in volo manda una
  // SECONDA POST /purchases con un requestId nuovo (la chiave non protegge
  // da un secondo clic deliberato). Il registro rifiuta il duplicato, ma
  // l'operatore vede un 422 "gia' acquistato" subito dopo un'aggiudicazione
  // che in realta' era riuscita.
  describe('mentre un invio e in volo o i dati non sono aggiornati', () => {
    beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
    afterEach(() => vi.useRealTimers());

    async function openExpired(overrides = {}) {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onAssign = open(overrides);
      await user.click(screen.getByRole('button', { name: /^Anna/ }));
      await user.keyboard(' ');
      await act(async () => {
        vi.advanceTimersByTime(5100);
      });
      return { onAssign, user };
    }

    it('pending disabilita il bottone Aggiudica e lo rietichetta', async () => {
      await openExpired({ pending: true });
      const button = screen.getByRole('button', { name: 'Aggiudico…' });
      expect(button).toBeDisabled();
    });

    it('disabled (dati stantii) disabilita il bottone Aggiudica, e lo dice a chi ascolta', async () => {
      await openExpired({ disabled: true });
      const button = screen.getByRole('button', { name: 'Aggiudica a 2' });
      expect(button).toBeDisabled();
      expect(button).toHaveAccessibleDescription(/non sono aggiornat/i);
    });

    it('ne pending ne disabled: il bottone resta attivo', async () => {
      await openExpired({ pending: false, disabled: false });
      expect(screen.getByRole('button', { name: 'Aggiudica a 2' })).not.toBeDisabled();
    });
  });
});
