import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ParticipantView, ValuationResponse } from '../api/types';
import { PlayerDecisionCard } from './PlayerDecisionCard';

const VALUATION: ValuationResponse = {
  playerId: 'd1',
  name: 'Bastoni',
  team: 'Inter',
  role: 'D',
  listPrice: 20,
  expectedPrice: 38,
  maxBid: 47,
  hardCap: 90,
  margin: 9,
  walkAwayReason: 'oltre 47 il completamento perde più di quanto guadagni',
  worthPursuing: true,
  confidenceStars: 4,
  drivers: [
    { label: 'budget', contribution: 3, explanation: 'budget capiente' },
    { label: 'alternative', contribution: -1, explanation: 'tre alternative sopra soglia' },
  ],
};

const ME: ParticipantView = {
  id: 'anna', name: 'Anna', initial: 'A', me: true,
  budgetRemaining: 300, slotsRemaining: 25,
  filledByRole: { P: 0, D: 0, C: 0, A: 0 },
  slotsByRole: { P: 3, D: 8, C: 8, A: 6 },
};

describe('PlayerDecisionCard', () => {
  /**
   * Col lotto sul banco i tuoi numeri non sono in pagina: il pannello centrale li
   * mostra solo a riposo, e la colonna di sinistra porta i crediti nudi. Quanto
   * puoi davvero offrire PER QUESTO giocatore — crediti meno un credito per ogni
   * altro posto da riempire — e' il vincolo che decide il rilancio, e finora si
   * scopriva solo sbagliando: lo diceva un errore, dopo aver scritto un prezzo
   * troppo alto.
   */
  it('mostra quanto puoi offrire per questo lotto, dal dato del server', () => {
    render(<PlayerDecisionCard valuation={VALUATION} stale={false} me={ME} />);
    // hardCap della valutazione (90), non i 276 che maxAffordable(ME) darebbe
    // ricalcolando qui la stessa formula: la fonte e' una, ed e' il server. Il
    // numero appartiene allo stesso scatto degli altri quattro della riga —
    // ricalcolarlo fresco dentro un blocco segnato come stantio lo farebbe
    // discordare proprio quando si guarda se fidarsi.
    expect(screen.getByTestId('affordable')).toHaveTextContent('90');
    expect(screen.getByText('puoi offrire')).toBeInTheDocument();
  });

  /**
   * Quattro numeri in fila allo stesso corpo si leggono come un elenco solo, e
   * non lo sono: quotazione, mercato e margine parlano del GIOCATORE, «puoi
   * offrire» parla di TE — e' il tuo budget, non una quarta misura del lotto. La
   * riga li separa con una linea, cosi' l'occhio non li somma.
   */
  it('separa il numero che riguarda te da quelli che riguardano il giocatore', () => {
    render(<PlayerDecisionCard valuation={VALUATION} stale={false} me={ME} />);
    expect(screen.getByTestId('affordable')).toHaveClass('border-l');
  });

  /**
   * Coi posti di quel ruolo gia' pieni non c'e' nessuna cifra da offrire: un numero
   * inviterebbe a rilanciare su un giocatore che non puoi comprare. Si dice il
   * vincolo, non la cifra.
   */
  it('coi posti del ruolo pieni dice il vincolo invece della cifra', () => {
    const pieno: ParticipantView = { ...ME, filledByRole: { P: 0, D: 8, C: 0, A: 0 } };
    render(<PlayerDecisionCard valuation={VALUATION} stale={false} me={pieno} />);
    expect(screen.getByTestId('affordable')).toHaveTextContent('—');
    expect(screen.getByText('difensori al completo')).toBeInTheDocument();
  });

  it('mostra il tetto come numero dominante', () => {
    render(<PlayerDecisionCard valuation={VALUATION} stale={false} />);
    const maxBid = screen.getByTestId('max-bid');
    expect(maxBid).toHaveTextContent('47');
  });

  it('mostra mercato, margine e il verdetto', () => {
    render(<PlayerDecisionCard valuation={VALUATION} stale={false} />);
    expect(screen.getByTestId('expected-price')).toHaveTextContent('38');
    expect(screen.getByTestId('margin')).toHaveTextContent('+9');
    expect(screen.getByText('Prendi')).toBeInTheDocument();
  });

  /**
   * La quotazione e' un dato del giocatore, come la squadra: sta nella testata,
   * e fra i numeri grandi restano quelli su cui si decide.
   */
  it('la quotazione sta nella testata, accanto alla squadra', () => {
    render(<PlayerDecisionCard valuation={VALUATION} stale={false} />);
    const header = screen.getByRole('heading', { name: VALUATION.name }).closest('header')!;
    expect(within(header).getByTestId('list-price')).toHaveTextContent(String(VALUATION.listPrice));
  });

  it('dice che i numeri li vedi solo tu', () => {
    render(<PlayerDecisionCard valuation={VALUATION} stale={false} />);
    expect(screen.getByText('Lo vedi solo tu')).toBeInTheDocument();
  });

  /**
   * Ogni numero ha la sua etichetta, e l'etichetta e' collegata al numero dalla
   * lista di definizioni — non dalla sola vicinanza sullo schermo. Prima «il tuo
   * tetto» stava in una riga insieme a mercato e margine, stessa taglia e stesso
   * colore: quale dei numeri fosse il tetto non si capiva.
   */
  it('lega ogni numero alla sua etichetta: il tetto e il primo dd de il tuo tetto', () => {
    const { container } = render(<PlayerDecisionCard valuation={VALUATION} stale={false} />);
    const lista = container.querySelector('dl')!;
    const voci = [...lista.children].map((el) => el.textContent?.trim());

    // dt seguito dal suo dd, nell'ordine in cui si leggono ad alta voce. La
    // quotazione non e' piu' qui: e' nella testata, accanto alla squadra.
    expect(voci[0]).toBe('il tuo tetto, fin qui conviene');
    expect(voci[1]).toContain('47');
    expect(voci[2]).toBe('mercato');
    expect(voci[3]).toBe('38');
    expect(voci[4]).toBe('margine');
    expect(voci[5]).toBe('+9');
  });

  it('quando non conviene mostra Lascia e la ragione', () => {
    render(
      <PlayerDecisionCard
        valuation={{ ...VALUATION, worthPursuing: false, margin: -4, maxBid: 11 }}
        stale={false}
      />,
    );
    expect(screen.getByText('Lascia')).toBeInTheDocument();
    expect(screen.getByTestId('margin')).toHaveTextContent('−4');
  });

  it('quando il dato e stantio si segnala come tale', () => {
    render(<PlayerDecisionCard valuation={VALUATION} stale />);
    expect(screen.getByTestId('decision-card')).toHaveAttribute('data-stale', 'true');
    // Il tetto resta leggibile: serve ancora. Cio' che cade e' la pretesa
    // che sia aggiornato.
    expect(screen.getByTestId('max-bid')).toHaveTextContent('47');
  });

  it('quando il dato e stantio espone un avviso per lo screen reader', () => {
    render(<PlayerDecisionCard valuation={VALUATION} stale />);
    expect(
      screen.getByText('I valori mostrati non sono più aggiornati.'),
    ).toBeInTheDocument();
  });

  it('espone la scheda come regione raggiungibile per nome accessibile', () => {
    render(<PlayerDecisionCard valuation={VALUATION} stale={false} />);
    expect(screen.getByRole('region', { name: 'Bastoni' })).toBeInTheDocument();
  });

  it('quando non conviene mostra anche il perche, walkAwayReason', () => {
    render(
      <PlayerDecisionCard
        valuation={{ ...VALUATION, worthPursuing: false, margin: -4, maxBid: 11 }}
        stale={false}
      />,
    );
    expect(
      screen.getByText('oltre 47 il completamento perde più di quanto guadagni'),
    ).toBeInTheDocument();
  });

  it('quando conviene non mostra walkAwayReason: non e la ragione per prendere', () => {
    render(<PlayerDecisionCard valuation={VALUATION} stale={false} />);
    expect(
      screen.queryByText('oltre 47 il completamento perde più di quanto guadagni'),
    ).not.toBeInTheDocument();
  });

  /**
   * I controlli si premono guardando il tavolo, non lo schermo: un bersaglio che
   * scende di una riga passando da un giocatore da prendere a uno da lasciare e'
   * un clic sbagliato che aspetta di succedere. Lo spazio della spiegazione e'
   * riservato sempre, anche vuoto.
   */
  it('lo spazio della spiegazione resta riservato anche quando non c\'e: i controlli non si spostano', () => {
    // jsdom non calcola il layout, quindi qui non si misurano pixel: cio' che si
    // puo' verificare — ed e' il contratto — e' che il riquadro ad altezza fissa
    // sia LO STESSO elemento nei due verdetti, vuoto o pieno, invece di un
    // blocco che compare e scompare portandosi dietro i bottoni.
    const slot = () => screen.getByTestId('decision-card').querySelector('.h-10');

    const { rerender } = render(<PlayerDecisionCard valuation={VALUATION} stale={false} />);
    expect(slot()).not.toBeNull();
    expect(slot()).toHaveTextContent('');

    rerender(
      <PlayerDecisionCard
        valuation={{ ...VALUATION, worthPursuing: false, margin: -4, maxBid: 11 }}
        stale={false}
      />,
    );
    expect(slot()).toHaveTextContent('oltre 47 il completamento perde più di quanto guadagni');
  });

  /**
   * Il dato stantio attenua la VALUTAZIONE, non i controlli. Prima l'attenuazione
   * stava sulla card e colpiva ogni figlio diretto, compreso il piede: il bottone
   * Aggiudica, che quando il dato e' stantio e' gia' disabilitato al 50%, finiva
   * al 30% — sotto il contrasto minimo richiesto a un controllo. Il bordo
   * tratteggiato e l'avviso sr-only bastano a dire che il dato e' vecchio.
   */
  it('quando il dato e stantio non attenua i controlli del piede', () => {
    render(
      <PlayerDecisionCard valuation={VALUATION} stale>
        <button type="button">Aggiudica</button>
      </PlayerDecisionCard>,
    );

    const attenuato = (el: HTMLElement | null) => {
      for (let node = el; node; node = node.parentElement) {
        if (node.className.toString().includes('opacity-60')) return true;
      }
      return false;
    };

    expect(attenuato(screen.getByTestId('max-bid'))).toBe(true);
    expect(attenuato(screen.getByRole('button', { name: 'Aggiudica' }))).toBe(false);
  });

  /**
   * Dentro il riquadro del banco la card non porta cornice propria: due bordi
   * concentrici dello stesso colore erano solo rumore attorno al numero che conta.
   * Il contenuto, invece, resta identico.
   */
  it('senza cornice propria non disegna bordo ne fondo, ma dice le stesse cose', () => {
    const { rerender } = render(<PlayerDecisionCard valuation={VALUATION} stale={false} />);
    expect(screen.getByTestId('decision-card').className).toContain('border');

    rerender(<PlayerDecisionCard valuation={VALUATION} stale={false} bare />);
    const card = screen.getByTestId('decision-card');
    expect(card.className).not.toContain('border');
    expect(card.className).not.toContain('bg-surface');
    expect(screen.getByTestId('max-bid')).toBeInTheDocument();
  });
});
