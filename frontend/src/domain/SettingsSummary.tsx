import type { Role, RulesSection, ScoringSection } from '../api/types';
import { RoleBadge } from './RoleBadge';
import { ROLE_NAME_PLURAL, ROLES } from './roles';

/**
 * Regole e punteggio di un'asta aperta, da leggere e non da modificare.
 *
 * <p>Prima erano gli stessi campi della creazione, spenti, con la stessa frase
 * «Asta in corso: … bloccati» ripetuta tre volte: sembravano un modulo rotto. Qui
 * sono valori scritti, con la ragione detta una volta sola da chi li monta.
 */
export function RulesSummary({ rules, teams }: { rules: RulesSection; teams: number }) {
  return (
    <section aria-labelledby="rules-summary" className="rounded-2xl border border-line-strong p-4">
      <h2 id="rules-summary" className="text-base font-bold">Regole della lega</h2>
      <dl className="mt-3 flex flex-wrap gap-x-10 gap-y-4">
        <Value label="Squadre" value={teams} />
        <Value label="Crediti per squadra" value={rules.budget} />
        {ROLES.map((role: Role) => (
          <div key={role} className="flex flex-col-reverse gap-1">
            <dt className="text-sm text-muted-foreground">{`Posti ${ROLE_NAME_PLURAL[role]}`}</dt>
            <dd className="flex items-center gap-2">
              <span aria-hidden="true"><RoleBadge role={role} /></span>
              <span className="tnum w-exp text-2xl font-extrabold">{rules.slots[role]}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const SCORING_VALUES: Array<{ key: keyof ScoringSection; label: string }> = [
  { key: 'assist', label: 'Assist' },
  { key: 'penaltyScored', label: 'Rigore segnato' },
  { key: 'penaltyMissed', label: 'Rigore sbagliato' },
  { key: 'penaltySaved', label: 'Rigore parato' },
  { key: 'yellowCard', label: 'Ammonizione' },
  { key: 'redCard', label: 'Espulsione' },
  { key: 'goalConceded', label: 'Gol subito' },
  { key: 'cleanSheet', label: 'Porta inviolata' },
];

/** «+3», «−0,5», «0»: un punteggio si legge col segno e con la virgola italiana. */
function points(n: number): string {
  const text = Math.abs(n).toLocaleString('it-IT', { maximumFractionDigits: 2 });
  if (n > 0) return `+${text}`;
  if (n < 0) return `−${text}`;
  return text;
}

export function ScoringSummary({ scoring }: { scoring: ScoringSection }) {
  return (
    <section aria-labelledby="scoring-summary" className="rounded-2xl border border-line-strong p-4">
      <h2 id="scoring-summary" className="text-base font-bold">Punteggio</h2>
      <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
        {SCORING_VALUES.map(({ key, label }) => (
          <Row key={key} label={label} value={points(scoring[key] as number)} />
        ))}
        {ROLES.map((role) => (
          <Row
            key={role}
            label={`Gol segnato, ${ROLE_NAME_PLURAL[role]}`}
            value={points(scoring.goalBonus[role])}
          />
        ))}
      </dl>
      <p className="mt-4 text-base">
        {scoring.defenceModifierEnabled
          ? `Modificatore di difesa attivo, con ${scoring.defendersCounted} difensori conteggiati: `
            + scoring.thresholds
              .map((t) => `da ${t.minAverage.toLocaleString('it-IT')} di media ${points(t.bonus)}`)
              .join(', ')
            + '.'
          : 'Modificatore di difesa spento.'}
      </p>
    </section>
  );
}

function Value({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col-reverse gap-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="tnum w-exp text-2xl font-extrabold">{value}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-1.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="tnum font-bold">{value}</dd>
    </div>
  );
}
