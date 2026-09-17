import { useId } from 'react';
import type { LeagueRulesView } from '../api/types';
import { RoleBadge } from './RoleBadge';
import { ROLES } from './roles';

/**
 * I quattro numeri di {@code LeagueRules} — crediti, squadre, limiti per ruolo —
 * mostrati in sola lettura, con l'etichetta che dice da dove vengono.
 *
 * <p>Non c'e' nessun controllo qui dentro, apposta: {@code SettingsResponse.rules}
 * non entra mai in {@code SaveSettingsRequest} (il server non lo scrive), quindi un
 * {@code <input disabled>} prometterebbe una modifica futura che non esiste. La
 * provenienza si sente a parole — il gruppo si chiama "Dalla configurazione" — non
 * solo a colpo d'occhio da uno stile diverso.
 */
export function ConfigChips({ rules }: { rules: LeagueRulesView }) {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="space-y-2">
      <h2 id={titleId} className="text-sm font-bold text-muted-foreground">
        Dalla configurazione
      </h2>
      <div className="flex flex-wrap gap-2">
        <span className="tnum inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line-strong px-4 font-extrabold">
          {rules.budget}
          <span className="font-normal text-muted-foreground">crediti</span>
        </span>
        <span className="tnum inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line-strong px-4 font-extrabold">
          {rules.participants}
          <span className="font-normal text-muted-foreground">squadre</span>
        </span>
        {ROLES.map((role) => (
          <span
            key={role}
            className="tnum inline-flex min-h-11 min-w-11 items-center gap-1.5 rounded-full border border-line-strong px-3 font-extrabold"
          >
            <RoleBadge role={role} filled />
            {rules.slots[role]}
          </span>
        ))}
      </div>
    </section>
  );
}
