import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ParticipantView } from '../api/types';
import { MyTeamSummary } from './MyTeamSummary';

const ME: ParticipantView = {
  id: 'anna', name: 'Anna', initial: 'A', me: true,
  budgetRemaining: 310, slotsRemaining: 20,
  filledByRole: { P: 1, D: 2, C: 1, A: 1 },
  slotsByRole: { P: 3, D: 8, C: 8, A: 6 },
};

/**
 * Il tavolo: io piu' sette. Sei avversari interi (500 crediti, 25 posti, nessun
 * portiere) e Bruno, che i tre portieri li ha gia' presi — cosi' «quante squadre
 * cercano ancora un portiere» non coincide col numero degli avversari, e un conto
 * che contasse tutti verrebbe smascherato.
 */
const OTHER = (id: string, name: string): ParticipantView => ({
  id, name, initial: name[0], me: false,
  budgetRemaining: 500, slotsRemaining: 25,
  filledByRole: { P: 0, D: 0, C: 0, A: 0 },
  slotsByRole: { P: 3, D: 8, C: 8, A: 6 },
});

const BRUNO: ParticipantView = {
  ...OTHER('bruno', 'Bruno'),
  budgetRemaining: 380, slotsRemaining: 22,
  filledByRole: { P: 3, D: 0, C: 0, A: 0 },
};

const TAVOLO: ParticipantView[] = [
  ME,
  ...['carla', 'dario', 'elena', 'fabio', 'gina', 'ivo'].map((id) => OTHER(id, id)),
  BRUNO,
];

describe('MyTeamSummary', () => {
  /**
   * La domanda che il pannello a riposo non sapeva rispondere: spingere adesso o
   * aspettare. Dipende da quanti la vogliono ancora e da quanto puo' mettere il
   * piu' ricco di loro — Bruno, che i portieri li ha gia', non conta in nessuno
   * dei due numeri.
   *
   * <p>Lo stesso dato esiste gia' fra i driver dei consigli, ma SOLO con un
   * giocatore sul banco: a riposo spariva proprio mentre si pianifica. I due stati
   * non convivono mai, quindi non e' un doppione.
   */
  it('dice quante squadre cercano ancora il ruolo della fase', () => {
    render(<MyTeamSummary me={ME} participants={TAVOLO} phase="P" freeInPhase={62} />);
    expect(screen.getByTestId('seeking')).toHaveTextContent('6');
  });

  it('dice fin dove puo arrivare la piu ricca fra quelle che lo cercano', () => {
    render(<MyTeamSummary me={ME} participants={TAVOLO} phase="P" freeInPhase={62} />);
    // 500 crediti meno i 24 posti che restano oltre a questo. Bruno e' escluso:
    // i portieri li ha gia' presi e non rilancera' su questo lotto.
    expect(screen.getByTestId('richest')).toHaveTextContent('476');
  });

  /** Quanta scelta resta: i liberi contro i posti che la lega deve ancora riempire. */
  it('dice quanti giocatori liberi restano nella fase e per quanti posti', () => {
    render(<MyTeamSummary me={ME} participants={TAVOLO} phase="P" freeInPhase={62} />);
    expect(screen.getByTestId('free-in-phase')).toHaveTextContent('62');
    // 2 miei (3 meno 1 gia' preso) + 3 per ognuno dei sei interi + 0 di Bruno.
    expect(screen.getByText(/per 20 posti/)).toBeInTheDocument();
  });

  /**
   * La tua media per posto da sola non dice se stai spendendo sopra o sotto il
   * ritmo: accanto a quella del resto del tavolo, si'.
   */
  it('affianca alla tua media per posto quella del tavolo', () => {
    render(<MyTeamSummary me={ME} participants={TAVOLO} phase="P" freeInPhase={62} />);
    // 3380 crediti degli avversari su 172 posti loro: 19,65 per difetto.
    expect(screen.getByText(/il tavolo sta a 19/)).toBeInTheDocument();
  });

  // L'oro va al numero su cui si decide: a riposo sono i tuoi crediti. Gli altri
  // numeri restano bianchi, la gerarchia la fa la taglia.
  it('a riposo solo i tuoi crediti portano l accento', () => {
    const { container } = render(<MyTeamSummary me={ME} participants={TAVOLO} phase="P" freeInPhase={62} />);
    const accented = container.querySelectorAll('dd.text-accent');
    expect(accented).toHaveLength(1);
    expect(accented[0]).toHaveTextContent(String(ME.budgetRemaining));
  });

  // Il banco ha un'altezza decisa: gli ultimi acquisti sono quattro, quanti ne
  // stanno accanto ai numeri senza farlo scorrere.
  it('gli ultimi acquisti sono al massimo quattro', () => {
    const board = {
      auctionId: 'a1', currentPhase: 'P' as const,
      columns: [
        { participantId: 'anna', participantName: 'Anna', me: true, budgetRemaining: 310, slotsRemaining: 20,
          byRole: { P: [
            { seq: 1, playerName: 'Maignan', price: 38 },
            { seq: 3, playerName: 'Sommer', price: 12 },
            { seq: 5, playerName: 'Hernandez', price: 8 },
          ], D: [], C: [], A: [] } },
        { participantId: 'diego', participantName: 'Diego', me: false, budgetRemaining: 400, slotsRemaining: 24,
          byRole: { P: [
            { seq: 2, playerName: 'Svilar', price: 42 },
            { seq: 4, playerName: 'Tomori', price: 15 },
          ], D: [], C: [], A: [] } },
      ],
    };
    render(<MyTeamSummary me={ME} board={board} />);
    expect(within(screen.getByTestId('recent-list')).getAllByRole('listitem').length).toBeLessThanOrEqual(4);
  });

  it('dice crediti, posti liberi e la media per posto arrotondata per difetto', () => {
    render(<MyTeamSummary me={ME} />);
    expect(screen.getByText('310')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    // 310 / 20 = 15.5: al tavolo si conta per difetto.
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('media per posto')).toBeInTheDocument();
  });

  /**
   * I quattro riquadri dei posti per ruolo non vivono piu' qui: le rose complete
   * stanno nella scheda «Rose squadre», che ha lo spazio per leggerle, e in questa
   * colonna sotto i ~1500px si riducevano a 98px l'uno — «1 di 3» andava a capo e
   * «centrocampisti» finiva sotto la pallina del ruolo.
   */
  it('i riquadri dei posti per ruolo non stanno piu qui', () => {
    render(<MyTeamSummary me={ME} participants={TAVOLO} phase="P" freeInPhase={62} />);
    expect(screen.queryByRole('list', { name: 'Posti per ruolo' })).not.toBeInTheDocument();
  });

  it('a rosa completa la media non e zero ma un trattino', () => {
    render(<MyTeamSummary me={{ ...ME, budgetRemaining: 4, slotsRemaining: 0 }} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  /** Gli ultimi acquisti di tutta la lega, dal piu' recente, col nome di chi ha preso. */
  it('mostra gli ultimi acquisti di tutti, dal piu recente', () => {
    const board = {
      auctionId: 'a1', currentPhase: 'P' as const,
      columns: [
        { participantId: 'anna', participantName: 'Anna', me: true, budgetRemaining: 310, slotsRemaining: 20,
          byRole: { P: [{ seq: 1, playerName: 'Maignan', price: 38 }], D: [], C: [], A: [] } },
        { participantId: 'diego', participantName: 'Diego', me: false, budgetRemaining: 400, slotsRemaining: 24,
          byRole: { P: [{ seq: 2, playerName: 'Svilar', price: 42 }], D: [], C: [], A: [] } },
      ],
    };
    render(<MyTeamSummary me={ME} board={board} />);

    const recent = screen.getByRole('region', { name: 'Ultimi acquisti' });
    const items = within(recent).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Svilar');
    expect(items[0]).toHaveTextContent('a Diego');
    expect(items[1]).toHaveTextContent('Maignan');
    expect(items[1]).toHaveTextContent('a te');
  });

  it('senza acquisti lo dice, invece di lasciare la colonna vuota', () => {
    render(<MyTeamSummary me={ME} board={{ auctionId: 'a1', currentPhase: 'P', columns: [] }} />);
    expect(screen.getByText("Ancora nessun acquisto in quest'asta.")).toBeInTheDocument();
  });

  /**
   * La colonna degli ultimi acquisti sta in pagina sempre, vuota o piena: se
   * comparisse alla prima aggiudicazione, i riquadri di ruolo si restringerebbero
   * sotto le mani di chi sta guardando. Le scatole si decidono in anticipo.
   */
  it('la colonna degli ultimi acquisti tiene il suo posto anche vuota', () => {
    const { rerender } = render(
      <MyTeamSummary me={ME} board={{ auctionId: 'a1', currentPhase: 'P', columns: [] }} />,
    );
    expect(screen.getByRole('region', { name: 'Ultimi acquisti' })).toBeInTheDocument();

    rerender(
      <MyTeamSummary
        me={ME}
        board={{
          auctionId: 'a1', currentPhase: 'P',
          columns: [
            { participantId: 'anna', participantName: 'Anna', me: true, budgetRemaining: 310, slotsRemaining: 20,
              byRole: { P: [{ seq: 1, playerName: 'Maignan', price: 38 }], D: [], C: [], A: [] } },
          ],
        }}
      />,
    );
    expect(screen.getByRole('region', { name: 'Ultimi acquisti' })).toBeInTheDocument();
  });

  /**
   * Il registro parte dal titolo e scende: il piu' recente entra in cima e spinge
   * gli altri giu'. Appoggiarlo al fondo della colonna apriva un vuoto FRA il
   * titolo e il primo acquisto — a inizio asta quasi tutta l'altezza del pannello,
   * col titolo sospeso sopra il nulla. Lo spazio che avanza sta in fondo, dove si
   * consuma da solo man mano che gli acquisti arrivano.
   */
  it('gli acquisti partono dal titolo, non dal fondo della colonna', () => {
    render(<MyTeamSummary me={ME} board={{ auctionId: 'a1', currentPhase: 'P', columns: [] }} />);
    const recent = screen.getByRole('region', { name: 'Ultimi acquisti' });
    expect(recent.querySelector('[data-testid="recent-list"]')).not.toHaveClass('mt-auto');
  });

  /** Il piu' recente in cima: si guarda cosa e' appena andato, non cosa ando' per primo. */
  it('il piu recente entra in cima alla lista', () => {
    const board = {
      auctionId: 'a1', currentPhase: 'P' as const,
      columns: [
        { participantId: 'anna', participantName: 'Anna', me: true, budgetRemaining: 310, slotsRemaining: 20,
          byRole: {
            P: [{ seq: 1, playerName: 'Maignan', price: 38 }, { seq: 3, playerName: 'Sommer', price: 12 }],
            D: [], C: [], A: [],
          } },
      ],
    };
    render(<MyTeamSummary me={ME} board={board} />);
    const items = within(screen.getByRole('region', { name: 'Ultimi acquisti' })).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Sommer');
    expect(items[1]).toHaveTextContent('Maignan');
  });
});
