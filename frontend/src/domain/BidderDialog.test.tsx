import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParticipantView, ValuationResponse } from '../api/types';
import type { BidBroadcast } from './bidChannel';
import { subscribeBid } from './bidChannel';
import { BidderDialog } from './BidderDialog';

// La consegna del BroadcastChannel di jsdom e' un vero task del motore, non un
// microtask: non lo si avanza con vi.advanceTimersByTime (i timer finti non lo
// toccano) ne' con un microtask esplicito (non basta). setImmediate e' reale
// anche sotto vi.useFakeTimers, quindi e' l'attesa giusta per farlo arrivare.
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

function open(overrides = {}) {
  const onAssign = vi.fn();
  render(
    <BidderDialog
      valuation={VALUATION}
      participants={PARTICIPANTS}
      timerSeconds={5}
      beepEnabled={false}
      onAssign={onAssign}
      onClose={() => {}}
      {...overrides}
    />,
  );
  return onAssign;
}

describe('BidderDialog', () => {
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
    expect(screen.getByText(/oltre il tuo tetto/i)).toBeInTheDocument();
  });

  it('sotto il tetto non segnala niente', async () => {
    open();
    await userEvent.keyboard(' ');
    expect(screen.getByTestId('bidder-dialog')).toHaveAttribute('data-over-ceiling', 'false');
    expect(screen.queryByText(/oltre il tuo tetto/i)).not.toBeInTheDocument();
  });

  describe('allo scadere del countdown', () => {
    // shouldAdvanceTime: senza, userEvent.keyboard resta in attesa per sempre
    // in questo ambiente — un'attesa interna di userEvent non riceve mai il
    // tick di cui ha bisogno se l'orologio finto sta fermo fra un
    // advanceTimersByTime esplicito e il successivo.
    beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
    afterEach(() => vi.useRealTimers());

    it('aggiudica al prezzo raggiunto', async () => {
      // Timer finti perche' il bottone Aggiudica compare solo a countdown
      // scaduto, e con timerSeconds: 5 il countdown non scade mai da solo
      // durante un test: bisogna farlo scadere esplicitamente. advanceTimers
      // tiene vive le gesture di userEvent (keyboard, click) mentre il tempo
      // avanza sotto i timer finti.
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onAssign = open();

      await user.keyboard('  ');
      expect(screen.getByTestId('bidder-price')).toHaveTextContent('3');

      // Oltre la scadenza del countdown, ripartito dall'ultimo rilancio.
      // In act(): il tick del countdown aggiorna lo stato React da un
      // intervallo, non da un evento, e senza act() il render non e'
      // garantito flush prima della query successiva.
      await act(async () => {
        vi.advanceTimersByTime(5100);
      });

      await user.click(screen.getByRole('button', { name: 'Aggiudica' }));
      expect(onAssign).toHaveBeenCalledWith({ participantId: 'anna', price: 3 });
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
});
