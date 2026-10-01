import { useEffect, useId, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { AppShell } from '../AppShell';
import { PageFrame } from '../domain/PageFrame';
import { ProblemError, userMessage } from '../api/client';
import { useLeagueName, useLeagueRules, useSaveLeagueRules } from '../api/leagues';
import type { SaveLeagueRulesRequest, SettingsErrors } from '../api/types';
import { FieldErrors } from '../domain/FieldErrors';
import { LeagueRulesFieldset } from '../domain/LeagueRulesFieldset';
import { ScoringFieldset } from '../domain/ScoringFieldset';
import { BidderSummary, RulesSummary, ScoringSummary } from '../domain/SettingsSummary';
import { ROLE_NAME_PLURAL } from '../domain/roles';
import { StepperField } from '../domain/StepperField';
import { SaveBar } from '../domain/SaveBar';
import { SettingsLayout, type SettingsSection } from '../domain/SettingsLayout';

const NO_ERRORS: SettingsErrors = {};

/** Le sezioni del modulo, nell'ordine della pagina: le voci dell'indice. */
const SECTIONS: SettingsSection[] = [
  { id: 'sezione-banditore', label: 'Banditore' },
  { id: 'sezione-regole', label: 'Crediti e posti', shortLabel: 'Crediti' },
  { id: 'sezione-punteggio', label: 'Punteggio' },
];

/** Gli stessi limiti di AuctionSettingsValidator (MIN_SECONDS, MAX_SECONDS). */
const MIN_TIMER_SECONDS = 1;
const MAX_TIMER_SECONDS = 120;

/**
 * Etichette leggibili per le chiavi di campo (task 16). Le righe indicizzate — una
 * riga della tabella soglie, un posto per ruolo — non hanno una voce fissa: la loro
 * forma si riconosce con un'espressione regolare, non elencandole tutte in anticipo,
 * perche' l'indice o l'id non si conoscono prima che arrivi la risposta.
 */
const FIELD_LABELS: Record<string, string> = {
  bidTimerSeconds: 'secondi del conto alla rovescia',
  bidder: 'banditore',
  defendersCounted: 'difensori conteggiati',
  thresholds: 'tabella soglie',
  scoring: 'punteggio',
  assist: 'assist',
  penaltyScored: 'rigore segnato',
  penaltyMissed: 'rigore sbagliato',
  penaltySaved: 'rigore parato',
  yellowCard: 'ammonizione',
  redCard: 'espulsione',
  goalConceded: 'gol subito',
  cleanSheet: 'porta inviolata',
  budget: 'crediti per squadra',
  rules: 'crediti e posti',
};

/**
 * Il nome del campo per il riassunto, non il messaggio: «riga 2 della tabella
 * soglie», non la frase intera che gia' vive accanto al campo.
 *
 * <p>Una chiave che questa funzione non riconosce (un campo aggiunto in futuro, un
 * typo) mostra se stessa cosi' com'e' — non "undefined" — cosi' il riassunto resta
 * onesto sul conto anche per un campo per cui non ha ancora un'etichetta.
 */
function fieldLabel(key: string): string {
  if (key in FIELD_LABELS) return FIELD_LABELS[key];
  const row = /^thresholds\[(\d+)]$/.exec(key);
  if (row) return `riga ${Number(row[1]) + 1} della tabella soglie`;
  const bonus = /^goalBonus\[(.+)]$/.exec(key);
  if (bonus) return `bonus gol ${bonus[1]}`;
  const slot = /^slots\[(P|D|C|A)]$/.exec(key);
  if (slot) return `posti ${ROLE_NAME_PLURAL[slot[1] as 'P' | 'D' | 'C' | 'A']}`;
  return key;
}

/** «3 errori: 1 in crediti per squadra, 2 in punteggio». Il conto e il dove, non l'elenco. */
function errorSummary(errors: SettingsErrors): string | null {
  const keys = Object.keys(errors).filter((k) => errors[k].length > 0);
  if (keys.length === 0) return null;
  const total = keys.reduce((n, k) => n + errors[k].length, 0);
  const parts = keys.map((k) => `${errors[k].length} in ${fieldLabel(k)}`);
  return `${total} ${total === 1 ? 'errore' : 'errori'}: ${parts.join(', ')}.`;
}

/** Un elenco di stringhe, e nient'altro — cio' che ogni chiave di SettingsErrors deve essere. */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function errorsFor(errors: SettingsErrors, key: string): string[] {
  return errors[key] ?? [];
}

/**
 * Restringe {@link ProblemError#body}: la classe porta il corpo indistinto apposta
 * (vedi il commento su di lei), quindi chi legge un 422 di questo endpoint deve
 * verificare da solo che la forma sia quella attesa, con la stessa cautela con cui
 * si legge qualunque JSON arrivato dalla rete — per OGNI chiave, non solo per il
 * primo livello.
 *
 * <p>Restringere un solo livello (verificare che "errors" fosse un oggetto e poi
 * fidarsi del resto) lasciava passare un corpo come
 * {@code {"errors": {"budget": "boom"}}}: {@code errors.budget.length}
 * leggeva la lunghezza della STRINGA "boom" (4), il riassunto diceva «4 errori: 4 in
 * crediti per squadra», e {@link FieldErrors} chiamando {@code .map} su una stringa
 * crashava il render — peggio del silenzio che questo stesso meccanismo esiste per
 * evitare (commit af64cd1).
 *
 * <p>Le chiavi sono di campo, non le quattro sezioni fisse di prima (task 16): non
 * si possono elencare tutte in anticipo (un indice di riga, un ruolo),
 * quindi qui si accetta QUALUNQUE chiave il cui valore sia un elenco di stringhe non
 * vuoto — non solo un sottoinsieme noto — e si scarta il resto della stessa forma
 * sbagliata di prima.
 */
function settingsErrorsOf(body: unknown): SettingsErrors | null {
  if (typeof body !== 'object' || body === null || !('errors' in body)) return null;
  const errors = (body as { errors: unknown }).errors;
  if (typeof errors !== 'object' || errors === null) return null;
  const record = errors as Record<string, unknown>;

  const result: SettingsErrors = {};
  for (const key of Object.keys(record)) {
    const value = record[key];
    if (isStringArray(value) && value.length > 0) {
      result[key] = value;
    }
    // Un valore presente ma della forma sbagliata (non un elenco di stringhe, o
    // vuoto) non entra in `result` — invece di propagare un dato che romperebbe
    // FieldErrors piu' a valle.
  }
  // Un 422 invalid-settings porta sempre almeno un errore vero (e' per questo che
  // il server l'ha mandato): se dopo aver scartato le voci mal formate non ne
  // resta nessuna, il corpo non aveva la forma attesa — e va trattato come tale,
  // cadendo nel ramo generico che mostra almeno il `detail` del problem, non
  // silenziosamente come "nessun errore".
  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Lo spazio sopra una sezione quando ci porta l'indice: la barra in alto e, sotto
 * lg, la fila ferma dell'indice. Senza, il titolo finirebbe dietro di loro.
 */
const ANCHOR = 'scroll-mt-[calc(var(--header-h)+4rem)]';
const SECTION = `panel ${ANCHOR} p-5 md:p-6`;

const TITLE = 'Regole della lega';
const CONTEXT = 'Valgono per le prossime aste. Quelle già create tengono le loro.';

/** Una sezione del modulo: riquadro, titolo, e l'ancora dell'indice. */
function RulesSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-titolo`} className={SECTION}>
      <h2 id={`${id}-titolo`} className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function formOf(data: SaveLeagueRulesRequest): SaveLeagueRulesRequest {
  return { bidder: data.bidder, scoring: data.scoring, rules: data.rules };
}

/**
 * Le regole della lega: banditore, crediti e posti, punteggio con cui nasceranno le
 * prossime aste. L'amministratore le cambia; gli altri membri le leggono. Le aste
 * gia' create non se ne accorgono: tengono le regole con cui sono nate.
 */
export function LeagueRulesRoute() {
  const { leagueId = '' } = useParams();
  const rules = useLeagueRules(leagueId);
  const save = useSaveLeagueRules(leagueId);
  const leagueName = useLeagueName(leagueId);
  const trail = [
    { label: 'Home', to: '/' },
    { label: leagueName ?? 'Lega', to: `/leghe/${leagueId}` },
    { label: 'Regole' },
  ];
  const bidTimerErrorId = useId();
  const bidTimerId = useId();
  const bidderGroupErrorId = useId();

  // Le regole sono un modulo: dal momento in cui si comincia a scrivere, la verita'
  // e' quella digitata, non quella arrivata. Per questo `form` e' stato del client e
  // si riempie una volta sola.
  const [form, setForm] = useState<SaveLeagueRulesRequest | null>(null);
  // Cio' a cui torna Annulla e contro cui si misura «Modifiche non salvate»: i
  // valori con cui il modulo e' stato riempito, poi gli ultimi salvati. Non la
  // lettura in cache, che una rilettura in sottofondo puo' cambiare sotto le mani.
  const [initial, setInitial] = useState<SaveLeagueRulesRequest | null>(null);
  const [errors, setErrors] = useState<SettingsErrors>(NO_ERRORS);
  // Un problem diverso da invalid-settings (rete caduta, errore interno): non ha un
  // campo, ma va detto comunque nello stesso, unico role="alert".
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!rules.data || form) return;
    setForm(formOf(rules.data));
    setInitial(formOf(rules.data));
  }, [rules.data, form]);

  if (rules.isError) {
    return (
      <AppShell chrome="top" trail={trail}>
      <PageFrame>
        <h1 className="sr-only">{TITLE}</h1>
        <p role="alert" className="panel mx-auto max-w-xl p-4 text-sm font-medium text-destructive">
          {userMessage(rules.error, 'Le regole della lega non si sono caricate. Riprova.')}
        </p>
      </PageFrame>
      </AppShell>
    );
  }

  if (!form || !initial || !rules.data) {
    // La stessa cornice della schermata pronta — intestazione, indice, tre sezioni —
    // con la frase nella prima: un pannellino piccolo che un attimo dopo diventa la
    // pagina intera fa sembrare che la pagina cambi due volte.
    return (
      <AppShell chrome="top" trail={trail}>
      <PageFrame>
        <SettingsLayout title={TITLE} context={CONTEXT} sections={SECTIONS} ready={false}>
          <RulesSection id={SECTIONS[0].id} title={SECTIONS[0].label}>
            <p className="flex min-h-24 items-center text-sm text-muted-foreground">Carico le regole della lega…</p>
          </RulesSection>
          <RulesSection id={SECTIONS[1].id} title={SECTIONS[1].label}><div className="min-h-48" /></RulesSection>
          <RulesSection id={SECTIONS[2].id} title={SECTIONS[2].label}><div className="min-h-80" /></RulesSection>
        </SettingsLayout>
      </PageFrame>
      </AppShell>
    );
  }

  const canEdit = rules.data.canEdit;
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const summary = errorSummary(errors) ?? saveError;
  const bidTimerErrors = errorsFor(errors, 'bidTimerSeconds');
  // "bidder" e' grezza: l'intero oggetto manca dal corpo (un client rotto), non un
  // campo preciso — resta a livello di gruppo.
  const bidderGroupErrors = errorsFor(errors, 'bidder');

  function reset() {
    setForm(initial);
    setErrors(NO_ERRORS);
    setSaveError(null);
  }

  function submit() {
    if (!form) return;
    setErrors(NO_ERRORS);
    setSaveError(null);
    save.mutate(form, {
      // Salvate, le regole sono il nuovo punto di partenza: la barra torna a «Tutto
      // salvato».
      onSuccess: (saved) => {
        setForm(formOf(saved));
        setInitial(formOf(saved));
      },
      onError: (error) => {
        if (error instanceof ProblemError && error.slug === 'invalid-settings') {
          const parsed = settingsErrorsOf(error.body);
          // Un corpo che non ha la forma attesa non deve fermarsi qui in
          // silenzio: cade nel ramo generico sotto, che dice il `detail`.
          if (parsed) {
            setErrors(parsed);
            return;
          }
        }
        setSaveError(userMessage(error, 'Il salvataggio non è riuscito. Riprova.'));
      },
    });
  }

  return (
    <AppShell chrome="top" trail={trail}>
      <PageFrame>
        <SettingsLayout
          title={TITLE}
          context={canEdit ? CONTEXT : (
            <>{CONTEXT} <span>Solo l'amministratore della lega può cambiare le regole.</span></>
          )}
          sections={SECTIONS}
          ready
          saveBar={canEdit ? (
            // Un solo alert, col conto e il dove: piu' alert di campo che si
            // popolano insieme se ne mangerebbero tutti tranne uno.
            <SaveBar dirty={dirty} pending={save.isPending} error={summary} saveLabel="Salva le regole"
              onSave={submit} onReset={reset} />
          ) : undefined}
        >
          <RulesSection id="sezione-banditore" title="Banditore">
            {canEdit ? (
              // Legend nascosta: il titolo visibile e' quello della sezione, ma il
              // fieldset resta un group nominato "Banditore" per chi ascolta.
              <fieldset
                className="m-0 grid gap-4 border-0 p-0 sm:grid-cols-2 sm:items-end"
                aria-describedby={bidderGroupErrors.length > 0 ? bidderGroupErrorId : undefined}
              >
                <legend className="sr-only">Banditore</legend>

                <div>
                  <label htmlFor={bidTimerId} className="block text-base">
                    Secondi del conto alla rovescia
                  </label>
                  {/* − e + ai lati del campo: si regola il timer senza tastiera, dentro
                      i limiti che valgono per ogni asta. */}
                  <StepperField
                    id={bidTimerId}
                    value={form.bidder.bidTimerSeconds}
                    onChange={(bidTimerSeconds) => setForm({ ...form, bidder: { ...form.bidder, bidTimerSeconds } })}
                    min={MIN_TIMER_SECONDS}
                    max={MAX_TIMER_SECONDS}
                    decreaseLabel="Un secondo in meno"
                    increaseLabel="Un secondo in più"
                    invalid={bidTimerErrors.length > 0}
                    describedBy={bidTimerErrors.length > 0 ? bidTimerErrorId : undefined}
                  />
                  <FieldErrors id={bidTimerErrorId} errors={bidTimerErrors} />
                </div>

                <div>
                  <label className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-lg border border-control-border px-4 text-base">
                    <input
                      type="checkbox"
                      checked={form.bidder.beepEnabled}
                      onChange={(e) => setForm({ ...form, bidder: { ...form.bidder, beepEnabled: e.target.checked } })}
                      className="h-5 w-5 shrink-0 accent-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                    />
                    Avviso sonoro allo scadere
                  </label>
                </div>

                <div className="sm:col-span-2">
                  <FieldErrors id={bidderGroupErrorId} errors={bidderGroupErrors} />
                </div>
              </fieldset>
            ) : (
              <BidderSummary bidder={form.bidder} />
            )}
          </RulesSection>

          <RulesSection id="sezione-regole" title="Crediti e posti">
            {canEdit ? (
              <LeagueRulesFieldset
                value={form.rules}
                onChange={(next) => setForm({ ...form, rules: next })}
                errors={errors}
                disabled={false}
              />
            ) : (
              <RulesSummary rules={form.rules} />
            )}
          </RulesSection>

          {/* Sempre aperto, non una disclosure: un <details> chiuso nascondeva anche il
              campo invalido che bloccava il salvataggio. */}
          <RulesSection id="sezione-punteggio" title="Punteggio">
            {canEdit ? (
              <ScoringFieldset
                value={form.scoring}
                onChange={(scoring) => setForm({ ...form, scoring })}
                errors={errors}
                disabled={false}
              />
            ) : (
              <ScoringSummary scoring={form.scoring} />
            )}
          </RulesSection>
        </SettingsLayout>
      </PageFrame>
    </AppShell>
  );
}
