import { useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../AppShell';
import { ProblemError } from '../api/client';
import { useSaveSettings, useSettings } from '../api/hooks';
import type { SaveSettingsRequest, SettingsErrors } from '../api/types';
import { NumberField } from '../domain/NumberField';
import { ParticipantsFieldset } from '../domain/ParticipantsFieldset';
import { ScoringFieldset } from '../domain/ScoringFieldset';
import { SectionErrors } from '../domain/SectionErrors';

const NO_ERRORS: SettingsErrors = {
  auction: [], participants: [], scoring: [], bidder: [],
};

const SECTION_NAMES: Record<keyof SettingsErrors, string> = {
  auction: "nome dell'asta",
  participants: 'partecipanti',
  scoring: 'punteggio',
  bidder: 'battitore',
};

/** «3 errori: 1 nei partecipanti, 2 nel punteggio». Il conto e il dove, non l'elenco. */
function errorSummary(errors: SettingsErrors): string | null {
  const parts = (Object.keys(errors) as Array<keyof SettingsErrors>)
    .filter((k) => errors[k].length > 0)
    .map((k) => `${errors[k].length} in ${SECTION_NAMES[k]}`);
  if (parts.length === 0) return null;
  const total = Object.values(errors).reduce((n, list) => n + list.length, 0);
  return `${total} ${total === 1 ? 'errore' : 'errori'}: ${parts.join(', ')}.`;
}

/** Un elenco di stringhe, e nient'altro — cio' che ogni chiave di SettingsErrors deve essere. */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
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
 * {@code {"errors": {"participants": "boom"}}}: {@code errors.participants.length}
 * leggeva la lunghezza della STRINGA "boom" (4), il riassunto diceva «4 errori: 4 in
 * partecipanti», e {@link SectionErrors} chiamando {@code .map} su una stringa
 * crashava il render — peggio del silenzio che questo stesso meccanismo esiste per
 * evitare (commit af64cd1).
 *
 * <p>Le chiavi si prendono da {@link NO_ERRORS}, non dalla risposta: una chiave in
 * piu' che il corpo porta (un campo aggiunto in futuro, un typo) non deve finire nel
 * riassunto — {@code SECTION_NAMES[k]} su una chiave che non conosce darebbe «in
 * undefined».
 */
function settingsErrorsOf(body: unknown): SettingsErrors | null {
  if (typeof body !== 'object' || body === null || !('errors' in body)) return null;
  const errors = (body as { errors: unknown }).errors;
  if (typeof errors !== 'object' || errors === null) return null;
  const record = errors as Record<string, unknown>;

  const result = { ...NO_ERRORS };
  let anyRealError = false;
  for (const key of Object.keys(NO_ERRORS) as Array<keyof SettingsErrors>) {
    const value = record[key];
    if (isStringArray(value)) {
      result[key] = value;
      if (value.length > 0) anyRealError = true;
    }
    // Un valore presente ma della forma sbagliata (o assente) resta [] — il
    // valore di NO_ERRORS con cui `result` e' partito — invece di propagare un
    // dato che romperebbe SectionErrors piu' a valle.
  }
  // Un 422 invalid-settings porta sempre almeno un errore vero (e' per questo che
  // il server l'ha mandato): se dopo aver scartato le voci mal formate non ne
  // resta nessuno, il corpo non aveva la forma attesa — e va trattato come tale,
  // cadendo nel ramo generico che mostra almeno il `detail` del problem, non
  // silenziosamente come "nessun errore".
  return anyRealError ? result : null;
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
  const bidderErrorsId = useId();
  const auctionNameErrorId = useId();

  // Le impostazioni sono un modulo: dal momento in cui si comincia a scrivere, la
  // verita' e' quella digitata, non quella del server. Per questo `form` e' stato
  // client — input dell'utente — e per questo `useSettings` non riaggiorna da solo:
  // un refetch sotto le dita riscriverebbe quello che si sta scrivendo.
  const [form, setForm] = useState<SaveSettingsRequest | null>(null);
  const [errors, setErrors] = useState<SettingsErrors>(NO_ERRORS);
  // Un problem diverso da invalid-settings (lega sconosciuta, errore interno, rete
  // caduta durante il salvataggio): non ha una sezione, quindi non entra in `errors`,
  // ma va detto comunque nello stesso, unico role="alert" — tacere sarebbe lasciare
  // chi ascolta senza sapere che il salvataggio non e' andato a buon fine.
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!settings.data || form) return;
    setForm({
      auctionName: '',
      bidder: settings.data.bidder,
      participants: settings.data.participants,
      scoring: settings.data.scoring,
    });
  }, [settings.data, form]);

  if (settings.isError) {
    return (
      <AppShell>
        <h1 className="sr-only">Impostazioni</h1>
        <p role="alert" className="text-sm font-bold text-destructive">
          {settings.error instanceof ProblemError
            ? settings.error.detail
            : 'Errore di rete: le impostazioni non si sono caricate. Riprova.'}
        </p>
      </AppShell>
    );
  }

  if (!form || !settings.data) {
    return (
      <AppShell>
        <h1 className="sr-only">Impostazioni</h1>
        <p className="text-sm text-muted-foreground">Carico le impostazioni…</p>
      </AppShell>
    );
  }

  const auctionOpen = settings.data.auctionOpen;
  const summary = errorSummary(errors) ?? saveError;

  return (
    <AppShell>
      <h1 className="w-exp mb-4 text-xl font-extrabold">Impostazioni</h1>

      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          setErrors(NO_ERRORS);
          setSaveError(null);
          save.mutate(form, {
            onSuccess: (result) => {
              // Un'asta e' nata: si va a batterla. Restare qui vorrebbe dire
              // guardare le impostazioni di una serata gia' cominciata.
              if (result?.auctionId) navigate('/asta');
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
          <label className="block text-sm">
            Nome dell'asta
            <input
              value={form.auctionName}
              aria-invalid={errors.auction.length > 0}
              aria-describedby={errors.auction.length > 0 ? auctionNameErrorId : undefined}
              onChange={(e) => setForm({ ...form, auctionName: e.target.value })}
              className="mt-1 block min-h-11 w-full max-w-md border border-line bg-transparent px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            />
            {/* Tutti i messaggi, non solo il primo: i validatori tornano l'elenco
                completo apposta, ed e' il motivo per cui questo task esiste. */}
            <SectionErrors id={auctionNameErrorId} errors={errors.auction} />
          </label>
        ) : null}

        <ParticipantsFieldset
          value={form.participants}
          onChange={(participants) => setForm({ ...form, participants })}
          errors={errors.participants}
        />

        <ScoringFieldset
          value={form.scoring}
          onChange={(scoring) => setForm({ ...form, scoring })}
          errors={errors.scoring}
          disabled={auctionOpen}
        />

        <fieldset className="border border-line p-4">
          <legend
            className="px-2 font-bold"
            aria-describedby={errors.bidder.length > 0 ? bidderErrorsId : undefined}
          >
            Battitore
          </legend>
          <div className="flex flex-wrap gap-4">
            <label className="text-sm">
              Secondi di countdown
              <NumberField
                value={form.bidder.bidTimerSeconds}
                onChange={(bidTimerSeconds) =>
                  setForm({
                    ...form,
                    bidder: { ...form.bidder, bidTimerSeconds },
                  })
                }
                className="tnum mt-1 block min-h-11 w-32 border border-line bg-transparent px-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.bidder.beepEnabled}
                onChange={(e) =>
                  setForm({
                    ...form,
                    bidder: { ...form.bidder, beepEnabled: e.target.checked },
                  })
                }
                className="h-11 w-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              />
              Avviso acustico allo scadere
            </label>
          </div>
          <SectionErrors id={bidderErrorsId} errors={errors.bidder} />
        </fieldset>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={save.isPending}
            className="min-h-11 bg-accent px-5 font-bold text-on-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground"
          >
            {save.isPending ? 'Salvo…' : auctionOpen ? 'Salva' : "Salva e comincia l'asta"}
          </button>

          {/* Un solo annuncio, col conto e il dove: tre alert di sezione che si
              popolano insieme se ne mangerebbero due. Il dettaglio sta accanto
              a ciascuna sezione, raggiungibile navigando. */}
          {summary ? (
            <p role="alert" className="text-sm font-bold text-destructive">
              {summary}
            </p>
          ) : null}
        </div>
      </form>
    </AppShell>
  );
}
