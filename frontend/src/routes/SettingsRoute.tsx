import { useEffect, useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppShell } from '../AppShell';
import { ProblemError } from '../api/client';
import { useSaveSettings, useSettings } from '../api/hooks';
import type { SaveSettingsRequest, SettingsErrors } from '../api/types';
import { FieldErrors } from '../domain/FieldErrors';
import { LeagueRulesFieldset } from '../domain/LeagueRulesFieldset';
import { ParticipantsFieldset } from '../domain/ParticipantsFieldset';
import { ScoringFieldset } from '../domain/ScoringFieldset';
import { ROLE_NAME_PLURAL } from '../domain/roles';
import { StepperField } from '../domain/StepperField';

const NO_ERRORS: SettingsErrors = {};

/** Gli stessi limiti di AuctionSettingsValidator (MIN_SECONDS, MAX_SECONDS). */
const MIN_TIMER_SECONDS = 1;
const MAX_TIMER_SECONDS = 120;

/**
 * Etichette leggibili per le chiavi di campo (task 16). Le righe indicizzate — una
 * riga della tabella soglie, un partecipante — non hanno una voce fissa: la loro
 * forma si riconosce con un'espressione regolare, non elencandole tutte in anticipo,
 * perche' l'indice o l'id non si conoscono prima che arrivi la risposta.
 */
const FIELD_LABELS: Record<string, string> = {
  auctionName: "nome dell'asta",
  bidTimerSeconds: 'timer',
  bidder: 'battitore',
  defendersCounted: 'difensori conteggiati',
  thresholds: 'tabella soglie',
  scoring: 'punteggio',
  participants: 'partecipanti',
  assist: 'assist',
  penaltyScored: 'rigore segnato',
  penaltyMissed: 'rigore sbagliato',
  penaltySaved: 'rigore parato',
  yellowCard: 'ammonizione',
  redCard: 'espulsione',
  goalConceded: 'gol subito',
  cleanSheet: 'porta inviolata',
  budget: 'crediti per squadra',
  rules: 'regole della lega',
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
  if (slot) return `slot ${ROLE_NAME_PLURAL[slot[1] as 'P' | 'D' | 'C' | 'A']}`;
  const participantField = /^participants\[[^\]]+]\.(name|initial)$/.exec(key);
  if (participantField) {
    return participantField[1] === 'name' ? 'nome di un partecipante' : "iniziale di un partecipante";
  }
  return key;
}

/** «3 errori: 1 nel nome dell'asta, 2 in partecipanti». Il conto e il dove, non l'elenco. */
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
 * Le uniche chiavi che NON appartengono al punteggio: il nome dell'asta, il
 * battitore (timer, oggetto intero mancante), e i partecipanti (l'insieme o una
 * riga precisa). Ogni altra chiave — comprese quelle non ancora note, come
 * {@code thresholds[N]} o {@code goalBonus[R]} — appartiene alla sezione punteggio.
 */
/**
 * Restringe {@link ProblemError#body}: la classe porta il corpo indistinto apposta
 * (vedi il commento su di lei), quindi chi legge un 422 di questo endpoint deve
 * verificare da solo che la forma sia quella attesa, con la stessa cautela con cui
 * si legge qualunque JSON arrivato dalla rete — per OGNI chiave, non solo per il
 * primo livello.
 *
 * <p>Restringere un solo livello (verificare che "errors" fosse un oggetto e poi
 * fidarsi del resto) lasciava passare un corpo come
 * {@code {"errors": {"participants": "boom"}}}: {@code errors.participants.length}
 * leggeva la lunghezza della STRINGA "boom" (4), il riassunto diceva «4 errori: 4 in
 * partecipanti», e {@link FieldErrors} chiamando {@code .map} su una stringa
 * crashava il render — peggio del silenzio che questo stesso meccanismo esiste per
 * evitare (commit af64cd1).
 *
 * <p>Le chiavi sono di campo, non le quattro sezioni fisse di prima (task 16): non
 * si possono elencare tutte in anticipo (un id di partecipante, un indice di riga),
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
 * Le impostazioni: la schermata dove un'asta nasce. Confermare qui, non premere
 * "nuova asta" sulla home, e' l'atto che la crea — la home porta soltanto a questa
 * rotta (Task 9), senza creare niente da sola.
 */
export function SettingsRoute() {
  const settings = useSettings();
  const save = useSaveSettings();
  const navigate = useNavigate();
  const auctionNameErrorId = useId();
  const bidTimerErrorId = useId();
  const bidTimerId = useId();
  const bidderGroupErrorId = useId();

  // Le impostazioni sono un modulo: dal momento in cui si comincia a scrivere, la
  // verita' e' quella digitata, non quella del server. Per questo `form` e' stato
  // client — input dell'utente — e per questo `useSettings` non riaggiorna da solo:
  // un refetch sotto le dita riscriverebbe quello che si sta scrivendo.
  const [form, setForm] = useState<SaveSettingsRequest | null>(null);
  const [errors, setErrors] = useState<SettingsErrors>(NO_ERRORS);
  // Un problem diverso da invalid-settings (lega sconosciuta, errore interno, rete
  // caduta durante il salvataggio): non ha un campo, quindi non entra in `errors`,
  // ma va detto comunque nello stesso, unico role="alert" — tacere sarebbe lasciare
  // chi ascolta senza sapere che il salvataggio non e' andato a buon fine.
  const [saveError, setSaveError] = useState<string | null>(null);
  // Solo quando si RESTA sulla schermata (asta gia' aperta: nessuna navigazione a
  // /asta) — altrimenti il bottone tornava da "Salvo…" a "Salva" senza nessun segno
  // che il salvataggio fosse riuscito. Nello stesso, unico nodo di alert usato per
  // gli errori: non un secondo role="status", che il vincolo di questa schermata
  // vieta.
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!settings.data || form) return;
    setForm({
      auctionName: '',
      bidder: settings.data.bidder,
      participants: settings.data.participants,
      scoring: settings.data.scoring,
      rules: { budget: settings.data.rules.budget, slots: settings.data.rules.slots },
    });
  }, [settings.data, form]);

  if (settings.isError) {
    return (
      <AppShell chrome="side">
        <h1 className="sr-only">Impostazioni</h1>
        <p role="alert" className="panel rounded-xl p-4 text-sm font-bold text-destructive">
          {settings.error instanceof ProblemError
            ? settings.error.detail
            : 'Errore di rete: le impostazioni non si sono caricate. Riprova.'}
        </p>
      </AppShell>
    );
  }

  if (!form || !settings.data) {
    return (
      <AppShell chrome="side">
        <h1 className="sr-only">Impostazioni</h1>
        <p className="panel rounded-xl p-4 text-sm text-muted-foreground">Carico le impostazioni…</p>
      </AppShell>
    );
  }

  const auctionOpen = settings.data.auctionOpen;
  const summary = errorSummary(errors) ?? saveError;
  // Errore e conferma non convivono mai: submit li azzera entrambi prima di
  // ripartire (vedi sotto), quindi al piu' uno dei due e' non-null qui.
  const alertMessage = summary ?? savedMessage;
  const auctionNameErrors = errorsFor(errors, 'auctionName');
  const bidTimerErrors = errorsFor(errors, 'bidTimerSeconds');
  // "bidder" e' grezza: l'intero oggetto manca dal corpo (un client rotto), non un
  // campo preciso che AuctionSettingsValidator conosce — resta a livello di gruppo.
  const bidderGroupErrors = errorsFor(errors, 'bidder');
  // Non si crea niente mentre si sta solo modificando: il titolo lo dice, non solo
  // il testo del bottone in fondo.
  const title = auctionOpen ? 'Impostazioni' : 'Crea asta';


  return (
    <AppShell chrome="side">
      {/* Un unico pannello pieno per tutto il modulo: etichette, pillole e
          messaggi non poggiano mai sulle linee del campo. */}
      <div className="panel mx-auto max-w-4xl rounded-2xl p-6">
        <div className="relative mb-6 flex items-center justify-center">
          {/* Nome accessibile esplicito: una freccia da sola sarebbe un'icona
              muta, senza niente che uno screen reader possa leggere. */}
          <Link
            to="/"
            aria-label="Torna alla home"
            className="absolute left-0 flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-extrabold">{title}</h1>
        </div>

        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            setErrors(NO_ERRORS);
            setSaveError(null);
            setSavedMessage(null);
            save.mutate(form, {
              onSuccess: (result) => {
                // Un'asta e' nata: si va a batterla. Restare qui vorrebbe dire
                // guardare le impostazioni di una serata gia' cominciata.
                if (result?.auctionId) {
                  navigate('/asta');
                  return;
                }
                setSavedMessage('Impostazioni salvate.');
              },
              onError: (error) => {
                if (error instanceof ProblemError && error.slug === 'invalid-settings') {
                  const parsed = settingsErrorsOf(error.body);
                  // Solo qui ci si ferma: un corpo che non ha la forma attesa (un proxy
                  // che lo riscrive, un controller che smette di mandare `errors`) non
                  // deve fermarsi comunque a valle in silenzio — deve cadere nel ramo
                  // generico sotto, che almeno dice il `detail` del problem.
                  if (parsed) {
                    setErrors(parsed);
                    return;
                  }
                }
                setSaveError(
                  error instanceof ProblemError
                    ? error.detail
                    : 'Errore di rete: il salvataggio non e\' riuscito. Riprova.',
                );
              },
            });
          }}
        >
          {!auctionOpen ? (
            // FieldErrors sta FUORI dal <label>: un <label> che avvolge il suo
            // <input> presta all'input il proprio intero contenuto testuale come
            // nome accessibile, ed e' quello che uno screen reader legge digitando
            // il campo — includerci l'elenco degli errori lo renderebbe "Nome
            // dell'asta" + il messaggio, non piu' semplicemente "Nome dell'asta".
            <div>
              <label className="block text-sm">
                Nome dell'asta
                <input
                  value={form.auctionName}
                  aria-invalid={auctionNameErrors.length > 0}
                  aria-describedby={auctionNameErrors.length > 0 ? auctionNameErrorId : undefined}
                  onChange={(e) => setForm({ ...form, auctionName: e.target.value })}
                  className="mt-1 block min-h-12 w-full rounded-full border border-line-strong bg-transparent px-4 text-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                />
              </label>
              {/* Tutti i messaggi, non solo il primo: i validatori tornano l'elenco
                  completo apposta, ed e' il motivo per cui questo task esiste. */}
              <FieldErrors id={auctionNameErrorId} errors={auctionNameErrors} />
            </div>
          ) : null}

          <div className="space-y-6">
            {/* Legend nascosta: il fieldset resta un group nominato "Battitore"
                per chi ascolta, ma visivamente e' solo la griglia delle sue due
                pillole — la cornice del fieldset non serve al disegno, che la
                mette gia' sulle singole pillole. */}
            <fieldset
              className="m-0 grid gap-4 border-0 p-0 sm:grid-cols-2 sm:items-end"
              aria-describedby={bidderGroupErrors.length > 0 ? bidderGroupErrorId : undefined}
            >
              <legend className="sr-only">Battitore</legend>

              <div>
                <label htmlFor={bidTimerId} className="block text-sm">
                  Secondi di countdown
                </label>
                {/* − e + ai lati del campo: si regola il timer senza tastiera, dentro
                    i limiti che il server accetta (AuctionSettingsValidator). */}
                <StepperField
                  id={bidTimerId}
                  value={form.bidder.bidTimerSeconds}
                  onChange={(bidTimerSeconds) =>
                    setForm({ ...form, bidder: { ...form.bidder, bidTimerSeconds } })
                  }
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
                <label className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-full border border-line-strong px-4 text-sm">
                  <input
                    type="checkbox"
                    checked={form.bidder.beepEnabled}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        bidder: { ...form.bidder, beepEnabled: e.target.checked },
                      })
                    }
                    className="h-5 w-5 shrink-0 accent-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                  />
                  Avviso acustico allo scadere
                </label>
              </div>

              <div className="sm:col-span-2">
                <FieldErrors id={bidderGroupErrorId} errors={bidderGroupErrors} />
              </div>
            </fieldset>

            <LeagueRulesFieldset
              value={form.rules}
              onChange={(rules) => setForm({ ...form, rules })}
              participants={form.participants.length}
              errors={errors}
              disabled={auctionOpen}
            />
          </div>

          <ParticipantsFieldset
            value={form.participants}
            onChange={(participants) => setForm({ ...form, participants })}
            errors={errors}
            lockCount={auctionOpen}
          />

          {/* Sempre aperto, non una disclosure: il punteggio e' parte della
              creazione dell'asta quanto i partecipanti, e un <details> chiuso
              nascondeva anche il campo invalido che bloccava il salvataggio. */}
          <ScoringFieldset
            value={form.scoring}
            onChange={(scoring) => setForm({ ...form, scoring })}
            errors={errors}
            disabled={auctionOpen}
          />

          <div className="flex flex-col items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={save.isPending}
              className="min-h-11 rounded-full bg-positive px-8 font-extrabold text-on-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground"
            >
              {save.isPending ? 'Salvo…' : auctionOpen ? 'Salva' : "Salva e comincia l'asta"}
            </button>

            {/* Un solo annuncio, col conto e il dove: piu' alert di campo che si
                popolano insieme se ne mangerebbero tutti tranne uno. Il dettaglio sta
                accanto a ciascun campo, raggiungibile navigando. Stesso nodo anche per
                la conferma di un salvataggio riuscito: colore positivo invece di
                destructive, non un secondo role="status". */}
            {alertMessage ? (
              <p
                role="alert"
                className={`text-sm font-bold ${summary ? 'text-destructive' : 'text-positive'}`}
              >
                {alertMessage}
              </p>
            ) : null}
          </div>
        </form>
      </div>
    </AppShell>
  );
}
