import { act, render, screen, within } from '@testing-library/react';
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

    // Il difetto che questo blocca: il conto alla rovescia si apriva col numero pieno e
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

  /**
   * Il modello dell'asta dal vivo: ogni squadra sta alla propria postazione e
   * rilancia per se'. Da questa schermata si offre per la PROPRIA squadra e
   * basta, quindi i bottoni delle altre squadre non ci sono mentre il conto
   * corre — erano il modo di battere per tutto il tavolo da un portatile solo.
   */
  it('aprendo il lotto sei tu in testa, a uno', () => {
    open({ participants: TEAMS });
    // Mettere un giocatore sul banco E' chiamarlo a uno: se nessun altro
    // rilancia, se lo prende chi l'ha chiamato. Prima qui diceva «Nessuno», e a
    // tempo scaduto non proponeva nessun acquirente per un lotto che era tuo.
    expect(screen.getByTestId('bidder-price')).toHaveTextContent('1');
    expect(screen.getByTestId('bidder-leader')).toHaveTextContent('Anna');
  });

  it('un offerta da un altra postazione passa la testa a quella squadra', () => {
    open({ participants: TEAMS, leader: { name: 'Diego' } });
    expect(screen.getByTestId('bidder-leader')).toHaveTextContent('Diego');
  });

  // L'oro col conto avviato e' dell'offerta: e' il numero su cui si decide. «In
  // testa» e «sei tu» lo dicono le parole, non il colore.
  it('la cella di chi e in testa non si tinge d oro, l offerta si', () => {
    open();
    expect(screen.getByTestId('bidder-leader').className).not.toContain('bg-accent');
    expect(screen.getByTestId('bidder-leader')).toHaveTextContent('sei tu');
    expect(screen.getByTestId('bidder-price').className).toContain('text-accent');
  });

  // Il tetto e' il riferimento fermo, non il prezzo: esce dal tabellone e scende
  // nella riga di cio' che vedi solo tu, accanto a quanto manca per arrivarci.
  it('il tetto sta nella riga privata, non fra le caselle', () => {
    open();
    const cells = screen.getByTestId('bidder-cells');
    expect(within(cells).queryByTestId('bidder-ceiling')).toBeNull();
    const privateRow = screen.getByTestId('bidder-private');
    expect(within(privateRow).getByTestId('bidder-ceiling')).toBeInTheDocument();
    expect(within(privateRow).getByText('Lo vedi solo tu')).toBeInTheDocument();
  });

  // Sul telefono il banco deve stare nella prima schermata: le tre caselle su
  // due righe lo allungavano di una riga intera. Restano su una riga, coi
  // numeri piu' piccoli; da sm in su non cambia niente.
  it('sotto sm le tre caselle restano su una riga, coi numeri piu piccoli', () => {
    open();
    const cells = screen.getByTestId('bidder-cells');
    expect(cells.className).not.toMatch(/max-sm:grid-cols/);
    expect(cells.className).toContain('grid-cols-[1fr_1.25fr_1.25fr]');
    for (const cell of cells.querySelectorAll('[data-cell]')) {
      expect(cell.className).not.toContain('nth-child');
    }
    const seconds = screen.getByTestId('bidder-remaining');
    expect(seconds.className).toContain('max-sm:text-4xl');
    expect(seconds.className).toContain('text-[56px]');
    const price = screen.getByTestId('bidder-price');
    expect(price.className).toContain('max-sm:text-5xl');
    expect(price.className).toContain('text-[84px]');
  });

  it('tre caselle mentre il conto corre, due a tempo scaduto', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    open();
    expect(screen.getByTestId('bidder-cells').querySelectorAll('[data-cell]')).toHaveLength(3);
    // Si porta il conto a zero con lo stesso meccanismo delle prove di
    // scadenza qui sotto: un rilancio (avvia il conto), poi l'orologio finto
    // avanti oltre i cinque secondi del timer.
    await user.keyboard(' ');
    await act(async () => { vi.advanceTimersByTime(5100); });
    expect(screen.getByTestId('bidder-cells').querySelectorAll('[data-cell]')).toHaveLength(2);
    vi.useRealTimers();
  });

  /**
   * Il perche' lasciare spariva proprio quando parte il conto, cioe' nel momento
   * in cui la tentazione di sforare il tetto e' massima. A tempo scaduto invece
   * non serve piu': li' si registra un esito, non si decide se spingere.
   */
  it('mentre il conto corre dice anche perche lasciare', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    open({ valuation: { ...VALUATION, worthPursuing: false } });

    expect(screen.getByText(/oltre 47 il completamento perde/)).toBeInTheDocument();

    await user.keyboard(' ');
    await act(async () => { vi.advanceTimersByTime(5100); });
    expect(screen.queryByText(/oltre 47 il completamento perde/)).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  /**
   * «Se lo prendi»: la domanda che il rilancio fa nascere e che l'applicazione non
   * rispondeva — quanto mi resta se lo pago questo. Sono i numeri della colonna di
   * sinistra proiettati dopo l'acquisto, non una stima nuova.
   */
  it('dice cosa ti resterebbe se lo prendi a quel prezzo', () => {
    open();
    const dopo = screen.getByTestId('bidder-after');
    // Anna: 312 crediti, 17 posti. A 1 credito restano 311 su 16 posti, 19 a posto.
    expect(dopo).toHaveTextContent('311');
    expect(dopo).toHaveTextContent('16');
    expect(dopo).toHaveTextContent('19');
  });

  it('a tempo scaduto «se lo prendi» non serve piu: il prezzo non cambia', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    open();
    await user.keyboard(' ');
    await act(async () => { vi.advanceTimersByTime(5100); });
    expect(screen.queryByTestId('bidder-after')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('mentre il conto corre non ci sono i bottoni delle altre squadre', () => {
    open({ participants: TEAMS });

    // Offrire al posto di un altro non e' un gesto che esiste: ognuno rilancia
    // dalla propria postazione. E otto bottoni in piu' riempivano il riquadro
    // proprio nel momento in cui serve leggere tre numeri e basta.
    expect(screen.queryByRole('button', { name: /^Diego/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Anna/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rilancia \+1/ })).toBeInTheDocument();
  });

  it('i tasti da 1 a 9 non offrono per altri mentre il conto corre', async () => {
    open({ participants: TEAMS });
    await userEvent.keyboard('2');
    expect(screen.getByTestId('bidder-price')).toHaveTextContent('1');
    expect(screen.getByTestId('bidder-leader')).toHaveTextContent('Anna');
  });

  it('rilanciando resti tu in testa', async () => {
    open({ participants: TEAMS });
    await userEvent.click(screen.getByRole('button', { name: /Rilancia \+1/ }));
    expect(screen.getByTestId('bidder-price')).toHaveTextContent('2');
    expect(screen.getByTestId('bidder-leader')).toHaveTextContent('Anna');
  });

  it('le scorciatoie sono scritte come tasti, non come una riga di prosa', () => {
    open({ participants: TEAMS });

    // Sono il vantaggio di questo riquadro su chi batte l'asta a mano, ed erano
    // scritte nel corpo meno leggibile dello schermo: una riga grigia di 14px
    // unita dai punti medi, in fondo a destra. Rese come tasti si trovano senza
    // leggerle.
    const keys = screen
      .getByTestId('bidder-shortcuts')
      .querySelectorAll('kbd');
    // Solo i gesti che esistono qui: rilanciare per te, e chiudere. I tasti
    // delle squadre compaiono a tempo scaduto, dove servono a dire a chi va.
    expect(Array.from(keys, (k) => k.textContent)).toEqual(['Spazio', 'Esc']);
  });

  // Senza tastiera i tasti non servono: sotto lg la loro riga non si vede.
  it('mentre il conto corre sotto lg la riga dei tasti non si vede', () => {
    open();
    expect(screen.getByTestId('bidder-shortcuts').className).toContain('max-lg:hidden');
  });

  // Sul telefono «Rilancia +1», «+5» e «+10» stanno su una riga: +10 andava a
  // capo da solo e allungava il banco di una riga.
  it('sotto sm i tre rilanci stanno su una riga', () => {
    open();
    const raise = screen.getByRole('button', { name: /Rilancia \+1/ });
    expect(raise.className).toContain('flex-1');
    expect(raise.className).toContain('max-sm:basis-0');
    for (const name of [/^\+5/, /^\+10/]) {
      const b = screen.getByRole('button', { name });
      expect(b.className).toContain('max-sm:w-16');
      expect(b.className).toContain('max-sm:min-w-16');
      expect(b.className).toContain('min-h-16');
    }
  });

  it('sotto il tetto dice quanto ne manca', async () => {
    open();
    // La distanza sta accanto al tetto, nella stessa riga privata: «il tuo
    // tetto 47, 46 sotto» si legge di seguito, senza rimbalzare fra due
    // riquadri.
    const distance = screen.getByTestId('bidder-ceiling-distance');
    expect(distance).toHaveTextContent('46 sotto');
    const privateRow = screen.getByTestId('bidder-private');
    expect(within(privateRow).getByTestId('bidder-ceiling')).toBeInTheDocument();
    expect(privateRow).toContainElement(distance);
  });

  // Sul telefono la riga privata sta su due righe al massimo: il tetto in una,
  // «se lo prendi a N» sotto, a tutta larghezza, invece di spezzarsi a meta'.
  it('sotto sm «se lo prendi» va a capo sotto il tetto, su una riga sua', () => {
    open();
    const after = screen.getByTestId('bidder-after');
    expect(after.className).toContain('max-sm:basis-full');
    expect(screen.getByTestId('bidder-private')).toContainElement(after);
  });

  it('Esc chiude il conto alla rovescia', async () => {
    const onClose = vi.fn();
    open({ onClose });

    // Il bottone «Chiudi» nell'intestazione se n'e' andato: accanto a «Togli
    // dal banco» sembrava il suo doppione. La via di ritorno resta, sulla
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

  // L'offerta e' adesso l'unico numero eroe del tabellone (84px): i secondi
  // restano a 56px. Prima i tre corpi erano identici apposta, perche' nessuna
  // cella prendeva l'oro da sola; ora l'offerta lo prende, ed e' lei che deve
  // saltare all'occhio.
  it('l offerta e piu grande dei secondi: e lei l unico numero eroe', () => {
    open();
    expect(screen.getByTestId('bidder-price').className).toContain('text-[84px]');
    expect(screen.getByTestId('bidder-remaining').className).toContain('text-[56px]');
  });

  // Il banco ha un'altezza fissa, e a 1440x900 il conto alla rovescia non ci
  // stava: da lg le celle del tabellone hanno meno aria sopra e sotto (12px, non
  // 20) e le righe del riquadro stanno a 8px l'una dall'altra, non 12. L'offerta
  // resta a 84px. Sotto lg il telefono resta com'era.
  it('da lg il tabellone e le sue righe sono piu stretti in altezza, l offerta no', () => {
    open();
    const dialog = screen.getByTestId('bidder-dialog');
    expect(dialog.className).toContain('gap-3');
    expect(dialog.className).toContain('lg:gap-2');
    dialog.querySelectorAll('[data-cell]').forEach((cell) => {
      expect(cell.className).toContain('py-5');
      expect(cell.className).toContain('lg:py-3');
    });
    expect(screen.getByTestId('bidder-price').className).toContain('text-[84px]');
  });

  it('mostra il giocatore e il tetto: e la versione privata', () => {
    open();
    expect(screen.getByText('Bastoni')).toBeInTheDocument();
    expect(screen.getByTestId('bidder-ceiling')).toHaveTextContent('47');
  });

  it('il tetto si dice una volta sola: nella riga privata', () => {
    open();

    // Due volte lo stesso numero sarebbe due numeri per chi legge di fretta.
    // Vive nella riga di cio' che vedi solo tu, non anche nel tabellone.
    const labels = screen.getAllByText('il tuo tetto');
    expect(labels).toHaveLength(1);
    expect(screen.getByTestId('bidder-private')).toContainElement(labels[0]);
  });

  it('senza nessun prezzo conveniente il tetto dice «nessuno», non zero', () => {
    open({ valuation: { ...VALUATION, maxBid: 0, worthPursuing: false } });

    // Lo stesso della tabella di fase: tetto zero non e' un prezzo basso, e' la
    // mancanza di un prezzo. In colonna con i secondi e l'offerta, uno zero si
    // legge come una cifra — e per giunta come la piu' conveniente della serata.
    expect(screen.getByTestId('bidder-ceiling')).toHaveTextContent('nessuno');
  });

  /**
   * Le tre letture sono celle della STESSA riga, e questo e' il punto: due
   * altezze diverse non possono nascere da celle di una riga sola. Il tetto non
   * e' piu' una di queste tre — e' sceso nella riga privata — quindi restano
   * tempo, offerta e chi e' in testa.
   */
  it('le tre letture sono celle della stessa riga: stessa altezza per costruzione', () => {
    open({ leader: { name: 'Diego' }, participants: TEAMS });
    const riga = screen.getByTestId('bidder-cells');

    for (const id of ['bidder-remaining', 'bidder-price', 'bidder-leader']) {
      expect(riga).toContainElement(screen.getByTestId(id));
    }
    expect(riga.children).toHaveLength(3);
  });

  /** La barra e' la base del tabellone, non una linea che gli galleggia sotto. */
  it('la barra del tempo e la base del tabellone', () => {
    open();
    expect(screen.getByTestId('bidder-scoreboard')).toContainElement(
      screen.getByTestId('bidder-remaining-bar'),
    );
  });

  /**
   * Il conto non pulsa. La pulsazione faceva oscillare l'opacita' fra 1 e 0,5, e
   * misurata col metodo di contrast.test.ts portava il numero da 5,21:1 a
   * 2,25:1 — sotto la soglia di 4,5 per meta' del tempo, sul dato che in quel
   * momento conta di piu'. E' la stessa ragione per cui le fasi non correnti non
   * si smorzano.
   *
   * <p>L'urgenza resta detta quattro volte: il numero rosso, l'etichetta «ultimi
   * secondi», la barra rossa e il numero che scende. La pulsazione era il quinto
   * segnale, ed era l'unico che costava leggibilita'.
   */
  it('negli ultimi secondi il conto non pulsa: resta leggibile', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    open();
    await act(async () => { await vi.advanceTimersByTimeAsync(2_500); });

    const conto = screen.getByTestId('bidder-remaining');
    expect(conto.className).toContain('text-destructive');
    expect(conto.className).not.toContain('animate-pulse');
    expect(screen.getByText('ultimi secondi')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('negli ultimi secondi la barra passa al rosso', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    open();
    await act(async () => { await vi.advanceTimersByTimeAsync(2_500); });
    expect(screen.getByTestId('bidder-remaining-bar').className).toContain('bg-destructive');
    vi.useRealTimers();
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
    // Breve, perche' sta sotto l'etichetta che lo nomina: «il tuo tetto 2, 2
    // oltre». La frase intera resta per chi ascolta, qui sotto.
    expect(screen.getByTestId('bidder-ceiling-distance')).toHaveTextContent('2 oltre');
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
      // il conto alla rovescia e riaprirlo, perdendo il prezzo a cui si era arrivati.
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

      // Il lotto si apre a 1 — ed e' gia' la tua offerta — poi due rilanci con
      // la barra spaziatrice.
      await user.keyboard('  ');
      expect(screen.getByTestId('bidder-price')).toHaveTextContent('3');

      // Oltre la scadenza del countdown, ripartito dall'ultimo rilancio.
      // In act(): il tick del countdown aggiorna lo stato React da un
      // intervallo, non da un evento, e senza act() il render non e'
      // garantito flush prima della query successiva.
      await act(async () => {
        vi.advanceTimersByTime(5100);
      });

      await user.click(screen.getByRole('button', { name: 'Aggiudica a Anna per 3' }));
      expect(onAssign).toHaveBeenCalledWith({ participantId: 'anna', price: 3 });
    });

    it('a chi va si sceglie con gli stessi bottoni squadra, non con un menu', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      open({ participants: TEAMS });
      await user.keyboard(' ');
      await act(async () => { vi.advanceTimersByTime(5100); });

      // Il difetto che questo blocca: un secondo prima si toccavano otto bottoni
      // squadra, e allo scadere la STESSA scelta passava a un menu a tendina di
      // sistema. Stesso compito, due modi di farlo — e il menu rompeva anche il
      // linguaggio a pillole del resto del riquadro.
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Diego/ })).toBeInTheDocument();
    });

    // Una lega non ha un massimo di squadre, e dieci o dodici sono comuni. Il banco
    // ha un'altezza fissa, misurata con otto: con dodici i bottoni vanno su due
    // righe, e se «Aggiudica» stesse sotto finirebbe oltre il bordo del banco. Sta
    // sopra, nel documento come a schermo: e' la seconda riga di squadre a
    // scorrere, non il gesto che chiude il lotto.
    it('con dodici squadre ci sono tutti i bottoni, e «Aggiudica» viene prima', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const twelve: ParticipantView[] = Array.from({ length: 12 }, (_, i) => ({
        ...TEAMS[1], id: `t${i}`, name: `Squadra ${i + 1}`, me: i === 0,
      }));
      open({ participants: twelve });
      await user.keyboard(' ');
      await act(async () => { vi.advanceTimersByTime(5100); });

      const teams = screen.getByRole('group', { name: /A chi va/ });
      expect(within(teams).getAllByRole('button')).toHaveLength(12);
      const assign = screen.getByRole('button', { name: /^Aggiudica/ });
      expect(teams.compareDocumentPosition(assign) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    });

    it('scegliere a chi va non rilancia e non fa ripartire il conto', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      open({ participants: TEAMS });
      await user.keyboard(' ');
      await act(async () => { vi.advanceTimersByTime(5100); });

      await user.click(screen.getByRole('button', { name: /^Diego/ }));

      // I bottoni squadra esistono solo qui, e dicono «se l'e' preso lui»: non
      // sono un'offerta. Indicare il vincitore non deve fargli pagare un credito
      // in piu' ne' far ripartire un conto gia' scaduto.
      expect(screen.getByTestId('bidder-price')).toHaveTextContent('2');
      expect(screen.getByRole('button', { name: 'Aggiudica a Diego per 2' })).toBeInTheDocument();
    });

    it('a tempo scaduto la barra spaziatrice non e piu una scorciatoia, e non lo dice', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      open({ participants: TEAMS });
      await user.keyboard(' ');
      await act(async () => { vi.advanceTimersByTime(5100); });

      // Scaduto il tempo, lo spazio non rilancia piu' (l'ascolto si spegne):
      // continuare a offrirlo fra le scorciatoie e' istruire a un gesto che non
      // fa niente. I tasti delle squadre restano, e cambiano significato.
      const keys = screen.getByTestId('bidder-shortcuts').querySelectorAll('kbd');
      expect(Array.from(keys, (k) => k.textContent)).toEqual(['1–4', 'Esc']);
      // E il tasto fa quello che dice: sceglie a chi va.
      await user.keyboard('2');
      expect(screen.getByRole('button', { name: 'Aggiudica a Diego per 2' })).toBeInTheDocument();
    });

    // A tempo scaduto si registra un esito, non si decide se spingere: la riga di
    // riferimento (mercato, margine, verdetto) se ne va come la riga privata, e i
    // tasti stanno sulla riga di «Aggiudica», in fondo a destra. Due righe in meno
    // in un banco alto quanto e' deciso in anticipo.
    it('a tempo scaduto niente riga di riferimento, e i tasti sulla riga di Aggiudica', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      open({ participants: TEAMS });
      expect(screen.getByText('mercato')).toBeInTheDocument();
      await user.keyboard(' ');
      await act(async () => { vi.advanceTimersByTime(5100); });

      expect(screen.queryByText('mercato')).not.toBeInTheDocument();
      expect(screen.queryByText('margine')).not.toBeInTheDocument();
      expect(screen.queryByText(/^(Prendi|Lascia)$/)).not.toBeInTheDocument();
      const assign = screen.getByRole('button', { name: /^Aggiudica a/ });
      const shortcuts = screen.getByTestId('bidder-shortcuts');
      expect(assign.parentElement).toBe(shortcuts.parentElement);
      expect(shortcuts.className).toContain('sm:ml-auto');
    });

    // Da xl le squadre stanno su una riga sola: su due righe il tempo scaduto era
    // lo stato piu' alto del banco, e non ci stava. Sotto xl restano quattro per
    // riga, e sul telefono due.
    it('a tempo scaduto da xl le squadre stanno su una riga sola', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      open({ participants: TEAMS });
      await user.keyboard(' ');
      await act(async () => { vi.advanceTimersByTime(5100); });

      const grid = screen.getByRole('button', { name: /^Diego/ }).parentElement!;
      expect(grid.className).toContain('grid-cols-2');
      expect(grid.className).toContain('sm:grid-cols-4');
      expect(grid.className).toContain('xl:grid-cols-8');
    });

    // Sul telefono il tempo scaduto era lo stato piu' alto del banco: sotto sm i
    // bottoni squadra perdono la seconda riga a vista (crediti, «se lo prende»),
    // ma la tengono per chi ascolta.
    it('a tempo scaduto sotto sm i bottoni squadra stanno su una riga, la seconda resta per chi ascolta', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      open({ participants: TEAMS });
      await user.keyboard(' ');
      await act(async () => { vi.advanceTimersByTime(5100); });

      const diego = screen.getByRole('button', { name: /^Diego/ });
      const second = diego.lastElementChild as HTMLElement;
      expect(second.className).toContain('max-sm:sr-only');
      expect(second.className).not.toContain('max-sm:hidden');
      expect(diego.firstElementChild!.className).not.toContain('sr-only');
    });

    // Senza tastiera i tasti non servono: sotto lg la loro riga non si vede
    // (resta nel documento, e dal computer in su si vede come prima).
    it('a tempo scaduto sotto lg la riga dei tasti non si vede', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      open({ participants: TEAMS });
      await user.keyboard(' ');
      await act(async () => { vi.advanceTimersByTime(5100); });
      expect(screen.getByTestId('bidder-shortcuts').className).toContain('max-lg:hidden');
    });

    // I due gesti del tempo scaduto, sul telefono, larghi uguali; la legenda
    // dice «A chi va» e basta, il resto della frase resta per chi ascolta.
    it('a tempo scaduto sotto sm «Riprendi le offerte» e «Aggiudica» sono larghi uguali, la legenda corta', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      open({ participants: TEAMS });
      await user.keyboard(' ');
      await act(async () => { vi.advanceTimersByTime(5100); });
      const assign = screen.getByRole('button', { name: /^Aggiudica a/ });
      const reopen = screen.getByRole('button', { name: 'Riprendi le offerte' });
      expect(assign.className).toContain('max-sm:w-full');
      expect(reopen.className).toContain('max-sm:w-full');
      expect(reopen.className).toContain('max-sm:justify-center');
      const legend = screen.getByRole('group', { name: /A chi va/ }).querySelector('legend')!;
      expect(legend).toHaveTextContent(/A chi va — se l.ha preso un altro/);
      const rest = within(legend).getByText(/se l.ha preso un altro/);
      expect(rest.className).toContain('max-sm:sr-only');
    });

    // Un nome tagliato coi puntini non si legge: sotto sm il nome della squadra
    // va a capo fra le parole, e sillaba in italiano solo una parola troppo lunga.
    it('a tempo scaduto sotto sm i nomi delle squadre vanno a capo, non si troncano', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      open({ participants: TEAMS });
      await user.keyboard(' ');
      await act(async () => { vi.advanceTimersByTime(5100); });
      const name = within(screen.getByRole('button', { name: /^Diego/ })).getByText('Diego');
      expect(name.className).toContain('max-sm:whitespace-normal');
      expect(name.className).toContain('max-sm:overflow-visible');
      expect(name.className).toContain('max-sm:hyphens-auto');
      // Sillaba solo le parole lunghe, non per riempire la riga.
      expect(name.className).toContain('max-sm:[hyphenate-limit-chars:12_6_6]');
      // WebKit (Safari, iPhone) non conosce hyphenate-limit-chars: i suoi limiti.
      expect(name.className).toContain('max-sm:[-webkit-hyphenate-limit-before:6]');
      expect(name.className).toContain('max-sm:[-webkit-hyphenate-limit-after:6]');
      expect(name.className).not.toContain('break-all');
      expect(name.className).not.toContain('break-words');
      expect(name).toHaveAttribute('lang', 'it');
      // Da sm in su resta com'era.
      expect(name.className).toContain('truncate');
    });

    it('a tempo scaduto il conto se ne va, invece di restare a zero', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      open();
      await user.keyboard(' ');
      await act(async () => { vi.advanceTimersByTime(5100); });

      // Uno zero gigante e' informazione morta nel posto piu' in vista del
      // riquadro, proprio dove serve l'esito. Restano le due letture che ancora
      // dicono qualcosa: a quanto siamo, e chi e' in testa. Il tetto non c'e'
      // piu' nemmeno nella riga privata: a tempo scaduto si registra un esito,
      // non si decide se spingere.
      expect(screen.queryByTestId('bidder-remaining')).not.toBeInTheDocument();
      expect(screen.getByTestId('bidder-price')).toBeInTheDocument();
      expect(screen.getByTestId('bidder-leader')).toBeInTheDocument();
      expect(screen.queryByTestId('bidder-ceiling')).not.toBeInTheDocument();
    });

    /**
     * Nessun altro ha rilanciato: il lotto e' tuo, al prezzo a cui l'hai portato.
     * Proporre «scegli la squadra» avrebbe chiesto di dichiarare l'ovvio.
     */
    it('senza offerte altrui il lotto e proposto a te, al prezzo raggiunto', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onAssign = open({ participants: TEAMS });
      await user.keyboard('  ');
      await act(async () => { vi.advanceTimersByTime(5100); });

      // Resta per chi ascolta, non per chi guarda: a schermo «Anna» lo dicono
      // gia' il riquadro di chi e' in testa, il bottone squadra acceso e il
      // bottone «Aggiudica a Anna per 3» — quattro volte lo stesso nome nello
      // stesso riquadro.
      const avviso = screen.getByRole('alert');
      expect(avviso).toHaveTextContent('Tempo scaduto: Anna è in testa a 3.');
      expect(avviso).toHaveClass('sr-only');
      const assign = screen.getByRole('button', { name: 'Aggiudica a Anna per 3' });
      expect(assign).not.toBeDisabled();
      await user.click(assign);
      expect(onAssign).toHaveBeenCalledWith({ participantId: 'anna', price: 3 });
    });

    /** Se al tavolo ha vinto un altro, lo si corregge con i bottoni squadra. */
    it('se se l e preso un altro, lo si corregge toccando la sua squadra', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onAssign = open({ participants: TEAMS });
      await user.keyboard('  ');
      await act(async () => { vi.advanceTimersByTime(5100); });

      await user.click(screen.getByRole('button', { name: /^Diego/ }));
      await user.click(screen.getByRole('button', { name: 'Aggiudica a Diego per 3' }));
      expect(onAssign).toHaveBeenCalledWith({ participantId: 'diego', price: 3 });
    });

    /** Chi e' in testa secondo il server e' proposto come acquirente. */
    it('allo scadere propone la squadra in testa secondo il server', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      open({ participants: TEAMS, leader: { name: 'Diego' } });
      await user.keyboard(' ');
      await act(async () => { vi.advanceTimersByTime(5100); });
      expect(screen.getByRole('alert')).toHaveTextContent('Tempo scaduto: Diego è in testa a 2.');
      expect(screen.getByRole('button', { name: /^Diego/ })).toHaveAttribute('aria-pressed', 'true');
    });

    /** Il server rifiuterebbe: dirlo prima evita un «Aggiudica» che torna indietro. */
    it('avvisa se l acquirente scelto non puo pagare quel prezzo', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      open({ participants: TEAMS });
      const offer = screen.getByLabelText('Offerta diretta');
      await user.type(offer, '30');
      await user.click(screen.getByRole('button', { name: 'Offri' }));
      await act(async () => { vi.advanceTimersByTime(5100); });
      await user.click(screen.getByRole('button', { name: /^Bruno/ }));
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
      const button = screen.getByRole('button', { name: 'Aggiudica a Anna per 2' });
      expect(button).toBeDisabled();
      expect(button).toHaveAccessibleDescription(/non sono aggiornat/i);
    });

    it('ne pending ne disabled: il bottone resta attivo', async () => {
      await openExpired({ pending: false, disabled: false });
      expect(screen.getByRole('button', { name: 'Aggiudica a Anna per 2' })).not.toBeDisabled();
    });
  });

  // L'amministratore senza posto batte l'asta senza consigli: niente tetto,
  // mercato, margine o verdetto — ne' un tetto «nessuno», che direbbe altro.
  it('senza consigli non mostra tetto, mercato, margine ne verdetto', () => {
    open({ advice: false, participants: TEAMS.filter((p) => !p.me) });
    expect(screen.queryByTestId('bidder-ceiling')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bidder-private')).not.toBeInTheDocument();
    expect(screen.queryByText('il tuo tetto')).not.toBeInTheDocument();
    expect(screen.queryByText('mercato')).not.toBeInTheDocument();
    expect(screen.queryByText('margine')).not.toBeInTheDocument();
    expect(screen.queryByText(/^(Prendi|Lascia)$/)).not.toBeInTheDocument();
    // Tre caselle anche senza consigli: il tetto non era una casella di questa
    // riga nemmeno prima, la griglia ora non dipende piu' da `advice`.
    expect(screen.getByTestId('bidder-cells').querySelectorAll('[data-cell]')).toHaveLength(3);
    expect(screen.getByRole('heading', { name: 'Bastoni' })).toBeInTheDocument();
  });

  // Dentro il banco nome, ruolo e squadra li porta la testata del banco: il
  // conto alla rovescia non li ripete, e l'offerta sale di una riga.
  it('senza testata non ripete il nome del giocatore', () => {
    open({ hideHeader: true });
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.queryByText('Bastoni')).not.toBeInTheDocument();
    expect(screen.getByTestId('bidder-price')).toHaveTextContent('1');
  });
});
