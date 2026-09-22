import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppShell } from '../AppShell';
import { ProblemError, userMessage } from '../api/client';
import { useAuctions, useSaveSettings, useSettings, useSettingsFrom } from '../api/hooks';
import type { SaveSettingsRequest, SettingsErrors } from '../api/types';
import { FieldErrors } from '../domain/FieldErrors';
import { LeagueRulesFieldset } from '../domain/LeagueRulesFieldset';
import { ParticipantsFieldset } from '../domain/ParticipantsFieldset';
import { ScoringFieldset } from '../domain/ScoringFieldset';
import { RulesSummary, ScoringSummary } from '../domain/SettingsSummary';
import { ROLE_NAME_PLURAL } from '../domain/roles';
import { StepperField } from '../domain/StepperField';
import { useActiveSection } from '../domain/useActiveSection';

const NO_ERRORS: SettingsErrors = {};

/** Le sezioni del modulo, nell'ordine della pagina: ancore dell'indice a sinistra. */
const SECTION_IDS = ['sezione-asta', 'sezione-regole', 'sezione-partecipanti', 'sezione-punteggio'] as const;

/**
 * I partecipanti di un'asta nuova: otto righe vuote, col segnaposto «Nome della
 * squadra N». Prima erano «Team 1…Team 8», nomi finti da cancellare uno per uno
 * senza che si vedesse quali fossero ancora da sistemare. Per ripartire dai nomi
 * veri di una lega c'e' «Parti da».
 */
const DEFAULT_PARTICIPANTS: SaveSettingsRequest['participants'] = Array.from(
  { length: 8 },
  (_, i) => ({
    id: `team-${i + 1}`,
    name: '',
    // L'iniziale la calcola il server dal nome: qui non si chiede piu'.
    initial: '',
    me: i === 0,
  }),
);

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
  bidTimerSeconds: 'secondi del conto alla rovescia',
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
  if (slot) return `posti ${ROLE_NAME_PLURAL[slot[1] as 'P' | 'D' | 'C' | 'A']}`;
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
  const auctions = useAuctions();
  const startFrom = useSettingsFrom();
  const startFromId = useId();
  // Da quale asta si e' partiti, per dirlo accanto alla scelta: '' e' il modello.
  const [startedFrom, setStartedFrom] = useState('');
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
  // Il corpo del modulo, che da tablet in su scorre dentro il riquadro fermo.
  const scrollRef = useRef<HTMLDivElement>(null);
  // La sezione che si sta leggendo, evidenziata nell'indice mentre si scorre.
  const activeSection = useActiveSection(SECTION_IDS, form !== null, scrollRef);

  useEffect(() => {
    if (!settings.data || form) return;
    setForm({
      auctionName: '',
      bidder: settings.data.bidder,
      // Asta nuova: otto squadre segnaposto. Ad asta aperta, i suoi partecipanti veri.
      participants: settings.data.auctionOpen
        ? settings.data.participants
        : DEFAULT_PARTICIPANTS,
      scoring: settings.data.scoring,
      rules: { budget: settings.data.rules.budget, slots: settings.data.rules.slots },
    });
  }, [settings.data, form]);

  if (settings.isError) {
    return (
      <AppShell chrome="top">
        <h1 className="sr-only">Impostazioni</h1>
        <p role="alert" className="panel rounded-xl p-4 text-sm font-bold text-destructive">
          {userMessage(settings.error, 'Le impostazioni non si sono caricate. Riprova.')}
        </p>
      </AppShell>
    );
  }

  if (!form || !settings.data) {
    // La stessa cornice della schermata pronta — indice a sinistra, pannello alto
    // quanto la finestra — con la frase in mezzo: prima era un pannellino piccolo
    // che un attimo dopo diventava quello grande, e arrivando dalla home la pagina
    // sembrava cambiare due volte.
    return (
      <AppShell chrome="top">
        <h1 className="sr-only">Impostazioni</h1>
        <div className="mx-auto grid w-full max-w-7xl gap-6 md:h-[calc(100dvh-var(--header-h)-3rem)] md:grid-rows-[minmax(0,1fr)] lg:grid-cols-[15rem_minmax(0,1fr)]">
          {/* Lo scheletro dell'indice: stessa struttura di quello vero (titolo e
              quattro voci da 44px), cosi' ha anche la stessa altezza. */}
          <div aria-hidden="true" className="panel self-start rounded-2xl p-3 max-lg:hidden">
            <p className="px-3 pb-2 pt-1 text-sm font-bold text-muted-foreground">&nbsp;</p>
            <ol className="flex flex-col gap-1">
              {Array.from({ length: 4 }, (_, i) => (
                <li key={i} className="flex min-h-11 items-center px-3">
                  <span className="h-4 w-32 rounded-full bg-line" />
                </li>
              ))}
            </ol>
          </div>
          <div className="panel flex min-h-[60dvh] items-center justify-center rounded-2xl md:min-h-0">
            <p className="text-sm text-muted-foreground">Carico le impostazioni…</p>
          </div>
        </div>
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


  /**
   * Riempie il modulo con le impostazioni di un'asta esistente: regole, punteggio,
   * battitore e i nomi dei partecipanti. Il nome della nuova asta resta quello che
   * si sta scrivendo. Tornare a «Impostazioni predefinite» rimette quelle arrivate
   * all'apertura della schermata.
   */
  function applyStart(auctionId: string) {
    setStartedFrom(auctionId);
    setErrors(NO_ERRORS);
    if (!form || !settings.data) return;
    if (auctionId === '') {
      setForm({
        ...form,
        bidder: settings.data.bidder,
        participants: DEFAULT_PARTICIPANTS,
        scoring: settings.data.scoring,
        rules: { budget: settings.data.rules.budget, slots: settings.data.rules.slots },
      });
      return;
    }
    startFrom.mutate(auctionId, {
      onSuccess: (from) => {
        setForm((current) => current && {
          ...current,
          bidder: from.bidder,
          participants: from.participants,
          scoring: from.scoring,
          rules: { budget: from.rules.budget, slots: from.rules.slots },
        });
      },
    });
  }

  const labels: Record<(typeof SECTION_IDS)[number], string> = {
    'sezione-asta': auctionOpen ? 'Battitore' : "L'asta",
    'sezione-regole': 'Regole della lega',
    'sezione-partecipanti': 'Partecipanti',
    'sezione-punteggio': 'Punteggio',
  };
  const sections = SECTION_IDS.map((id) => ({ id, label: labels[id] }));

  return (
    <AppShell chrome="top">
      {/* Due colonne da lg in su: a sinistra l'indice delle sezioni, fermo mentre il
          modulo scorre; a destra il modulo. Prima era una colonna sola alta due
          schermi, senza sapere quanto mancasse alla fine. */}
      {/* Da tablet in su la pagina non scorre: il riquadro e' alto quanto la finestra
          (meno barra e padding di main) e scorre dentro, con titolo e «Salva» sempre
          in vista. Sul telefono scorre la pagina, come sempre: un riquadro con lo
          scorrimento interno e la tastiera aperta sopra lascerebbe una fessura. */}
      <div className="mx-auto grid w-full max-w-7xl gap-6 md:h-[calc(100dvh-var(--header-h)-3rem)] md:grid-rows-[minmax(0,1fr)] lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label="Sezioni del modulo" className="self-start max-lg:hidden">
          <div className="panel rounded-2xl p-3">
            <p className="px-3 pb-2 pt-1 text-sm font-bold text-muted-foreground">{title}</p>
            <ol className="flex flex-col gap-1">
              {sections.map((section) => (
                <li key={section.id}>
                  {/* La sezione in cui ci si trova in giallo pieno, come ogni «dove sei»
                      dell'app; per chi ascolta, aria-current="location". */}
                  <a
                    href={`#${section.id}`}
                    aria-current={activeSection === section.id ? 'location' : undefined}
                    className={`flex min-h-11 items-center rounded-full px-3 font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
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
        <div className="relative flex items-center justify-center px-5 pt-5 sm:px-8 sm:pt-8">
          {/* Solo ad asta aperta: si torna all'asta, da cui si e' arrivati
              (l'ingranaggio). Preparando un'asta nuova la via d'uscita e' «Le mie
              aste» nella barra: una seconda freccia verso la stessa home era una
              doppia navigazione. */}
          {auctionOpen ? (
            <Link
              to="/asta"
              aria-label="Torna all'asta"
              className="absolute left-5 flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent sm:left-8"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
          ) : null}
          <h1 className="w-exp text-xl font-extrabold sm:text-2xl">{title}</h1>
        </div>

        <form
          className="mt-6 flex min-h-0 flex-1 flex-col"
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
                setSaveError(userMessage(error, 'Il salvataggio non è riuscito. Riprova.'));
              },
            });
          }}
        >
          {/* Il corpo che scorre: overscroll-contain perche' arrivati in fondo la
              rotella non passi a far scorrere la pagina dietro. relative: i testi
              sr-only dentro (position:absolute) altrimenti si agganciano a un
              antenato fuori dal riquadro e allungano la pagina, che torna a scorrere. */}
          <div ref={scrollRef} className="relative min-h-0 flex-1 space-y-8 px-5 pb-8 sm:px-8 md:overflow-y-auto md:overscroll-contain">
          {/* Blocchi senza nome, solo ancore dell'indice: il nome ce l'hanno gia' i
              riquadri dentro, e due regioni con lo stesso nome si confondono. */}
          <div id="sezione-asta" className="scroll-mt-[calc(var(--header-h)+1.5rem)] md:scroll-mt-6 space-y-6">
          {!auctionOpen ? (
            // Partire da un'asta gia' fatta: regole, punteggio, battitore e nomi
            // copiati nel modulo, da ritoccare. Per chi rifa' l'asta ogni stagione
            // con la stessa lega, e' la differenza fra un minuto e dieci.
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1 basis-72">
                <label htmlFor={startFromId} className="block text-base">Parti da</label>
                <select
                  id={startFromId}
                  value={startedFrom}
                  disabled={startFrom.isPending}
                  onChange={(e) => applyStart(e.target.value)}
                  className="mt-1 block min-h-12 w-full max-w-md rounded-full border border-line-strong bg-surface px-4 text-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <option value="">Impostazioni predefinite</option>
                  {(auctions.data ?? []).map((a) => (
                    <option key={a.id} value={a.id}>{`Le regole di «${a.label}»`}</option>
                  ))}
                </select>
              </div>
              <p className="basis-full text-sm text-muted-foreground" aria-live="polite">
                {startFrom.isPending
                  ? 'Copio le impostazioni…'
                  : startFrom.isError
                    ? 'Non è stato possibile copiare le impostazioni. Riprova.'
                    : startedFrom
                      ? 'Regole, punteggio, battitore e partecipanti copiati: cambia quello che serve.'
                      : 'Scegli un\'asta che hai già fatto per ripartire dalle sue regole e dai suoi partecipanti.'}
              </p>
            </div>
          ) : null}

          {!auctionOpen ? (
            // FieldErrors sta FUORI dal <label>: un <label> che avvolge il suo
            // <input> presta all'input il proprio intero contenuto testuale come
            // nome accessibile, ed e' quello che uno screen reader legge digitando
            // il campo — includerci l'elenco degli errori lo renderebbe "Nome
            // dell'asta" + il messaggio, non piu' semplicemente "Nome dell'asta".
            <div>
              <label className="block text-base">
                Nome dell'asta
                <input
                  value={form.auctionName}
                  aria-invalid={auctionNameErrors.length > 0}
                  aria-describedby={auctionNameErrors.length > 0 ? auctionNameErrorId : undefined}
                  placeholder="Per esempio: Lega del bar, stagione 2026"
                  onChange={(e) => setForm({ ...form, auctionName: e.target.value })}
                  className="mt-1 block min-h-12 w-full max-w-xl rounded-full border border-line-strong bg-transparent px-4 text-lg placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                />
              </label>
              {/* Tutti i messaggi, non solo il primo: i validatori tornano l'elenco
                  completo apposta, ed e' il motivo per cui questo task esiste. */}
              <FieldErrors id={auctionNameErrorId} errors={auctionNameErrors} />
            </div>
          ) : null}

            {/* Legend nascosta: il fieldset resta un group nominato "Battitore"
                per chi ascolta, ma visivamente e' solo la fila delle sue due
                pillole — la cornice del fieldset non serve al disegno, che la
                mette gia' sulle singole pillole. */}
            <fieldset
              className="m-0 grid max-w-3xl gap-4 border-0 p-0 sm:grid-cols-2 sm:items-end"
              aria-describedby={bidderGroupErrors.length > 0 ? bidderGroupErrorId : undefined}
            >
              <legend className="sr-only">Battitore</legend>

              <div>
                <label htmlFor={bidTimerId} className="block text-base">
                  Secondi del conto alla rovescia
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
                <label className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-full border border-line-strong px-4 text-base">
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
          </div>

          {/* Ad asta aperta regole e punteggio sono valori da leggere, non campi
              spenti: la ragione e' detta una volta sola, qui. */}
          {auctionOpen ? (
            <p className="rounded-xl border border-line p-4 text-base text-muted-foreground">
              Asta in corso: regole della lega e punteggio sono fissati alla creazione, perché
              cambiarli ricalcolerebbe budget e valutazioni di rose già pagate. Puoi cambiare
              il battitore e i nomi dei partecipanti.
            </p>
          ) : null}

          <div id="sezione-regole" className="scroll-mt-[calc(var(--header-h)+1.5rem)] md:scroll-mt-6">
            {auctionOpen ? (
              <RulesSummary rules={form.rules} teams={form.participants.length} />
            ) : (
              <LeagueRulesFieldset
                value={form.rules}
                onChange={(rules) => setForm({ ...form, rules })}
                errors={errors}
                disabled={false}
              />
            )}
          </div>

          <div id="sezione-partecipanti" className="scroll-mt-[calc(var(--header-h)+1.5rem)] md:scroll-mt-6">
            <ParticipantsFieldset
              value={form.participants}
              onChange={(participants) => setForm({ ...form, participants })}
              errors={errors}
              lockCount={auctionOpen}
            />
          </div>

          {/* Sempre aperto, non una disclosure: il punteggio e' parte della
              creazione dell'asta quanto i partecipanti, e un <details> chiuso
              nascondeva anche il campo invalido che bloccava il salvataggio. */}
          <div id="sezione-punteggio" className="scroll-mt-[calc(var(--header-h)+1.5rem)] md:scroll-mt-6">
            {auctionOpen ? (
              <ScoringSummary scoring={form.scoring} />
            ) : (
              <ScoringFieldset
                value={form.scoring}
                onChange={(scoring) => setForm({ ...form, scoring })}
                errors={errors}
                disabled={false}
              />
            )}
          </div>
          </div>

          {/* Sempre in vista: in fondo al riquadro, che non scorre, e sul telefono
              ferma in fondo allo schermo. Prima il bottone stava dopo duemila pixel
              di campi. Un solo annuncio, col
              conto e il dove: piu' alert di campo che si popolano insieme se ne
              mangerebbero tutti tranne uno. Stesso nodo anche per la conferma di un
              salvataggio riuscito, non un secondo role="status". */}
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-6 gap-y-2 rounded-b-2xl border-t border-line-strong bg-surface px-5 py-4 max-md:sticky max-md:bottom-0 max-md:z-10 sm:px-8">
            {alertMessage ? (
              <p
                role="alert"
                className={`mr-auto text-sm font-bold ${summary ? 'text-destructive' : 'text-positive'}`}
              >
                {alertMessage}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={save.isPending}
              className="min-h-12 rounded-full bg-accent px-8 text-lg font-extrabold text-on-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground"
            >
              {save.isPending ? 'Salvo…' : auctionOpen ? 'Salva' : "Salva e comincia l'asta"}
            </button>
          </div>
        </form>
      </div>
      </div>
    </AppShell>
  );
}
