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
tutti e il giocatore all'asta — in **sola lettura**, e con **nessuna valutazione**.
Entrambi i vincoli sono strutturali: non ha controlli perché una schermata che
nessuno tocca non può far trapelare niente per sbaglio, e i modelli che la
alimentano non hanno un campo dove un prezzo consigliato possa stare.

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
mvn -q -Pprod package
java -jar target/*.jar
```

Poi apri <http://localhost:8080>. È il frontend React, ed è alla radice: da lì si
passa dalla home, si sceglie o si crea un'asta, e si batte.

Il profilo `prod` scarica Node ed esegue la build del frontend dentro il pacchetto:
non serve installarlo a mano, e il risultato è un jar solo, che parte e basta.
Alla prima esecuzione servono anche i file di configurazione descritti sotto —
senza il listone in `res/` l'applicazione non parte.

**Le schermate Thymeleaf di prima ci sono ancora**, su `/legacy` — vedi la sezione
Com'è fatto più sotto — ma non sono più la via consigliata: restano come punto di
paragone mentre la migrazione le sostituisce.

### Lavorare sul frontend React

Due processi, in due terminali. Il backend per primo: il dev server di Vite gli
inoltra `/api`, quindi senza backend il frontend si apre e non trova niente.
Qui il backend parte senza il passo di build — `run.sh` non impacchetta il
frontend, quindi la sua radice a `:8080` non serve nulla finché non è passata da
`mvn -Pprod package`; è la porta `:5173` del dev server quella da aprire.

```bash
# terminale 1 — backend
./run.sh

# terminale 2 — frontend
cd frontend
npm install          # solo la prima volta
npm run dev
```

Il frontend sta su <http://localhost:5173>. Non è un secondo modo di fare l'asta:
è la stessa interfaccia che finisce nel jar, servita qui dal dev server perché
reagisce senza ricaricare mentre ci si lavora. Il backend resta l'unica verità
anche in sviluppo — qui dentro non c'è stato di dominio e non ci sono mock.

Il `Ctrl-C` sul terminale del backend lo ferma; `run.sh` non lascia processi dietro.

Se prima è già stato eseguito `mvn -Pprod package` e non è seguito un `mvn clean`,
`target/classes/static` conserva ancora quella build: la radice di `run.sh` a
`:8080` servirebbe quella SPA (ormai vecchia) invece di restare vuota come questa
sezione dice. Un `mvn clean` prima di `./run.sh` evita l'ambiguità.

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

Java 25 e Spring Boot. L'interfaccia con cui si fa l'asta è un frontend React,
servito dalla radice; accanto a lei, sotto `/legacy`, sono rimaste le schermate
Thymeleaf e HTMX con cui è nato il progetto — stessa API, stesso registro, tenute
come punto di paragone mentre la migrazione le sostituisce una alla volta. Non
sono un secondo modo di fare l'asta pensato per l'uso quotidiano: sono lì per
poter confrontare una schermata nuova con quella che rimpiazza.

Con un'eccezione, ad oggi: la SPA non ha ancora il pannello TARGET/obiettivi. Chi ne
ha bisogno durante un'asta lo trova ancora solo su `/legacy` — non è un difetto
minore da ignorare la sera dell'asta, ma lavoro non ancora fatto, ed è onesto dirlo
qui invece che lasciarlo scoprire a chi sceglie quale interfaccia usare. La ricerca
libera di un giocatore per nome, invece, è già nella SPA: sta al centro della
schermata d'asta (`/asta`), non serve più passare da `/legacy` per usarla.

Il frontend React ha un passo di build: Node e npm, sotto `frontend/`. È il prezzo
pagato per avere una schermata d'asta che reagisce senza ricaricare, e per potere
finalmente testare comportamento e contrasti — la cosa che la suite Java, per sua
natura, non fa. Il jar però resta uno: il profilo Maven `prod` esegue `npm ci` e
`npm run build` e copia il risultato dentro l'artefatto, così `mvn -Pprod package`
continua a produrre una cosa sola che parte e basta, il che la sera dell'asta conta
più dell'eleganza.

Un instradamento lato client copre le rotte della SPA (`/`, `/asta`, `/proiezione`,
`/impostazioni`, `/riepilogo`): una ricarica su un percorso profondo restituisce
`index.html`, non un 404, perché l'indirizzo nella barra deve restare quello
richiesto. `/riepilogo` non è più una schermata propria: l'indirizzo vecchio
reindirizza a `/asta`, dove il riepilogo vive ora come la scheda «Rose squadre».
Resta instradato apposta — non tolto dall'elenco — perché chi lo aveva salvato o
linkato continui ad arrivare da qualche parte invece di trovare un 404. Un percorso
che non è né una rotta della SPA, né `/api`, né `/legacy` resta un 404 vero — niente
fallback che inghiotte tutto e trasforma un indirizzo sbagliato in una pagina bianca
senza errore.

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
