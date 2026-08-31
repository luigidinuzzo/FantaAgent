# Fantasy Football Auction Assistant — Design

**Data:** 2026-08-30
**Stato:** approvato, pronto per il piano di implementazione

---

## 1. Contesto e obiettivo

Applicazione locale a supporto dell'asta del Fantacalcio, usata in tempo reale durante
l'asta. L'utente cerca un giocatore e ottiene una raccomandazione strategica
contestuale allo stato corrente dell'asta, il cui elemento centrale e il **prezzo
massimo consigliato**.

Il prezzo massimo non è una valutazione assoluta del giocatore: e il prezzo oltre il
quale acquistarlo peggiora la rosa finale, dati budget residuo, slot da coprire,
giocatori ancora disponibili e composizione attuale della rosa.

L'applicazione separa nettamente due responsabilità:

- **calcolo deterministico** — l'applicazione: budget, slot, statistiche, valore
  marginale, prezzo massimo, confidenza;
- **ragionamento generativo** — Claude: interpretazione del contesto, rischi e
  opportunita non catturati dai numeri, formulazione della raccomandazione.

Claude non è mai la fonte di verità per dati strutturati e non produce numeri
statistici.

---

## 2. Regole di lega

### 2.1 Parametri confermati

| Parametro | Valore |
|---|---|
| Variante | Classic (ruoli singoli P/D/C/A) |
| Partecipanti | 8 |
| Budget per partecipante | 500 crediti |
| Dimensione rosa | 25 |
| Slot per ruolo | 3 P, 8 D, 8 C, 6 A |
| Formato asta | A chiamata per ruolo |
| Sequenza fasi | P -> D -> C -> A |
| Modificatore di difesa | Attivo |
| Modificatore portiere | Attivo |

Replacement level derivati (indice del giocatore marginale per ruolo):

| Ruolo | Formula | Indice |
|---|---|---|
| P | 8 x 3 + 1 | 25° portiere |
| D | 8 x 8 + 1 | 65° difensore |
| C | 8 x 8 + 1 | 65° centrocampista |
| A | 8 x 6 + 1 | 49° attaccante |

### 2.2 Parametri da fornire alla fase 0

Le seguenti tabelle sono **configurazione**, vivono in `application.yml`, e vanno
fornite prima dell'inizio della fase 5 (motore di valutazione). Il motore e
parametrico rispetto ad esse: nessun valore è cablato nel codice.

- **Tabella del modificatore di difesa**: soglie di media voto del reparto ->
  bonus/malus in gol, e definizione di quali giocatori entrano nel calcolo
  (portiere + 3 migliori difensori, oppure portiere + 4 difensori).
- **Tabella del modificatore portiere**: soglie -> bonus/malus, e regola di calcolo.
- **Tabella bonus/malus** completa della lega: gol per ruolo, assist, rigore
  segnato/sbagliato/parato, ammonizione, espulsione, gol subito, porta inviolata.

Fino a quando non sono disponibili, la configurazione contiene valori segnaposto
esplicitamente marcati, e la validazione all'avvio rifiuta l'avvio in modalità asta
se i segnaposto non sono stati sostituiti.

---

## 3. Requisiti funzionali

| ID | Requisito |
|---|---|
| FR1 | Ricerca giocatore per nome, fuzzy, tollerante a errori di battitura, con ranking pesato per rilevanza |
| FR2 | Analisi contestuale: prezzo di mercato atteso, prezzo massimo, margine, confidenza, punti di forza, rischi, razionale |
| FR3 | Registrazione acquisto tramite comando testuale singolo: giocatore, prezzo, partecipante |
| FR4 | Annullamento dell'ultimo acquisto |
| FR5 | Stato asta derivato: budget residui, rose, slot scoperti, pool residuo per ruolo, inflazione per fase |
| FR6 | Persistenza durevole e ripristino esplicito della sessione dopo un crash |
| FR7 | Vista tabellone con budget, rosa e slot residui di tutti gli 8 partecipanti |
| FR8 | Lista target della fase corrente, ordinata per margine |
| FR9 | Avanzamento di fase (P -> D -> C -> A) |
| FR10 | Import del listone e delle statistiche da file, con report di riconciliazione |
| FR11 | Generazione pre-asta dei dossier qualitativi (squadre e giocatori) |

---

## 4. Requisiti non funzionali

### 4.1 Budget di performance

Obiettivi verificabili, implementati come test.

| Operazione | Target |
|---|---|
| Ricerca giocatore | < 50 ms |
| Valutazione completa (motore) | < 80 ms |
| Registrazione acquisto, fsync incluso | < 100 ms |
| Primo byte del ragionamento di Claude | < 1.5 s |
| Advice completa | < 6 s |
| Registrazione acquisto da parte dell'utente | < 3 s, senza mouse |

### 4.2 Altri requisiti

- **Degradazione controllata**: se Claude è lento o non disponibile, l'applicazione
  resta pienamente utilizzabile con i soli numeri deterministici.
- **Zero setup**: nessun database da avviare, nessuna build del frontend.
- **Testabilità senza rete**: dominio e motore testabili senza Spring e senza API.
- **Sicurezza della chiave**: `ANTHROPIC_API_KEY` solo da variabile d'ambiente, mai
  nel repository, mai nei log.
- **Controllo dei costi**: ogni chiamata LLM loggata con token, latenza e costo stimato.
- **Riproducibilità**: garantita per record/replay, non per determinismo del modello
  (vedi ADR-8).
- **Sostituibilità del provider LLM**: tramite una porta a due metodi.

---

## 5. Decisioni architetturali

### ADR-1 — Architettura esagonale leggera, modulo Maven singolo

Tre package con dipendenza unidirezionale (`domain` -> nessuna; `application` ->
`domain`; `adapter` -> entrambi), verificata da ArchUnit.

Solo due boundary sono rigidi, ed entrambi servono un requisito esplicito:
`domain/strategy` isolato (testabile senza Spring, in millisecondi) e
`StrategicAdvisor` come porta (applicazione funzionante senza Claude, provider
sostituibile). Ogni altro boundary sarebbe cerimoniale.

Modulo singolo è non multi-modulo: il multi-modulo Maven serve a impedire dipendenze
a compile-time in un team; qui ArchUnit ottiene lo stesso risultato con un test,
senza complicare la build. Promuovere a multi-modulo in seguito è meccanico.

### ADR-2 — Nessun database

I dati complessivi stanno sotto i 3 MB (listone ~500 KB, statistiche ~1.5 MB, eventi
d'asta ~40 KB, dossier ~400 KB). Non esiste un problema di volume, query complesse,
concorrenza o transazioni.

- Dati di riferimento: file, caricati in memoria all'avvio.
- Stato asta: log JSONL append-only con `fsync`, che fornisce già durabilità e audit
  trail — le uniche due proprietà per cui servirebbe un database.

MongoDB è stato valutato e **scartato**: aggiunge un processo da avviare prima di
ogni asta, driver e mapping, e perde la validazione che i record Java forniscono
gratuitamente, senza risolvere alcun problema esistente.

SQLite/H2 embedded è l'alternativa più sensata di Mongo è va riconsiderata quando
servira storicizzare più stagioni per analisi comparative. La migrazione è a basso
costo perché il dominio è disaccoppiato dalla persistenza.

### ADR-3 — Event sourcing leggero per lo stato dell'asta

Log append-only di eventi immutabili; `AuctionState` è una proiezione ricostruita in
memoria per fold. Nessun event store, nessun CQRS, nessun framework, nessun
versioning di aggregati.

Motivazione: annullamento e ripristino da crash sono requisiti reali, non ipotetici.
Il costo aggiuntivo rispetto a uno stato mutabile è di circa 70 righe. L'event
sourcing completo sarebbe cerimoniale: non ci sono proiezioni multiple, ne
concorrenza, ne consumatori esterni.

Nessuno snapshot: il replay di 300 eventi richiede millisecondi.

L'annullamento è un evento compensativo (`PurchaseRevoked`), non un troncamento del
file: il log resta immutabile e l'audit completo.

### ADR-4 — Motore di valutazione E2: valore marginale su completamento greedy

Il prezzo massimo emerge dal confronto tra la migliore rosa ancora completabile con e
senza il giocatore in esame. Dettaglio in sezione 7.

Alternative valutate e scartate:

- **E1, additivo con termine di sinergia**: più semplice, ma richiede di tarare a mano
  il peso della sinergia difensiva e la ripartizione del budget per fase — esattamente
  le due aree dove le regole di questa lega sono più particolari. Rischio di falsa
  precisione.
- **E3, Monte Carlo sui prezzi di chiusura**: fornirebbe intervalli di confidenza veri,
  ma richiede molti parametri da tarare senza dati per tararli, e non è testabile in
  modo deterministico. È l'evoluzione naturale di E2 (E2 ne è il caso deterministico),
  non un punto di partenza.

### ADR-5 — SDK Anthropic ufficiale dietro una porta, non Spring AI

`com.anthropic:anthropic-java` dietro l'interfaccia `StrategicAdvisor`.

Spring AI introdurrebbe un'astrazione che duplica esattamente quella porta,
ritardando l'accesso alle funzionalita che qui contano (structured output tipizzato,
prompt caching con breakpoint espliciti, controllo dell'effort) senza ridurre il
vendor lock-in meglio di un'interfaccia a due metodi.

### ADR-6 — Risposta a due livelli, con streaming

Il ramo deterministico e il ramo LLM partono insieme e arrivano separatamente: i
numeri in ~80 ms, il ragionamento in streaming via SSE.

Motivazione: in un'asta il tempo tra chiamata e aggiudicazione è di 10-30 secondi.
Una risposta sincrona che attende Claude arriverebbe dopo l'aggiudicazione, rendendo
l'applicazione inutile nel momento in cui serve. Questo vincolo, non l'eleganza
architetturale, e il driver principale del design.

### ADR-7 — UI server-rendered senza build step

Thymeleaf per lo scheletro, HTMX per ricerca e registrazione, SSE per lo streaming,
circa 200 righe di JavaScript nativo per hotkey e parsing dei comandi.

Un framework SPA aggiungerebbe un passo di build, `node_modules` e una superficie di
errore, in cambio di nulla di percepibile su un'applicazione locale mono-utente. Il
backend espone comunque un contratto JSON, quindi una riscrittura futura della UI e
possibile senza toccarlo.

### ADR-8 — Riproducibilità per record/replay

Il parametro `temperature` non è disponibile sui modelli correnti, quindi la
riproducibilità non è ottenibile per determinismo del modello.

È ottenuta invece così:

1. La parte che guida la decisione — `PriceRecommendation` — proviene dal motore ed e
   deterministica per costruzione.
2. Ogni chiamata LLM viene registrata su file (hash del prompt, identificativo del
   modello, risposta completa) e riprodotta in test e in analisi post-asta senza
   contattare l'API.
3. Il `ValuationContext` serializzato viene loggato, il che consente di ricostruire
   esattamente lo stato che ha prodotto una data raccomandazione.

### ADR-9 — Politica degli errori asimmetrica

- **Errori di configurazione: rumorosi e bloccanti, prima dell'asta.** Una lega mal
  configurata produce numeri sbagliati per tutta la serata senza che l'utente se ne
  accorga: deve impedire l'avvio.
- **Errori di runtime: silenziosi e degradanti, durante l'asta.** Un timeout di Claude
  deve solo far sparire un riquadro. Non esiste alcuna condizione, durante un'asta, in
  cui un crash sia la risposta giusta.

---

## 6. Modello di dominio

### 6.1 Player reference — immutabile, caricato all'avvio

- `Player` — identificativo, nome, alias, squadra, ruolo, quotazione di listino
- `Role` — enum P, D, C, A
- `SeasonStats` — stagione, presenze, minuti, media voto, fantamedia, gol, assist,
  rigori segnati/sbagliati/parati, ammonizioni, espulsioni, porte inviolate
- `PlayerProjection` — derivato: `basePoints`, presenze attese, probabilita di
  titolarità, incertezza
- `Tier` — fascia derivata dai punti attesi, per ruolo

`PlayerProjection` contiene i punti attesi **base**, senza modificatori. Il termine
dei modificatori dipende dalla rosa e viene calcolato dal motore. Questo mantiene la
proiezione cacheabile e il motore puro.

### 6.2 League — configurazione

- `LeagueRules` — budget, slot per ruolo, numero di partecipanti, sequenza delle fasi
- `ScoringRules` — bonus/malus, `DefenceModifier`, `GoalkeeperModifier`
- `Participant` — identificativo, nome, iniziale, flag `isMe`

### 6.3 Auction ledger

- `sealed interface AuctionEvent` con implementazioni `AuctionStarted`,
  `PhaseAdvanced`, `PlayerPurchased`, `PurchaseCorrected`, `PurchaseRevoked`
- `AuctionState` — proiezione derivata, mai mutata direttamente
- `AuctionPhase` — ruolo in asta, slot residui nella fase
- `Squad` — rosa per partecipante, con slot coperti e scoperti
- `Budget` — totale, speso, residuo, impegno minimo, massimo spendibile ora

### 6.4 Valuation & strategy

- `RosterPlan` — esito del completamento greedy: quali giocatori si comprerebbero, a
  quale prezzo, in quale fase. È un **risultato**, non una configurazione.
- `DefensiveBlock` — difensori raggruppati per squadra, con contributo marginale
- `MarginalValue` — valore marginale del giocatore rispetto al completamento
- `InflationIndex` — per fase, con shrinkage
- `MarketPressure` — domanda residua per ruolo e tier, `maxRivalBid`
- `ValuationContext` — input completo e serializzabile al motore
- `PriceRecommendation` — `expectedPrice`, `maxBid`, `hardCap`, margine,
  `walkAwayReason`, `confidence`, lista di `Driver`
- `Driver` — nome, contributo numerico, spiegazione
- `Confidence` — valore aggregato più i quattro fattori componenti

### 6.5 Advisory

- `PlayerDossier` — profilo qualitativo statico, generato pre-asta
- `TeamDossier` — contesto qualitativo di squadra, generato pre-asta
- `AuctionAdvice` — raccomandazione contestuale prodotta da Claude a runtime

### 6.6 Concetti esclusi e motivazione

- **`Bid`** — i singoli rilanci non sono osservabili in modo affidabile e non servono
  al calcolo. L'unico evento che conta è l'aggiudicazione.
- **`Purchase` come entita separata** — già rappresentata da `PlayerPurchased`.
- **`AuctionRecommendation` unificata** — scissa in `PriceRecommendation`
  (deterministica) e `AuctionAdvice` (generativa), che hanno origine, latenza e
  criteri di test completamente diversi.

---

## 7. Motore di valutazione (E2)

### 7.1 Stadio 0 — Punti attesi base, pre-asta

```
basePoints(p) = fantamediaAttesa(p) x presenzeAttese(p)
```

`fantamediaAttesa` è la media pesata delle ultime 3 stagioni (pesi 0.5, 0.3, 0.2) con
shrinkage bayesiano verso la media di ruolo:

```
fm_adj = (n * fm_osservata + k * fm_ruolo) / (n + k)      n = presenze, k ~ 15
```

Lo shrinkage è necessario: senza, il motore sopravvaluta sistematicamente i giocatori
con pochissime presenze e fantamedia alta.

```
presenzeAttese = probabilitaTitolarita x 38 x fattoreDisponibilita
```

I bonus/malus della lega si applicano in questo stadio. I modificatori no.

### 7.2 Stadio 1 — Modificatori come termine di reparto

Il modificatore non è una proprietà del giocatore ma una funzione della media voto del
reparto schierato, mappata su bonus tramite una tabella a gradini `f`:

```
modifierPoints(squad) ~ 38 x f(mvRepartoAttesa(squad))
```

Il contributo di un singolo giocatore è quindi una differenza:

```
marginalPoints(p | squad) = basePoints(p)
                          + [ modifierPoints(squad + p) - modifierPoints(squad) ]
```

Questa formulazione gestisce difesa e portiere con lo stesso codice, senza casi
speciali.

Lo stacking emerge dal calcolo perché `f` è una funzione a gradini, quindi convessa a
tratti: portare la media del reparto oltre una soglia può valere più di un difensore
nominalmente migliore che non la fa scattare. Nessun coefficiente di sinergia viene
tarato a mano.

Conseguenza pratica: con entrambi i modificatori attivi, il portiere titolare di una
difesa solida alza la media del reparto e ha media voto alta, quindi vale
significativamente più di quanto suggerisca qualunque listino generico. Questo
riguarda la prima fase dell'asta.

### 7.3 Stadio 2 — Prezzi attesi di mercato

```
prior(p)          = quotazione di listino riscalata sul budget della lega
inflazioneForward = creditiResiduiTotaliLega
                    / somma dei prior dei giocatori roster-worthy disponibili
expectedPrice(p)  = prior(p) x inflazioneForward x biasFase(ruolo)
```

Un giocatore è **roster-worthy** se rientra fra i primi `partecipanti x slot(ruolo)`
del proprio ruolo per punti attesi, cioè fra i giocatori che verranno effettivamente
acquistati da qualcuno. Quelli oltre la soglia non assorbono budget significativo e
sono esclusi dal denominatore.

`inflazioneForward` è forward-looking: se restano molti crediti e pochi giocatori
validi, i prezzi saliranno e il motore lo sa prima che accada.

`biasFase` è la correzione osservata sulla fase corrente (prezzi pagati / prior dei
venduti), con shrinkage verso 1.0 quando i campioni sono pochi.

### 7.4 Stadio 3 — Completamento greedy

```
completaRosa(squad, budget, disponibili):
    finché slot residui > 0:
        per ogni candidato c nei ruoli ancora scoperti:
            gain(c)  = marginalPoints(c | squad) - replacement(ruolo(c))
            cost(c)  = max(1, expectedPrice(c))
            ammissibile se cost(c) <= budget - (slotResidui - 1)
            score(c) = gain(c) / cost(c)
        seleziona il candidato ammissibile con score massimo
        squad += c ; budget -= cost(c)
    ritorna (squad, puntiTotali)
```

Il greedy per rapporto valore/prezzo è l'euristica standard per il problema dello
zaino; con 25 slot su circa 600 candidati l'errore rispetto all'ottimo è trascurabile.

**Correzione necessaria**: con i modificatori, `marginalPoints` dipende dall'ordine di
inserimento, quindi il greedy può fissarsi su un blocco difensivo sub-ottimo. Dopo il
completamento viene eseguita una passata di **local search**: per ogni giocatore
selezionato si tenta lo scambio con un candidato non selezionato dello stesso ruolo e
costo comparabile, accettando lo scambio se i punti totali migliorano. Due o tre
iterazioni.

Il motore è dichiaratamente **euristico**. La scelta è appropriata perché l'incertezza
sui prezzi attesi è di gran lunga superiore all'errore del greedy: raffinare
ulteriormente l'ottimizzazione significherebbe ottimizzare rumore.

### 7.5 Stadio 4 — Valore marginale e prezzo massimo

```
V_senza       = completaRosa(miaRosa, mioBudget, disponibili \ {p}).punti
V_con(prezzo) = completaRosa(miaRosa + p@prezzo, mioBudget - prezzo,
                             disponibili \ {p}).punti

surplus(prezzo) = V_con(prezzo) - V_senza
maxBid          = max { prezzo intero : surplus(prezzo) > 0 }
```

`surplus` e monotono decrescente nel prezzo, quindi `maxBid` si determina per ricerca
binaria su `[1, hardCap]`, con circa 8 valutazioni di `completaRosa`.

Costo stimato: ogni `completaRosa` è nell'ordine di 25 x 200 = 5.000 operazioni; con
la local search il totale resta entro i 60 ms.

```
hardCap = budgetResiduo - (slotResidui - 1)
```

`hardCap` e imposto come invariante esplicito e verificato da property test, anche se
il greedy lo rispetterebbe implicitamente.

**Output principale** — tre valori:

| Valore | Significato |
|---|---|
| `expectedPrice` | quanto lo pagherà il mercato |
| `maxBid` | oltre questo prezzo la rosa peggiora |
| margine | differenza tra i due, con segno |

Il caso di maggior valore è `maxBid < expectedPrice`: il mercato pagherà più di quanto
convenga, quindi il giocatore va lasciato e i crediti impiegati altrove. È una
raccomandazione che un listino statico non può produrre.

### 7.6 Stadio 5 — Pressione di mercato

```
maxRivalBid(ruolo) = massimo, sugli avversari con slot scoperto in quel ruolo,
                     di ( budget_i - (slot_i - 1) )
```

Usi: se `maxRivalBid` è basso non è necessario partire alto; se molti avversari
possono superare la propria soglia, la probabilita di aggiudicazione è bassa e conviene
dirottare su un'alternativa mentre il prezzo è ancora contenuto.

`domandaResidua(tier)` conta gli avversari con slot scoperto in quel ruolo e budget
sufficiente per il prezzo atteso del tier.

### 7.7 Stadio 6 — Confidenza

Quattro fattori indipendenti in `[0, 1]`, combinati con **media geometrica**, che
penalizza il fattore peggiore:

| Fattore | Definizione |
|---|---|
| Dati statistici | presenze osservate rispetto a una soglia |
| Titolarità | complemento dell'incertezza sulla probabilita di titolarità |
| Calibrazione di mercato | acquisti osservati nella fase corrente rispetto a una soglia |
| Stabilita | variazione di `maxBid` perturbando `expectedPrice` di +/- 15% |

Nella fase portieri la confidenza sarà bassa per costruzione, non essendo ancora stato
osservato alcun prezzo della lega. Questo va mostrato apertamente all'utente: il
sistema deve dichiarare l'incertezza sul mercato, non simulare precisione.

### 7.8 Driver

Ogni raccomandazione espone da 3 a 5 driver con contributo numerico esplicito, ad
esempio:

```
- Blocco difensivo Inter: +2.1 punti/stagione marginali (terzo difensore)
- Budget: hardCap 61, riservati 178 crediti per le fasi C e A
- Alternativa: Bastoni a ~38 rende il 94%, differenza reale 7 crediti
- Inflazione fase D osservata: +12% su 22 acquisti
- maxRivalBid: 47 (Marco, 3 slot difensivi scoperti)
```

I driver alimentano il prompt di Claude, che li interpreta senza mai ricalcolarli.

---

## 8. Gestione dello stato dell'asta

Log append-only di eventi immutabili su `events.jsonl`, con `fsync` a ogni scrittura.
`AuctionState` è ricostruito per fold all'avvio e mantenuto in memoria.

`AuctionEvent` è una `sealed interface` di dominio e non conosce Jackson: la
serializzazione polimorfica vive in un DTO nell'adapter `out/file`, con mapping
esplicito. Sono alcune righe in più rispetto ad annotare il record di dominio, ed e il
prezzo consapevole della testabilità del dominio senza librerie.

**Ripristino esplicito**: all'avvio, se esiste una directory d'asta per la data
corrente, l'applicazione non riprende in silenzio ma chiede conferma indicando numero
di acquisti e fase corrente. Riprendere silenziosamente uno stato sbagliato sarebbe
peggio di non riprendere.

**Backup** di `events.jsonl` a ogni cambio di fase.

---

## 9. Integrazione Claude

### 9.1 Tre tipi di contenuto

**`TeamDossier`** — 20 squadre, generato pre-asta. Il giudizio qualitativo che serve ai
modificatori (solidità difensiva attesa, cambio di allenatore, mercato, gerarchia tra
i pali, rigorista) e una proprietà della squadra, non del singolo giocatore.
Generarlo una volta per squadra invece di ripeterlo in ogni dossier individuale riduce
il costo ed elimina il rischio di giudizi incoerenti sulla stessa difesa.

**`PlayerDossier`** — circa 280 giocatori di shortlist, generati pre-asta in batch.
Profilo tattico, rischi strutturali, upside, note sulla titolarità. Modello
`claude-opus-5`, effort alto, Batch API (-50%), output tipizzato, cache su file con
invalidazione manuale.

**`AuctionAdvice`** — runtime, in streaming. Unica chiamata nel percorso critico.
Modello `claude-opus-5` con thinking adattivo ed effort basso: il ragionamento pesante
e già nei numeri, qui serve sintesi rapida.

### 9.2 Struttura del prompt e caching

L'ordine di rendering è `tools -> system -> messages`; qualunque byte modificato
invalida tutto ciò che segue.

| Blocco | Contenuto | Token stimati | Cache |
|---|---|---|---|
| system | Regole di lega, tabelle dei modificatori, rubrica, semantica dei driver, formato di output, guardrail | ~1.500 | breakpoint |
| system | I 20 `TeamDossier` | ~6.000 | breakpoint |
| user | `PlayerDossier`, driver numerici, stato asta, `RosterPlan` | ~1.200 | volatile, in coda |

Il TTL della cache va verificato in fase 7: con l'asta a fasi ci sono pause tra le
chiamate e un TTL breve produrrebbe miss sistematici. L'impatto economico è di pochi
centesimi, non è un rischio di progetto. Va comunque misurato su
`usage.cache_read_input_tokens`: un valore costantemente nullo indica un invalidatore
silenzioso, tipicamente un timestamp o un JSON con chiavi non ordinate.

### 9.3 Schema di output

```java
record AuctionAdvice(
    Verdict      verdict,          // PUSH | FAIR | PASS
    int          adjustedMaxBid,
    String       oneLiner,         // massimo 120 caratteri
    List<String> strengths,        // massimo 3
    List<String> risks,            // massimo 3
    String       rationale,        // 2-4 frasi
    String       adjustmentReason  // obbligatorio se adjustedMaxBid != maxBid
)
```

### 9.4 Guardrail

Implementato in codice, non come istruzione nel prompt:

```
accettato   se |adjustedMaxBid - maxBid| <= 0.15 * maxBid  e  adjustedMaxBid <= hardCap
altrimenti  clamp al limite, log dell'evento, confidenza declassata
```

Claude può spostare il numero entro una banda, motivando. Non può violare il vincolo
di budget.

### 9.5 Tool calling

**Non incluso nell'MVP.** Il contesto sta sotto i 9.000 token e l'applicazione sa già
quali dati servono: un round-trip aggiuntivo costerebbe latenza senza produrre valore.

Previsti in una fase successiva, entrambi restituiscono calcoli del motore e non dati
grezzi:

- `simulate_purchase(playerId, price)` — stato risultante è nuovo `RosterPlan`,
  consente a Claude di verificare l'effetto di un prezzo invece di stimarlo;
- `compare_alternatives(role, maxPrice)` — le cinque migliori alternative con margine.

Nessun subagent: non c'e fan-out ne ricerca aperta.

### 9.6 Resilienza

- timeout di 8 secondi, poi abbandono silenzioso;
- un solo retry, esclusivamente su errori ritentabili (429, 5xx, errori di
  connessione); mai su 400;
- circuit breaker: dopo due fallimenti consecutivi Claude viene disabilitato per 60
  secondi;
- l'errore non è mai bloccante: il riquadro mostra l'indisponibilita del ragionamento e
  il resto della scheda resta completo.

### 9.7 Costi stimati

| Voce | Costo |
|---|---|
| 20 `TeamDossier`, in batch | ~0.5 USD |
| 280 `PlayerDossier`, in batch | ~4.2 USD |
| ~70 `AuctionAdvice` runtime, con prefisso cachato | ~1.7 USD |
| **Totale per asta** | **~6.5 USD** |

Ogni chiamata è registrata su `llm-calls.jsonl` con token, latenza, costo stimato e
modello.

---

## 10. Interfaccia utente

Requisito guida: registrazione di un acquisto in meno di 3 secondi, senza mouse.
Priorità dichiarata: velocità, poi chiarezza, poi estetica.

### 10.1 Layout

Schermata unica con tre zone: barra di stato in alto (fase, avanzamento, inflazione,
budget e slot propri), colonna principale a sinistra (barra di input e scheda del
giocatore), tabellone a destra (8 partecipanti con budget, rosa e slot residui, più
`maxRivalBid` della fase).

Nella scheda del giocatore la gerarchia visiva primaria è costituita da
`expectedPrice`, `maxBid` e il margine, seguiti dalla confidenza, dai driver e dal
riquadro in streaming del ragionamento di Claude.

### 10.2 Barra unica: ricerca e comando

Un solo campo di input, nessuna modalità da commutare.

```
bast                 ricerca e analizza in tempo reale il primo risultato
bast 47      invio   registra: giocatore acquistato dall'utente per 47
bast 47 m    invio   registra: giocatore acquistato da Marco per 47
```

Grammatica: `<giocatore> [prezzo] [partecipante]`. Il ruolo è implicito nella fase
corrente e non va mai digitato. Il partecipante predefinito è l'utente. I partecipanti
si identificano per iniziale, disambiguata solo quando necessario.

### 10.3 Hotkey

| Tasto | Azione |
|---|---|
| `/` o `Esc` | focus sulla barra |
| `Invio` | registra |
| `Ctrl+Z` | annulla l'ultimo acquisto |
| freccia su / giu | scorre i risultati di ricerca |
| `Ctrl+L` | apre e chiude la lista target della fase |

**Nessuna modale di conferma.** Dopo l'invio compare un avviso non bloccante con la
possibilità di annullare. Un dialogo di conferma costerebbe più tempo di quanto ne
farebbe risparmiare, e l'annullamento è già previsto dal modello a eventi.

### 10.4 Ricerca

Normalizzazione (minuscole, rimozione degli accenti), match su prefisso e su
sottosequenza, e ranking pesato per i punti attesi del giocatore: a parita di match
deve emergere il giocatore rilevante. I giocatori della fase corrente hanno priorità
nei risultati.

### 10.5 Lista target

`Ctrl+L` apre l'elenco dei migliori giocatori disponibili della fase corrente,
ordinati per margine (`maxBid - expectedPrice`), con evidenziazione dei casi a margine
negativo.

Il motore calcola già questi valori per il completamento greedy: esporli costa una
vista. Con l'asta a fasi risponde alla domanda operativa più importante nel momento in
cui tocca all'utente chiamare.

---

## 11. Persistenza e configurazione

### 11.1 Struttura dei dati

```
data/
  reference/
    sources.yaml          mappatura file -> campi, pesi stagioni, alias
    listone-2026.xlsx     fornito dall'utente
    stats-*.csv           fornito dall'utente
    normalized.json       prodotto dall'import
  dossiers/
    teams/*.json
    players/*.json
  auctions/<data>/
    events.jsonl          append-only, fsync
    llm-calls.jsonl
    valuations.jsonl
```

### 11.2 Configurazione

`application.yml` contiene le regole di lega: budget, slot, partecipanti, sequenza
delle fasi, tabella bonus/malus e le due tabelle dei modificatori.

`.env` contiene esclusivamente `ANTHROPIC_API_KEY`, è gitignorato, e `.env.example` è
versionato. La chiave non viene mai scritta nei log.

Elementi gitignorati: `.env`, `data/auctions/`, `data/dossiers/`, i file di riferimento
forniti dall'utente.

### 11.3 Validazione all'avvio

Bloccante: somma degli slot pari alla dimensione rosa; budget positivo; 8 partecipanti
con iniziali non ambigue; tabelle dei modificatori monotone crescenti e prive di
segnaposto; file di riferimento presenti e importabili.

L'assenza della chiave API **non e** bloccante: l'applicazione parte in modalità
offline con un banner esplicito e il motore pienamente funzionante.

Profili Spring: `default`, `offline` (usa `FixtureStrategicAdvisor`), `test`.

---

## 12. Testing

| Livello | Oggetto | Modalità |
|---|---|---|
| Dominio e strategia | Motore, proiezioni, modificatori | JUnit puro, senza Spring e senza rete |
| Property-based | `maxBid <= hardCap` sempre; `surplus` monotono decrescente nel prezzo; `hardCap` non crescente attraverso qualunque acquisto a prezzo >= 1 (invariante vera e strutturale). NOTA: una precedente versione di questa spec affermava che `maxBid` non cresce al calare degli slot residui. E' falso: a budget invariato, meno slot residui significano meno crediti da riservare, quindi il tetto SALE. Sotto riduzione per acquisto la tendenza esiste ma non e' una legge — il motore e' euristico e ogni acquisto toglie anche un concorrente dal pool, il che puo' far salire il surplus del giocatore in esame. Verificato empiricamente: circa il 20% di violazioni a coppie sotto randomizzazione ampia. Resta coperto da un test di regressione su sequenza fissa, non da una property | Generatori di stati d'asta casuali |
| Golden test | Inizio asta; metà fase D con blocco difensivo avviato; finale con 2 slot e 5 crediti | Scenari fissi con `maxBid` atteso |
| Modificatori | Un difensore che porta il reparto oltre una soglia deve battere un difensore con `basePoints` superiore che non la fa scattare | E il comportamento distintivo del motore |
| Projector | Sequenza di eventi -> stato atteso, incluso annullamento | Tabellare |
| Ingestion | File di esempio -> report di riconciliazione, inclusi nomi non risolti | |
| Adapter LLM | Il guardrail effettua il clamp; il circuit breaker apre; il timeout degrada correttamente | `FixtureStrategicAdvisor` con risposte registrate |
| Architettura | `domain` non importa Spring, Anthropic o Jackson; `application` non importa `adapter` | ArchUnit |

Un solo smoke test Spring Boot per l'avvio del contesto. Nessun test end-to-end
pesante: su un'applicazione locale mono-utente costerebbe più di quanto protegga.

---

## 13. Observability e sicurezza

`llm-calls.jsonl` registra modello, token in ingresso/uscita/da cache, latenza, costo
stimato e hash del prompt.

`valuations.jsonl` registra il `ValuationContext` serializzato è la
`PriceRecommendation`, consentendo di ricostruire a posteriori l'origine di ogni
raccomandazione e fornendo il dataset per migliorare il motore nelle stagioni
successive.

Actuator per l'health check; Micrometer minimale per le latenze p50 e p95 di
valutazione e advice.

La chiave API proviene esclusivamente da variabile d'ambiente e non viene mai loggata.
Nessun dato personale viene trattato.

---

## 14. Struttura del repository

```
fanta-agent/
  pom.xml
  run.sh
  .env.example
  README.md
  docs/superpowers/specs/
  data/                                   (gitignorato, tranne gli esempi)
  src/main/java/com/fantaagent/
    domain/
      player/    Player, Role, SeasonStats, PlayerProjection, Tier
      league/    LeagueRules, ScoringRules, DefenceModifier,
                 GoalkeeperModifier, Participant
      auction/   AuctionEvent (sealed), AuctionState, AuctionPhase,
                 Squad, Budget, AuctionProjector
      strategy/  ValuationEngine, RosterCompleter, LocalSearch,
                 ReplacementLevel, InflationIndex, MarketPressure,
                 DefensiveBlock, RosterPlan, ValuationContext,
                 PriceRecommendation, Driver, Confidence
      advice/    PlayerDossier, TeamDossier, AuctionAdvice, Verdict
    application/
      port/in/   AnalyzePlayer, RecordPurchase, SearchPlayers, ManageAuction
      port/out/  PlayerCatalog, AuctionEventStore, DossierStore,
                 StrategicAdvisor
      service/   PlayerAnalysisService, AuctionService, PlayerSearchService
    adapter/
      in/web/    PlayerController, AuctionController,
                 AdviceStreamController (SSE), dto/
      out/file/  FilePlayerCatalog, JsonlAuctionEventStore,
                 FileDossierStore, event/ (DTO di serializzazione)
      out/llm/   AnthropicStrategicAdvisor, PromptBuilder, AdviceSchema,
                 AdviceGuardrail, LlmCallLogger, ResilientAdvisor
      out/llm/fixture/  FixtureStrategicAdvisor
    ingestion/   ListoneImporter, StatsImporter, NameResolver,
                 ReconciliationReport
    config/      LeagueProperties, AnthropicProperties, BeanConfig,
                 StartupValidator
  src/main/resources/
    prompts/     system-advice.md, system-dossier.md, system-team-dossier.md
    templates/   index.html, fragments/
    static/      app.js, app.css
    application.yml
  src/test/java/com/fantaagent/
    domain/, strategy/, adapter/, architecture/ArchUnitTest
```

I prompt risiedono in `resources/prompts` come file Markdown e non come stringhe Java:
sono così diffabili, versionabili e modificabili senza ricompilare, il che conta
durante la messa a punto.

---

## 15. Roadmap

| Fase | Contenuto | Criterio di completamento |
|---|---|---|
| 0 | Regole di lega definitive: tabelle dei modificatori, bonus/malus, partecipanti | `application.yml` completo e validato, senza segnaposto |
| 1 | Skeleton Maven e Spring Boot, `run.sh`, ArchUnit, validazione della configurazione | `./run.sh` avvia l'applicazione; i test di architettura passano |
| 2 | Ingestion: importer XLSX/CSV, `NameResolver`, report di riconciliazione | Il listone reale si importa; gli scarti sono elencati |
| 3 | Proiezioni: `basePoints` con shrinkage, tier, replacement level | Classifica per ruolo ispezionabile e coerente |
| 4 | Auction ledger: eventi, JSONL con fsync, projector, annullamento, ripristino | 50 acquisti, processo terminato, riavvio: stato intatto |
| 5 | Motore E2: modificatori, greedy, local search, ricerca binaria, confidenza, driver | `maxBid` motivato in meno di 80 ms; property e golden test verdi |
| 6 | Ricerca fuzzy e UI base: barra unica, parsing dei comandi, scheda numerica, tabellone | **L'applicazione è utilizzabile in asta senza Claude** |
| 7 | Claude: porta, dossier in batch, advice in streaming SSE, caching, guardrail, circuit breaker | Analisi in streaming; senza rete l'applicazione continua a funzionare |
| 8 | Rifinitura UI: hotkey, avvisi non bloccanti, lista target, layout definitivo | Acquisto registrato in meno di 3 secondi senza mouse |
| 9 | Hardening e prova generale: logging, backup, simulazione d'asta cronometrata | Un'asta simulata completa, senza intoppi |

Due proprietà volute della sequenza: dopo la fase 6 esiste già uno strumento
utilizzabile anche in caso di tempo insufficiente, e la fase 5, dove si concentra il
rischio tecnico, arriva presto e con test veri.

La fase 9 non è opzionale: un'applicazione d'asta che si rivela difettosa durante
l'asta è peggio della sua assenza.

---

## 16. Fuori scope per l'MVP

Escluso deliberatamente, con la motivazione:

- **Database** — nessun problema di volume, query o concorrenza (ADR-2).
- **Tool calling e subagent** — costerebbero latenza senza valore aggiunto a questo
  livello di contesto (9.5).
- **Monte Carlo sui prezzi** — troppi parametri senza dati per tararli (ADR-4).
- **Framework SPA** — build step e superficie di errore senza beneficio percepibile
  (ADR-7).
- **Web search a runtime** — non nel percorso critico; le informazioni fresche
  entrano nei dossier pre-asta.
- **Aggiornamento dei dati durante la stagione** — l'asta è un evento singolo; il
  design a file rende comunque banale un nuovo import.
- **Supporto Mantra** — la lega gioca Classic.
- **Multi-utente e accesso in rete** — uso mono-utente su una singola macchina.
- **Docker** — contrasta con il requisito di setup minimo.

---

## 17. Rischi aperti

| Rischio | Impatto | Mitigazione |
|---|---|---|
| Data entry in tempo reale non sostenibile durante l'asta | Alto: uno stato desincronizzato azzera il valore differenziale del sistema | Barra unica con grammatica minima, ruolo implicito nella fase, target sotto i 3 secondi verificato in fase 8 e provato in fase 9 |
| Tabelle dei modificatori errate o incomplete | Alto: il motore produrrebbe raccomandazioni sistematicamente sbagliate su portieri e difensori | Configurazione esterna, validazione bloccante all'avvio, test dedicato al comportamento a soglia |
| Riconciliazione dei nomi tra listone e statistiche | Medio: giocatori senza statistiche vengono sottovalutati | Tabella di alias, report di riconciliazione all'import, risoluzione prima dell'asta |
| Confidenza intrinsecamente bassa nella fase portieri | Medio: le prime decisioni sono le meno informate | Confidenza esposta apertamente; `RosterPlan` che rende esplicito il blocco difensivo ipotizzato |
| Neopromossi e nuovi acquisti senza storico in Serie A | Medio: proiezioni inaffidabili | Marcati ad alta incertezza, con confidenza ridotta; giudizio qualitativo dal `TeamDossier` |
| Errore del greedy rispetto all'ottimo | Basso: inferiore all'incertezza sui prezzi attesi | Local search; property test sugli invarianti |
| Latenza o indisponibilita dell'API | Basso: il percorso deterministico è indipendente | Timeout, circuit breaker, degradazione silenziosa, modalità offline |
