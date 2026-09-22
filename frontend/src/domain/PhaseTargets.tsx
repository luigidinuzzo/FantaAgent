import type { Role, TargetView } from '../api/types';
import { signed } from './PlayerDecisionCard';
import { RoleBadge } from './RoleBadge';
import { ROLE_NAME_PLURAL } from './roles';

const HEADING_ID = 'phase-targets-heading';

/**
 * Il pannello dei consigli a battitore vuoto: le occasioni della fase, cioe' i
 * giocatori liberi del ruolo in corso con il margine piu' alto fra il tuo tetto e
 * quanto li paghera' il mercato. Prima qui c'era una frase sola in una colonna
 * alta mezzo schermo.
 *
 * <p>Ogni riga mette il giocatore sul battitore, come una riga della tabella: stessa
 * selezione, nessun secondo percorso. Scelto un giocatore, il pannello torna a
 * spiegarne il prezzo (AnalysisPanel).
 *
 * <p>Stessa cornice e stesso titolo in tutti gli stati — carica, vuoto, pieno — cosi'
 * la colonna non cambia forma mentre i dati arrivano.
 */
export function PhaseTargets({ phase, targets, loading, failed = false, disabled, onSelect }: {
  phase: Role | undefined;
  targets: TargetView[];
  loading: boolean;
  /** Le occasioni non sono arrivate: va detto, non scambiato per «non ce ne sono». */
  failed?: boolean;
  disabled: boolean;
  onSelect: (playerId: string) => void;
}) {
  return (
    <section aria-labelledby={HEADING_ID} className="panel flex min-h-0 flex-col rounded-2xl p-5">
      <h2 id={HEADING_ID} className="shrink-0 text-sm font-bold text-muted-foreground">
        Occasioni della fase
      </h2>
      <p className="mt-1 shrink-0 text-sm text-muted-foreground">
        {phase
          ? `I ${ROLE_NAME_PLURAL[phase]} liberi su cui guadagni di più rispetto al mercato.`
          : 'I giocatori liberi su cui guadagni di più rispetto al mercato.'}
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Cerco le occasioni…</p>
      ) : failed ? (
        // Non un alert: la pagina ha gia' il suo canale per gli errori dei gesti,
        // e questo non e' la risposta a un gesto. Si riprova da solo.
        <p className="mt-4 text-sm text-muted-foreground">
          Le occasioni non si sono caricate. Riprovo tra poco; intanto scegli dalla tabella.
        </p>
      ) : targets.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          In questa fase non restano giocatori liberi. Passa alla fase successiva.
        </p>
      ) : (
        <ol className="mt-3 flex min-h-0 flex-1 flex-col overflow-y-auto">
          {targets.map((t) => (
            <li key={t.id} className="border-b border-line last:border-b-0">
              <button
                type="button"
                onClick={() => onSelect(t.id)}
                disabled={disabled}
                // Il nome comincia col nome visibile (chi comanda a voce dice quello), poi
                // i numeri detti per esteso: il «·» e il segno non si leggono bene.
                aria-label={`${t.name}, ${t.team}: mercato ${t.expectedPrice}, tetto ${t.maxBid}, margine ${signed(t.margin)}`}
                className="flex min-h-14 w-full items-center gap-3 px-1 py-2 text-left hover:bg-line disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <span aria-hidden="true"><RoleBadge role={t.role} /></span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-bold">{t.name}</span>
                  <span className="tnum truncate text-xs text-muted-foreground">
                    {`${t.team} · mercato ${t.expectedPrice} · tetto ${t.maxBid}`}
                  </span>
                </span>
                {/* Il margine, col segno: e' il motivo per cui la riga e' qui. */}
                <span className={`tnum w-exp shrink-0 text-lg font-extrabold ${t.margin >= 0 ? 'text-accent' : 'text-destructive'}`}>
                  {signed(t.margin)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
