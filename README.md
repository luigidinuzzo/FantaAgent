# FantaAgent

Assistente d'asta per il Fantacalcio, da usare **dal vivo mentre si rilancia**.

Non è un listone con dei prezzi stampati sopra: calcola quanto conviene spendere per
un giocatore **adesso**, sulla base di com'è andata l'asta fino a questo momento —
chi ha già speso quanto, quali alternative restano in quel ruolo, quanti slot ti
mancano e quanto budget hai.

Gira in locale. Nessun servizio esterno, nessun account, nessuna rete richiesta
durante l'asta.

---

## Cosa fa

**Calcola un prezzo massimo motivato.** Per ogni giocatore stima quanto migliora la
tua rosa completabile, e da lì ricava il prezzo oltre il quale comprarlo la
peggiora. Il numero arriva con i suoi driver — budget, alternative, concorrenza — in
modo da poterlo controllare invece di doverci credere.

**Registra l'asta come un libro mastro.** Ogni acquisto è un evento aggiunto in coda
a un file, con `fsync`. Niente viene mai sovrascritto: annullare significa scrivere
un evento che ne compensa un altro. Chiudere il processo a metà asta e riaprirlo
lascia lo stato esattamente dov'era.

**Batte l'asta.** Un popup con countdown configurabile, rilanci con la barra
spaziatrice, e l'aggiudicazione al partecipante scelto.

**Si proietta.** Una pagina apposta per lo schermo condiviso, con i tabelloni di
tutti e la ricerca — e **nessuna valutazione**: il vincolo è strutturale, i modelli
che alimentano quella pagina non hanno un campo dove un prezzo consigliato possa
stare.

**Esporta le rose** nel formato di importazione di Fantacalcio.it.

---

## Requisiti

- Java 25
- Maven 3.9+
- Node 22.13+ o 24 — **solo se lavori sul frontend React.** Per fare un'asta non
  serve: il jar non ha bisogno di Node per partire.

## Avvio

### Fare un'asta

```bash
./run.sh
```

Poi apri <http://localhost:8080>. Da lì si passa dalla home, si sceglie o si crea
un'asta, e si batte. Sono le schermate Thymeleaf: oggi sono queste a fare l'asta.

Alla prima esecuzione servono i file di configurazione descritti sotto — senza il
listone in `res/` l'applicazione non parte.

### Lavorare sul frontend React

Due processi, in due terminali. Il backend per primo: il dev server di Vite gli
inoltra `/api`, quindi senza backend il frontend si apre e non trova niente.

```bash
# terminale 1 — backend
./run.sh

# terminale 2 — frontend
cd frontend
npm install          # solo la prima volta
npm run dev
```

Il frontend sta su <http://localhost:5173>. Non è un secondo modo di fare l'asta:
è la schermata d'asta React, in costruzione, che parla al backend via API. Il
backend resta l'unica verità anche in sviluppo — qui dentro non c'è stato di
dominio e non ci sono mock.

**Serve un'asta già aperta.** Il frontend non ha (ancora) la home per crearne una:
aprila da <http://localhost:8080>, poi ricarica la pagina su `:5173`. Senza,
ogni richiesta risponde `409` con «Nessuna asta è aperta» — che è il comportamento
giusto, non un errore di configurazione.

Il `Ctrl-C` sul terminale del backend lo ferma; `run.sh` non lascia processi dietro.

## Configurazione

I file di configurazione vivono in `res/`.

| File | Cosa contiene |
|---|---|
| `league-members.yml` | i partecipanti — copia `league-members.example.yml` e mettici i tuoi |
| `league-settings.yml` | le regole di punteggio della lega |
| `Quotazioni_*.xlsx` | il listone ufficiale Fantacalcio.it |
| `Statistiche_*.xlsx` | le statistiche delle stagioni passate |

I file XLSX vanno scaricati dall'area download di Fantacalcio.it: non sono inclusi
qui perché non sono miei da ridistribuire.

**Ogni asta è indipendente.** Quando ne crei una, partecipanti e regole vengono
copiati dentro la sua cartella: riconfigurare una nuova asta non cambia più né i
nomi né i numeri di quelle già concluse.

---

## Com'è fatto

Java 25 e Spring Boot. Le schermate con cui si fa l'asta oggi sono Thymeleaf e HTMX,
rese dal server; accanto a loro, e senza toccarle, è nata un'API JSON sotto
`/api/leagues/{lega}/auctions/{asta}/…` e un frontend React servito da Vite, che le
sostituirà una alla volta.

Quel frontend ha un passo di build: Node e npm, sotto `frontend/`. È il prezzo
pagato per avere una schermata d'asta che reagisce senza ricaricare, e per potere
finalmente testare comportamento e contrasti — la cosa che la suite Java, per sua
natura, non fa. Il jar però resta uno: il profilo Maven `prod` esegue `npm ci` e
`npm run build` e copia il risultato dentro l'artefatto, così `mvn -Pprod package`
continua a produrre una cosa sola che parte e basta, il che la sera dell'asta conta
più dell'eleganza.

**Il frontend impacchettato non è ancora raggiungibile.** `HomeController` mappa `/`
e `AuctionController` mappa `/asta`, e una request mapping vince sempre sulla pagina
di benvenuto: `index.html` finisce nel jar e nessuna URL lo apre. È voluto, non
dimenticato. Servirlo adesso vorrebbe dire decidere come convive con le sei rotte
Thymeleaf, e un prefisso provvisorio tipo `/app/**` creerebbe una URL destinata a
morire. La tappa 6 toglie quelle rotte e mette il frontend alla radice. Fino ad
allora vale quanto scritto sopra in [Avvio](#avvio): l'asta si fa dalle schermate
Thymeleaf su `:8080`, il frontend si sviluppa col dev server su `:5173`.

Architettura esagonale leggera in un solo modulo Maven, con i confini fra dominio,
applicazione e adattatori verificati da ArchUnit invece che raccomandati a parole.

Lo stato dell'asta è la proiezione di un log append-only: non esiste stato di dominio
nel browser, e ogni schermata — Thymeleaf o React — è una vista su quel log. È la
ragione per cui l'API non ha aggiornamenti ottimistici: mostrare un acquisto come
riuscito prima che il registro abbia fatto `fsync` significa mentire nel momento in
cui conta di più.

## Test

```bash
mvn test
```

Una nota onesta: la suite Java **non esegue JavaScript né CSS**. Countdown,
scorciatoie da tastiera e resa grafica delle schermate Thymeleaf si verificano
aprendo l'applicazione, e più di un difetto è uscito esattamente da lì. Il frontend
React ha una sua suite — `cd frontend && npm test` — nata proprio perché quella zona
cieca non diventasse la maggioranza del prodotto.

---

## Documentazione

- [`docs/superpowers/specs/`](docs/superpowers/specs/) — la specifica di progetto, con
  le decisioni architetturali e le loro motivazioni
- [`docs/superpowers/plans/`](docs/superpowers/plans/) — i piani di implementazione
- [`docs/superpowers/decisions/`](docs/superpowers/decisions/) — il registro delle
  decisioni prese durante lo sviluppo
