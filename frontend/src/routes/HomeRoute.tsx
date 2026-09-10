import { Link, useNavigate } from 'react-router-dom';
import { AppShell } from '../AppShell';
import { ProblemError } from '../api/client';
import { useAuctions, useSelectAuction } from '../api/hooks';
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
  const navigate = useNavigate();

  const selectError = select.error instanceof ProblemError ? select.error.detail : null;

  function resume(id: string) {
    select.mutate(id, { onSuccess: () => navigate('/asta') });
  }

  return (
    <AppShell>
      <h1 className="w-exp text-xl font-extrabold">Le tue aste</h1>

      {auctions.data?.length === 0 ? (
        <div className="mt-4">
          <EmptyState>
            Nessuna asta ancora. Cominciane una: partecipanti e regole di punteggio
            vengono copiati dentro, e non cambieranno più.
          </EmptyState>
        </div>
      ) : null}

      <ul className="mt-4 space-y-2">
        {(auctions.data ?? []).map((a) => (
          <li key={a.id} className="flex items-center gap-4 border border-line p-4">
            <div className="min-w-0">
              <p className="font-bold">{a.label}</p>
              <p className="text-sm text-muted-foreground">
                {a.lastWritten ? QUANDO.format(new Date(a.lastWritten)) : 'mai scritta'}
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

      {selectError ? (
        // role="alert", non un secondo role="status": l'unica live region
        // ambientale della pagina resta AuctionAnnouncer (dentro AuctionRoute).
        <p role="alert" className="mt-4 text-sm font-bold text-destructive">
          {selectError}
        </p>
      ) : null}

      {/*
        "Nuova asta" porta alle impostazioni e non crea niente: l'asta nasce quando le
        impostazioni vengono confermate. Creare qui lascerebbe dietro aste vuote per chi
        si ferma alla schermata di conferma — e' gia' successo, ed e' il motivo per cui
        il flusso e' fatto cosi'.
      */}
      <Link
        to="/impostazioni"
        className="mt-6 inline-flex min-h-11 items-center border border-line-strong px-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        Nuova asta
      </Link>
    </AppShell>
  );
}
