import { Fragment, useEffect, useRef, useState } from 'react';
import { auctionExportUrl, ProblemError, userMessage } from '../api/client';
import { useAuctionState, useBoard, useCorrectPurchase, useVoidPurchase } from '../api/hooks';
import type { BoardColumn, Role } from '../api/types';
import { CorrectPurchaseDialog } from './CorrectPurchaseDialog';
import type { CorrectablePurchase } from './CorrectPurchaseDialog';
import { FIELD } from './controls';
import { ROLE_NAME_PLURAL_CAPITALIZED, ROLES } from './roles';

/**
 * La fascia di ruolo, leggera: un filo del colore del ruolo a sinistra e la lettera
 * colorata, su un fondo appena piu' chiaro. Prima era una barra piena a tutta
 * larghezza, quattro per colonna: in una griglia di otto squadre erano trentadue
 * rettangoli colorati che coprivano i nomi.
 */
const ROLE_BAND_CLASS: Record<Role, string> = {
  P: 'border-role-p', D: 'border-role-d', C: 'border-role-c', A: 'border-role-a',
};
/**
 * L'altezza di ogni riga della rosa, uguale che il posto sia pieno o vuoto: una
 * riga con un giocatore porta anche il bottone di annullamento ed era piu' alta di
 * una vuota, quindi le colonne delle squadre si sfalsavano appena una comprava.
 * Con un'altezza decisa qui, le righe restano incolonnate fra tutte le squadre.
 */
const ROW_H = 'h-9';

const ROLE_LETTER_CLASS: Record<Role, string> = {
  P: 'text-role-p', D: 'text-role-d', C: 'text-role-c', A: 'text-role-a',
};

/**
 * Vero se il contenuto dell'elemento scorre di lato piu' di quanto si vede, e non
 * e' gia' arrivato in fondo: serve a dire che ci sono altre squadre a destra.
 */
function useMoreToTheRight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    check();
    el.addEventListener('scroll', check, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(check);
    observer?.observe(el);
    return () => {
      el.removeEventListener('scroll', check);
      observer?.disconnect();
    };
  });
  return [ref, more] as const;
}

/**
 * Le rose comprate, con la revoca riga per riga — dove prima viveva
 * {@code RecapRoute}, ora dentro la scheda "Rose squadre" dell'asta.
 *
 * <p>Legge da {@code /board}, che porta gia' esattamente questi dati. Una seconda API
 * che assembla gli stessi eventi sarebbe una seconda verita' da tenere d'accordo con
 * la prima — e {@code /board} sta nel package che la regola ArchUnit tiene lontano
 * dalle valutazioni, quindi questa schermata non puo' mostrare per sbaglio un prezzo
 * consigliato accanto a uno pagato. La griglia dice cosa e' stato speso, non cosa
 * valeva.
 *
 * <p>La capacita' per ruolo (quante caselle esistono, non solo quante sono piene)
 * non e' nel corpo di {@code /board}: {@code BoardColumn} porta solo l'elenco di chi
 * e' stato comprato. E' una regola di lega — la stessa per ogni partecipante — e
 * {@code /state} la porta gia' in {@code ParticipantView.slotsByRole}. Leggerla da li'
 * (uno stesso query client, stessa chiave di cache di {@code AuctionRoute}) non
 * costa una seconda richiesta di rete: la pagina la sta gia' facendo.
 *
 * <p>{@code fill}: nel pannello delle schede dell'asta, da lg in su, la griglia e'
 * alta quanto il pannello e scorre nei due sensi dentro di se'. La tua colonna va
 * per prima e resta ferma a sinistra, i nomi delle squadre restano fermi in alto:
 * scorrendo le rose degli altri si confrontano sempre con la tua. Senza
 * {@code fill} (asta conclusa, chi non ha un posto) la griglia e' quella di sempre.
 *
 * <p>Con {@code fill}, sul telefono, otto colonne una accanto all'altra non si
 * leggono: una squadra alla volta, scelta da un selettore, la tua per prima.
 */
export function RosterGrid({ fill = false }: { fill?: boolean } = {}) {
  const board = useBoard();
  const state = useAuctionState();
  // Revoca e correzione sono dell'amministratore: gli altri vedono le rose e basta.
  // Finche' lo stato non e' arrivato, nessun gesto.
  const admin = state.data?.admin ?? false;
  const voidPurchase = useVoidPurchase();
  const correctPurchase = useCorrectPurchase();
  // L'acquisto aperto nella modale di correzione, o nessuno.
  const [correcting, setCorrecting] = useState<CorrectablePurchase | null>(null);
  // Solo la riga in volo si disabilita: `voidPurchase.isPending` da solo e' un
  // booleano UNICO condiviso da ogni riga di ogni colonna, e disabiliterebbe anche
  // il bottone di un acquisto diverso da quello che si sta annullando.
  const [pendingSeq, setPendingSeq] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const voidError =
    voidPurchase.error instanceof ProblemError ? voidPurchase.error : null;

  // Un solo alert, mai due insieme: stessa disciplina delle impostazioni
  // (SettingsRoute), qui applicata ai due possibili — l'errore della revoca e
  // l'errore di caricamento della board. L'errore della revoca ha la precedenza
  // perche' e' il piu' recente dei due gesti dell'utente.
  const alertMessage = voidError
    ? voidErrorMessage(voidError)
    : board.isError
      ? 'Non riesco a caricare le rose.'
      : null;

  function handleVoid(seq: number) {
    if (!board.data) return;
    // Un gesto alla volta, e un solo alert: l'errore di una correzione
    // precedente non resta appeso accanto all'esito di questa revoca.
    correctPurchase.reset();
    setPendingSeq(seq);
    voidPurchase.mutate(
      // L'asta a cui appartiene questo seq e' quella che LA BOARD ha appena letto,
      // non necessariamente quella del contesto della finestra: una scheda lasciata
      // aperta su un'asta mentre altrove si e' passati a un'altra spedirebbe
      // altrimenti il seq al registro sbagliato — vedi useVoidPurchase.
      { auctionId: board.data.auctionId, seq },
      { onSettled: () => setPendingSeq(null) },
    );
  }

  function openCorrection(purchase: CorrectablePurchase) {
    voidPurchase.reset();
    correctPurchase.reset();
    setCorrecting(purchase);
  }

  function handleCorrect(seq: number, participantId: string, price: number) {
    if (!board.data) return;
    correctPurchase.mutate(
      // Stesso motivo della revoca: il seq e' del registro che LA BOARD ha letto.
      { auctionId: board.data.auctionId, seq, participantId, price },
      { onSuccess: () => setCorrecting(null) },
    );
  }

  const [scrollerRef, moreToTheRight] = useMoreToTheRight<HTMLDivElement>();
  // La tua per prima solo con fill: sort e' stabile, l'ordine delle altre resta
  // quello del tabellone.
  const columns = fill
    ? [...(board.data?.columns ?? [])].sort((a, b) => Number(b.me) - Number(a.me))
    : (board.data?.columns ?? []);

  // Sul telefono, con fill, la squadra in vista: la tua finche' non se ne sceglie
  // un'altra (le colonne sono gia' ordinate con la tua in testa). Se la scelta non
  // e' piu' nel tabellone si torna alla prima, invece di mostrare nessuna rosa.
  const [chosen, setChosen] = useState<string | null>(null);
  const shownId = columns.some((c) => c.participantId === chosen)
    ? chosen
    : columns[0]?.participantId;

  function toggleSection(key: string) {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className={fill ? 'lg:flex lg:h-full lg:min-h-0 lg:flex-col' : undefined}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="sr-only">Rose squadre</h2>

        {board.data ? (
          // <a href download>, non una fetch: e' il browser a dover gestire il
          // salvataggio, e una fetch costringerebbe a costruire un blob per
          // riottenere esattamente cio' che il browser fa da solo. L'auctionId
          // e' quello che LA BOARD ha appena letto, non quello del contesto della
          // finestra — stesso motivo della revoca, vedi handleVoid.
          <a
            href={auctionExportUrl(board.data.auctionId)}
            download
            className="flex min-h-11 items-center gap-2 rounded-lg border border-control-border px-4 font-medium hover:bg-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <DownloadIcon />
            Scarica il CSV delle rose
          </a>
        ) : null}
      </div>

      {alertMessage ? (
        // role="alert", non un secondo role="status": l'unica live region
        // ambientale della pagina resta AuctionAnnouncer.
        <p role="alert" className="mb-4 text-sm font-medium text-destructive">
          {alertMessage}
        </p>
      ) : null}

      {board.isLoading ? (
        <p className="text-sm text-muted-foreground">Carico le rose…</p>
      ) : board.isError ? null : (
        // Una colonna per partecipante, affiancate su una riga sola e non a
        // capo (spec 6.4, mockup asta2.png): e' quello che permette di
        // scorrere una fascia di ruolo e leggere a colpo d'occhio chi ha
        // gia' riempito i portieri. overflow-x-auto e min-w-[16rem] per
        // colonna, non un grid a righe multiple — stesso schema di
        // SquadCards.tsx (la fila di card squadra sopra), cosi' le due file
        // scorrono allineate sotto lo stesso participantId.
        // relative: senza, i testi sr-only (position:absolute) dentro le colonne
        // fuori vista non sono tagliati da questo contenitore e allargano la
        // pagina intera, che scorre di lato.
        // Le colonne si dividono la larghezza che c'e' (almeno 11rem l'una): su uno
        // schermo largo otto squadre stanno tutte in vista, su uno stretto si scorre.
        // Quando ne restano fuori, una sfumatura sul bordo destro e una riga di
        // testo lo dicono: prima le colonne finivano tagliate a meta' senza nessun
        // segno che ce ne fossero altre.
        <div className={`relative ${fill ? 'lg:flex lg:min-h-0 lg:flex-1 lg:flex-col' : ''}`}>
          {fill && columns.length > 0 ? (
            <div className="mb-3 flex flex-col gap-1 lg:hidden">
              <label htmlFor="roster-team-select" className="text-meta font-medium text-muted-foreground">Squadra</label>
              <select
                id="roster-team-select"
                className={FIELD}
                value={shownId ?? ""}
                onChange={(e) => setChosen(e.target.value)}
              >
                {columns.map((c) => (
                  <option key={c.participantId} value={c.participantId}>
                    {c.participantName}{c.me ? ' (tu)' : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {moreToTheRight ? (
            <p className={`mb-2 text-sm text-muted-foreground ${fill ? 'max-lg:hidden' : ''}`}>Scorri di lato per vedere le altre squadre.</p>
          ) : null}
        <div
          ref={scrollerRef}
          className={`relative overflow-x-auto ${fill ? 'lg:min-h-0 lg:flex-1 lg:overflow-auto' : ''}`}
        >
          <div
            // Con fill sul telefono una colonna sola: le tracce delle colonne
            // nascoste, rimaste nel template, farebbero scorrere la pagina su vuoto.
            className={`grid gap-3 pb-1 ${fill ? 'max-lg:grid-cols-1!' : ''}`}
            style={{
              // Per l'amministratore ogni riga porta due gesti, matita e ✕: la
              // colonna si allarga di quanto occupa il secondo, cosi' al nome resta
              // lo spazio di sempre invece di troncarsi alla terza lettera.
              gridTemplateColumns: `repeat(${columns.length}, minmax(${admin ? '13rem' : '11rem'}, 1fr))`,
            }}
          >
            {columns.map((column) => (
              <RosterColumn
                key={column.participantId}
                column={column}
                sticky={fill}
                hiddenOnPhone={fill && column.participantId !== shownId}
                capacity={
                  state.data?.participants.find((p) => p.id === column.participantId)
                    ?.slotsByRole
                }
                admin={admin}
                onVoid={handleVoid}
                onCorrect={openCorrection}
                pendingSeq={pendingSeq}
                collapsed={collapsed}
                onToggleSection={toggleSection}
              />
            ))}
          </div>
        </div>
          {moreToTheRight ? (
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-surface to-transparent ${fill ? 'max-lg:hidden' : ''}`}
            />
          ) : null}
        </div>
      )}

      <CorrectPurchaseDialog
        purchase={correcting}
        participants={(state.data?.participants ?? []).map((p) => ({ id: p.id, name: p.name }))}
        pending={correctPurchase.isPending}
        error={correctPurchase.error
          ? userMessage(correctPurchase.error, 'La correzione non è riuscita. Riprova.')
          : null}
        onConfirm={handleCorrect}
        onCancel={() => { setCorrecting(null); correctPurchase.reset(); }}
      />
    </div>
  );
}

/**
 * I tre rifiuti possibili della revoca dicono cose diverse, e la schermata deve
 * dirle diverse:
 * <ul>
 *   <li>{@code unknown-auction}: la guardia lato server ha rifiutato l'asta
 *       indirizzata — il tab e' stantio, l'asta aperta e' cambiata altrove. Non e'
 *       lo stesso caso di "l'acquisto non c'e' piu'": qui e' l'ASTA a non essere
 *       (piu') quella giusta, e ricaricare la pagina la fa riallineare.
 *   <li>{@code purchase-not-found}: l'acquisto non esiste nel registro giusto —
 *       forse un altro dispositivo l'ha gia' revocato.
 *   <li>{@code purchase-already-revoked}: c'e', ma e' gia' stato annullato —
 *       ripetere il tentativo non servirebbe a niente.
 * </ul>
 */
function voidErrorMessage(error: ProblemError): string {
  switch (error.slug) {
    case 'unknown-auction':
      return "L'asta aperta è cambiata: ricarica la pagina.";
    case 'purchase-not-found':
      return "Quell'acquisto non c'è più: ricarica la pagina.";
    default:
      return userMessage(error, "L'annullamento non è riuscito. Riprova.");
  }
}

/** Una freccia verso un trattino, come tratto vettoriale: mai un'emoji. */
function DownloadIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 2v8" />
      <path d="M4.5 7.5 8 11l3.5-3.5" />
      <path d="M2.5 13.5h11" />
    </svg>
  );
}

/** «✕», ma come tratto vettoriale: il vincolo vuole icone SVG, mai emoji. */
function CancelIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <line x1="3" y1="3" x2="13" y2="13" />
      <line x1="13" y1="3" x2="3" y2="13" />
    </svg>
  );
}

/** Una matita, come tratto vettoriale: mai un'emoji. */
function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.5 2.5l3 3L6 13H3v-3z" />
      <path d="M9 4l3 3" />
    </svg>
  );
}

/** Il chevron che gira secondo {@code open}: tratto vettoriale, mai un'emoji. */
function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

function RosterColumn({
  column,
  capacity,
  admin,
  onVoid,
  onCorrect,
  pendingSeq,
  collapsed,
  onToggleSection,
  sticky,
  hiddenOnPhone,
}: {
  column: BoardColumn;
  /** Le caselle per ruolo, dalle regole di lega lette da {@code /state}. Assente
   *  finche' quella richiesta non e' ancora tornata: la sezione allora si apre
   *  senza denominatore invece di dividere per zero o mostrare NaN. */
  capacity: Record<Role, number> | undefined;
  /** Solo l'amministratore revoca e corregge: per gli altri la riga e' da leggere. */
  admin: boolean;
  onVoid: (seq: number) => void;
  onCorrect: (purchase: CorrectablePurchase) => void;
  pendingSeq: number | null;
  collapsed: Record<string, boolean>;
  onToggleSection: (key: string) => void;
  /** Nel pannello a riempimento: la tua colonna ferma a sinistra, il nome in alto. */
  sticky: boolean;
  /** Sul telefono, con fill, le squadre non scelte dal selettore non si vedono. */
  hiddenOnPhone: boolean;
}) {
  return (
    // La larghezza la decide la griglia di RosterGrid; min-w-0 perche' un nome
    // lungo non allarghi la colonna oltre la sua parte. La tua ha il bordo giallo,
    // come nella colonna delle squadre e nella proiezione.
    <section
      aria-labelledby={`roster-${column.participantId}`}
      // Ferma a sinistra, col fondo pieno: le altre colonne le scorrono sotto.
      className={`min-w-0 rounded-lg border p-3 ${hiddenOnPhone ? 'max-lg:hidden' : ''} ${column.me ? 'border-accent' : 'border-line'} ${
        sticky && column.me ? 'lg:sticky lg:left-0 lg:z-10 lg:bg-surface' : ''
      }`}
    >
      <h3
        id={`roster-${column.participantId}`}
        className={`flex items-baseline justify-between gap-2 ${sticky ? 'lg:sticky lg:top-0 lg:z-[5] lg:bg-surface' : ''}`}
      >
        <span className="truncate font-medium">{column.participantName}</span>
        {/* I crediti con la loro parola accanto: un numero nudo accanto al nome
            si capiva solo sapendolo gia'. */}
        <span className="shrink-0 whitespace-nowrap">
          <span className={`tnum w-exp font-medium ${column.me ? 'text-accent' : ''}`}>{column.budgetRemaining}</span>
          <span className="text-meta text-muted-foreground"> crediti</span>
          <span className="sr-only"> residui</span>
        </span>
      </h3>

      {/* Larghezze fisse: al nome va tutto cio' che prezzo e ✕ non usano, e un
          nome lungo si tronca invece di allargare la tabella oltre la colonna. */}
      <table className="mt-3 w-full table-fixed text-sm">
        <caption className="sr-only">Rosa di {column.participantName}</caption>
        <thead>
          <tr className="text-left text-meta text-muted-foreground">
            <th scope="col">Giocatore</th>
            <th scope="col" className="w-9 text-right">Prezzo</th>
            {/* Senza gesti per chi non e' amministratore: la colonna della ✕ non
                toglie spazio ai nomi. */}
            <th scope="col" className={admin ? 'w-[4.5rem]' : 'w-0'}>
              <span className="sr-only">Azioni</span>
            </th>
          </tr>
        </thead>
        {ROLES.map((role) => {
          const slots = column.byRole[role];
          const total = capacity?.[role] ?? 0;
          const occupied = slots.length;
          // Il totale viene dalla mappa DI QUESTA colonna (capacity), non da
          // un'altra presa a caso: le regole della lega sono condivise, ma la
          // sezione di Bruno non deve dipendere da un partecipante che non e' lui.
          const key = `${column.participantId}-${role}`;
          const open = !collapsed[key];
          const panelId = `roster-panel-${key}`;
          const empties = Math.max(total - occupied, 0);

          return (
            // Due <tbody> fratelli, non uno annidato nell'altro: un <tbody>
            // dentro un altro <tbody> e' HTML non valido, e il parser lo
            // correggerebbe spostandolo altrove, rompendo l'accoppiamento fra
            // il bottone e il suo aria-controls. Un <table> puo' avere piu' di
            // un <tbody>: qui uno e' l'intestazione della sezione (sempre in
            // vista), l'altro e' il pannello che si apre e chiude.
            <Fragment key={role}>
              <tbody>
                <tr>
                  {/* p-0: il colore deve arrivare fino al bordo della cella,
                      non fermarsi dentro un riquadro neutro — pt-3 resta
                      fuori dal bottone solo per staccare una sezione dalla
                      precedente. */}
                  <th scope="colgroup" colSpan={3} className="p-0 pt-3 text-left font-normal">
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={panelId}
                      onClick={() => onToggleSection(key)}
                      className={[
                        'flex min-h-10 w-full items-center gap-2 rounded-r-lg border-l-4 bg-white/[0.04] px-2 font-medium hover:bg-white/[0.08]',
                        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
                        ROLE_BAND_CLASS[role],
                      ].join(' ')}
                    >
                      <span aria-hidden="true" className={ROLE_LETTER_CLASS[role]}>{role}</span>
                      {/* «2 di 3», non «67%»: i posti si contano, non si stimano.
                          Nascosto a chi ascolta, che sente gia' «2 su 3» qui sotto. */}
                      <span aria-hidden="true" className="tnum ml-auto text-sm text-muted-foreground">
                        {`${occupied} di ${total}`}
                      </span>
                      <ChevronIcon open={open} />
                      <span className="sr-only">
                        {ROLE_NAME_PLURAL_CAPITALIZED[role]}, {occupied} su {total}
                      </span>
                    </button>
                  </th>
                </tr>
              </tbody>
              {/* Il <tbody> resta nel DOM anche chiuso (l'id deve esistere
                  per aria-controls), ma le righe si smontano davvero invece
                  di restare solo nascoste: un lettore di schermo che risalga
                  l'albero non deve incontrare "Bastoni" mentre la sezione
                  dice di essere chiusa. */}
              <tbody id={panelId}>
                {!open ? null : slots.map((slot) => (
                  <tr key={slot.seq} className="group">
                    <td className={`${ROW_H} truncate py-0`}>
                      {slot.playerName}
                    </td>
                    <td className={`tnum ${ROW_H} py-0 text-right text-muted-foreground`}>
                      {slot.price}
                      <span className="sr-only"> crediti pagati</span>
                    </td>
                    <td className={`${ROW_H} whitespace-nowrap py-0 text-right`}>
                      {admin ? (
                      <>
                      {/* Accanto alla ✕, con la stessa misura e le stesse regole:
                          compare passando sulla riga o arrivandoci da tastiera, e
                          resta sempre in vista dove non si passa sopra col
                          puntatore. */}
                      <button
                        type="button"
                        disabled={pendingSeq === slot.seq}
                        onClick={() => onCorrect({
                          seq: slot.seq,
                          playerName: slot.playerName,
                          participantId: column.participantId,
                          price: slot.price,
                        })}
                        aria-label={`Correggi l'acquisto di ${slot.playerName}`}
                        className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-muted-foreground opacity-0 hover:bg-line hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent [@media(hover:none)]:opacity-100"
                      >
                        <PencilIcon />
                      </button>
                      <button
                        type="button"
                        disabled={pendingSeq === slot.seq}
                        onClick={() => onVoid(slot.seq)}
                        aria-label={`Annulla l'acquisto di ${slot.playerName}`}
                        // Compare passando sulla riga o arrivandoci da tastiera: prima
                        // era una ✕ sempre visibile accanto a ognuno dei duecento
                        // giocatori, un gesto distruttivo ripetuto su tutta la
                        // griglia. Sui dispositivi senza puntatore che passa sopra
                        // (telefoni, tablet) resta sempre visibile, o non si
                        // raggiungerebbe mai.
                        className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-muted-foreground opacity-0 hover:bg-line hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent [@media(hover:none)]:opacity-100"
                      >
                        <CancelIcon />
                      </button>
                      </>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {/* Le righe-slot vuote del mockup: un trattino, e un testo
                    sr-only che dice cosa significa — non solo un buco muto. */}
                {!open ? null : Array.from({ length: empties }, (_, i) => (
                  <tr key={`empty-${i}`}>
                    <td className={`${ROW_H} py-0 text-muted-foreground`}>
                      –<span className="sr-only"> posto libero</span>
                    </td>
                    <td className={`${ROW_H} py-0 text-right text-muted-foreground`}>–</td>
                    <td className={ROW_H} />
                  </tr>
                ))}
              </tbody>
            </Fragment>
          );
        })}
      </table>
    </section>
  );
}
