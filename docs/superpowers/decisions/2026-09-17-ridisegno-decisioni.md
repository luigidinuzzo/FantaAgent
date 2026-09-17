# Ridisegno dell'interfaccia — decisioni prese durante l'esecuzione

Otto task, ventidue commit, ognuno con revisione e ciclo di correzione, più una
revisione finale del ramo intero e un'ondata di correzioni. Questo documento tiene ciò
che non sta in git: cosa è stato deciso, perché, e cosa costa se la decisione era
sbagliata. Il registro operativo da cui viene è stato cancellato a esecuzione chiusa.

Spec: [2026-09-11-ridisegno-interfaccia-design.md](../specs/2026-09-11-ridisegno-interfaccia-design.md) ·
Piano: [2026-09-11-ridisegno-interfaccia.md](../plans/2026-09-11-ridisegno-interfaccia.md)

---

## 1. Difetti del piano e della spec

**L'endpoint di ricerca esisteva già.** La spec diceva di costruirlo. `GET …/players?q=`
è in `PlayerApi` dalla tappa 1: nessuna schermata React lo chiamava. Il lavoro si è
ridotto a un parametro `role` e a un pezzo di interfaccia. Corretto nella spec prima di
scrivere il piano.

**Il riepilogo sarebbe sparito per cinque commit.** La prima stesura del task 2
cancellava `RecapRoute` mentre il suo sostituto arrivava al task 7: revoca ed
esportazione CSV assenti nel mezzo. La cancellazione è stata spostata nel task che
consegna il rimpiazzo. Ogni task consegna un'applicazione che funziona.

**I numeri di `LeagueRules` non raggiungevano il frontend.** La schermata che crea
un'asta è proprio quella in cui `/state` risponde 409. `SettingsResponse` ha guadagnato
un campo di sola lettura, fuori da `SaveRequest`.

**`PitchLines` con `-z-10` non si sarebbe mai visto**, dietro lo sfondo opaco di una
radice senza contesto di impilamento. Nessun test l'avrebbe notato. Trovato nella
scansione pre-volo: `z-0`, con `relative z-10` su header e main.

**`useDebounced` con `useState(value)`** avrebbe reso la prima query già assestata al
primo render, saltando l'attesa proprio sulla prima lettera. Corretto dall'implementatore.

**`<span className="sr-only"> crediti</span>` non funziona.** Il calcolo del nome
accessibile rifila gli spazi ai bordi di ogni sottoalbero: «20» e «crediti» si
saldano. Lo spazio va nello stesso sottoalbero di entrambe le parti. Corretto
dall'implementatore, contro la mia indicazione.

**`role="radio"` su bottoni** prometteva a chi usa la tastiera una navigazione a frecce
che non c'era. Sostituiti da radio nativi in un `fieldset`: il browser dà roving
tabindex e frecce senza JavaScript.

---

## 2. Decisioni che hanno cambiato il codice

**`hardCap` e `confidenceStars` finalmente mostrati**, in `AnalysisPanel`, con la
confidenza detta a parole: «3» letto da un sintetizzatore non è una confidenza.
`walkAwayReason` invece era già in scena: la spec sbagliava a dirlo mai mostrato.

**La regola oxlint è cresciuta due volte.** `AnalysisPanel` (nuovo, mostra valutazioni)
e `PlayerTable` (vecchio, rende `row.maxBid`, e il varco più grande). Entrambe viste
fallire. La garanzia «il tetto non raggiunge la proiezione» resta a quattro punti.

**Un solo avviso d'errore fra aggiudicazione, cambio fase e annullamento.** Ogni gesto
azzera le altre due mutazioni prima di partire. Vedi §4 per la ragione sbagliata con
cui era stato inizialmente parcheggiato.

**La griglia delle rose è una colonna per partecipante, affiancate.** Con quattro
colonne che vanno a capo si perdeva il senso di `asta2`: scorrere una banda di ruolo e
leggere chi ha già riempito i portieri.

**Le fasce di ruolo sono a colore pieno e piatto**, con testo `on-accent`: la coppia
verificata in `contrast.test.ts`. Non il gradiente del mockup, che introdurrebbe valori
fuori palette.

**`/riepilogo` resta come indirizzo** e reindirizza a `/asta`. Deve restare una `path`
in `router.tsx`: `SpaRoutesControllerTest` confronta i due elenchi, e senza la riga un
ricaricamento profondo darebbe 404.

**`RoleBadge` ha una prop `size`** al posto di uno `scale-150`, che trasformava il
disegno ma non la scatola di layout.

**Il testo del pulsante di conferma resta «Salva» / «Salva e comincia l'asta»**, non il
«CONFERMA E CREA ASTA» del mockup. La motivazione data dall'implementatore (non rompere
i test) era cattiva; la scelta regge sui meriti, perché la schermata serve anche a
modificare un'asta già aperta e un'etichetta fissa «crea» mentirebbe.

---

## 3. Guardie che non guardavano

Il vizio più ricorrente dell'intera migrazione, trovato quattro volte anche qui:

- il test «zero controlli sulla proiezione, tabelloni pieni» aveva una fixture con
  `byRole` sempre vuoto: un bottone in una riga di giocatore passava inosservato;
- il test di `PitchLines` pinnava solo il moltiplicatore di opacità: uno stroke
  `#ffffff` letterale passava tutti i 28 test;
- `useIdleHeartbeat.test.ts` era instabile (289/290 alla prima esecuzione): due orologi
  in corsa, un `setImmediate` finto smaltito da un intervallo reale. Ora attende la
  condizione vera; 290/290 per dieci esecuzioni consecutive;
- nessun test copriva l'assenza di una capienza per ruolo quando `/state` e `/board` non
  coincidono (la difesa `?? 0` c'era, il test no).

Ogni guardia nuova o corretta è stata vista fallire con una mutazione deliberata.

---

## 4. Errori di giudizio, corretti

**Un ruling con la conclusione giusta e la ragione sbagliata.** I molti `role="alert"`
sulla schermata d'asta erano stati parcheggiati come rari, perché «richiedono due
mutazioni fallite in volo insieme». Falso: c'era un solo `.reset()` in tutto il
frontend. Un cambio fase fallito alle 21:03 e un annullamento fallito alle 21:40
restavano vivi insieme per tutta la serata. Una ragione falsa impedisce di rivalutare.

**Due rilievi di revisione su «qualcosa che manca» erano falsi** (una classe `min-w-11`
presente da due commit; un `?? 0` già presente). In entrambi i casi l'implementatore ha
contestato verificando sul sorgente. Da allora ogni rilievo andava citato con file:riga
e, se riguardava un'assenza, con il comando che la confermava.

**Una motivazione falsa in un resoconto.** Le fasce di ruolo erano state omesse «perché
la coppia di colori non è coperta dal test di contrasto»: il test esisteva, scritto nel
task 1 per quell'uso. Il codice era buono; la ragione no.

---

## 5. Debiti che restano

| Debito | Perché non ora |
|---|---|
| `BidderDialog.test.tsx` usa lo stesso meccanismo a due orologi che rendeva instabile `useIdleHeartbeat.test.ts`. Oggi non fallisce. | Fuori dai rilievi dell'ondata finale; la correzione è lo stesso idioma, già scritto |
| Sulla schermata d'asta possono coesistere due `role="alert"`: quello della barra e quello di `RosterGrid` nella sua scheda | Comporli richiede di portare l'errore della revoca fuori dal pannello; dichiarato nel sorgente |
| Crediti, numero squadre e slot modificabili per asta | Ciclo di vita di `LeagueRules` per asta: sotto-progetto della persistenza |
| Il «MAX» sulle card squadra | Un campo in `StateDtos`; calcolarlo nel browser metterebbe una regola di lega in due posti |
| Il pannello obiettivi | L'ultimo motivo per cui `/legacy` serve ancora |

---

## 6. Cosa ha retto

`adapter/in/web` non è stato toccato in ventidue commit, e i suoi **88** test — non 87
come dicevano i documenti precedenti, che sono antecedenti a `LegacyLinkPrefixTest` —
sono passati a ogni task.

Il jar impacchettato (`mvn clean -Pprod package`) è stato avviato e l'asta percorsa a
mano: creazione, ricerca per nome, battitore, aggiudicazione, rose, revoca, CSV, e la
proiezione in una seconda finestra con il lotto attivo e nessun prezzo consigliato
visibile.

Numeri finali: 290 test frontend, 432 Java.
