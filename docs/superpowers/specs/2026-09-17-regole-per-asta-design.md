# Regole per asta, cartella dell'asta e cancellazione — specifica

Oggi ogni asta ha già una sua cartella, `res/auctions/<id>/`, con il registro degli
acquisti, i partecipanti e il punteggio. Restano globali due cose che invece
appartengono alla serata: le **regole della lega** (crediti e slot per ruolo), lette
da `application.yml`, e le **preferenze del battitore** (timer e avviso), lette da
`res/auction-settings.yml`. L'export CSV, poi, si genera al volo e non resta da
nessuna parte.

Questo documento porta tutto dentro la cartella dell'asta, rende le regole
configurabili in «Crea asta» e aggiunge la cancellazione di un'asta dalla home.

È il passo intermedio prima del database: il formato su disco resta file YAML,
JSONL e CSV leggibili a mano, e il confine fra runtime e archivio resta quello che
un'implementazione su database dovrà rispettare.

Data: 17 settembre 2026.

---

## 1. Cosa cambia, e cosa no

| Resta com'è | Cambia |
|---|---|
| Il formato degli eventi in `events.jsonl`, l'append-only e l'undo per compensazione | `LeagueRules` passa da bean globale a proprietà dell'asta |
| Il formato di `league-members.yml` e `league-settings.yml` | Due file nuovi nella cartella dell'asta, più `rose.csv` all'export |
| L'ordine delle fasi (P, D, C, A), globale | Il numero di squadre non si configura: è il numero di partecipanti |
| La garanzia di atomicità dello snapshot del runtime | «Crea asta» modifica crediti e slot; il salvataggio non scrive più file globali |
| Il catalogo dei giocatori, globale | Le preferenze del battitore diventano dell'asta |
| Le pagine sotto `/legacy`: abbandonate, non si aggiornano (§6.6) | Si può cancellare un'asta, con conferma |

---

## 2. La cartella dell'asta

`res/auctions/<id>/`, creata quando si conferma «Salva e comincia l'asta» (non
prima: chi si ferma alla schermata non lascia cartelle vuote, come oggi).

| File | Contenuto | Scritto quando |
|---|---|---|
| `events.jsonl` | registro dell'asta | come oggi |
| `league-members.yml` | partecipanti | alla creazione; ad asta aperta, al salvataggio (nomi e iniziali) |
| `league-settings.yml` | punteggio | alla creazione |
| `league-rules.yml` | **nuovo** — crediti per squadra, slot per ruolo | alla creazione |
| `auction-settings.yml` | **nuovo** — secondi del timer, avviso acustico | alla creazione; ad asta aperta, al salvataggio |
| `rose.csv` | **nuovo** — l'export nel formato Fantacalcio.it | a ogni download del CSV |

`league-rules.yml` non contiene il numero di squadre né le fasi:

```yaml
# Regole della lega per questa asta.
# Scritto dall'applicazione alla creazione dell'asta. Le squadre sono i
# partecipanti in league-members.yml; l'ordine delle fasi e' globale.
budget: 500
slots:
  P: 3
  D: 8
  C: 8
  A: 6
```

`auction-settings.yml` ha lo stesso formato del file globale di oggi, così
`AuctionSettingsStore` si riusa puntandolo alla cartella — lo stesso idioma con cui
`FileAuctionArchive` già riusa gli store di partecipanti e punteggio.

### 2.1 Aste esistenti

Le aste create prima di questa modifica non hanno `league-rules.yml` né
`auction-settings.yml`. Ricadono sui valori predefiniti (§3), esattamente come oggi
ricadono su quelli generali quando manca `league-members.yml` o
`league-settings.yml`. **Nessuna migrazione, nessuna riscrittura.** Non serve altro:
i valori predefiniti sono proprio quelli con cui quelle aste sono state giocate.

Per queste aste il numero di squadre è il numero dei loro partecipanti. Oggi le due
cose coincidono in tutte le aste presenti in `res/auctions` (8 e 8); se un domani non
coincidessero, vale la lista dei partecipanti.

---

## 3. Valori predefiniti

«Crea asta» parte dai valori di oggi, che diventano un **modello in sola lettura**:

| Cosa | Da dove |
|---|---|
| Crediti, slot per ruolo | `league.budget`, `league.slots` in `application.yml` |
| Partecipanti | `res/league-members.yml` se esiste, altrimenti `league.members` |
| Punteggio | `res/league-settings.yml` se esiste, altrimenti `league.scoring` |
| Timer, avviso | `res/auction-settings.yml` se esiste, altrimenti i predefiniti del codice |

L'utente può cambiare tutto. Salvare **scrive solo nella cartella della nuova
asta**: la SPA non riscrive più nessun file globale (per `/legacy` vedi §6.6). La
prossima asta riparte dagli stessi valori, non da quelli dell'ultima creata.

`league.participants` in `application.yml` perde di significato (il numero viene
dalla lista) e sparisce, insieme al controllo d'avvio che lo confrontava. Il
controllo d'avvio resta sui valori predefiniti: crediti positivi, slot validi,
`league.roster-size` uguale alla somma degli slot, partecipanti predefiniti validi.

---

## 4. Modifiche e blocchi

| Campo | Asta in preparazione | Asta aperta |
|---|---|---|
| Nome dell'asta | modificabile | non mostrato (come oggi) |
| Crediti, slot per ruolo | modificabili | **bloccati**, con il motivo |
| Partecipanti: aggiungere, togliere | modificabile | **bloccato**, con il motivo |
| Partecipanti: nome, iniziale, «sei tu» | modificabile | modificabile (come oggi) |
| Punteggio | modificabile | bloccato (come oggi) |
| Timer, avviso | modificabile | modificabile |

Il motivo, per crediti, slot e numero di partecipanti: *«Asta in corso: crediti,
slot e numero di squadre sono bloccati, perché cambiarli ricalcolerebbe budget e rose
già pagate.»* Stesso idioma del punteggio: testo visibile, collegato ai controlli con
`aria-describedby`.

Il server non si fida del blocco dell'interfaccia: ad asta aperta ignora crediti e
slot eventualmente presenti nella richiesta, e rifiuta con 422 un elenco di
partecipanti di lunghezza diversa o con id diversi da quelli dell'asta.

---

## 5. Validazione al salvataggio

Un nuovo `LeagueRulesValidator`, funzione pura come gli altri tre, con chiavi di
campo:

| Chiave | Regola | Messaggio |
|---|---|---|
| `budget` | intero ≥ 1 | «I crediti per squadra devono essere almeno 1: indicati N.» |
| `slots[P]` … `slots[A]` | intero fra 1 e 30 | «Gli slot dei portieri devono essere fra 1 e 30: indicati N.» |
| `participants` | almeno 2 partecipanti | «Servono almeno 2 partecipanti.» |

Il limite di 30 slot per ruolo è una sponda contro un refuso (300 invece di 3), non
una regola del gioco. Il controllo «almeno 2» si aggiunge a quelli di
`LeagueMembersSettingsValidator` sotto la stessa chiave `participants`.

Gli errori finiscono accanto al campo e nel riassunto unico, come oggi.
`FIELD_LABELS` nel frontend guadagna le etichette dei nuovi campi.

---

## 6. Backend

### 6.1 Le regole seguono lo snapshot

Oggi `LeagueRules` è un bean costruito all'avvio e passato al costruttore di
`AuctionRuntime`, `AuctionService`, `PlayerAnalysisService`, `SettingsApi` e
`StartupValidator`. Diventa parte di `RuntimeSnapshot`:

- `RuntimeSnapshot` guadagna il campo `LeagueRules rules`, e `AuctionScope` lo porta
  con sé. `ValuationChain` è già costruita da `rules`: le due cose nascono insieme
  nella stessa assegnazione volatile, quindi non può esistere una catena calcolata
  con regole diverse da quelle dello snapshot.
- `AuctionService` e `PlayerAnalysisService` non ricevono più `LeagueRules` nel
  costruttore: la leggono dallo scope a ogni richiesta, come già fanno con
  partecipanti e registro.
- `AuctionRuntime` riceve un caricatore `Function<String, LeagueRules>` al posto del
  valore fisso — stesso schema di `scoringLoader`. Con id null restituisce i
  predefiniti.
- Le regole si costruiscono da budget e slot dell'asta, partecipanti dell'asta
  (`size()`) e fasi globali. Una lista partecipanti che cambia di nome ma non di
  lunghezza non tocca le regole.
- Il bean globale `LeagueRules` resta solo come **valore predefinito**, usato dalla
  validazione d'avvio e dal caricatore con id null.

### 6.2 Creazione

`AuctionRuntime.createNew(name)` diventa `createNew(AuctionSetup setup)`: nome,
regole, partecipanti, punteggio e preferenze del battitore arrivano insieme, già
validati. Il runtime scrive i cinque file e il primo evento, poi pubblica lo
snapshot. Sparisce il `scoringSnapshot` che copiava i file globali: non c'è più
niente da copiare, i valori arrivano dalla richiesta.

L'ordine di scrittura mette `events.jsonl` **per ultimo**: `auctionIds()` elenca solo
le cartelle con un registro, quindi un errore a metà lascia una cartella senza
registro, invisibile alla home e mai riusata da `freeId` (che già evita le cartelle
esistenti). Nessuna asta mezza scritta compare nell'elenco.

`AuctionSetup` vive in `application.service`: `record AuctionSetup(String name,
LeagueRulesSettings rules, List<Participant> participants, ScoringSettings scoring,
AuctionSettings bidder)`. `LeagueRulesSettings(int budget, Map<Role, Integer> slots)` è
un record nuovo in `config`, accanto a `ScoringSettings` e `AuctionSettings`: sono i
valori come si salvano, non ancora le regole del dominio. Il porto `AuctionArchive`
usa già `ScoringSettings` da `config`, quindi questa dipendenza esiste ed è ammessa da
`ArchitectureTest`; il formato YAML resta negli store di `config`.

### 6.3 Preferenze del battitore

Le preferenze del battitore diventano un campo di `RuntimeSnapshot`, come regole e
partecipanti: dell'asta aperta, o del modello quando non ce n'è una. L'API del
battitore pubblico e `SettingsApi` le leggono da lì; ad asta aperta si cambiano con
`AuctionRuntime.setBidder`, che scrive nella cartella e ripubblica lo snapshot.
L'archivio guadagna `bidder(id)` e `saveBidder(id, settings)`.

### 6.4 Archivio

`AuctionArchive` guadagna:

```java
Optional<LeagueRulesSettings> rules(String auctionId);
Optional<AuctionSettings> bidder(String auctionId);
void saveBidder(String auctionId, AuctionSettings settings);
void saveRules(String auctionId, LeagueRulesSettings settings);
void saveExport(String auctionId, String csv);
void delete(String auctionId);            // §8
```

`saveRules(id, settings)` esiste sul porto, ma il runtime lo chiama solo dentro
`createNew`: `AuctionRuntime` non espone nessun metodo che modifichi le regole di
un'asta aperta.

### 6.5 API

- `GET /settings` restituisce `rules` con `budget`, `slots` e `participants`
  (quest'ultimo calcolato): dell'asta aperta, o i predefiniti. Anche partecipanti,
  punteggio e battitore sono quelli dell'asta aperta, o del modello (§3).
- `PUT /settings` accetta `rules: { budget, slots }`. Ad asta aperta il campo è
  ignorato (§4).
- `GET /export.csv` scrive anche `rose.csv` nella cartella dell'asta, poi risponde
  come oggi. **Se la scrittura fallisce, il download parte comunque** e l'errore va nel
  log con l'id dell'asta: scaricare è ciò che l'utente ha chiesto, il file su disco è
  una copia.
- `DELETE /auctions/{id}`: §8.

### 6.6 `/legacy`

Le pagine Thymeleaf sono **abbandonate**: non si cancellano, ma non si aggiornano
più. Nessun campo nuovo, nessun test nuovo, nessuna modifica ai loro controller.

Perché continuino a compilare e i loro test restino verdi, il runtime conserva i
metodi che usano — `createNew(String name)`, che crea l'asta dal modello (§3), e
`rebuild()` — e il bean `AuctionSettingsHolder` resta, letto e scritto solo da loro.
La conseguenza è accettata: salvare da `/legacy` riscrive ancora i file globali, cioè
il modello da cui parte la prossima asta. La SPA non legge più `AuctionSettingsHolder`.

---

## 7. Frontend

### 7.1 «Crea asta»

La sezione «Dalla configurazione» diventa **«Regole della lega»**:

- **Crediti per squadra**: campo numerico con − e +, a passi di 10, minimo 1.
- **Slot per ruolo**: quattro campi con − e +, a passi di 1, fra 1 e 30, con la
  `RoleBadge` nell'etichetta.
- **Squadre**: pillola in sola lettura con il numero dei partecipanti. Cambia mentre
  si aggiungono o tolgono righe.

Il campo con − e + del countdown diventa un componente, `StepperField`, riusato dai
tre usi; i limiti arrivano come prop.

Ad asta aperta i campi delle regole sono disabilitati e descritti dal motivo (§4), e
«Aggiungi partecipante» e le X dei partecipanti non si mostrano.

### 7.2 Tipi e test di confine

`LeagueRulesView` e il corpo di `SaveSettingsRequest` si aggiornano nei tipi TS, a
specchio dei DTO Java (`SettingsDtos.RulesSection`).

---

## 8. Cancellazione di un'asta

### 8.1 Cosa succede su disco

La cartella **non viene distrutta**: si sposta in `res/auctions-cestino/<id>-<istante>/`,
fuori da `res/auctions`: sparisce dalla home, e il suo id torna libero per `freeId`.
Recuperarla è rimetterla a mano sotto `res/auctions`.

È una deroga dichiarata a «l'archivio non cancella mai»: il registro non si tronca e
non si riscrive, si sposta intero con una sola `Files.move` atomica sullo stesso
filesystem. Se lo spostamento fallisce non resta niente a metà — la cartella è ancora
al suo posto — e l'API risponde con un errore.

Il cestino non si svuota da solo; svuotarlo resta un gesto manuale fuori
dall'applicazione.

### 8.2 API

`DELETE /api/leagues/{leagueId}/auctions/{auctionId}` → `204`.

- Id inesistente: `404` con il problem `unknown-auction` che esiste già.
- Se è l'asta aperta, prima si chiude (`deselect`), poi si sposta: nessuno snapshot
  resta a puntare un registro spostato.
- Serializzato con le altre mutazioni del runtime (`synchronized`): una cancellazione
  non può incrociarsi con `select` o `createNew` sulla stessa asta.

### 8.3 Home

Ogni riga dell'elenco aste guadagna, accanto a «Riprendi», un bottone icona con il
cestino:

- nome accessibile «Elimina <nome asta>», area 44×44, colore `destructive` all'hover;
- apre una **modale di conferma**, un `<dialog>` nativo aperto con `showModal()`:
  focus intrappolato dal browser, Esc annulla, sfondo inerte;
- titolo «Eliminare «<nome>»?» e testo «Sei sicuro? L'azione è irreversibile.». Il
  testo non nomina cartelle, percorsi o cestino: è un prodotto per chi gioca, non per
  chi sviluppa (il cestino resta un dettaglio del README);
- due bottoni: **«Annulla»**, che riceve il focus all'apertura, ed **«Elimina»** in
  `destructive`. Il focus iniziale su «Annulla» evita che un Invio di troppo cancelli;
- durante la richiesta «Elimina» è disabilitato e dice «Elimino…»;
- un errore resta **dentro la modale** come unico `role="alert"`, e la modale resta
  aperta;
- al successo la modale si chiude, l'elenco si ricarica (invalidazione della query,
  nessun aggiornamento ottimistico) e il focus va all'`h1` della pagina, perché il
  bottone che l'aveva aperta non esiste più.

La card destra «Asta aperta» non ha il cestino: si cancella dalla riga, un solo
posto.

---

## 9. Test

**Java**

- Due aste con regole diverse: selezionarle a turno cambia `rules` nello snapshot e
  i numeri della catena, senza che l'una tocchi l'altra.
- Asta senza `league-rules.yml` / `auction-settings.yml`: ricade sui predefiniti.
- `createNew` scrive i cinque file, e `events.jsonl` per ultimo; un errore prima del
  registro lascia l'asta fuori dall'elenco.
- Salvare non riscrive nessun file globale (confronto del contenuto prima e dopo).
- Ad asta aperta: regole ignorate, partecipanti di lunghezza diversa → 422.
- `LeagueRulesValidator`: ogni regola e ogni limite.
- Export: `rose.csv` scritto con lo stesso contenuto della risposta; scrittura
  fallita → risposta comunque 200.
- Cancellazione: cartella spostata nel cestino, sparisce dall'elenco, asta aperta
  prima chiusa, id inesistente → 404, id non valido (`..`) → rifiutato.
- `AuctionRuntimeAtomicityTest` continua a passare con il campo in più nello
  snapshot.

**Frontend**

- `StepperField`: passi, limiti, bottoni disabilitati ai limiti, campo scrivibile.
- «Regole della lega»: squadre segue i partecipanti; campi bloccati ad asta aperta
  con motivo; il salvataggio invia `rules`.
- Modale: si apre dal cestino, focus su «Annulla», Esc chiude senza chiamate,
  «Elimina» chiama `DELETE`, errore dentro la modale, successo chiude e sposta il
  focus.

Ogni guardia va vista fallire con una mutazione deliberata, come nel progetto finora.

**Mai sui dati veri**: i test Java usano directory temporanee; la verifica a mano sul
jar usa una copia di `res` fuori dal progetto.

---

## 10. Fuori da qui

- Il database: il formato su disco resta file.
- Modificare le regole di un'asta già cominciata.
- Svuotare il cestino o ripristinare un'asta dall'interfaccia.
- Rendere configurabile l'ordine delle fasi.
