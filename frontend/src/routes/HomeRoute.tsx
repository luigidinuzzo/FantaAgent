import { useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../AppShell';
import { userMessage } from '../api/client';
import {
  useAuctions,
  useDeleteAuction,
  useDuplicateAuction,
  useLeaveAuction,
  useRenameAuction,
  useSelectAuction,
} from '../api/hooks';
import type { AuctionCard } from '../api/types';
import { AuctionRow } from '../domain/AuctionRow';
import { DeleteAuctionDialog } from '../domain/DeleteAuctionDialog';
import { RenameAuctionDialog } from '../domain/RenameAuctionDialog';
import { PhasePager } from '../domain/PhasePager';
import { Wordmark } from '../domain/Wordmark';

/** Quante aste per pagina: oltre, l'elenco si sfoglia invece di allungarsi. */
const AUCTIONS_PER_PAGE = 5;

/**
 * L'altezza della zona delle righe, fissa: cinque righe da 6.5rem. Il pannello ha
 * la stessa misura con una o cinque aste, mentre carica e al primo accesso, cosi' la
 * pagina non cambia proporzioni.
 */
const ROWS_AREA = 'min-h-[32.5rem]';

/**
 * Il martelletto del banditore: testa con le due ghiere, manico e la base su cui
 * batte. Sagome piene e non tratti: a questa misura il disegno a fil di ferro di
 * prima non si riconosceva come un martello. Decorazione, aria-hidden.
 */
function GavelIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 48 48"
      className="h-14 w-14 shrink-0 text-accent sm:h-20 sm:w-20"
      fill="currentColor"
    >
      <g transform="rotate(-40 22 16)">
        <rect x="10" y="10" width="24" height="12" rx="3" />
        <rect x="8" y="8" width="4" height="16" rx="1.5" />
        <rect x="32" y="8" width="4" height="16" rx="1.5" />
        <rect x="20" y="22" width="4" height="24" rx="2" />
      </g>
      <rect x="2" y="41" width="26" height="4" rx="2" />
      <rect x="6" y="37" width="18" height="4" rx="1.5" opacity="0.6" />
    </svg>
  );
}

/** La lente del campo di ricerca: decorazione, il nome sta nell'aria-label del campo. */
function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </svg>
  );
}

/**
 * I passi del primo accesso: sono davvero una sequenza (si prepara, si chiama, si
 * registra), per questo sono numerati. Le parole sono quelle delle schermate
 * dell'asta — «il tuo tetto», «mercato», il tabellone — cosi' chi li legge qui le
 * ritrova la'.
 */
const HOW_IT_WORKS: Array<{ title: string; text: string }> = [
  {
    title: "Prepari l'asta",
    text: 'Partecipanti, crediti, posti in rosa e punteggio della tua lega: una volta sola.',
  },
  {
    title: 'Chiami il giocatore',
    text: 'Lo cerchi per nome e vedi il prezzo di mercato, il tuo tetto e se conviene prenderlo.',
  },
  {
    title: "Registri l'acquisto",
    text: 'Crediti e rose di tutte le squadre si aggiornano, anche sul tabellone da proiettare.',
  },
];

/**
 * La home: l'elenco delle aste della lega, con un modo per riprenderne una
 * o per cominciarne una nuova. E' la rotta radice — senza di lei il
 * frontend non si apriva mai senza prima passare da un'asta scelta a mano
 * sulle vecchie pagine Thymeleaf.
 */
export function HomeRoute() {
  const auctions = useAuctions();
  const select = useSelectAuction();
  const leave = useLeaveAuction();
  const remove = useDeleteAuction();
  const rename = useRenameAuction();
  const duplicate = useDuplicateAuction();
  // Le aste di cui una modale chiede conferma o un nome, o null a modale chiusa.
  const [toDelete, setToDelete] = useState<AuctionCard | null>(null);
  const [toRename, setToRename] = useState<AuctionCard | null>(null);
  // La conferma dell'ultima copia, detta a chi ascolta e a chi guarda.
  const [notice, setNotice] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  // Un fallimento della lista (background refetch, indipendente da qualunque
  // gesto) e un fallimento di una mutazione (appena tentata dall'utente) sono due
  // condizioni indipendenti. Comporle in un'unica variabile, con l'errore di
  // mutazione che vince perche' e' la risposta al gesto piu' recente, e' quello che
  // tiene un solo role="alert" alla volta: due live region che parlano nello
  // stesso istante si sovrappongono, e uno screen reader ne perde una.
  const loadErrorMessage = auctions.isError
    ? userMessage(auctions.error, "L'elenco delle aste non si è caricato. Riprova.")
    : null;
  const mutationErrorMessage = select.error
    ? userMessage(select.error, "Non è stato possibile aprire l'asta. Riprova.")
    : leave.error
      ? userMessage(leave.error, "Non è stato possibile preparare una nuova asta. Riprova.")
      : duplicate.error
        ? userMessage(duplicate.error, "Non è stato possibile duplicare l'asta. Riprova.")
        : null;
  const alertMessage = mutationErrorMessage ?? loadErrorMessage;

  // L'asta aperta sta in cima, sulla prima pagina: e' quella che si riprende piu'
  // spesso. Le altre restano nell'ordine del server, dalla piu' recente.
  const all: AuctionCard[] = [...(auctions.data ?? [])].sort(
    (a, b) => Number(b.selected) - Number(a.selected),
  );
  const firstRun = auctions.isSuccess && all.length === 0;
  // La ricerca serve quando l'elenco si sfoglia: con cinque aste o meno si vedono
  // gia' tutte, e un campo in piu' sarebbe solo rumore.
  const searchable = all.length > AUCTIONS_PER_PAGE;
  const needle = query.trim().toLocaleLowerCase('it');
  const list = searchable && needle
    ? all.filter((a) => a.label.toLocaleLowerCase('it').includes(needle))
    : all;
  // La pagina non puo' restare oltre l'ultima: dopo una cancellazione che svuota
  // l'ultima pagina si torna a quella prima, invece di mostrare un elenco vuoto.
  const pages = Math.max(1, Math.ceil(list.length / AUCTIONS_PER_PAGE));
  const currentPage = Math.min(page, pages - 1);
  const pageItems = list.slice(
    currentPage * AUCTIONS_PER_PAGE,
    (currentPage + 1) * AUCTIONS_PER_PAGE,
  );
  // Un solo «adesso» per tutte le date relative della stessa schermata.
  const now = new Date();

  function open(id: string) {
    select.mutate(id, { onSuccess: () => navigate('/asta') });
  }

  /**
   * Difetto critico della revisione finale: era un {@code <Link>} semplice verso
   * /impostazioni. Con un'asta aperta ci si arrivava in sola lettura — niente campo
   * per il nome, punteggio bloccato, bottone «Salva» — e confermare chiamava
   * {@code runtime.setParticipants}, RISCRIVENDO i nomi dell'asta in corso invece di
   * cominciarne una nuova. Nessun avviso lo diceva. La versione Thymeleaf (vedi
   * {@code HomeController#create}) chiude sempre l'asta aperta PRIMA di mostrare le
   * impostazioni, proprio per questo; qui va fatto lo stesso, chiamando l'endpoint di
   * uscita e aspettando la sua conferma prima di navigare — non semplicemente
   * cambiando pagina e sperando che la richiesta parta comunque.
   */
  function startNew() {
    leave.mutate(undefined, { onSuccess: () => navigate('/impostazioni') });
  }

  function copy(a: AuctionCard) {
    setNotice(null);
    duplicate.mutate(a.id, {
      onSuccess: () => {
        // Torna alla prima pagina e toglie il filtro: la copia e' la piu' recente,
        // e deve comparire dove chi l'ha chiesta la cerca.
        setQuery('');
        setPage(0);
        setNotice(`Copia di «${a.label}» creata.`);
      },
    });
  }

  let rowsArea: ReactNode;
  if (auctions.isLoading) {
    rowsArea = <LoadingRows />;
  } else if (auctions.isError) {
    // Nessun testo qui: il messaggio (loadErrorMessage) vive nell'unico role="alert"
    // in fondo alla pagina, non duplicato in due posti.
    rowsArea = null;
  } else if (list.length === 0) {
    rowsArea = (
      <div className="flex flex-col items-start gap-3 p-5 sm:p-6">
        <p className="text-base text-muted-foreground">{`Nessuna asta si chiama «${query.trim()}».`}</p>
        <button
          type="button"
          onClick={() => setQuery('')}
          className="min-h-11 rounded-full border border-line-strong px-5 font-bold hover:bg-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          Mostra tutte le aste
        </button>
      </div>
    );
  } else {
    rowsArea = (
      <ul className="divide-y divide-line">
        {pageItems.map((a, i) => (
          <AuctionRow
            // La chiave e' la posizione, non l'id: le righe gia' montate si
            // aggiornano sul posto quando si sfoglia, si cerca o si rilegge
            // l'elenco, e cosi' l'ingresso a cascata (row-enter) si vede una volta
            // sola, alla prima comparsa — non a ogni pagina.
            key={`riga-${i}`}
            auction={a}
            now={now}
            enterIndex={i}
            disabled={select.isPending}
            onOpen={() => open(a.id)}
            actions={[
              { label: 'Rinomina', onSelect: () => { rename.reset(); setToRename(a); } },
              { label: 'Duplica', onSelect: () => copy(a) },
              {
                label: 'Elimina',
                destructive: true,
                onSelect: () => { remove.reset(); setToDelete(a); },
              },
            ]}
          />
        ))}
      </ul>
    );
  }

  return (
    <AppShell chrome="top">
      {/* Colonna alta almeno quanto la finestra (meno barra e padding di main): cosi'
          il marchio sta in fondo alla pagina anche con poco contenuto, invece di
          salire sotto l'ultima riga. Sul telefono il contenuto riempie gia' lo
          schermo: il marchio lo segue. */}
      <div className="flex flex-col md:min-h-[calc(100dvh-var(--header-h)-3rem)]">
          <>
          {/* Il titolo esiste per chi ascolta: la card-eroe sotto e' gia' visivamente
              il punto di partenza della pagina, un h1 visibile qui sopra la
              duplicherebbe. */}
          <h1 ref={headingRef} tabIndex={-1} className="sr-only">Le tue aste</h1>

          {/* Due box uno sotto l'altro, dentro le linee del campo (pitch-frame in
              index.css): cominciano appena sotto la linea di fondo e ne distano ai
              lati quanto in alto. Resta ancorato in alto e non centrato in
              verticale: cosi' «Crea asta» sta sempre nello stesso punto. */}
          <div className="pitch-frame mx-auto flex w-full flex-col gap-6">
            {/* La card-eroe: un bersaglio solo, grande. "Crea asta" chiude PRIMA l'asta
                eventualmente aperta (vedi startNew) e solo dopo va alle impostazioni:
                non crea niente da sola, l'asta nasce quando le impostazioni vengono
                confermate. Fondo un tono piu' chiaro e bordo doppio in accento: e'
                l'unico box della pagina cosi', l'altro e' un pannello. Al primo
                accesso dice cos'e' FantaAgent invece di dare per scontato che si sappia. */}
            <section
              aria-labelledby="home-nuova"
              className="flex flex-wrap items-center gap-5 rounded-2xl border-2 border-accent bg-surface-raised p-6 sm:gap-8 sm:px-10 sm:py-12"
            >
              <GavelIcon />
              <div className="min-w-0 flex-1 basis-64">
                <h2 id="home-nuova" className="w-exp text-2xl font-extrabold leading-tight sm:text-4xl">
                  {firstRun ? 'Prepara la tua prima asta' : 'Comincia una nuova asta'}
                </h2>
                <p className="mt-2 max-w-[60ch] text-base text-muted-foreground sm:text-lg">
                  {firstRun
                    ? "FantaAgent ti affianca all'asta del fantacalcio: per ogni giocatore chiamato vedi quanto lo pagherà il mercato e fin dove conviene spingerti."
                    : 'La prepari in pochi minuti. Poi, a ogni giocatore chiamato, vedi quanto lo pagherà il mercato e fin dove conviene spingerti.'}
                </p>
              </div>
              {/* Giallo: l'azione principale della pagina. Il verde resta per gli
                  stati positivi (un'asta conclusa, la connessione attiva). */}
              <button
                type="button"
                onClick={startNew}
                disabled={leave.isPending}
                className="min-h-14 w-full shrink-0 rounded-full bg-accent px-10 text-lg font-extrabold text-on-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground sm:w-auto"
              >
                {firstRun ? 'Crea la tua prima asta' : 'Crea asta'}
              </button>
            </section>

            {firstRun ? (
              <section aria-labelledby="home-come" className="panel flex min-w-0 flex-col rounded-2xl">
                <h2 id="home-come" className="px-5 pt-5 text-xl font-extrabold sm:px-6 sm:pt-6">
                  Come funziona
                </h2>
                <ol className={`mt-3 grid border-t border-line md:grid-cols-3 ${ROWS_AREA}`}>
                  {HOW_IT_WORKS.map((step, i) => (
                    <li
                      key={step.title}
                      // Centrati in altezza: i passi sono brevi, e in cima alla zona
                      // fissa lasciavano mezzo pannello vuoto sotto.
                      className="flex flex-col justify-center gap-3 border-line p-8 max-md:border-b max-md:last:border-b-0 md:border-r md:last:border-r-0 sm:p-10"
                    >
                      {/* Numeri grandi: sono il disegno del pannello, e con i testi
                          a misura di lettura riempiono la zona fissa invece di
                          galleggiarci in mezzo. */}
                      <span aria-hidden="true" className="tnum w-exp text-7xl font-extrabold leading-none text-accent sm:text-8xl">
                        {i + 1}
                      </span>
                      <h3 className="w-exp mt-2 text-2xl font-extrabold">{step.title}</h3>
                      <p className="max-w-[36ch] text-lg text-muted-foreground">{step.text}</p>
                    </li>
                  ))}
                </ol>
              </section>
            ) : (
              /* Un pannello solo, con le aste in righe separate da una linea.
                 min-w-0: senza, la colonna si allarga fino al contenuto piu' largo di
                 una riga e sul telefono la pagina scorre di lato. */
              <section aria-labelledby="home-riprendi" className="panel flex min-w-0 flex-col rounded-2xl">
                <div className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-2 px-5 pt-5 sm:px-6 sm:pt-6">
                  <h2 id="home-riprendi" className="text-xl font-extrabold">
                    Riprendi un'asta
                  </h2>
                  {notice ? (
                    <p role="status" className="text-sm font-bold text-positive">{notice}</p>
                  ) : null}
                  {searchable ? (
                    <div className="relative ml-auto w-full sm:w-72">
                      <SearchIcon />
                      <input
                        type="search"
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setPage(0); }}
                        aria-label="Cerca un'asta per nome"
                        placeholder="Cerca per nome"
                        className="min-h-11 w-full rounded-full border border-line-strong bg-surface pl-10 pr-4 text-base placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                      />
                    </div>
                  ) : null}
                </div>
                <div data-testid="elenco-aste" className={`mt-3 border-t border-line ${ROWS_AREA}`}>
                  {rowsArea}
                </div>
                {/* In fondo al pannello, staccato dalle righe da una linea. Con una
                    pagina sola il pager non c'e' affatto. */}
                {list.length > AUCTIONS_PER_PAGE ? (
                  <div className="border-t border-line px-4 py-3 [&>nav]:mt-0 [&>nav]:justify-center">
                    <PhasePager
                      offset={currentPage * AUCTIONS_PER_PAGE}
                      pageSize={AUCTIONS_PER_PAGE}
                      total={list.length}
                      hasPrevious={currentPage > 0}
                      hasNext={currentPage < pages - 1}
                      onPrevious={() => setPage(currentPage - 1)}
                      onNext={() => setPage(currentPage + 1)}
                      navLabel="Pagine delle aste"
                      scope="dell'elenco"
                    />
                  </div>
                ) : null}
              </section>
            )}
          </div>

          {alertMessage ? (
            // role="alert", non un secondo role="status": l'unica live region
            // ambientale della pagina resta AuctionAnnouncer (dentro AuctionRoute).
            <p role="alert" className="panel mx-auto mt-4 w-full max-w-7xl rounded-xl p-4 text-sm font-bold text-destructive">
              {alertMessage}
            </p>
          ) : null}

          {/* Gli errori di rinomina e cancellazione non entrano in alertMessage:
              vivono dentro la loro modale, che mentre e' aperta e' l'unico
              role="alert" della pagina. */}
          <RenameAuctionDialog
            key={toRename?.id ?? 'chiusa'}
            auction={toRename}
            pending={rename.isPending}
            error={rename.error
              ? userMessage(rename.error, "Non è stato possibile rinominare l'asta. Riprova.")
              : null}
            onCancel={() => setToRename(null)}
            onConfirm={(id, name) =>
              rename.mutate({ id, name }, { onSuccess: () => setToRename(null) })
            }
          />
          <DeleteAuctionDialog
            auction={toDelete}
            pending={remove.isPending}
            error={remove.error
              ? userMessage(remove.error, "Non è stato possibile eliminare l'asta. Riprova.")
              : null}
            onCancel={() => setToDelete(null)}
            onConfirm={(id) =>
              remove.mutate(id, {
                onSuccess: () => {
                  setToDelete(null);
                  // Il bottone che aveva aperto la modale non esiste piu': il focus
                  // torna all'inizio della pagina invece di perdersi sul body.
                  headingRef.current?.focus();
                },
              })
            }
          />
          </>
      {/* Il marchio in fondo alla pagina, sotto il contenuto, direttamente sul campo:
          l'unica eccezione voluta alla regola «niente testo sull'erba». Piccolo: e'
          una firma, non un secondo titolo, e il marchio c'e' gia' nella barra. */}
      <footer className="mx-auto mt-auto flex flex-col items-center gap-3 pt-10 pb-6">
        <Wordmark size="xl" outlined />
        {/* Chiaro su scuro, al contrario di tutto il resto: e' il blocchetto a dare il
            contrasto. La coppia surface/foreground e' in contrast.test.ts. */}
        <p className="rounded-full bg-foreground px-4 py-1.5 text-sm font-bold text-surface">
          2026, Luigi di Nuzzo
        </p>
      </footer>
      </div>
    </AppShell>
  );
}

/**
 * Cinque righe grigie al posto delle aste mentre arrivano: stessa altezza e stessa
 * griglia delle righe vere, cosi' niente si sposta quando compaiono. Sono
 * decorazione; chi ascolta sente la frase nascosta.
 */
function LoadingRows() {
  return (
    <>
      <p className="sr-only">Carico le aste…</p>
      <ul aria-hidden="true" className="divide-y divide-line">
        {Array.from({ length: AUCTIONS_PER_PAGE }, (_, i) => (
          <li key={i} className="flex min-h-[6.5rem] items-center gap-4 px-4 sm:px-6">
            <span className="h-11 w-11 shrink-0 rounded-xl bg-line" />
            <span className="flex flex-1 flex-col gap-2.5">
              <span className="h-4 w-48 max-w-full rounded-full bg-line" />
              <span className="h-3 w-80 max-w-full rounded-full bg-line" />
            </span>
            <span className="hidden h-11 w-28 rounded-full bg-line sm:block" />
          </li>
        ))}
      </ul>
    </>
  );
}
