import type { BoardColumn, ParticipantView, Role, TargetView, ValuationResponse } from '../api/types';
import { AnalysisPanel } from './AnalysisPanel';
import { MyRoster } from './MyRoster';
import { OnlyYouBadge } from './OnlyYouBadge';
import { PhaseTargets } from './PhaseTargets';

/**
 * La colonna di destra dell'asta: tutto cio' che vedi solo tu. Un pannello solo,
 * alto quanto la griglia, che cambia contenuto e mai forma.
 *
 * <p>A riposo le occasioni della fase e la tua rosa. Col lotto sul banco il perche'
 * del suo prezzo e le alternative, «Invece di lui»: prima stavano nel banco, sotto i
 * bottoni, e ne decidevano l'altezza. Col conto avviato le alternative restano da
 * leggere ma non si scelgono: un lotto alla volta.
 *
 * <p>La proiezione non importa questo file (regola oxlint in .oxlintrc.json, sui
 * componenti che mostra: AnalysisPanel ne e' gia' coperto).
 */
export function AdviceColumn({
  phase, targets, targetsLoading, targetsFailed, selectedId, valuation, bidderOpen, onSelect, me, myColumn,
  className = '',
}: {
  phase: Role | undefined;
  targets: TargetView[];
  targetsLoading: boolean;
  targetsFailed: boolean;
  /** Il giocatore sul banco, o null a riposo. */
  selectedId: string | null;
  /** La sua valutazione, quando e' arrivata. */
  valuation: ValuationResponse | null;
  bidderOpen: boolean;
  onSelect: (playerId: string) => void;
  /** La tua squadra: senza (non dovrebbe capitare a chi ha un posto) niente rosa. */
  me: ParticipantView | undefined;
  /** La tua colonna del tabellone, se e' arrivata. */
  myColumn: BoardColumn | undefined;
  /** Il posto nella griglia di chi la monta (righe e colonne dell'asta). */
  className?: string;
}) {
  return (
    <section aria-labelledby="advice-title" className={`panel flex min-h-0 min-w-0 flex-col overflow-hidden ${className}`}>
      <div className="flex min-h-11 shrink-0 items-center justify-between gap-3 border-b border-line px-4">
        <h2 id="advice-title" className="text-meta font-semibold text-muted-foreground">I tuoi consigli</h2>
        <OnlyYouBadge label="Solo tu" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-4">
        {selectedId === null ? (
          <>
            <PhaseTargets
              framed={false}
              phase={phase}
              targets={targets}
              loading={targetsLoading}
              failed={targetsFailed}
              disabled={bidderOpen}
              onSelect={onSelect}
            />
            {me ? <MyRoster me={me} column={myColumn} /> : null}
          </>
        ) : (
          <>
            <AnalysisPanel bare valuation={valuation} />
            {valuation ? (
              <PhaseTargets
                bare
                stacked
                excludeId={valuation.playerId}
                phase={phase}
                targets={targets}
                loading={targetsLoading}
                failed={targetsFailed}
                disabled={bidderOpen}
                onSelect={onSelect}
              />
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
