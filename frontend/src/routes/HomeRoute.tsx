import { useNavigate } from 'react-router-dom';
import { AppShell } from '../AppShell';
import { ProblemError } from '../api/client';
import { useAuctions, useLeaveAuction, useSelectAuction } from '../api/hooks';
import type { AuctionCard } from '../api/types';
import { EmptyState } from '../domain/EmptyState';
import { RoleBadge } from '../domain/RoleBadge';

const QUANDO = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

/**
 * Il testo dell'unico invito a creare un'asta quando non ce n'e' nessuna. Una sola
 * stringa, richiamata sia quando l'elenco e' del tutto vuoto sia (altrove, nella
 * colonna destra) quando esistono aste ma nessuna e' aperta — cosi' non ne nascono
 * due leggermente diverse da tenere d'accordo.
 */
const NESSUNA_ASTA_TESTO =
  'Nessuna asta ancora. Cominciane una: partecipanti e regole di punteggio ' +
  'vengono copiati dentro, e non cambieranno più.';

/** Il martelletto della card-eroe: decorazione, non informazione — aria-hidden. */
function GavelIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 48 48"
      className="h-12 w-12 shrink-0 text-accent"
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
 * La home: l'elenco delle aste della lega, con un modo per riprenderne una
 * o per cominciarne una nuova. E' la rotta radice — senza di lei il
 * frontend non si apriva mai senza prima passare da un'asta scelta a mano
 * sulle vecchie pagine Thymeleaf.
 */
export function HomeRoute() {
  const auctions = useAuctions();
  const select = useSelectAuction();
  const leave = useLeaveAuction();
  const navigate = useNavigate();

  // Un fallimento della lista (background refetch, indipendente da qualunque
  // gesto) e un fallimento di una mutazione (select/leave, appena tentata
  // dall'utente) sono due condizioni indipendenti — niente le esclude a
  // vicenda come invece accade fra select e leave. Comporle in un'unica
  // variabile, con l'errore di mutazione che vince perche' e' la risposta al
  // gesto piu' recente, e' quello che tiene un solo role="alert" alla volta:
  // due live region che parlano nello stesso istante si sovrappongono, e uno
  // screen reader ne perde una.
  const loadErrorMessage = auctions.isError
    ? auctions.error instanceof ProblemError
      ? auctions.error.detail
      : "Errore di rete: l'elenco delle aste non si è caricato. Riprova."
    : null;
  const mutationErrorMessage =
    select.error instanceof ProblemError
      ? select.error.detail
      : leave.error instanceof ProblemError
        ? leave.error.detail
        : null;
  const alertMessage = mutationErrorMessage ?? loadErrorMessage;

  const list: AuctionCard[] = auctions.data ?? [];
  const openAuction = list.find((a) => a.selected);

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
    <AppShell chrome="side">
      {/* Il titolo esiste per chi ascolta: la card-eroe sotto e' gia' visivamente
          il punto di partenza della pagina, un h1 visibile qui sopra la
          duplicherebbe. */}
      <h1 className="sr-only">Le tue aste</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div>
          {/* La card-eroe: un bersaglio solo, grande, in cima alla colonna. "Crea
              asta" chiude PRIMA l'asta eventualmente aperta (vedi startNew) e solo
              dopo va alle impostazioni: non crea niente da sola, l'asta nasce quando
              le impostazioni vengono confermate. Creare qui lascerebbe dietro aste
              vuote per chi si ferma alla schermata di conferma — e' gia' successo, ed
              e' il motivo per cui il flusso e' fatto cosi'. */}
          <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-line-strong bg-[radial-gradient(120%_90%_at_20%_0%,var(--color-surface)_0%,var(--color-background)_75%)] p-6">
            <GavelIcon />
            <div className="min-w-0 flex-1">
              <p className="w-exp text-lg font-extrabold">Comincia una nuova asta</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Partecipanti e regole di punteggio si copiano dentro, e non
                cambieranno più.
              </p>
            </div>
            <button
              type="button"
              onClick={startNew}
              disabled={leave.isPending}
              className="min-h-11 shrink-0 rounded-full bg-positive px-6 font-extrabold text-on-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              Crea asta
            </button>
          </div>

          {auctions.isLoading ? (
            <p className="mt-6 text-sm text-muted-foreground">Carico le aste…</p>
          ) : auctions.isError ? (
            // Nessun testo qui: il messaggio (loadErrorMessage) vive nell'unico
            // role="alert" in fondo alla pagina, non duplicato in due posti.
            null
          ) : list.length === 0 ? (
            <div className="mt-6">
              <EmptyState>{NESSUNA_ASTA_TESTO}</EmptyState>
            </div>
          ) : (
            <ul className="mt-6 space-y-2">
              {list.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-4 rounded-xl border border-line px-4 py-3"
                >
                  {/* Il pallino e' decorazione — il fatto sta nel testo "In corso"
                      qui sotto, non nel colore. */}
                  <span
                    aria-hidden="true"
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                      a.selected ? 'bg-positive' : 'bg-muted-foreground'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">
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
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                      {/* RoleBadge dice gia' la fase, in tutti e due i modi che
                          contano: la lettera colorata per chi vede, il nome
                          per esteso in sr-only per chi ascolta (vedi il suo
                          commento, "'D' letto da un sintetizzatore e' una
                          lettera, non un ruolo"). Un secondo "· fase D" qui
                          non aggiungeva niente per chi vede — la fase era gia'
                          in vista — e per chi ascolta ripeteva la fase una
                          seconda volta, stavolta come lettera nuda e basta:
                          esattamente il difetto che RoleBadge esiste per
                          evitare (revisione finale, finding F). */}
                      <RoleBadge role={a.phase} />
                      {/* .tnum: la data si confronta riga per riga in colonna, come i
                          numeri qui accanto — senza cifre tabulari non si allinea. */}
                      <span className="tnum">
                        {a.lastWritten ? QUANDO.format(new Date(a.lastWritten)) : 'mai scritta'}
                      </span>
                      {' · '}
                      {/*
                        Il numero e "acquisti" stanno nello stesso nodo apposta: non e' una
                        necessita' di accessibilita' (l'accessible name unisce comunque il
                        testo di tutti i discendenti) ma di test — getByText di Testing
                        Library concatena solo i nodi-testo DIRETTI di un elemento, saltando
                        quelli dentro un figlio-elemento. Con <span>{a.purchases}</span>
                        seguito da testo "acquisti" fuori dallo span, nessun nodo avrebbe
                        contenuto la stringa intera "3 acquisti" da trovare.
                      */}
                      <span className="tnum">{a.purchases} acquisti</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={select.isPending}
                    onClick={() => resume(a.id)}
                    aria-label={`Riprendi ${a.label}`}
                    className="ml-auto min-h-11 shrink-0 rounded-full bg-accent px-4 font-bold text-on-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground"
                  >
                    Riprendi
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/*
          La colonna destra: l'asta aperta, in grande, oppure l'invito a
          cominciarne una. Il nome, il conteggio acquisti e "In corso" NON sono
          ripetuti qui parola per parola come nella riga-pillola sopra: sono la
          stessa asta, quindi lo stesso testo isolato in un nodo apparirebbe due
          volte nella pagina, e getByText (qui e nei test di questo file) si aspetta
          un solo nodo per corrispondenza esatta. Impastare nome e conteggio dentro
          una frase più lunga evita la duplicazione senza nascondere l'informazione.
        */}
        <aside>
          {openAuction ? (
            <div className="rounded-2xl border border-line-strong bg-surface p-6">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Asta aperta
              </p>
              <p className="mt-2 w-exp text-xl font-extrabold">
                Stai continuando {openAuction.label}
              </p>
              <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                {/* Stessa ragione della riga-pillola sopra: RoleBadge dice
                    gia' la fase in entrambi i modi (lettera colorata, nome
                    per esteso in sr-only). "fase D" qui ripeteva la lettera
                    nuda una seconda volta (revisione finale, finding F). */}
                <RoleBadge role={openAuction.phase} />
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
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
                className="mt-4 min-h-11 w-full rounded-full bg-positive px-4 font-extrabold text-on-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                Riprendi
              </button>
            </div>
          ) : list.length === 0 ? (
            // Deviazione dichiarata dal brief: qui andrebbe un secondo EmptyState
            // ("altrimenti l'EmptyState esistente"), ma quando la lista e' del
            // tutto vuota il ramo sopra (list.length === 0, colonna sinistra) mostra
            // gia' lo stesso EmptyState con lo stesso testo — ripeterlo qui
            // produrrebbe due nodi identici, ambigui per getByText nei test.
            // Null e' la scelta deliberata per questo solo caso; con aste presenti
            // ma nessuna aperta, l'EmptyState sotto resta invece quello del brief.
            null
          ) : (
            <EmptyState>{NESSUNA_ASTA_TESTO}</EmptyState>
          )}
        </aside>
      </div>

      {alertMessage ? (
        // role="alert", non un secondo role="status": l'unica live region
        // ambientale della pagina resta AuctionAnnouncer (dentro AuctionRoute).
        <p role="alert" className="mt-4 text-sm font-bold text-destructive">
          {alertMessage}
        </p>
      ) : null}
    </AppShell>
  );
}
