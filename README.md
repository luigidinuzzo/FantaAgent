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

## Avvio

```bash
./run.sh
```

Poi apri <http://localhost:8080>.

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

Java 25, Spring Boot, Thymeleaf e HTMX. **Nessun passo di build per il frontend**:
niente Node, niente npm, niente bundler — `mvn package` produce un jar che parte e
basta, il che la sera dell'asta conta più dell'eleganza.

Architettura esagonale leggera in un solo modulo Maven, con i confini fra dominio,
applicazione e adattatori verificati da ArchUnit invece che raccomandati a parole.

Lo stato dell'asta è la proiezione di un log append-only: non esiste stato di dominio
nel browser, e ogni schermata è una vista su quel log.

## Test

```bash
mvn test
```

Una nota onesta: la suite **non esegue JavaScript né CSS**. Countdown, scorciatoie da
tastiera e resa grafica si verificano aprendo l'applicazione, e più di un difetto è
uscito esattamente da lì.

---

## Documentazione

- [`docs/superpowers/specs/`](docs/superpowers/specs/) — la specifica di progetto, con
  le decisioni architetturali e le loro motivazioni
- [`docs/superpowers/plans/`](docs/superpowers/plans/) — i piani di implementazione
- [`docs/superpowers/decisions/`](docs/superpowers/decisions/) — il registro delle
  decisioni prese durante lo sviluppo
