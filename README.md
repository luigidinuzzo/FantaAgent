# FantaAgent

Assistente d'asta per il Fantacalcio, da usare **dal vivo mentre si rilancia**.

Non è un listone con dei prezzi stampati sopra: calcola quanto conviene spendere per
un giocatore **adesso**, sulla base di com'è andata l'asta fino a questo momento —
chi ha già speso quanto, quali alternative restano in quel ruolo, quanti slot ti
mancano e quanto budget hai.

Un portale per la lega: ognuno ha il suo **account**, l'amministratore crea la
**lega** e invita gli altri con un link, e l'**asta** è una sola, a cui partecipano
tutti. L'amministratore registra gli acquisti e li corregge; gli altri membri la
seguono in diretta dal proprio telefono o computer, ciascuno con i **propri consigli
privati** — quanto conviene spendere a lui, con la sua rosa e il suo budget, e che
nessun altro vede.

---

## Cosa fa

**Calcola un prezzo massimo motivato.** Per ogni giocatore stima quanto migliora la
tua rosa completabile, e da lì ricava il prezzo oltre il quale comprarlo la
peggiora. Il numero arriva con i suoi driver — budget, alternative, concorrenza — in
modo da poterlo controllare invece di doverci credere.

**Registra l'asta come un libro mastro.** Ogni acquisto è un evento aggiunto in coda
al registro dell'asta, una tabella di Postgres (`auction_event`). Niente viene mai
sovrascritto: annullare o correggere significa scrivere un evento che ne compensa un
altro. L'append-only non è una convenzione del codice ma un vincolo del database: i
trigger respingono `UPDATE`, `DELETE` e `TRUNCATE`, e in produzione il ruolo
dell'applicazione non ha nemmeno il permesso di chiederli (vedi «Verso il deploy»). Chiudere il processo a
metà asta e riaprirlo lascia lo stato esattamente dov'era.

**Batte l'asta.** Oggi la batte l'amministratore della lega: sceglie il giocatore,
segue il turno di chiamata, aggiudica al membro che ha vinto il rilancio, e può
correggere o annullare un acquisto. Gli altri vedono il banco e le rose aggiornarsi
da soli, senza comandi. Il banditore che gira sul server — i rilanci fatti da
ciascuno dal proprio dispositivo, col conto alla rovescia condiviso — arriva col
sotto-progetto 4.

**Si proietta.** Una pagina apposta per lo schermo condiviso, con i tabelloni di
tutti e il giocatore all'asta — in **sola lettura**, e con **nessuna valutazione**.
Entrambi i vincoli sono strutturali: non ha controlli perché una schermata che
nessuno tocca non può far trapelare niente per sbaglio, e i modelli che la
alimentano non hanno un campo dove un prezzo consigliato possa stare.

**Porta dentro le aste di prima.** Le aste nate quando FantaAgent girava su file
(`res/auctions/<id>/`, con `events.jsonl` e i file YAML accanto) si importano in una
lega dal browser: si sceglie la cartella dell'asta, si abbina ogni partecipante di
allora a un membro della lega, e l'importazione riscrive il registro e ricontrolla
che le rose ricostruite coincidano con quelle originali. Tutto o niente: se qualcosa
non torna, non resta un'asta a metà.

**Esporta le rose** nel formato di importazione di Fantacalcio.it.

---

## Requisiti

- Java 25
- Maven 3.9+
- Node 22.13+ o 24 — **solo per il frontend React** (il dev server in locale; il jar
  di produzione se lo scarica da sé col profilo `prod`).

**Nessun Postgres da installare in locale.** `./run.sh` ne avvia uno incorporato
(la stessa libreria dei test), con i dati in una cartella che sopravvive ai riavvii.

## Avvio

Due processi, in due terminali. Il backend per primo: il dev server di Vite gli
inoltra `/api`, quindi senza backend il frontend si apre e non trova niente.

```bash
# terminale 1 — backend (API su :8080, Postgres incorporato su :54329)
./run.sh

# terminale 2 — frontend
cd frontend
npm install          # solo la prima volta
npm run dev
```

Poi apri <http://localhost:5173>. `run.sh` legge `.env` se c'è (il modello è
`.env.example`), avvia il backend col profilo `local` e il classpath dei test —
lì vive il Postgres incorporato, che il jar di produzione non contiene. Il `Ctrl-C`
lo ferma, Postgres compreso.

`run.sh` non costruisce il frontend: la radice di `:8080` resta vuota, ed è la porta
`:5173` del dev server quella da aprire. Se prima è passato `mvn -Pprod package` senza
un `mvn clean`, `target/classes/static` conserva quella build e `:8080` servirebbe una
SPA ormai vecchia: un `mvn clean` prima di `./run.sh` evita l'ambiguità.

### Il primo uso

1. **Registrati** su `/registrati`. L'indirizzo va verificato col link dell'email.
2. **Crea la lega** dalla pagina «Le mie leghe», con le sue regole (crediti, slot
   per ruolo, punteggi).
3. **Invita** gli altri: dalla pagina della lega si crea un link d'invito da mandare
   a chi si vuole; chi lo apre si registra (o accede) e entra nella lega.
4. **Crea l'asta** dalla pagina della lega (servono almeno due membri), scegli chi
   partecipa, con che nome di squadra e in che ordine di chiamata — oppure
   **importala** da un'asta di prima.

### Le email in locale

Senza `SPRING_MAIL_HOST` le email non partono: il testo intero, link compreso,
finisce nel log del backend (`LogMailer`, riga `email per <indirizzo> — <oggetto>`).
Verifica dell'indirizzo e recupero della password si provano copiando il link da lì.

### Il database locale

I dati stanno in `data/pg` (gitignorato). Per un database di prova, da buttare,
basta indicare un'altra cartella:

```bash
FANTAAGENT_DB_DIR=/tmp/fantaagent-prova ./run.sh
```

Il Postgres incorporato ascolta sempre su `localhost:54329` (utente `postgres`,
database `fantaagent`), così ci si può guardare dentro con un client qualunque.
Una porta fissa vuol dire anche un solo `./run.sh` alla volta.

### Il listone

Il catalogo dei giocatori si legge da `res/` all'avvio:

| File | Cosa contiene |
|---|---|
| `Quotazioni_*.xlsx` | il listone ufficiale Fantacalcio.it — **senza, l'applicazione non parte** |
| `Statistiche_*.xlsx` | le statistiche delle stagioni passate |
| `league-settings.yml` | le regole di punteggio proposte a una lega nuova |

I file XLSX vanno scaricati dall'area download di Fantacalcio.it: non sono inclusi
qui perché non sono miei da ridistribuire. Leghe, membri, aste e registri non stanno
più in `res/`: stanno nel database.

### `/legacy`

Le schermate Thymeleaf con cui è nato il progetto esistono solo col profilo Spring
`legacy` (`-Dspring-boot.run.profiles=local,legacy`), girano ancora sulle aste su
file di `res/auctions/` e non conoscono account né leghe: non hanno protezione CSRF
né controllo d'accesso. **Solo in locale, mai su un'installazione raggiungibile da
altri.** Sono abbandonate: compilano, ma non si estendono.

---

## Verso il deploy

Il passo che segue questo sotto-progetto. Quello che serve:

1. **Postgres 17 gestito, con due ruoli.** Uno proprietario dello schema, che esegue
   Flyway (`spring.flyway.user` / `spring.flyway.password`); uno per l'applicazione,
   con `SELECT, INSERT` su `auction_event` e senza `UPDATE, DELETE, TRUNCATE`. È la
   seconda metà della garanzia append-only, accanto ai trigger:
   `REVOKE UPDATE, DELETE, TRUNCATE ON auction_event FROM <ruolo_app>`.
2. **Le variabili d'ambiente di `.env.example`**, con `FANTAAGENT_COOKIE_SECURE=true`
   e `FANTAAGENT_PUBLIC_URL` sull'indirizzo pubblico (compone i link delle email e
   degli inviti).
3. **`server.forward-headers-strategy=native` dietro un proxy.** Senza, il limite ai
   tentativi di accesso vede un solo indirizzo, quello del proxy, e blocca tutti
   insieme.
4. **Un SMTP vero** per verifica dell'indirizzo e recupero della password, con un
   mittente (`FANTAAGENT_MAIL_FROM`) che abbia SPF e DKIM del dominio.
5. **Backup giornaliero del database.** Con i file è sparita anche la copia del
   registro a ogni cambio di fase: il backup ora è compito dell'installazione.
6. **Il jar di produzione** (`mvn -Pprod package`) non contiene il Postgres
   incorporato: senza `FANTAAGENT_DB_URL` non parte, di proposito.
7. **`LoginThrottle` è in memoria**: con più istanze il limite ai tentativi di
   accesso vale per istanza, non per l'installazione.

---

## Com'è fatto

Java 25 e Spring Boot, Postgres con Flyway, sessioni su Spring Session JDBC.
L'interfaccia è un frontend React, servito dalla radice; il backend espone solo
`/api` (più `/legacy` col suo profilo, vedi sopra).

La SPA non ha ancora il pannello TARGET/obiettivi che c'era nelle schermate
Thymeleaf: è lavoro non ancora fatto, ed è onesto dirlo qui invece che lasciarlo
scoprire la sera dell'asta.

Il frontend React ha un passo di build: Node e npm, sotto `frontend/`. È il prezzo
pagato per avere una schermata d'asta che reagisce senza ricaricare, e per potere
finalmente testare comportamento e contrasti — la cosa che la suite Java, per sua
natura, non fa. Il jar però resta uno: il profilo Maven `prod` esegue `npm ci` e
`npm run build` e copia il risultato dentro l'artefatto, così `mvn -Pprod package`
continua a produrre una cosa sola che parte e basta, il che la sera dell'asta conta
più dell'eleganza.

Un instradamento lato client copre le rotte della SPA (`/`, `/leghe/...`, le
pagine d'asta, proiezione e impostazioni, `/invito/...`, `/accedi`, `/registrati`,
il recupero della password, `/profilo`): una ricarica su un percorso profondo
restituisce `index.html`, non un 404, perché l'indirizzo nella barra deve restare
quello richiesto. Un percorso che non è né una rotta della SPA, né `/api`, né
`/legacy` resta un 404 vero — niente fallback che inghiotte tutto e trasforma un
indirizzo sbagliato in una pagina bianca senza errore.

Chi non fa parte di una lega non ne vede nulla: per lui la lega e le sue aste non
esistono (404, non 403). I consigli di un membro si calcolano sul posto che
l'utente autenticato occupa in quell'asta, e nessuna richiesta può sceglierne un
altro.

Architettura esagonale leggera in un solo modulo Maven, con i confini fra dominio,
applicazione e adattatori verificati da ArchUnit invece che raccomandati a parole.

Lo stato dell'asta è la proiezione di un log append-only: non esiste stato di dominio
nel browser, e ogni schermata è una vista su quel log. È la ragione per cui l'API
non ha aggiornamenti ottimistici: mostrare un acquisto come riuscito prima che il
registro l'abbia confermato significa mentire nel momento in cui conta di più.

## Test

```bash
mvn test
```

I test di persistenza girano su un Postgres incorporato condiviso, un database
fresco per ogni contesto Spring: niente da installare, e nessun test scrive in
`res/` o in `data/`.

Una nota onesta: la suite Java **non esegue JavaScript né CSS**. Countdown,
scorciatoie da tastiera e resa grafica si verificano aprendo l'applicazione, e più di un difetto è uscito esattamente da lì. Il frontend
React ha una sua suite — `cd frontend && npm test` — nata proprio perché quella zona
cieca non diventasse la maggioranza del prodotto. La prova end-to-end
(`frontend/e2e/critical-path.spec.ts`, Playwright) vuole un backend già avviato, su
un database di prova:

```bash
FANTAAGENT_DB_DIR=$(mktemp -d) ./run.sh      # terminale 1
cd frontend && npx playwright test           # terminale 2 (avvia da sé npm run dev)
```

---

## Documentazione

- [`docs/superpowers/specs/`](docs/superpowers/specs/) — la specifica di progetto, con
  le decisioni architetturali e le loro motivazioni
- [`docs/superpowers/plans/`](docs/superpowers/plans/) — i piani di implementazione
- [`docs/superpowers/decisions/`](docs/superpowers/decisions/) — il registro delle
  decisioni prese durante lo sviluppo
