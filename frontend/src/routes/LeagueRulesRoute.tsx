import { useEffect, useId, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../AppShell';
import { ProblemError, userMessage } from '../api/client';
import { useLeagueRules, useSaveLeagueRules } from '../api/leagues';
import type { SaveLeagueRulesRequest, SettingsErrors } from '../api/types';
import { FieldErrors } from '../domain/FieldErrors';
import { LeagueRulesFieldset } from '../domain/LeagueRulesFieldset';
import { ScoringFieldset } from '../domain/ScoringFieldset';
import { BidderSummary, RulesSummary, ScoringSummary } from '../domain/SettingsSummary';
import { ROLE_NAME_PLURAL } from '../domain/roles';
import { StepperField } from '../domain/StepperField';
import { useActiveSection } from '../domain/useActiveSection';

const NO_ERRORS: SettingsErrors = {};

/** Le sezioni del modulo, nell'ordine della pagina: ancore dell'indice a sinistra. */
const SECTION_IDS = ['sezione-banditore', 'sezione-regole', 'sezione-punteggio'] as const;

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

/** Lo spazio di scorrimento delle ancore: sotto la barra sul telefono, dentro il riquadro dal tablet. */
const ANCHOR = 'scroll-mt-[calc(var(--header-h)+1.5rem)] md:scroll-mt-6';

const TITLE = 'Regole della lega';

/**
 * Le regole della lega: banditore, crediti e posti, punteggio con cui nasceranno le
 * prossime aste. L'amministratore le cambia; gli altri membri le leggono. Le aste
 * gia' create non se ne accorgono: tengono le regole con cui sono nate.
 */
export function LeagueRulesRoute() {
  const { leagueId = '' } = useParams();
  const rules = useLeagueRules(leagueId);
  const save = useSaveLeagueRules(leagueId);
  const bidTimerErrorId = useId();
  const bidTimerId = useId();
  const bidderGroupErrorId = useId();

  // Le regole sono un modulo: dal momento in cui si comincia a scrivere, la verita'
  // e' quella digitata, non quella arrivata. Per questo `form` e' stato del client e
  // si riempie una volta sola.
  const [form, setForm] = useState<SaveLeagueRulesRequest | null>(null);
  const [errors, setErrors] = useState<SettingsErrors>(NO_ERRORS);
  // Un problem diverso da invalid-settings (rete caduta, errore interno): non ha un
  // campo, ma va detto comunque nello stesso, unico role="alert".
  const [saveError, setSaveError] = useState<string | null>(null);
  // Si resta sulla pagina dopo il salvataggio: senza questa frase il bottone
  // tornerebbe da «Salvo…» a «Salva» senza nessun segno che sia andato bene.
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  // Il corpo del modulo, che da tablet in su scorre dentro il riquadro fermo.
  const scrollRef = useRef<HTMLDivElement>(null);
  // La sezione che si sta leggendo, evidenziata nell'indice mentre si scorre.
  const activeSection = useActiveSection(SECTION_IDS, form !== null, scrollRef);

  useEffect(() => {
    if (!rules.data || form) return;
    setForm({ bidder: rules.data.bidder, scoring: rules.data.scoring, rules: rules.data.rules });
  }, [rules.data, form]);

  if (rules.isError) {
    return (
      <AppShell chrome="top">
        <h1 className="sr-only">{TITLE}</h1>
        <p role="alert" className="panel mx-auto max-w-xl rounded-xl p-4 text-sm font-medium text-destructive">
          {userMessage(rules.error, 'Le regole della lega non si sono caricate. Riprova.')}
        </p>
      </AppShell>
    );
  }

  if (!form || !rules.data) {
    // La stessa cornice della schermata pronta — indice a sinistra, pannello alto
    // quanto la finestra — con la frase in mezzo: un pannellino piccolo che un attimo
    // dopo diventa quello grande fa sembrare che la pagina cambi due volte.
    return (
      <AppShell chrome="top">
        <h1 className="sr-only">{TITLE}</h1>
        <div className="mx-auto grid w-full max-w-7xl gap-6 md:h-[calc(100dvh-var(--header-h)-3rem)] md:grid-rows-[minmax(0,1fr)] lg:grid-cols-[15rem_minmax(0,1fr)]">
          {/* Lo scheletro dell'indice: stessa struttura di quello vero (titolo e
              tre voci da 44px), cosi' ha anche la stessa altezza. */}
          <div aria-hidden="true" className="panel self-start rounded-2xl p-3 max-lg:hidden">
            <p className="px-3 pb-2 pt-1 text-sm font-medium text-muted-foreground">&nbsp;</p>
            <ol className="flex flex-col gap-1">
              {SECTION_IDS.map((id) => (
                <li key={id} className="flex min-h-11 items-center px-3">
                  <span className="h-4 w-32 rounded-full bg-line" />
                </li>
              ))}
            </ol>
          </div>
          <div className="panel flex min-h-[60dvh] items-center justify-center rounded-2xl md:min-h-0">
            <p className="text-sm text-muted-foreground">Carico le regole della lega…</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const canEdit = rules.data.canEdit;
  const summary = errorSummary(errors) ?? saveError;
  const bidTimerErrors = errorsFor(errors, 'bidTimerSeconds');
  // "bidder" e' grezza: l'intero oggetto manca dal corpo (un client rotto), non un
  // campo preciso — resta a livello di gruppo.
  const bidderGroupErrors = errorsFor(errors, 'bidder');

  /** Ogni modifica toglie la conferma di prima: «Regole salvate.» non vale piu'. */
  function edit(next: SaveLeagueRulesRequest) {
    setForm(next);
    setSavedMessage(null);
  }

  const labels: Record<(typeof SECTION_IDS)[number], string> = {
    'sezione-banditore': 'Banditore',
    'sezione-regole': 'Crediti e posti',
    'sezione-punteggio': 'Punteggio',
  };
  const sections = SECTION_IDS.map((id) => ({ id, label: labels[id] }));

  const body = (
    // Il corpo che scorre: overscroll-contain perche' arrivati in fondo la rotella
    // non passi a far scorrere la pagina dietro. relative: i testi sr-only dentro
    // (position:absolute) altrimenti si agganciano a un antenato fuori dal riquadro
    // e allungano la pagina, che torna a scorrere.
    <div ref={scrollRef} className="relative min-h-0 flex-1 space-y-8 px-5 pb-8 sm:px-8 md:overflow-y-auto md:overscroll-contain">
      {/* Blocchi senza nome, solo ancore dell'indice: il nome ce l'hanno gia' i
          riquadri dentro, e due regioni con lo stesso nome si confondono. */}
      <div id="sezione-banditore" className={ANCHOR}>
        {canEdit ? (
          // Legend nascosta: il fieldset resta un group nominato "Banditore" per chi
          // ascolta, ma visivamente e' solo la fila dei suoi due controlli.
          <fieldset
            className="m-0 grid max-w-3xl gap-4 border-0 p-0 sm:grid-cols-2 sm:items-end"
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
                onChange={(bidTimerSeconds) => edit({ ...form, bidder: { ...form.bidder, bidTimerSeconds } })}
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
              <label className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-full border border-line-strong px-4 text-base">
                <input
                  type="checkbox"
                  checked={form.bidder.beepEnabled}
                  onChange={(e) => edit({ ...form, bidder: { ...form.bidder, beepEnabled: e.target.checked } })}
                  className="h-5 w-5 shrink-0 accent-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                />
                Avviso acustico allo scadere
              </label>
            </div>

            <div className="sm:col-span-2">
              <FieldErrors id={bidderGroupErrorId} errors={bidderGroupErrors} />
            </div>
          </fieldset>
        ) : (
          <BidderSummary bidder={form.bidder} />
        )}
      </div>

      <div id="sezione-regole" className={ANCHOR}>
        {canEdit ? (
          <LeagueRulesFieldset
            value={form.rules}
            onChange={(next) => edit({ ...form, rules: next })}
            errors={errors}
            disabled={false}
          />
        ) : (
          <RulesSummary rules={form.rules} />
        )}
      </div>

      {/* Sempre aperto, non una disclosure: un <details> chiuso nascondeva anche il
          campo invalido che bloccava il salvataggio. */}
      <div id="sezione-punteggio" className={ANCHOR}>
        {canEdit ? (
          <ScoringFieldset
            value={form.scoring}
            onChange={(scoring) => edit({ ...form, scoring })}
            errors={errors}
            disabled={false}
          />
        ) : (
          <ScoringSummary scoring={form.scoring} />
        )}
      </div>
    </div>
  );

  return (
    <AppShell chrome="top">
      {/* Due colonne da lg in su: a sinistra l'indice delle sezioni, fermo mentre il
          modulo scorre; a destra il modulo. Da tablet in su la pagina non scorre: il
          riquadro e' alto quanto la finestra e scorre dentro, con titolo e «Salva»
          sempre in vista. Sul telefono scorre la pagina: un riquadro con lo
          scorrimento interno e la tastiera aperta sopra lascerebbe una fessura. */}
      <div className="mx-auto grid w-full max-w-7xl gap-6 md:h-[calc(100dvh-var(--header-h)-3rem)] md:grid-rows-[minmax(0,1fr)] lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label="Sezioni del modulo" className="self-start max-lg:hidden">
          <div className="panel rounded-2xl p-3">
            <p className="px-3 pb-2 pt-1 text-sm font-medium text-muted-foreground">{TITLE}</p>
            <ol className="flex flex-col gap-1">
              {sections.map((section) => (
                <li key={section.id}>
                  {/* La sezione in cui ci si trova in giallo pieno, come ogni «dove sei»
                      dell'app; per chi ascolta, aria-current="location". */}
                  <a
                    href={`#${section.id}`}
                    aria-current={activeSection === section.id ? 'location' : undefined}
                    className={`flex min-h-11 items-center rounded-full px-3 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                      activeSection === section.id ? 'bg-accent text-on-accent' : 'hover:bg-line'
                    }`}
                  >
                    {section.label}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        {/* Un unico pannello pieno per tutto il modulo: etichette, pillole e
            messaggi non poggiano mai sulle linee del campo. */}
        <div className="panel flex min-h-0 min-w-0 flex-col rounded-2xl">
          <div className="px-5 pt-5 sm:px-8 sm:pt-8">
            <div className="relative flex items-center justify-center">
              {/* Si torna alla lega, da cui si e' arrivati: «Le mie leghe» nella barra
                  porta un passo piu' indietro. */}
              <Link
                to={`/leghe/${leagueId}`}
                aria-label="Torna alla lega"
                className="absolute left-0 flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="w-exp text-xl font-semibold sm:text-2xl">{TITLE}</h1>
            </div>
            {/* Una volta sola, in testa: vale per tutto quello che sta sotto. */}
            <p className="mt-4 text-center text-base text-muted-foreground">
              Valgono per le prossime aste della lega. Quelle già create tengono le regole con cui sono nate.
            </p>
            {!canEdit ? (
              <p className="mt-4 rounded-xl border border-line p-4 text-base">
                Solo l'amministratore della lega può cambiare le regole.
              </p>
            ) : null}
          </div>

          {canEdit ? (
            <form
              className="mt-6 flex min-h-0 flex-1 flex-col"
              onSubmit={(e) => {
                e.preventDefault();
                setErrors(NO_ERRORS);
                setSaveError(null);
                setSavedMessage(null);
                save.mutate(form, {
                  onSuccess: (saved) => {
                    setForm({ bidder: saved.bidder, scoring: saved.scoring, rules: saved.rules });
                    setSavedMessage('Regole salvate.');
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
              }}
            >
              {body}

              {/* Sempre in vista: in fondo al riquadro, che non scorre, e sul telefono
                  ferma in fondo allo schermo. Un solo alert, col conto e il dove: piu'
                  alert di campo che si popolano insieme se ne mangerebbero tutti tranne
                  uno. La conferma sta in un role="status" a parte, sempre montato, cosi'
                  che il cambio di testo venga annunciato. */}
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-6 gap-y-2 rounded-b-2xl border-t border-line-strong bg-surface px-5 py-4 max-md:sticky max-md:bottom-0 max-md:z-10 sm:px-8">
                {summary ? (
                  <p role="alert" className="mr-auto text-sm font-medium text-destructive">{summary}</p>
                ) : null}
                <p role="status" className={`text-sm font-medium text-positive ${summary ? 'sr-only' : 'mr-auto'}`}>
                  {savedMessage}
                </p>
                <button
                  type="submit"
                  disabled={save.isPending}
                  className="min-h-12 rounded-full bg-accent px-8 text-lg font-semibold text-on-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground"
                >
                  {save.isPending ? 'Salvo…' : 'Salva le regole'}
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-6 flex min-h-0 flex-1 flex-col">{body}</div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
