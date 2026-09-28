import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PhaseRowView } from '../api/types';
import { PlayerTable } from './PlayerTable';

const ROWS: PhaseRowView[] = [
  {
    id: 'd1', name: 'Dimarco', team: 'INT', role: 'D', listPrice: 21,
    maxBid: 29, expectedPrice: 22, margin: 7, fantamediaAttesa: 6.8, titolaritaPercent: 88,
  },
  {
    id: 'd2', name: 'Gatti', team: 'JUV', role: 'D', listPrice: 16,
    maxBid: 11, expectedPrice: 15, margin: -4, fantamediaAttesa: 6.1, titolaritaPercent: 74,
  },
];

describe('PlayerTable', () => {
  /**
   * A bloccare la selezione e' il conto alla rovescia in corso — un lotto alla
   * volta — e l'avviso deve nominare quello: «il battitore» non e' un controllo
   * che chi ascolta possa trovare in pagina, e non e' nemmeno la parola giusta.
   */
  it('a selezione bloccata dice di chiudere il conto alla rovescia', () => {
    render(<PlayerTable rows={ROWS} selectedId={null} onSelect={() => {}} disabled />);
    expect(
      screen.getByText('Selezione bloccata: chiudi il conto alla rovescia per scegliere un altro giocatore.'),
    ).toBeInTheDocument();
  });

  /**
   * Il colore marca l'ECCEZIONE, non la regola. Prima ogni tetto era colorato —
   * rosso fuori portata, giallo raggiungibile — e la colonna diventava un muro di
   * caldo in cui le due tinte, a 14px su verde scuro, si distinguevano a fatica.
   * Colorare il caso normale vuol dire non colorare niente: il raggiungibile resta
   * del colore del testo, e il rosso torna a voler dire qualcosa.
   */
  it('colora solo il tetto fuori portata, non quello raggiungibile', () => {
    render(<PlayerTable rows={ROWS} selectedId={null} onSelect={() => {}} />);
    // Gatti: margine −4, il mercato lo paga oltre il tuo tetto.
    expect(screen.getByTestId('maxbid-d2')).toHaveClass('text-destructive');
    // Dimarco: margine +7, alla tua portata. Niente colore, niente accento.
    expect(screen.getByTestId('maxbid-d1')).not.toHaveClass('text-accent');
    expect(screen.getByTestId('maxbid-d1')).not.toHaveClass('text-destructive');
  });

  /**
   * Accanto, «Occasioni della fase» dichiara il proprio criterio («su cui guadagni
   * di piu' rispetto al mercato») e mostra altri nomi. Senza dire il suo, questa
   * tabella sembrava contraddirla: i giocatori consigliati non erano in cima e non
   * si capiva perche'. L'ordine e' voluto — e' quello in cui i giocatori vengono
   * chiamati in asta — e va detto a chi guarda, non solo a chi ascolta.
   */
  it('dichiara il proprio ordine, visibile e non solo per chi ascolta', () => {
    const { container } = render(<PlayerTable rows={ROWS} selectedId={null} onSelect={() => {}} />);
    const caption = container.querySelector('caption')!;
    expect(caption).toHaveTextContent(/dal più quotato/i);
    expect(caption).not.toHaveClass('sr-only');
  });

  /**
   * Il motore restituisce tetto 0 quando NESSUN prezzo, nemmeno uno, lascia un
   * guadagno: non e' una cifra bassa, e' l'assenza di una cifra. Messo in colonna
   * con 23 e 22, lo zero si leggeva come un prezzo — e per giunta come il prezzo
   * piu' conveniente della tabella. La parola dice quello che il numero non diceva.
   */
  it('un tetto inesistente si legge come parola, non come zero', () => {
    const rows = [{ ...ROWS[0], id: 'z1', name: 'Martinez', maxBid: 0, margin: -17 }];
    render(<PlayerTable rows={rows} selectedId={null} onSelect={() => {}} />);
    const cella = screen.getByTestId('maxbid-z1');
    expect(cella).toHaveTextContent('nessuno');
    expect(cella).not.toHaveTextContent('0');
  });

  /**
   * In una fase intera «nessuno» tocca quasi meta' delle righe: e' la norma, non
   * l'eccezione, e una parola di sette lettere ripetuta undici volte in rosso
   * sovrasta i numeri accanto — che sono l'unica cosa su cui si agisce. Arretra.
   *
   * <p>Il rosso resta a «c'e' un tetto, ma il mercato te lo porta via»: il caso in
   * cui si puo' ancora essere tentati, e un avviso serve. Dove non c'e' proprio
   * niente da fare, l'avviso non ha nessuno da avvisare.
   */
  it('il tetto inesistente arretra, il rosso resta a chi puo ancora tentarti', () => {
    const rows = [
      { ...ROWS[0], id: 'z1', name: 'Martinez', maxBid: 0, margin: -17 },
      { ...ROWS[0], id: 'z2', name: 'Vicario', maxBid: 22, margin: -3 },
    ];
    render(<PlayerTable rows={rows} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByTestId('maxbid-z1')).not.toHaveClass('text-destructive');
    expect(screen.getByTestId('maxbid-z1')).toHaveClass('text-muted-foreground');
    expect(screen.getByTestId('maxbid-z2')).toHaveClass('text-destructive');
  });

  /** Chi ascolta sente la stessa cosa, e una volta sola: «nessuno», non «nessuno, oltre il tetto». */
  it('il tetto inesistente non si porta dietro anche l avviso di superamento', () => {
    const rows = [{ ...ROWS[0], id: 'z1', name: 'Martinez', maxBid: 0, margin: -17 }];
    render(<PlayerTable rows={rows} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByTestId('maxbid-z1')).not.toHaveTextContent(/oltre il tetto/);
  });

  it('e una tabella vera, con intestazione', () => {
    render(<PlayerTable rows={ROWS} selectedId={null} onSelect={() => {}} />);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').length).toBeGreaterThan(3);
    expect(within(table).getAllByRole('row')).toHaveLength(3); // intestazione + 2
  });

  it('incolonna i numeri con le cifre tabulari', () => {
    render(<PlayerTable rows={ROWS} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByTestId('maxbid-d1')).toHaveClass('tnum');
  });

  it('distingue le righe sopra soglia', () => {
    render(<PlayerTable rows={ROWS} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByTestId('row-d2')).toHaveAttribute('data-above-threshold', 'true');
    expect(screen.getByTestId('row-d1')).toHaveAttribute('data-above-threshold', 'false');
  });

  it('seleziona una riga col clic e con la tastiera', async () => {
    const onSelect = vi.fn();
    render(<PlayerTable rows={ROWS} selectedId={null} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button', { name: /Dimarco/ }));
    expect(onSelect).toHaveBeenCalledWith('d1');

    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  // aria-current da solo annuncia "corrente" senza riferimento: chi ascolta
  // sente "Dimarco, bottone, corrente" e non sa corrente di cosa. La
  // correzione vera sta nel nome accessibile del bottone, che dice insieme
  // l'azione e lo stato — non in un attributo di stato in piu' da decifrare.
  // Verifichiamo il nome accessibile, non un attributo: e' quello, non
  // l'attributo, che lo screen reader annuncia per un bottone.
  it('il nome accessibile del bottone dice l azione e, se selezionata, lo stato', () => {
    const { rerender } = render(
      <PlayerTable rows={ROWS} selectedId={null} onSelect={() => {}} />,
    );
    expect(screen.getByRole('button', { name: 'Valuta Dimarco' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Valuta Gatti' })).toBeInTheDocument();

    rerender(<PlayerTable rows={ROWS} selectedId="d1" onSelect={() => {}} />);
    expect(
      screen.getByRole('button', { name: 'Dimarco, selezionato per la valutazione' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Valuta Gatti' })).toBeInTheDocument();
  });

  // Il colore (destructive contro accent) e data-above-threshold non
  // raggiungono chi non vede: un data-* non entra nell'albero di
  // accessibilita' e il colore da solo non e' mai informazione. Il testo
  // nascosto accanto al tetto e' l'equivalente per chi non vede: si legge
  // insieme al numero, non lo sostituisce.
  it('segnala il superamento del tetto anche a chi non vede, non solo col colore', () => {
    render(<PlayerTable rows={ROWS} selectedId={null} onSelect={() => {}} />);
    expect(within(screen.getByTestId('maxbid-d2')).getByText(/oltre il tetto/)).toBeInTheDocument();
    expect(
      within(screen.getByTestId('maxbid-d1')).queryByText(/oltre il tetto/),
    ).not.toBeInTheDocument();
  });

  it('con nessun giocatore invita ad agire invece di restare vuota', () => {
    render(<PlayerTable rows={[]} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText(/Nessun giocatore libero in questa fase/)).toBeInTheDocument();
  });

  // Fix round 1: un lotto alla volta sta sul banco. Senza
  // bloccare la tabella, un clic vagante su un'altra riga mentre il
  // conto alla rovescia corre cambia il giocatore sotto un rilancio in corso —
  // countdown, prezzo accumulato e beep perduti senza preavviso, e la
  // proiezione (che ascolta lo stesso canale) vedrebbe il lotto saltare a
  // meta' asta. Abbandonare un lotto resta un gesto deliberato: si chiude
  // il conto alla rovescia, non si clicca altrove per sbaglio.
  it('quando la selezione e bloccata i bottoni delle righe sono disabilitati e lo dicono a chi ascolta', () => {
    render(<PlayerTable rows={ROWS} selectedId="d1" onSelect={() => {}} disabled />);
    const button = screen.getByRole('button', { name: /Dimarco/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(/conto alla rovescia/i);
  });

  it('quando non e bloccata i bottoni restano normali', () => {
    render(<PlayerTable rows={ROWS} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: /Dimarco/ })).not.toBeDisabled();
  });

  // Il nome del giocatore cominciava esattamente sul bordo sinistro della
  // cornice e la titolarita' finiva su quello destro: le celle avevano solo
  // riempimento verticale. Nella prima colonna il riempimento sta sul bottone,
  // che occupa tutta la cella, non sulla cella stessa.
  it('stacca il testo dai bordi: ogni cella ha il suo riempimento laterale', () => {
    render(<PlayerTable rows={ROWS} selectedId={null} onSelect={() => {}} />);
    screen.getAllByRole('columnheader').forEach((th) => {
      expect(th.className).toContain('px-');
    });
    const row = screen.getByTestId('row-d1');
    expect(within(row).getByRole('button', { name: /Dimarco/ }).className).toContain('px-');
    within(row).getAllByRole('cell').slice(1).forEach((td) => {
      expect(td.className).toContain('px-');
    });
  });

  /**
   * Tre stati nella colonna «Il tuo tetto» — un numero, un numero rosso,
   * «nessuno» — e nessuno dei tre si spiegava. Il colore da solo non e'
   * informazione, e qui non lo era nemmeno per chi il rosso lo distingue: si
   * capiva solo sapendolo gia'.
   */
  it('la legenda dice cosa vuol dire il rosso e cosa vuol dire «nessuno»', () => {
    render(<PlayerTable rows={ROWS} selectedId={null} onSelect={() => {}} />);
    const legenda = screen.getByTestId('player-table-legend');
    expect(legenda).toHaveTextContent(/rosso/i);
    expect(legenda).toHaveTextContent(/nessuno/i);
  });


  /**
   * Tre colonne si ordinano — quotazione, fantamedia attesa, titolarita' — perche'
   * sono le sole che il server sa mettere in fila senza valutare l'intera fase.
   * L'ordine vero lo fa il server: qui si chiede e basta, altrimenti si
   * riordinerebbe la sola pagina che si ha in mano, dicendo una bugia su tutte le
   * altre.
   */
  it('le colonne ordinabili chiedono l ordine, e dicono quello in corso', async () => {
    const onSort = vi.fn();
    render(
      <PlayerTable
        rows={ROWS} selectedId={null} onSelect={() => {}}
        sort="quotazione" dir="desc" onSort={onSort}
      />,
    );

    expect(screen.getByRole('columnheader', { name: /Quotazione/ })).toHaveAttribute('aria-sort', 'descending');
    await userEvent.click(screen.getByRole('button', { name: /Titolarità/ }));
    expect(onSort).toHaveBeenCalledWith('titolarita', 'desc');
  });

  it('richiamare la colonna gia in uso ne rovescia il verso', async () => {
    const onSort = vi.fn();
    render(
      <PlayerTable
        rows={ROWS} selectedId={null} onSelect={() => {}}
        sort="quotazione" dir="desc" onSort={onSort}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Quotazione/ }));
    expect(onSort).toHaveBeenCalledWith('quotazione', 'asc');
  });

  /**
   * «Il tuo tetto» non e' ordinabile, e non va lasciato a sembrare un bottone
   * rotto: nasce da una valutazione completa per riga, e ordinarci sopra vorrebbe
   * dire valutare l'intera fase a ogni pagina. Alla stessa domanda risponde
   * «Occasioni della fase», che e' gia' una classifica per margine.
   */
  it('il tuo tetto non si ordina, e dice dove guardare invece', () => {
    render(
      <PlayerTable
        rows={ROWS} selectedId={null} onSelect={() => {}}
        sort="quotazione" dir="desc" onSort={() => {}}
      />,
    );
    const tetto = screen.getByRole('columnheader', { name: /Il tuo tetto/ });
    expect(within(tetto).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByTestId('player-table-legend')).toHaveTextContent(/Occasioni della fase/);
  });

  /**
   * La didascalia dichiara il criterio dell'elenco. Ordinando per un'altra colonna
   * continuava a dire «dal piu' quotato: l'ordine in cui vengono chiamati» — che a
   * quel punto e' falso, e per giunta e' l'unica riga che spiega perche' i
   * giocatori stanno in quell'ordine.
   */
  it('la didascalia dice l ordine che c e davvero', () => {
    const { rerender } = render(
      <PlayerTable rows={ROWS} selectedId={null} onSelect={() => {}} sort="quotazione" dir="desc" onSort={() => {}} />,
    );
    expect(screen.getByText(/dal più quotato/)).toBeInTheDocument();

    rerender(
      <PlayerTable rows={ROWS} selectedId={null} onSelect={() => {}} sort="titolarita" dir="desc" onSort={() => {}} />,
    );
    expect(screen.queryByText(/dal più quotato/)).not.toBeInTheDocument();
    expect(screen.getByText(/da chi gioca di più/)).toBeInTheDocument();
  });
});
