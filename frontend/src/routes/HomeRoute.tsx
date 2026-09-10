import { useNavigate } from 'react-router-dom';
import { AppShell } from '../AppShell';
import { ProblemError } from '../api/client';
import { useAuctions, useLeaveAuction, useSelectAuction } from '../api/hooks';
import { EmptyState } from '../domain/EmptyState';

const QUANDO = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

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

  // Un solo alert, mai due insieme: al piu' una delle due mutazioni e' in errore
  // in un dato momento, ma comporle in un'unica variabile tiene la disciplina
  // esplicita invece di lasciarla implicita nel fatto che i due gesti si
  // escludono a vicenda.
  const alertMessage =
    select.error instanceof ProblemError
      ? select.error.detail
      : leave.error instanceof ProblemError
        ? leave.error.detail
        : null;

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
    <AppShell>
      <h1 className="w-exp text-xl font-extrabold">Le tue aste</h1>

      {auctions.isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Carico le aste…</p>
      ) : auctions.isError ? (
        <p role="alert" className="mt-4 text-sm font-bold text-destructive">
          {auctions.error instanceof ProblemError
            ? auctions.error.detail
            : "Errore di rete: l'elenco delle aste non si è caricato. Riprova."}
        </p>
      ) : (auctions.data ?? []).length === 0 ? (
        <div className="mt-4">
          <EmptyState>
            Nessuna asta ancora. Cominciane una: partecipanti e regole di punteggio
            vengono copiati dentro, e non cambieranno più.
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {(auctions.data ?? []).map((a) => (
            <li key={a.id} className="flex items-center gap-4 border border-line p-4">
              <div className="min-w-0">
                <p className="font-bold">
                  {a.label}
                  {a.selected ? (
                    // Parita' con la home Thymeleaf (che segna la riga con la classe
                    // CSS "sel"), ma raggiungibile anche da chi ascolta: senza questo
                    // testo React non diceva MAI quale asta fosse quella aperta — un
                    // difetto che si aggiunge al critico qui sopra, perche' senza
                    // saperlo e' facile premere "Nuova asta" credendo che nessuna
                    // asta sia in corso.
                    <span className="ml-2 text-xs font-bold text-accent">In corso</span>
                  ) : null}
                </p>
                <p className="text-sm text-muted-foreground">
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
                  {' · fase '}
                  {a.phase}
                </p>
              </div>
              <button
                type="button"
                disabled={select.isPending}
                onClick={() => resume(a.id)}
                aria-label={`Riprendi ${a.label}`}
                className="ml-auto min-h-11 bg-accent px-4 font-bold text-on-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground"
              >
                Riprendi
              </button>
            </li>
          ))}
        </ul>
      )}

      {alertMessage ? (
        // role="alert", non un secondo role="status": l'unica live region
        // ambientale della pagina resta AuctionAnnouncer (dentro AuctionRoute).
        <p role="alert" className="mt-4 text-sm font-bold text-destructive">
          {alertMessage}
        </p>
      ) : null}

      {/*
        "Nuova asta" chiude PRIMA l'asta eventualmente aperta (vedi startNew) e solo
        dopo va alle impostazioni: non crea niente da sola, l'asta nasce quando le
        impostazioni vengono confermate. Creare qui lascerebbe dietro aste vuote per chi
        si ferma alla schermata di conferma — e' gia' successo, ed e' il motivo per cui
        il flusso e' fatto cosi'.
      */}
      <button
        type="button"
        onClick={startNew}
        disabled={leave.isPending}
        className="mt-6 inline-flex min-h-11 items-center border border-line-strong px-4 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        Nuova asta
      </button>
    </AppShell>
  );
}
