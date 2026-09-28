# Persistenza e identità — specifica

Sotto-progetto 2 di 4 verso il portale multi-utente. Questo documento fissa cosa
viene costruito, cosa viene deliberatamente rimandato, e perché.

Data: 28 settembre 2026.

---

## 1. Perché, e dove si inserisce

FantaAgent oggi è un jar che gira in locale: un operatore, il banco, registra
l'asta su un file, e l'applicazione gli calcola i consigli. La destinazione decisa
il 28 settembre è un portale in cui più persone si collegano insieme, ognuna dal
proprio dispositivo, e **il server batte l'asta**: a turno ognuno chiama un
giocatore, tutti rilanciano, allo scadere il server aggiudica.

La roadmap del 7 settembre ([sotto-progetto 1](2026-09-07-frontend-app-api-design.md))
viene riordinata così:

| # | Sotto-progetto | Cosa consegna | Alla fine si può… |
|---|---|---|---|
| 1 | API JSON + app frontend | chiuso | — |
| **2** | **Persistenza e identità** — questo documento | Postgres, account, leghe, inviti, membri, aste dentro la lega, registro eventi su tabella, import delle aste su file | registrarsi, creare una lega, invitare col link, creare un'asta coi membri come posti; l'amministratore registra gli acquisti, ognuno vede rose e propri consigli |
| 3 | Sala condivisa in tempo reale | canale server→client, presenza, stato che si aggiorna da solo | seguire l'asta dal telefono mentre si muove |
| 4 | Il banditore sul server | turno di chiamata, lotto, countdown sul server, rilanci concorrenti, aggiudicazione; deploy | fare l'asta a distanza, ognuno dal suo dispositivo |

Persistenza e identità stanno in un solo sotto-progetto perché un database senza
proprietari non ha chiavi, e degli account senza database non hanno dove stare.

### 1.1 Decisioni prese

| Decisione | Scelta | Conseguenza |
|---|---|---|
| Autorità durante l'asta | Il server batte l'asta | Lo stato non può vivere in un singleton con un'asta selezionata; serve un canale bidirezionale (sotto-progetto 4) |
| Identità | Account veri, email e password | Password da custodire, email da mandare |
| Persistenza | Tutto su Postgres | Il registro eventi lascia il file |
| Gruppo e serata | Lega persistente, aste dentro | Regole e membri appartengono alla lega; l'invito si fa una volta |
| Consigli | A ognuno, privati | Una catena per asta, il posto come argomento, nessuna richiesta che valuti per un altro |
| Modo locale | Il portale sostituisce tutto | Una sola strada; il codice a file va in pensione come `/legacy` |
| Posto e membro | Un posto è un membro | Chi non è registrato non gioca |
| Aste su file | Import con abbinamento obbligatorio | Ogni partecipante del file deve corrispondere a un membro |
| Amministratore | Solo poteri correttivi | Assegna o toglie un giocatore, modifica il turno di chiamata; non gioca per altri né vede i loro consigli |

### 1.2 Cosa non cambia

Il dominio: `AuctionEvent`, `AuctionProjector`, `AuctionState`, `ValuationChain`,
il motore di prezzo. Niente di questo sa dove vive il registro o chi sta guardando,
e deve continuare a non saperlo.

La forma delle rotte: `/api/leagues/{leagueId}/auctions/{auctionId}/…` era stata
progettata per questo sotto-progetto, e i controller di stato, rose, giocatori ed
export cambiano solo nei guard.

---

## 2. Modello dei dati

Postgres, identificativi UUID, schema gestito da Flyway: una migrazione per
modifica, mai riscritta dopo essere stata applicata.

```
app_user        id, email (unica, senza distinzione di maiuscole), password_hash,
                display_name, email_verified_at, created_at

league          id, name, created_by → app_user, created_at,
                rules (jsonb), scoring (jsonb)            valori predefiniti della lega

league_member   league_id, user_id, role (ADMIN | MEMBER), team_name, initial, joined_at
                PK (league_id, user_id) · UNIQUE (league_id, initial)

league_invite   id, league_id, token_hash, created_by, created_at, expires_at, revoked_at

auction         id, league_id, name, created_by, created_at, deleted_at,
                rules, scoring, bidder (jsonb)            copiati dalla lega alla creazione

auction_seat    auction_id, user_id, team_name, initial, position
                PK (auction_id, user_id) · UNIQUE (auction_id, position)

auction_event   auction_id, seq, at, type, payload (jsonb), request_id, actor_id → app_user
                PK (auction_id, seq) · UNIQUE (auction_id, request_id)
```

Le sessioni HTTP stanno nelle tabelle di Spring Session JDBC; i token di verifica
e di recupero password in una tabella `user_token` (id, user_id, purpose,
token_hash, expires_at, used_at).

### 2.1 Il registro è append-only per costruzione

Oggi l'append-only è una disciplina del codice: `JsonlAuctionEventStore` non
riscrive. Qui diventa un vincolo del database:

- un trigger su `auction_event` rifiuta ogni `UPDATE` e `DELETE`;
- il ruolo con cui gira l'applicazione non ha il permesso di `UPDATE`, `DELETE` né
  `TRUNCATE` sulla tabella — le migrazioni girano con un ruolo diverso.

Correggere o annullare restano, come oggi, nuovi eventi che ne referenziano uno
precedente.

La PK `(auction_id, seq)` sostituisce il lock di `appendWithNextSeq`: due scritture
concorrenti che calcolano lo stesso seq non possono passare entrambe. L'idempotenza
diventa il vincolo `UNIQUE (auction_id, request_id)`.

### 2.2 Ogni evento dice chi l'ha scritto

`actor_id` è l'utente che ha prodotto l'evento. Con un amministratore che corregge
le rose degli altri, e dal sotto-progetto 4 con un server che aggiudica,
"chi ha cambiato questo prezzo" deve avere una risposta. `actor_id` sta sulla riga,
non nel dominio: `AuctionEvent` non cambia.

### 2.3 Le regole dell'asta si fotografano alla creazione

`auction.rules`, `scoring` e `bidder` sono copiati dalla lega quando l'asta nasce e
da lì non cambiano: è la garanzia che oggi dà `AuctionArchive.saveRules`. Modificare
la lega cambia le aste future, mai quelle aperte o giocate.

### 2.4 Posto = membro, ma fotografato

`auction_seat` dice quali membri partecipano a quell'asta, con quale nome squadra,
quale iniziale, e in che ordine di chiamata (`position`). Il `participantId` degli
eventi è l'id dell'utente.

- Nome squadra e iniziale sono proposti da `league_member` alla creazione dell'asta.
- I posti (chi partecipa, nome, iniziale) si modificano finché nel registro non c'è
  il primo `PlayerPurchased`; poi sono fissi.
- **`position` resta modificabile per tutta l'asta**: è il turno di chiamata, e
  modificarlo è uno dei due poteri dell'amministratore. Nel sotto-progetto 2 si
  imposta e si modifica; chi lo usa è il banditore del sotto-progetto 4.

Senza la fotografia, un membro che lascia la lega farebbe sparire una rosa già
pagata.

### 2.5 Cancellare un'asta

Imposta `auction.deleted_at`. Come il cestino di oggi, nulla si perde; l'asta
sparisce dagli elenchi e le sue rotte rispondono 404.

---

## 3. Identità e accesso

### 3.1 Sessione lato server

Spring Security con sessione in Postgres (Spring Session JDBC) e un cookie
`HttpOnly`, `Secure`, `SameSite=Lax`. Per una SPA servita dallo stesso dominio
dell'API è la scelta più sobria: nessun token da custodire in JavaScript, un logout
che cancella davvero la sessione, sessioni che sopravvivono a un riavvio e a una
seconda istanza.

Protezione CSRF col cookie `XSRF-TOKEN`, rimandato dal client nell'header
`X-XSRF-TOKEN`. `frontend/src/api/client.ts` lo aggiunge in un punto solo.

### 3.2 Password

- Argon2id tramite `DelegatingPasswordEncoder`: l'algoritmo si può cambiare senza
  invalidare gli hash esistenti.
- Minimo 10 caratteri, nessuna regola di composizione, rifiuto delle password di
  una lista di quelle più comuni.
- Limite ai tentativi di accesso per email e per indirizzo, con attesa crescente.

### 3.3 Email

Una porta `Mailer` con due adattatori: SMTP in produzione, e in sviluppo uno che
scrive il messaggio nel log.

- **Verifica dell'indirizzo.** L'account è usabile subito, senza aspettare l'email:
  la sera dell'asta nessuno deve restare fuori perché il messaggio è finito nello
  spam. La verifica serve per recuperare la password.
- **Recupero password.** Link a uso singolo, valido un'ora, di cui si conserva solo
  l'hash; richiede un indirizzo verificato. La risposta a "password dimenticata" è
  identica che l'email esista o no. Reimpostare la password chiude tutte le altre
  sessioni dell'utente.

### 3.4 Autorizzazione

Tre livelli, tutti nei guard che ogni endpoint già chiama:

1. **Autenticato** — tutto sotto `/api` tranne registrazione, accesso, verifica,
   recupero e la lettura di un invito.
2. **Membro della lega** — `LeagueGuard` risolve la lega dal database e verifica la
   membership. A chi non è membro risponde **404, non 403**: un identificativo non
   deve rivelare che la lega esiste. `AuctionGuard` verifica che l'asta appartenga a
   quella lega e non sia cancellata.
3. **Amministratore** — vedi 3.5.

Il creatore della lega ne è l'amministratore. La colonna `role` permetterebbe più
amministratori, ma in questo sotto-progetto ce n'è uno solo per lega.

### 3.5 Cosa può fare l'amministratore

L'amministratore **non gioca per nessuno e non vede i consigli di nessun altro
posto**. I suoi poteri sull'asta sono correttivi:

- **assegnare o togliere un giocatore a mano** — registrare, correggere, annullare
  un acquisto;
- **modificare il turno di chiamata**.

In più gestisce la lega: crea le aste, imposta i posti prima del primo acquisto,
cambia fase, gestisce inviti e membri, importa le aste su file.

**Nel sotto-progetto 2 l'assegnazione a mano è l'unico modo in cui un acquisto
entra nel registro**, perché il banditore sul server arriva col 4. È lo stesso
comando e lo stesso evento: dal 4 smette di essere la norma e diventa l'eccezione,
senza cambiare forma, e `actor_id` distingue un'aggiudicazione del server da una
correzione.

I membri leggono stato, rose, fase, e vedono i propri consigli. Non scrivono nel
registro.

### 3.6 Inviti

Un link `/invito/<token>`: token casuale di 256 bit, di cui il database conserva
solo l'hash. È riutilizzabile finché non scade (predefinito: 14 giorni) o
l'amministratore non lo revoca; l'amministratore può generarne uno nuovo in
qualsiasi momento.

- Con l'accesso già fatto: si vede la lega e chi invita, si sceglie nome squadra e
  iniziale, si entra.
- Senza account: registrazione con l'invito che segue, poi stessa scelta, poi si
  atterra nella lega.
- Già membro: si atterra nella lega.

Un membro può lasciare la lega; l'amministratore può toglierne uno. In entrambi i
casi il suo posto nelle aste con almeno un acquisto resta intatto (2.4), mentre in
quelle senza acquisti si toglie insieme a lui; l'utente perde l'accesso alla lega e
alle sue aste.

---

## 4. Lo strato applicativo

### 4.1 Dall'asta selezionata al registro delle aste

`AuctionRuntime` oggi tiene **un'asta selezionata** per l'intero processo. Diventa
`AuctionRegistry`: una mappa `auctionId → AuctionSnapshot`, dove lo snapshot porta
lo stato proiettato dal registro, i posti, le regole e la `ValuationChain`.

- Si costruisce alla prima richiesta per quell'asta e resta in una cache limitata;
  le aste inattive escono.
- Resta la garanzia di atomicità di oggi, ma per asta: uno snapshot si pubblica
  intero con una sola assegnazione, e chi legge vede tutto il vecchio o tutto il
  nuovo.
- Lo snapshot porta il **seq dell'ultimo evento come versione**. È il numero che il
  canale del sotto-progetto 3 trasmetterà.
- La `ValuationChain` dipende da regole e punteggio, cioè dall'asta: **una catena
  per asta**, condivisa da tutti i posti.

Spariscono `POST /auctions/{id}/select` e `POST /auctions/current/leave`: l'asta è
sempre quella dell'URL.

### 4.2 Scrittura

Ogni comando (acquisto, correzione, annullamento, cambio fase, turno di chiamata):

1. il guard verifica che l'utente sia l'amministratore;
2. il servizio valida contro lo snapshot corrente, con le regole di oggi (budget,
   slot, giocatore già assegnato);
3. inserisce l'evento con `seq = ultimo + 1`, in una transazione;
4. se la PK respinge il seq perché un'altra scrittura è arrivata prima, ricarica lo
   snapshot e **rivalida** — non ritenta alla cieca, perché il comando potrebbe non
   essere più valido;
5. pubblica il nuovo snapshot.

Con una sola istanza il punto 4 non scatta quasi mai. È lì perché col
sotto-progetto 4 scatterà, e questa parte non deve essere riscritta.

Il turno di chiamata non è un evento del registro: è `auction_seat.position`, e
modificarlo aggiorna la riga (l'append-only vale per `auction_event`, non per i
posti).

### 4.3 Valutazione per utente

`PlayerAnalysisService` riceve `(snapshot, seatId)` invece di leggere il flag `me`,
che sparisce da `Participant`.

**Il `seatId` non arriva mai dalla richiesta**: lo ricava il guard dall'utente
autenticato. Nessun endpoint accetta "valuta per il posto X". È la stessa forma
della garanzia della proiezione, che non ha un campo dove un prezzo possa stare:
l'amministratore corregge le rose degli altri, ma non esiste una richiesta con cui
leggerne i consigli.

### 4.4 Rotte

Invariate nella forma, con i guard nuovi: stato, rose, giocatori, valutazione,
fase, obiettivi, tabellone, export, acquisti.

Nuove:

| Rotta | Chi |
|---|---|
| `POST /api/auth/register`, `/login`, `/logout`, `/verify`, `/password/forgot`, `/password/reset` | chiunque (logout: autenticato) |
| `GET /api/me`, `PATCH /api/me` | autenticato |
| `GET /api/leagues`, `POST /api/leagues` | autenticato |
| `GET/PATCH /api/leagues/{id}` | membro / amministratore |
| `GET /api/leagues/{id}/members`, `DELETE …/members/{userId}` | membro / amministratore o sé stesso |
| `POST /api/leagues/{id}/invites`, `DELETE …/invites/{inviteId}` | amministratore |
| `GET /api/invites/{token}`, `POST /api/invites/{token}/accept` | chiunque / autenticato |
| `PUT /api/leagues/{id}/auctions/{auctionId}/seats` | amministratore |
| `POST /api/leagues/{id}/imports` | amministratore |

### 4.5 Confini

- Il contesto di sicurezza si legge solo negli adattatori in ingresso. Dominio e
  servizi ricevono l'utente o il posto come argomento. Una nuova regola ArchUnit lo
  verifica.
- Nuovo adattatore `adapter/out/jdbc` con `JdbcAuctionEventStore` e i repository di
  utenti, leghe, aste. JDBC semplice (`JdbcClient`), niente JPA: gli eventi sono
  righe append-only con un payload JSON, e le altre tabelle sono poche e piatte.
- `adapter/out/file` va in pensione come `/legacy`: compila, non si estende. Ne
  resta usato solo il pezzo che legge le cartelle per l'importazione.

---

## 5. Importazione delle aste su file

Dall'area della lega, l'amministratore sceglie una cartella d'asta (`events.jsonl`
più i file di regole, punteggio, partecipanti).

1. L'applicazione legge i partecipanti del file e chiede di **abbinare ognuno a un
   membro** della lega. Non si procede finché ne manca uno: chi non è ancora membro
   va invitato prima.
2. Crea l'asta con le regole del file (o del modello, per le aste che non le
   avevano, come fa oggi `AuctionTemplate`) e i posti dall'abbinamento.
3. Copia gli eventi coi loro `seq` e le loro date, riscrivendo i `participantId` con
   l'abbinamento; `actor_id` è l'amministratore che importa.
4. Proietta lo stato dal database e lo confronta con quello proiettato dal file:
   rose, prezzi, crediti residui, fase. **Se differiscono anche di un credito,
   l'import si annulla per intero** — una sola transazione.

I file `.bak` e `rose.csv` non si importano: il primo è una copia del registro, il
secondo si rigenera.

---

## 6. Frontend

Le schermate d'asta esistenti restano; cambia chi le usa.

- **Membri:** stato, rose, fase e i propri consigli, senza controlli di scrittura.
- **Amministratore:** in più registrazione, correzione e annullamento degli
  acquisti, cambio fase, turno di chiamata. Il popup di battuta locale e il
  `BroadcastChannel` verso la proiezione restano a lui finché non arriva il
  sotto-progetto 4.
- **Proiezione:** invariata, in sola lettura e senza valutazioni.

Schermate nuove: accesso, registrazione, password dimenticata / nuova password,
invito, **Le mie leghe** (sostituisce la home: leghe, aste in corso, il mio posto e
i miei crediti), impostazioni della lega (membri, inviti, regole predefinite),
posti e turno di chiamata di un'asta, importazione, profilo — che finalmente ha
motivo di comparire.

Valgono le regole già fissate: nessun riferimento a server, file o percorsi nei
testi; «banco» e «banditore» come lessico; scatole di dimensione fissa; pagina
piena. Il router entra ora, perché le rotte diventano più di una.

---

## 7. Errori

| Situazione | Risposta |
|---|---|
| Seq già preso da una scrittura concorrente | Rivalidazione; se il comando non è più valido, 409 con il motivo |
| Richiesta ripetuta (stesso `request_id`) | L'evento già scritto, senza duplicare |
| Sessione scaduta | 401; il client porta all'accesso e poi riporta alla stessa pagina |
| Non membro, membro rimosso, asta cancellata | 404 |
| Membro che tenta una scrittura | 403 — lui la lega la vede già |
| Invito scaduto o revocato | Pagina che lo dice e suggerisce di chiederne uno nuovo |
| Database irraggiungibile | 503 con un messaggio umano; nessuna scrittura parziale, ogni comando è una transazione |

---

## 8. Test

Postgres vero con Testcontainers per adattatori e servizi: il vincolo append-only
e il trigger vanno provati sul database, non su un finto.

- `UPDATE`, `DELETE` e `TRUNCATE` su `auction_event` falliscono, col ruolo
  dell'applicazione.
- Due acquisti concorrenti con lo stesso seq: uno passa, l'altro rivalida e, se non
  più valido, è respinto.
- Stesso `request_id` due volte: un evento solo.
- Un membro non ottiene mai i consigli di un altro posto, e l'amministratore nemmeno:
  un test per ogni endpoint che restituisce una valutazione.
- Un non membro riceve 404 su ogni rotta di una lega; un membro riceve 403 su ogni
  scrittura.
- I posti non si modificano dopo il primo acquisto; il turno di chiamata sì.
- Import: ogni asta in `res/auctions` si rilegge dal database con lo stesso stato; un
  abbinamento incompleto o una divergenza annullano tutto.
- Password: hash Argon2id, tentativi limitati, reset a uso singolo che chiude le
  altre sessioni.
- ArchUnit: nessun accesso al contesto di sicurezza fuori da `adapter/in`.

I test di dominio non cambiano. Quelli degli adattatori web cambiano solo nella
preparazione: un utente autenticato, una lega, un'asta.

---

## 9. Fuori da qui

- Tempo reale, presenza, aggiornamento automatico dello stato — sotto-progetto 3.
- Banditore sul server, lotto, countdown, rilanci dai dispositivi, uso del turno di
  chiamata — sotto-progetto 4.
- Deploy, hosting, osservabilità — sotto-progetto 4.
- Accesso con Google o altri fornitori.
- Più amministratori per lega, passaggio di amministrazione.
- Cancellazione dell'account ed esportazione dei propri dati.
