# App frontend e confine API — specifica

Sotto-progetto 1 di 4 verso la versione distribuita su internet. Questo documento
fissa cosa viene costruito, cosa viene deliberatamente rimandato, e perché.

Data: 7 settembre 2026.

---

## 1. Perché

FantaAgent oggi è un'applicazione Spring Boot che rende HTML con Thymeleaf e lo
anima con HTMX. Funziona, è veloce, e non ha passo di build. La decisione presa il
7 settembre è di portarla a essere un prodotto ospitato: più leghe, più utenti,
account, persistenza reale.

Quella destinazione richiede quattro cambiamenti indipendenti. Questo documento
copre solo il primo.

| # | Sotto-progetto | Dipende da |
|---|---|---|
| **1** | **API JSON + app frontend** — questo documento | — |
| 2 | Persistenza multi-lega | 1 |
| 3 | Identità e autorizzazione | 2 |
| 4 | Tempo reale e deploy | 3 |

**Alla fine di questo sotto-progetto FantaAgent è ancora un jar che gira in
locale.** Non ci sono account, non c'è un database, non c'è hosting. Ciò che
cambia è che l'interfaccia è un'applicazione React separata, e che il confine fra
i due pezzi è un'API JSON già nella forma che i sotto-progetti successivi
richiedono.

### La valutazione contraria, e perché non vale più

Il documento [`2026-09-02-redesign-frontend.md`](../plans/2026-09-02-redesign-frontend.md)
raccomandava di **non** migrare a React, con dei numeri: nessun problema di
prestazioni da risolvere, 108 asserzioni sull'HTML da riscrivere, un passo di
build introdotto dove non ce n'era.

Quei numeri restano veri. Ciò che è cambiato è la destinazione: quella
raccomandazione valeva per uno strumento personale che gira sul portatile la sera
dell'asta. Per un prodotto ospitato con più utenti, il frontend separato non è una
preferenza estetica — è il confine che rende possibili i sotto-progetti 3 e 4.

Il documento del 2 settembre resta valido come analisi e come fonte
dell'architettura dei componenti. Va considerato superato solo nella sua
raccomandazione finale.

---

## 2. Architettura

### 2.1 Forma del repository

Monorepo. Due build che si toccano in un punto solo.

```
FantaAgent/
├── pom.xml
├── src/main/java/com/fantaagent/
│   ├── domain/                 invariato
│   ├── application/            invariato
│   └── adapter/in/
│       ├── web/                Thymeleaf — resta finché il nuovo non è completo
│       └── api/                NUOVO — i @RestController
└── frontend/                   NUOVO — applicazione Vite indipendente
    ├── package.json
    └── src/
```

`adapter/in/web` non viene toccato durante la migrazione. I suoi 70 test con 108
asserzioni sull'HTML reso continuano a girare e sono la rete di sicurezza mentre
si costruisce il resto. Nessun template viene eliminato prima che la schermata
React corrispondente sia verificata.

### 2.2 Le due build

**In sviluppo:** Vite su `:5173`, Spring Boot su `:8080`, con il dev server che fa
da proxy per `/api`. Due processi, ricarica istantanea del frontend.

**In produzione:** `mvn package` esegue la build di Vite e copia `dist/` dentro le
risorse statiche del jar. **L'artefatto distribuito resta uno solo.** Il README
rivendica «un jar che parte e basta»: la migrazione introduce un passo di build,
ma non deve introdurre un secondo processo da distribuire e sorvegliare.

Il collegamento è il plugin `frontend-maven-plugin`, legato alla fase `generate-resources`
e attivo solo in un profilo `prod`. Uno sviluppatore che lavora sul backend non
paga il costo della build del frontend a ogni `mvn test`.

### 2.3 Stack del frontend

| | |
|---|---|
| Build | Vite |
| Linguaggio | TypeScript |
| Interfaccia | React |
| Stile | Tailwind CSS v4 |
| Componenti | shadcn/ui — Radix + Tailwind, sorgente posseduto |
| Stato del server | TanStack Query |
| Tabelle | TanStack Table |
| Instradamento | React Router |
| Test | Vitest + Testing Library, Playwright |

La scelta di shadcn su una libreria a batterie incluse è motivata dalla direzione
visiva: i componenti vanno tematizzati a fondo, e possedere il sorgente è la sola
via che non combatte contro il tema di qualcun altro.

Non c'è SSR e non serve: l'applicazione vive di stato in tempo reale dietro
autenticazione, non di indicizzazione.

---

## 3. Il confine API

### 3.1 Le URL nascono nella forma finale

Le rotte sono già multi-lega e multi-asta, anche se dietro c'è ancora il file
locale e un utente unico risolto da un `CurrentUser` fittizio. I sotto-progetti 2
e 3 riempiono l'implementazione **senza cambiare né le URL né una riga di
frontend**.

In questo sotto-progetto esiste **una sola lega**, quella descritta da
`res/league-members.yml`. Il segmento `{leagueId}` è presente nelle URL e
attraversa i controller fino al livello applicativo, ma vi risolve un
identificativo costante. La forma è quella definitiva; la molteplicità arriva col
sotto-progetto 2. Un `leagueId` diverso da quello noto risponde 404, così il
frontend è già costretto a gestire il caso invece di scoprirlo più tardi.

```
GET    /api/leagues/{leagueId}/auctions
POST   /api/leagues/{leagueId}/auctions
GET    /api/leagues/{leagueId}/auctions/{id}/state
GET    /api/leagues/{leagueId}/auctions/{id}/players?q=…
GET    /api/leagues/{leagueId}/auctions/{id}/players/{playerId}/valuation
POST   /api/leagues/{leagueId}/auctions/{id}/purchases
POST   /api/leagues/{leagueId}/auctions/{id}/purchases/{seq}/void
POST   /api/leagues/{leagueId}/auctions/{id}/phase
GET    /api/leagues/{leagueId}/auctions/{id}/recap
GET    /api/leagues/{leagueId}/auctions/{id}/board
GET    /api/leagues/{leagueId}/auctions/{id}/export.csv
GET    /api/leagues/{leagueId}/settings
PUT    /api/leagues/{leagueId}/settings
```

`export.csv` resta l'unico endpoint che non produce JSON, come oggi.

### 3.2 La confidenzialità del max bid

**Questo è il vincolo più importante del documento.**

Oggi la pagina proiettata sullo schermo condiviso non può mostrare il prezzo
consigliato perché il record `ViewModels.PublicBidder` **non ha un campo dove
quel prezzo possa stare**. È una garanzia strutturale, e la sua motivazione è
scritta nel sorgente: un flag si dimentica, un campo assente no.

Un'API JSON distrugge quella garanzia nel modo peggiore. Non serve che
l'interfaccia disegni il numero: basta che l'endpoint lo restituisca, e chiunque
apra la scheda di rete del browser — o il telefono di un avversario puntato sulla
stessa URL — lo legge.

La garanzia viene ricostruita su tre livelli, tutti verificati:

1. **DTO separati in un package separato.** Gli endpoint di proiezione (`/board`)
   hanno i propri record in `adapter/in/api/board`, e quei record non hanno campi
   di valutazione. Stessa disciplina di oggi, spostata sull'API.

2. **Una regola ArchUnit** che fallisce la build se una classe di
   `adapter.in.api.board` raggiunge `PriceRecommendation`, `ValuationEngine`,
   `PriceModel` o `ValuationContext`. ArchUnit verifica già i confini esagonali:
   questa è una regola in più nella stessa suite.

3. **Un test di serializzazione** che chiama `/board` con uno stato d'asta noto e
   asserisce che il corpo JSON non contiene il valore del tetto calcolato per
   nessuno dei giocatori presenti.

Il vincolo passa da «un campo che non esiste» a «un campo che non esiste, più due
test che lo dimostrano». Non è più debole di prima.

### 3.3 Errori

Formato unico: **RFC 9457, `application/problem+json`**, prodotto da `ProblemDetail`
di Spring. Ogni eccezione di dominio già esistente riceve un `type` stabile che il
frontend mappa a un messaggio.

| `type` | Origine | Stato |
|---|---|---|
| `no-auction-selected` | `NoAuctionSelectedException` | 409 |
| `insufficient-budget` | validazione di `recordPurchase` | 422 |
| `role-slots-exhausted` | validazione di `recordPurchase` | 422 |
| `player-already-sold` | validazione di `recordPurchase` | 409 |
| `unknown-player` | catalogo | 404 |
| `invalid-settings` | validatori delle impostazioni | 422 |

`NoAuctionAdvice` oggi reindirizza: sull'API il reindirizzamento non ha senso, e
l'advice va sdoppiato — quello esistente resta per i controller HTML, uno nuovo
serve l'API.

I testi mostrati all'utente dicono cosa è successo e come si rimedia, in italiano
corrente, vicino al campo che ha causato l'errore e non in un banner in cima:
«Anna non ha più slot da difensore. Passa alla fase successiva o annulla un
acquisto», non «Operazione non consentita».

### 3.4 Idempotenza delle scritture

`POST /purchases` accetta una chiave di idempotenza generata dal client. Se il
server riconosce una chiave già vista, non scrive un secondo evento e restituisce
l'esito del primo.

Questo rischio **non esisteva prima**: senza rete di mezzo, un acquisto non poteva
partire due volte. Con la rete, una risposta persa e un secondo clic producono
«Bastoni comprato due volte a 47», che il registro append-only non può cancellare
— può solo compensarlo dopo, a danno fatto.

La chiave vive nel registro insieme all'evento, così l'idempotenza sopravvive al
riavvio del processo come tutto il resto dello stato.

---

## 4. Lo stato nel browser

**Lo stato di dominio non entra nel browser.** Oggi è vero per costruzione, perché
il server rende l'HTML. Domani deve restare vero per disciplina, perché due verità
che divergono mentre qualcuno rilancia sono la classe di difetto più costosa che
questa applicazione possa avere.

Concretamente: TanStack Query tiene una **cache** della risposta del server, non
una copia gestita a mano. Nessun `useState` contiene mai un budget, uno slot, un
prezzo o una composizione di rosa. L'unico stato realmente client è il countdown
del battitore, che è già l'unico oggi.

### 4.1 Nessun aggiornamento ottimistico sull'aggiudicazione

È il default di TanStack Query e qui è sbagliato. Un aggiornamento ottimistico
mostrerebbe l'acquisto come riuscito prima che il registro abbia eseguito `fsync`;
se la scrittura fallisse, l'interfaccia avrebbe mentito nel momento in cui contava
di più. Il bottone mostra lo stato di attesa e aspetta la conferma del server.

### 4.2 Lo stato stantio

Con Thymeleaf ogni pagina è resa dal server: ciò che si vede è vero per
costruzione. Con un frontend separato la connessione può cadere **senza che la
pagina cambi**, e allora i numeri sullo schermo mentono in silenzio.

L'interfaccia deve dirlo. Il segnale esiste già — `dataUpdatedAt`, `isStale` e
`isError` di TanStack Query — e non va riscritto a mano. Quando il dato è vecchio:

- la barra di stato mostra da quanto tempo lo è;
- i valori impallidiscono e il bordo della scheda diventa tratteggiato;
- l'azione primaria si disabilita.

Il tetto resta leggibile, perché serve ancora. Ma nulla finge di essere
aggiornato.

### 4.3 Annunci accessibili

Ogni aggiudicazione cambia contemporaneamente budget, slot, composizione della
rosa e disponibilità del giocatore. Un lettore di schermo non può inseguirli uno a
uno. Serve **un solo** `role="status"` con `aria-atomic`, che annuncia un
messaggio di senso compiuto:

> «Bastoni aggiudicato ad Anna per 47 crediti. Ti restano 265 crediti e 17 slot.»

Non un numero nudo, e non una live region per ogni valore che cambia.

---

## 5. Design

### 5.1 Direzione: Campo

L'applicazione è radicata nell'oggetto che sostituisce: un'asta di fantacalcio
attorno a un tavolo, non un terminale finanziario. La direzione scelta è **il
campo sotto i riflettori**: verde profondo, luce ambra, e — l'elemento che decide
il carattere — **le righe bianche del campo come unico dispositivo strutturale
della pagina**. I bordi non decorano: sono linee di campo, arco d'angolo incluso.

Due direzioni alternative sono state disegnate e scartate: *Tabellone* (la lavagna
del banditore, verde-nero caldo con gesso ambra) e *Rosa* (il listone della
Gazzetta, carta rosa e inchiostro nero). Restano registrate come alternative
valide in `.superpowers/brainstorm/`.

### 5.2 Token

| ruolo | valore |
|---|---|
| `background` | `#0A1F16` |
| `surface` | `#0E2A1E` |
| `line` | `#FFFFFF26` |
| `line-strong` | `#FFFFFF40` |
| `foreground` | `#F1F7F2` |
| `muted-foreground` | `#87A594` |
| `accent` | `#FFC24B` |
| `on-accent` | `#1B1400` |
| `positive` | `#5FD08A` |
| `destructive` | `#E86A4B` |

Scritti in **OKLCH** ed esposti a Tailwind v4 con `@theme inline`. Nessun
componente scrive mai un colore letterale: `bg-[#FFC24B]` e `bg-amber-400` sono
entrambi errori.

**L'applicazione ha un tema solo, e è scuro.** La direzione Campo non ha una
controparte chiara sensata, e costruirne una che nessuno userà è lavoro sprecato
che diverge al primo componente aggiunto. I token vivono quindi su `:root`; la
classe `.dark` viene comunque applicata alla radice del documento perché i
componenti shadcn la presuppongono, ma non ridefinisce nulla. Se un tema chiaro
servirà, sarà una decisione presa allora, con i suoi valori misurati.

I rapporti di contrasto vanno **misurati con un controllo automatico**, non
valutati a occhio. `#87A594` su `#0A1F16` è il caso da verificare per primo.

Il gradiente radiale che illumina la scheda della decisione è l'unico effetto
decorativo ammesso, e compare su un solo elemento della pagina.

### 5.3 Tipografia

**Archivo variabile, una sola famiglia, tre ruoli** ottenuti dall'asse di
larghezza:

- larghezza condensata per le righe fitte della tabella;
- larghezza normale per l'interfaccia;
- larghezza estesa per il tetto, che è il numero più grande dello schermo.

Le cifre tabulari native di Archivo rendono superfluo un monospace. Auto-ospitata
con `@fontsource-variable/archivo`: nessuna richiesta a Google Fonts, perché la
stanza dell'asta può essere senza rete.

### 5.4 Disciplina visiva

Regole che il progetto si dà, ognuna contro un difetto osservato:

- **Nessuna route definisce stile proprio.** Se una schermata ha bisogno di
  qualcosa che non esiste, si aggiunge un componente, non una regola CSS locale.
- **L'audacia in un posto solo:** il tetto. Tutto il resto sta zitto.
- **Un solo elemento elevato** — la scheda che decide. L'ombra torna a significare
  gerarchia invece di essere una decorazione uniforme su ogni riquadro.
- **Niente etichette in maiuscoletto spaziato** sopra ogni valore. Dove la
  posizione già dice cosa è un numero, l'etichetta si toglie.
- **Niente stringhe unite da punti mediani.** La composizione della rosa è la
  barra segmentata per ruolo, non `1P · 3D · 0C · 0A`.
- **Icone SVG in linea** (Lucide), mai emoji.
- **Movimento sobrio**, 150–300 ms, solo in risposta a un'azione.
  `prefers-reduced-motion` sopprime le transizioni e le pulsazioni, **non il
  countdown**: il numero che scende è informazione, non decorazione, e continua ad
  aggiornarsi. Ciò che sparisce è il battito che lo accompagna.
- **Bersagli da 44×44 px** minimo, contorno di fuoco sempre visibile.

### 5.5 Struttura dei componenti

```
frontend/src/
├── api/          client + hook (useAuctionState, useValuation, useAssign…)
├── ui/           primitive shadcn tematizzate
├── domain/       PlayerDecisionCard · PlayerTable · LeagueBoard · RosterSlots
│                 BidPanel · PhaseSwitcher · ConnectionStatus
├── routes/       sola composizione: / · /asta · /battitore · /proiezione
│                 /riepilogo · /impostazioni
└── styles/       tokens.css
```

Le tabelle usano il componente `Table` **semantico** di shadcn con `thead` e
`tbody`, combinato con TanStack Table per ordinamento e filtri. Mai griglie di
`div` al posto di una tabella.

---

## 6. Test

| Livello | Cosa verifica | Strumento |
|---|---|---|
| Dominio, applicazione | **invariati** — nessuna riga toccata | JUnit |
| API | forma del JSON, codici, `problem+json`, idempotenza | `@WebMvcTest`, MockMvc |
| Confidenzialità | `/board` non raggiunge la valutazione; il JSON non contiene tetti | ArchUnit, test di serializzazione |
| Componenti | tetto corretto, allineamento numerico, stato stantio | Vitest, Testing Library |
| Percorso critico | cercare → valutare → aggiudicare → annullare | Playwright |

I 108 assert sull'HTML Thymeleaf restano attivi per tutta la migrazione e vengono
rimossi solo nella tappa 6, quando ogni schermata ha il suo equivalente
verificato.

**Playwright è nuovo, e la ragione è dichiarata nel README:** «la suite non esegue
JavaScript né CSS. Countdown, scorciatoie da tastiera e resa grafica si verificano
aprendo l'applicazione, e più di un difetto è uscito esattamente da lì.»
Spostando l'interfaccia su React, quella zona cieca diventerebbe la maggioranza
del prodotto.

---

## 7. Ordine di lavoro

Sei tappe, ognuna verificabile da sola.

1. **Fondamenta.** `frontend/` con Vite, TypeScript, Tailwind v4, shadcn. Token
   Campo, Archivo, guscio dell'applicazione. Nessuna chiamata al backend.
   *Verifica: il guscio si vede, i contrasti passano il controllo automatico.*

2. **Il confine.** `adapter/in/api` con stato e ricerca, `problem+json`, le due
   regole di confidenzialità.
   *Verifica: test di contratto verdi, ArchUnit verde.*

3. **La schermata d'asta.** Scheda della decisione, tabella, tabellone,
   aggiudicazione con chiave di idempotenza, stato stantio.
   *Verifica: Playwright sul percorso critico.*

4. **Battitore e proiezione.** Countdown, tastiera, audio; la pagina proiettata
   contro il suo endpoint cieco.
   *Verifica: il JSON di `/board` non contiene tetti.*

5. **Home, riepilogo, impostazioni.** Esportazione CSV inclusa.

6. **La rimozione.** Template, controller HTML, HTMX e CSS eliminati in un commit
   solo, quando tutto il resto è verde.

---

## 8. Fuori perimetro

Dichiarato esplicitamente, per non doverlo dedurre:

- account, autenticazione, autorizzazione — sotto-progetto 3;
- database e persistenza multi-lega — sotto-progetto 2;
- aggiornamenti in tempo reale via SSE o WebSocket — sotto-progetto 4;
- hosting, distribuzione, osservabilità — sotto-progetto 4;
- pagina di presentazione pubblica del prodotto;
- l'integrazione con Claude pianificata in
  [`2026-09-01-integrazione-claude-fase-7.md`](../plans/2026-09-01-integrazione-claude-fase-7.md),
  che resta non implementata e non viene affrontata qui. La schermata d'asta
  lascia lo spazio dove quel contenuto andrà, e non lo riempie di nulla di finto.
