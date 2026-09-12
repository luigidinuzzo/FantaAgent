import { Fragment, useState } from 'react';
import { auctionExportUrl, ProblemError } from '../api/client';
import { useAuctionState, useBoard, useVoidPurchase } from '../api/hooks';
import type { BoardColumn, Role } from '../api/types';
import { BG_ROLE_CLASS, ROLE_NAME_PLURAL_CAPITALIZED, ROLES } from './roles';

// Lo stesso fondo pieno di RoleBadge {filled}, ma qui serve come classe a se'
// stante: la fascia della griglia e' un bottone a tutta larghezza, non la
// pillola stretta che RoleBadge disegna altrove (ConfigChips, PhaseSwitcher).
// La coppia di colori e' quella verificata in contrast.test.ts: on-accent
// sopra ciascuno dei quattro role-*, 4.5:1.
const ROLE_BAND_CLASS = BG_ROLE_CLASS;

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
 */
export function RosterGrid() {
  const board = useBoard();
  const state = useAuctionState();
  const voidPurchase = useVoidPurchase();
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

  function toggleSection(key: string) {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div>
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
            className="flex min-h-11 items-center gap-2 border border-line px-3 font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <DownloadIcon />
            Scarica il CSV delle rose
          </a>
        ) : null}
      </div>

      {alertMessage ? (
        // role="alert", non un secondo role="status": l'unica live region
        // ambientale della pagina resta AuctionAnnouncer.
        <p role="alert" className="mb-4 text-sm font-bold text-destructive">
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
        <div className="overflow-x-auto">
          <div className="flex gap-4 pb-1">
            {(board.data?.columns ?? []).map((column) => (
              <RosterColumn
                key={column.participantId}
                column={column}
                capacity={
                  state.data?.participants.find((p) => p.id === column.participantId)
                    ?.slotsByRole
                }
                onVoid={handleVoid}
                pendingSeq={pendingSeq}
                collapsed={collapsed}
                onToggleSection={toggleSection}
              />
            ))}
          </div>
        </div>
      )}
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
      return error.detail;
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
  onVoid,
  pendingSeq,
  collapsed,
  onToggleSection,
}: {
  column: BoardColumn;
  /** Le caselle per ruolo, dalle regole di lega lette da {@code /state}. Assente
   *  finche' quella richiesta non e' ancora tornata: la sezione allora si apre
   *  senza denominatore invece di dividere per zero o mostrare NaN. */
  capacity: Record<Role, number> | undefined;
  onVoid: (seq: number) => void;
  pendingSeq: number | null;
  collapsed: Record<string, boolean>;
  onToggleSection: (key: string) => void;
}) {
  return (
    // w-56 shrink-0: la stessa larghezza fissa delle card di SquadCards.tsx
    // (riga 65), cosi' le due file scorrono in orizzontale allineate colonna
    // per colonna sotto lo stesso participantId, non solo entrambe scorrevoli.
    <section
      aria-labelledby={`roster-${column.participantId}`}
      className="w-56 shrink-0 border border-line p-4"
    >
      <h3 id={`roster-${column.participantId}`} className="flex items-baseline justify-between">
        <span className="font-bold">{column.participantName}</span>
        <span className="tnum w-exp font-bold">
          {column.budgetRemaining}
          <span className="sr-only"> crediti residui</span>
        </span>
      </h3>

      <table className="mt-3 w-full text-sm">
        <caption className="sr-only">Rosa di {column.participantName}</caption>
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th scope="col">Giocatore</th>
            <th scope="col" className="text-right">Prezzo</th>
            <th scope="col">
              <span className="sr-only">Azione</span>
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
          const percent = total > 0 ? Math.round((occupied / total) * 100) : 0;
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
                        'flex min-h-11 w-full items-center justify-between gap-2 px-3 font-bold text-on-accent',
                        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
                        ROLE_BAND_CLASS[role],
                      ].join(' ')}
                    >
                      <span className="flex items-center gap-2">
                        <span aria-hidden="true">{role}</span>
                        <span className="tnum">{percent}%</span>
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
                  <tr key={slot.seq}>
                    <td className="py-1">{slot.playerName}</td>
                    <td className="tnum py-1 text-right text-muted-foreground">
                      {slot.price}
                      <span className="sr-only"> crediti pagati</span>
                    </td>
                    <td className="py-1 text-right">
                      <button
                        type="button"
                        disabled={pendingSeq === slot.seq}
                        onClick={() => onVoid(slot.seq)}
                        aria-label={`Annulla l'acquisto di ${slot.playerName}`}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center px-2 text-muted-foreground disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        <CancelIcon />
                      </button>
                    </td>
                  </tr>
                ))}
                {/* Le righe-slot vuote del mockup: un trattino, e un testo
                    sr-only che dice cosa significa — non solo un buco muto. */}
                {!open ? null : Array.from({ length: empties }, (_, i) => (
                  <tr key={`empty-${i}`}>
                    <td className="py-1 text-muted-foreground">
                      –<span className="sr-only"> posto libero</span>
                    </td>
                    <td className="py-1 text-right text-muted-foreground">–</td>
                    <td />
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
