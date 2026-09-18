import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '../AppShell';
import { userMessage } from '../api/client';
import { useAuctions, useDeleteAuction, useLeaveAuction, useSelectAuction } from '../api/hooks';
import type { AuctionCard } from '../api/types';
import { DeleteAuctionDialog } from '../domain/DeleteAuctionDialog';
import { EmptyState } from '../domain/EmptyState';
import { ProfilePanel } from '../domain/ProfilePanel';
import type { HomeSection } from '../domain/SideNav';
import { PhasePager } from '../domain/PhasePager';
import { RoleBadge } from '../domain/RoleBadge';
import { Wordmark } from '../domain/Wordmark';
import { ROLE_NAME_PLURAL } from '../domain/roles';

const QUANDO = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

/**
 * L'invito quando non esiste nessuna asta. Solo in quel caso: con aste presenti ma
 * nessuna aperta diceva «Nessuna asta ancora» accanto a un elenco pieno.
 */
const NESSUNA_ASTA_TESTO = 'Nessuna asta ancora. Creane una con «Crea asta».';

/** Quante aste per pagina: oltre, l'elenco si sfoglia invece di allungarsi. */
const AUCTIONS_PER_PAGE = 5;

/** «1 acquisto», «3 acquisti»: il numero e la parola nello stesso nodo di testo. */
function purchasesLabel(n: number): string {
  return n === 1 ? '1 acquisto' : `${n} acquisti`;
}

/** Il martelletto della card-eroe: decorazione, non informazione — aria-hidden. */
function GavelIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 48 48"
      className="h-14 w-14 shrink-0 text-accent"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="6" y="20" width="14" height="8" rx="1.5" transform="rotate(-45 13 24)" />
      <line x1="19" y1="13" x2="27" y2="21" />
      <line x1="10" y1="30" x2="22" y2="42" />
      <line x1="4" y1="40" x2="30" y2="40" />
    </svg>
  );
}

/**
 * La fase in cui l'asta e' rimasta, detta per esteso: una «P» in un cerchio da sola
 * non diceva che fosse una fase. La lettera colorata resta per chi guarda; chi
 * ascolta sente solo «Fase portieri», non anche il singolare di RoleBadge.
 */
function PhaseLabel({ role }: { role: AuctionCard['phase'] }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true">
        <RoleBadge role={role} />
      </span>
      {`Fase ${ROLE_NAME_PLURAL[role]}`}
    </span>
  );
}

/** Il cestino accanto a ogni asta: decorazione, il nome sta nell'aria-label del bottone. */
function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </svg>
  );
}

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
  // L'asta di cui si sta chiedendo conferma, o null a modale chiusa.
  const [toDelete, setToDelete] = useState<AuctionCard | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [page, setPage] = useState(0);
  const navigate = useNavigate();
  // La sezione vive nello stato della pagina, non nell'indirizzo: passare da Asta
  // a Profilo non e' cambiare pagina. Chi arriva da un'altra schermata (la barra
  // laterale delle impostazioni) la porta nello stato della navigazione.
  const location = useLocation();
  const [section, setSection] = useState<HomeSection>(
    (location.state as { section?: HomeSection } | null)?.section ?? 'asta',
  );

  // Un fallimento della lista (background refetch, indipendente da qualunque
  // gesto) e un fallimento di una mutazione (select/leave, appena tentata
  // dall'utente) sono due condizioni indipendenti — niente le esclude a
  // vicenda come invece accade fra select e leave. Comporle in un'unica
  // variabile, con l'errore di mutazione che vince perche' e' la risposta al
  // gesto piu' recente, e' quello che tiene un solo role="alert" alla volta:
  // due live region che parlano nello stesso istante si sovrappongono, e uno
  // screen reader ne perde una.
  const loadErrorMessage = auctions.isError
    ? userMessage(auctions.error, "L'elenco delle aste non si è caricato. Riprova.")
    : null;
  const mutationErrorMessage = select.error
    ? userMessage(select.error, "Non è stato possibile riprendere l'asta. Riprova.")
    : leave.error
      ? userMessage(leave.error, "Non è stato possibile preparare una nuova asta. Riprova.")
      : null;
  const alertMessage = mutationErrorMessage ?? loadErrorMessage;

  const list: AuctionCard[] = auctions.data ?? [];
  const openAuction = list.find((a) => a.selected);
  // La pagina non puo' restare oltre l'ultima: dopo una cancellazione che svuota
  // l'ultima pagina si torna a quella prima, invece di mostrare un elenco vuoto.
  const pages = Math.max(1, Math.ceil(list.length / AUCTIONS_PER_PAGE));
  const currentPage = Math.min(page, pages - 1);
  const pageItems = list.slice(
    currentPage * AUCTIONS_PER_PAGE,
    (currentPage + 1) * AUCTIONS_PER_PAGE,
  );

  function resume(id: string) {
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

  return (
    <AppShell chrome="side" section={section} onSectionChange={setSection}>
      {/* Colonna alta almeno quanto la finestra (meno il padding di main): cosi' il
          marchio sta in fondo alla pagina anche con poco contenuto, invece di salire
          sotto l'ultima riga. Sul telefono la barra sta sopra e il contenuto riempie
          gia' lo schermo: il marchio lo segue. Le due sezioni condividono la stessa
          colonna e lo stesso marchio in fondo. */}
      <div className="flex flex-col md:min-h-[calc(100dvh-3rem)]">
      {section === 'profilo' ? (
        <>
          <h1 className="sr-only">Profilo</h1>
          <ProfilePanel />
        </>
      ) : (
          <>
          {/* Il titolo esiste per chi ascolta: la card-eroe sotto e' gia' visivamente
              il punto di partenza della pagina, un h1 visibile qui sopra la
              duplicherebbe. */}
          <h1 ref={headingRef} tabIndex={-1} className="sr-only">Le tue aste</h1>

          {/* Larghezza limitata e centrata, come il campo dietro, ma ampia quanto il
              campo stesso: i pannelli lo coprono invece di galleggiarci in mezzo.
              Oltre questa misura, su uno schermo molto largo, nome e bottoni di una
              riga finirebbero troppo lontani. La
              colonna destra esiste solo con un'asta aperta: senza, non ha niente di
              vero da dire. */}
          <div
            className={`mx-auto grid w-full gap-6 ${
              openAuction ? 'max-w-[96rem] lg:grid-cols-[1fr_24rem]' : 'max-w-7xl'
            }`}
          >
            {/* min-w-0: senza, la colonna si allarga fino al contenuto piu' largo
                di una riga e sul telefono la pagina scorre di lato. */}
            <div className="min-w-0">
              {/* La card-eroe: un bersaglio solo, grande, in cima alla colonna. "Crea
                  asta" chiude PRIMA l'asta eventualmente aperta (vedi startNew) e solo
                  dopo va alle impostazioni: non crea niente da sola, l'asta nasce quando
                  le impostazioni vengono confermate. Creare qui lascerebbe dietro aste
                  vuote per chi si ferma alla schermata di conferma — e' gia' successo, ed
                  e' il motivo per cui il flusso e' fatto cosi'. */}
              {/* Diversa dalle altre card: fondo un tono piu' chiaro e bordo in
                  accento, cosi' l'invito a cominciare si distingue dall'elenco senza
                  cambiare forma ne' misura. */}
              <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-accent bg-surface-raised p-5 sm:gap-6 sm:p-8">
                <GavelIcon />
                <div className="min-w-0 flex-1">
                  <p className="w-exp text-xl font-extrabold sm:text-2xl">Comincia una nuova asta</p>
                  <p className="mt-2 text-base text-muted-foreground">
                    Scegli partecipanti, regole e punteggio: ogni asta tiene i suoi.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={startNew}
                  disabled={leave.isPending}
                  className="min-h-12 shrink-0 rounded-full bg-positive px-8 text-lg font-extrabold text-on-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  Crea asta
                </button>
              </div>

              {auctions.isLoading ? (
                <p className="panel mt-6 rounded-xl p-4 text-sm text-muted-foreground">Carico le aste…</p>
              ) : auctions.isError ? (
                // Nessun testo qui: il messaggio (loadErrorMessage) vive nell'unico
                // role="alert" in fondo alla pagina, non duplicato in due posti.
                null
              ) : list.length === 0 ? (
                <div className="mt-6">
                  <EmptyState>{NESSUNA_ASTA_TESTO}</EmptyState>
                </div>
              ) : (
                <ul className="mt-6 space-y-3">
                  {pageItems.map((a) => (
                    <li
                      key={a.id}
                      className="panel flex items-center gap-3 rounded-2xl px-4 py-4 sm:gap-4 sm:px-6 sm:py-5"
                    >
                      {/* Il pallino segna solo l'asta in corso, ed e' decorazione: il
                          fatto sta nel testo "In corso". Grigio su tutte le righe non
                          diceva niente. Lo spazio resta, cosi' i nomi si allineano. */}
                      <span
                        aria-hidden="true"
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                          a.selected ? 'bg-positive' : ''
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-lg font-bold">
                          {a.label}
                          {a.selected ? (
                            // Parita' con la home Thymeleaf (che segna la riga con la classe
                            // CSS "sel"), ma raggiungibile anche da chi ascolta: senza questo
                            // testo React non diceva MAI quale asta fosse quella aperta — un
                            // difetto che si aggiunge al critico qui sopra, perche' senza
                            // saperlo e' facile premere "Crea asta" credendo che nessuna
                            // asta sia in corso.
                            <span className="ml-2 text-xs font-bold text-accent">In corso</span>
                          ) : null}
                        </p>
                        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-base text-muted-foreground">
                          <PhaseLabel role={a.phase} />
                          {/* .tnum: la data si confronta riga per riga in colonna, come i
                              numeri qui accanto — senza cifre tabulari non si allinea. Il
                              «·» sta attaccato alla data: andando a capo su uno schermo
                              stretto finiva da solo a inizio riga. */}
                          <span className="tnum whitespace-nowrap">
                            {a.lastWritten ? QUANDO.format(new Date(a.lastWritten)) : 'mai scritta'}
                            {' ·'}
                          </span>
                          {/*
                            Il numero e "acquisti" stanno nello stesso nodo apposta: getByText di
                            Testing Library concatena solo i nodi-testo DIRETTI di un elemento.
                          */}
                          <span className="tnum">{purchasesLabel(a.purchases)}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={select.isPending}
                        onClick={() => resume(a.id)}
                        aria-label={`Riprendi ${a.label}`}
                        // Pieno solo sull'asta in corso: cinque bottoni gialli uguali
                        // competevano con «Crea asta», che e' l'azione principale.
                        className={`ml-auto min-h-11 shrink-0 rounded-full px-4 font-bold disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                          a.selected
                            ? 'bg-accent text-on-accent'
                            : 'border border-line-strong text-foreground hover:bg-line'
                        }`}
                      >
                        Riprendi
                      </button>
                      <button
                        type="button"
                        aria-label={`Elimina ${a.label}`}
                        onClick={() => { remove.reset(); setToDelete(a); }}
                        // ml-2: un po' di distanza da «Riprendi», che sta subito accanto.
                        className="flex h-11 w-11 sm:ml-2 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-line hover:text-destructive focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        <TrashIcon />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {/* In un pannello: il conteggio «1–5 di 7» e' testo, e sull'erba non si
                  legge. Con cinque aste o meno il pager non c'e' affatto. */}
              {list.length > AUCTIONS_PER_PAGE ? (
                <div className="panel mt-3 rounded-2xl px-4 py-3 [&>nav]:mt-0 [&>nav]:justify-center">
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
            </div>

            {/*
              La colonna destra: l'asta aperta, in grande, solo se ce n'e' una. Il nome, il conteggio acquisti e "In corso" NON sono
              ripetuti qui parola per parola come nella riga-pillola sopra: sono la
              stessa asta, quindi lo stesso testo isolato in un nodo apparirebbe due
              volte nella pagina, e getByText (qui e nei test di questo file) si aspetta
              un solo nodo per corrispondenza esatta. Impastare nome e conteggio dentro
              una frase più lunga evita la duplicazione senza nascondere l'informazione.
            */}
            {openAuction ? (
              <aside>
                <div className="panel rounded-2xl p-8">
                  <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                    Asta aperta
                  </p>
                  <p className="mt-2 w-exp text-2xl font-extrabold">
                    Stai continuando {openAuction.label}
                  </p>
                  <p className="mt-3 flex items-center gap-2 text-base text-muted-foreground">
                    <PhaseLabel role={openAuction.phase} />
                  </p>
                  <p className="mt-1 text-base text-muted-foreground">
                    Acquisti finora: <span className="tnum">{openAuction.purchases}</span>
                  </p>
                  {/*
                    Due bottoni "Riprendi" convivono sullo schermo quando un'asta e'
                    aperta (questo e quello della riga-pillola). Il testo visibile puo'
                    restare "Riprendi" in entrambi perche' il contesto attorno lo
                    disambigua a chi guarda — ma chi ascolta per elenco di ruoli sente
                    solo il nome accessibile, senza quel contesto. Un aria-label che
                    ripetesse esattamente "Riprendi {label}" come la riga darebbe due
                    voci identiche (e due bottoni indistinguibili anche per una query
                    per nome nei test): la frase qui e' diversa apposta, e nomina
                    comunque l'asta.
                  */}
                  <button
                    type="button"
                    disabled={select.isPending}
                    onClick={() => resume(openAuction.id)}
                    aria-label={`Riprendi l'asta aperta, ${openAuction.label}`}
                    className="mt-6 min-h-12 w-full rounded-full bg-positive px-4 text-lg font-extrabold text-on-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    Riprendi
                  </button>
                </div>
              </aside>
            ) : null}
          </div>

          {alertMessage ? (
            // role="alert", non un secondo role="status": l'unica live region
            // ambientale della pagina resta AuctionAnnouncer (dentro AuctionRoute).
            <p role="alert" className="panel mt-4 rounded-xl p-4 text-sm font-bold text-destructive">
              {alertMessage}
            </p>
          ) : null}


          {/* L'errore di una cancellazione non entra in alertMessage: vive dentro la
              modale, che mentre e' aperta e' l'unico role="alert" della pagina. */}
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
      )}
      {/* Il marchio in fondo alla pagina, sotto il contenuto, direttamente sul campo:
          l'unica eccezione voluta alla regola «niente testo sull'erba». Il bordo
          nero del marchio e il blocchetto bianco della firma li staccano dal campo e
          dalle linee in gesso che ci passano dietro. */}
      <footer className="mx-auto mt-auto flex flex-col items-center gap-4 pt-12 pb-8">
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
