import type { Role, TargetView } from '../api/types';
import { signed } from './PlayerDecisionCard';
import { RoleBadge } from './RoleBadge';
import { ROLE_NAME_PLURAL, ROLE_NAME_SINGULAR } from './roles';

const HEADING_ID = 'phase-targets-heading';

/**
 * Il pannello dei consigli a banco vuoto: le occasioni della fase, cioe' i
 * giocatori liberi del ruolo in corso con il margine piu' alto fra il tuo tetto e
 * quanto li paghera' il mercato. Prima qui c'era una frase sola in una colonna
 * alta mezzo schermo.
 *
 * <p>Ogni riga mette il giocatore sul banco, come una riga della tabella: stessa
 * selezione, nessun secondo percorso. Scelto un giocatore, il pannello torna a
 * spiegarne il prezzo (AnalysisPanel).
 *
 * <p>Stessa cornice e stesso titolo in tutti gli stati — carica, vuoto, pieno — cosi'
 * la colonna non cambia forma mentre i dati arrivano.
 */
export function PhaseTargets({
  phase, targets, loading, failed = false, disabled, onSelect, bare = false, stacked = false, excludeId,
}: {
  phase: Role | undefined;
  targets: TargetView[];
  loading: boolean;
  /** Le occasioni non sono arrivate: va detto, non scambiato per «non ce ne sono». */
  failed?: boolean;
  disabled: boolean;
  onSelect: (playerId: string) => void;
  /**
   * Dentro il banco, sotto i controlli del lotto. Senza cornice propria — il
   * riquadro del banco porta gia' bordo, fondo e titolo, e due cornici
   * concentriche dello stesso colore sono solo rumore — e con un titolo che dice
   * un'altra cosa: li' non e' l'elenco delle occasioni della fase, e' la via
   * d'uscita dal lotto aperto.
   *
   * <p>Riempie il vuoto piu' grande della schermata: con un giocatore sul banco,
   * sotto «Avvia il conto alla rovescia» restavano trecento pixel di niente,
   * proprio nel punto in cui si decide se spingere o lasciare.
   */
  bare?: boolean;
  /**
   * Nel banco, una sotto l'altra invece che affiancate, ognuna con squadra e
   * mercato. Per chi non batte l'asta: sotto la scheda non ci sono il conto alla
   * rovescia e l'aggiudicazione, e una sola fila di pillole lasciava vuoto un
   * terzo del banco. Restano pillole col contorno, non righe di elenco.
   */
  stacked?: boolean;
  /**
   * Il giocatore gia' sul banco: sarebbe un'alternativa a se stesso, e
   * prenderebbe il posto di una vera.
   */
  excludeId?: string;
}) {
  const shown = excludeId === undefined ? targets : targets.filter((t) => t.id !== excludeId);
  return (
    <section
      aria-labelledby={HEADING_ID}
      className={bare ? 'flex min-h-0 flex-col' : 'panel flex min-h-0 flex-col p-5'}
    >
      {/* Nel banco il titolo non arretra: e' la via d'uscita dal lotto aperto, non
          una nota a pie' di pagina. Il criterio gli sta accanto sulla stessa riga —
          dice perche' proprio questi, e non costa una riga a nessuno. */}
      <div className="flex shrink-0 flex-wrap items-baseline gap-x-2">
        {/* Il criterio e' ACCANTO al titolo, non dentro: dentro finirebbe nel nome
            accessibile della sezione, che deve restare il nome corto con cui la si
            chiama — «Invece di lui», non «Invece di lui i portieri liberi che
            rendono di piu'». */}
        <h2
          id={HEADING_ID}
          className={`text-sm ${bare ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'}`}
        >
          {bare ? 'Invece di lui' : 'Occasioni della fase'}
        </h2>
        {bare ? (
          <p className="text-sm text-muted-foreground">
            {phase ? `i ${ROLE_NAME_PLURAL[phase]} liberi che rendono di più` : 'i liberi che rendono di più'}
          </p>
        ) : null}
      </div>
      {/* Il criterio si dichiara solo nella colonna: accanto al lotto aperto c'e'
          gia' il suo margine, e ripeterlo qui sarebbe una riga in meno di elenco. */}
      {bare ? null : (
      <p className="mt-1 shrink-0 text-sm text-muted-foreground">
        {phase
          ? `I ${ROLE_NAME_PLURAL[phase]} liberi su cui guadagni di più rispetto al mercato.`
          : 'I giocatori liberi su cui guadagni di più rispetto al mercato.'}
      </p>
      )}

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Cerco le occasioni…</p>
      ) : failed ? (
        // Non un alert: la pagina ha gia' il suo canale per gli errori dei gesti,
        // e questo non e' la risposta a un gesto. Si riprova da solo.
        <p className="mt-4 text-sm text-muted-foreground">
          Le occasioni non si sono caricate. Riprovo tra poco; intanto scegli dalla tabella.
        </p>
      ) : shown.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {bare
            ? phase
              ? `Non c’è nessun altro ${ROLE_NAME_SINGULAR[phase]} libero: se lo lasci, resti senza.`
              : 'Non c’è nessun altro giocatore libero: se lo lasci, resti senza.'
            : 'In questa fase non restano giocatori liberi. Passa alla fase successiva.'}
        </p>
      ) : (
        <ol
          // Nel banco: tutte le occasioni affiancate, e NIENTE scorrimento.
          //
          // Il difetto che questo chiude: l'elenco era alto una riga sola e il
          // contenuto tre — cinque occasioni, due visibili, tre dietro uno
          // scorrimento che non si annunciava. Uno scorrimento che nasconde senza
          // dirlo non e' una scorciatoia, e' roba persa: chi guarda non sa nemmeno
          // di doverlo cercare. Cinque sono il massimo che l'API restituisce
          // (limit=5), quindi ci stanno tutte in una riga e non c'e' niente da
          // nascondere.
          //
          // Nella colonna dei consigli resta un elenco alto quanto la colonna:
          // li' lo spazio e' stretto e alto, ed e' l'unica cosa in scena.
          className={`mt-3 ${
            bare
              ? stacked
                ? 'grid grid-cols-1 gap-2'
                : 'grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]'
              : 'grid min-h-0 flex-1 auto-rows-min overflow-y-auto'
          }`}
        >
          {shown.map((t) => (
            <li key={t.id} className={bare ? 'min-w-0' : 'border-b border-line'}>
              <button
                type="button"
                onClick={() => onSelect(t.id)}
                disabled={disabled}
                // Il nome comincia col nome visibile (chi comanda a voce dice quello), poi
                // i numeri detti per esteso: il «·» e il segno non si leggono bene.
                aria-label={`${t.name}, ${t.team}: mercato ${t.expectedPrice}, tetto ${t.maxBid}, margine ${signed(t.margin)}`}
                // Nel banco e' una pillola col contorno, come i bottoni squadra del
                // conto alla rovescia: prima erano righe separate da un filetto, e si
                // leggevano come testo invece che come qualcosa da premere.
                className={
                  bare && stacked
                    ? 'flex min-h-11 w-full min-w-0 items-baseline gap-3 rounded-lg border border-control-border px-3 py-2 text-left hover:bg-line disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent'
                    : bare
                    ? 'flex min-h-14 w-full min-w-0 flex-col justify-center rounded-lg border border-control-border px-3 py-1.5 text-left hover:bg-line disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent'
                    : 'flex min-h-14 w-full items-center gap-3 px-1 py-2 text-left hover:bg-line disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent'
                }
              >
                {bare && stacked ? (
                  // Su una riga sola: quattro alternative devono stare tutte nel
                  // banco senza scorrere, e la riga e' larga abbastanza per dire
                  // anche squadra e mercato.
                  <>
                    <span className="shrink-0 font-semibold">{t.name}</span>
                    <span className="tnum min-w-0 truncate text-xs text-muted-foreground">
                      {`${t.team} · mercato ${t.expectedPrice} · tetto ${t.maxBid}`}
                    </span>
                    <span className={`tnum ml-auto shrink-0 font-semibold ${t.margin >= 0 ? 'text-accent' : 'text-destructive'}`}>
                      {signed(t.margin)}
                    </span>
                  </>
                ) : bare ? (
                  <>
                    <span className="flex w-full items-baseline gap-2">
                      <span className="truncate font-semibold">{t.name}</span>
                      {/* Il margine, col segno: e' il motivo per cui questa
                          alternativa e' qui, e l'unico numero su cui si sceglie
                          fra l'una e l'altra. */}
                      <span className={`tnum ml-auto shrink-0 font-semibold ${t.margin >= 0 ? 'text-accent' : 'text-destructive'}`}>
                        {signed(t.margin)}
                      </span>
                    </span>
                    <span className="tnum truncate text-xs text-muted-foreground">
                      {`tetto ${t.maxBid}`}
                    </span>
                  </>
                ) : (
                  <>
                    <span aria-hidden="true"><RoleBadge role={t.role} /></span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{t.name}</span>
                      <span className="tnum truncate text-xs text-muted-foreground">
                        {`${t.team} · mercato ${t.expectedPrice} · tetto ${t.maxBid}`}
                      </span>
                    </span>
                    <span className={`tnum w-exp shrink-0 text-lg font-semibold ${t.margin >= 0 ? 'text-accent' : 'text-destructive'}`}>
                      {signed(t.margin)}
                    </span>
                  </>
                )}
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
