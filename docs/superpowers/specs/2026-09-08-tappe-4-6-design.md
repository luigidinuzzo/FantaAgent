# Tappe 4–6 — integrazione alla specifica

Le tappe 1–3 sono su `main`: il confine API esiste, la schermata d'asta funziona in
React, e le pagine Thymeleaf sono intatte accanto a lei.

Questo documento integra
[la specifica del sotto-progetto 1](2026-09-07-frontend-app-api-design.md), che
descriveva le tappe restanti in una riga ciascuna. Quella riga si è rivelata sbagliata
per la tappa 4, e qui viene corretta. Il resto della specifica — vincoli globali,
direzione visiva, disciplina sullo stato — resta in vigore e non si ripete.

Data: 8 settembre 2026.

---

## 1. Cosa resta, e cosa è diverso da come era scritto

| Tappa | La specifica diceva | Cosa è davvero |
|---|---|---|
| 4 | «Battitore e proiezione. Countdown, tastiera, audio.» | Una **seconda schermata**, in sola lettura, più il dialogo di rilancio in due versioni |
| 5 | «Home, riepilogo, impostazioni. Esportazione CSV inclusa.» | Confermato |
| 6 | «La rimozione.» | Confermato, più la decisione su come il jar serve la SPA |

L'errore nella riga della tappa 4 vale la pena nominarlo, perché è lo stesso tipo di
errore che la scansione pre-volo deve cercare: `/battitore` non è un popup, è la
**schermata da cui oggi si conduce l'asta**, proiettata sullo schermo condiviso, con la
propria ricerca, aggiudicazione, timer, annullamento, cambio fase ed esportazione. Chi
avesse letto solo il piano avrebbe costruito un dialogo e scoperto a metà tappa di
doverne costruire una pagina intera.

---

## 2. Tappa 4 — la proiezione e i due battitori

### 2.1 La proiezione diventa di sola lettura

Oggi si conduce dalla schermata proiettata. Era necessario: in Thymeleaf la schermata
privata non si aggiornava da sola, quindi tenerne due aperte non serviva a niente.
Ora `/asta` in React si riaggiorna ogni cinque secondi, e la divisione cambia.

**La proiezione mostra e basta**: i tabelloni di tutti, il giocatore all'asta, il
countdown. Non ha ricerca, non aggiudica, non cambia fase, non esporta. Si conduce dal
portatile, dove ci sono i tetti.

Due ragioni, e la seconda conta più della prima. È meno codice — ma soprattutto **una
schermata che nessuno tocca non può far trapelare niente per sbaglio**, e non esiste il
rischio di digitare su quella sbagliata mentre otto persone la guardano.

Il costo, dichiarato: mentre parli al tavolo devi guardare il portatile, non lo schermo
grande.

### 2.1.1 Quello che la proiezione smette di fare, la schermata privata deve saperlo fare

È la conseguenza che non va lasciata implicita. Oggi `/battitore` cambia fase, annulla
l'ultimo acquisto, regola il timer ed esporta; se smette, quelle azioni devono esistere
altrove o spariscono dal prodotto.

La schermata React d'asta oggi sa scegliere un giocatore, vederne la valutazione,
aggiudicarlo e mostrare i tabelloni. **Non sa cambiare fase e non sa annullare.** L'API
c'è per entrambe — `POST /phase` e `POST /purchases/void-last` sono state costruite nella
tappa 2 — ma il frontend non le chiama: gli hook erano stati scritti e poi **rimossi come
codice morto** durante la revisione finale, proprio perché nessuna schermata li usava.

Rientrano qui, con la loro interfaccia:

- **cambio fase**, che oggi è l'unico modo di passare dai portieri ai difensori;
- **annullamento dell'ultimo acquisto**, che lo stato dell'asta già segnala con `canUndo`
  e che nessun bottone raccoglie.

L'esportazione CSV **non** rientra qui: appartiene al riepilogo, quindi alla tappa 5.
La regolazione del timer segue le impostazioni, quindi anche lei alla tappa 5 — fino ad
allora vale il valore salvato, che è già ciò che l'API restituisce.

Senza questa sezione la tappa 4 consegnerebbe una proiezione elegante e un'applicazione
da cui non si può finire un'asta.

### 2.2 Due dialoghi di rilancio, non uno con un interruttore

Il dialogo esiste in due versioni: privata, col tetto, su `/asta`; pubblica, senza, sulla
proiezione. In Java la garanzia è strutturale — `ViewModels.PublicBidder` non ha il campo
dove un prezzo consigliato possa stare, e il sorgente spiega perché: un flag si
dimentica, un campo assente no.

In React si ricostruisce con la stessa disciplina:

- **due componenti in due file**, `BidderDialog` e `PublicBidderDialog`, con **due tipi
  TypeScript distinti**. Quello pubblico non ha il campo del tetto.
- **una regola di lint** che vieta al file pubblico di importare il tipo della
  valutazione — l'equivalente della regola ArchUnit, alla stessa altezza: impedisce di
  nominare, non di disegnare.
- il countdown, la tastiera e l'audio stanno in un **hook condiviso**, perché non toccano
  valutazioni. Condividere il comportamento è sicuro; condividere i dati no.

Si duplica del markup. È il prezzo, ed è lo stesso che il progetto ha già scelto di
pagare una volta.

### 2.3 I dati del battitore pubblico vengono dal package del tabellone

L'endpoint che alimenta il dialogo pubblico vive in `adapter/in/api/board`, insieme ai
DTO della proiezione, **non** accanto agli altri endpoint dell'API. Non è una scelta di
ordine: è ciò che mette quell'endpoint sotto la regola ArchUnit che vieta a quel package
di raggiungere `domain.strategy`.

Restituisce il giocatore, i secondi del timer e se il beep è attivo. Non restituisce
valutazioni, e non può iniziare a restituirle senza far fallire la build.

### 2.4 Lo stato che attraversa due finestre

Il dialogo di rilancio vive interamente nel browser: `AuctionController` lo dice a
chiare lettere — «un rilancio non è un fatto dell'asta, solo l'aggiudicazione lo è», e
scriverlo nel registro lo riempirebbe di eventi che non si possono annullare in modo
sensato. Quel principio non cambia.

Ma con una proiezione in sola lettura, «quale giocatore è all'asta» e «a che punto è il
countdown» devono arrivare a una seconda finestra, e sul server non esiste niente che lo
sappia.

**Passano per `BroadcastChannel`.** La schermata privata trasmette, la proiezione
ascolta.

Il canale porta **solo i fatti che sul server non esistono**: quale giocatore è
all'asta, a che prezzo, quanto manca. Nome, squadra e ruolo no — quelli sono dati di
dominio, e farli attraversare un canale fra finestre creerebbe una seconda verità
accanto al server, che è esattamente ciò che questa migrazione vieta. La proiezione li
chiede all'endpoint del tabellone, che è autoritativo e sta sotto la regola ArchUnit.

Nessuno stato sul server, nessuna riga nel registro, e funziona esattamente nel caso
reale: il proiettore è il secondo schermo dello stesso portatile, quindi stesso browser
e stessa origine.

**Il limite va dichiarato nell'interfaccia, non solo qui.** Se la proiezione viene aperta
su un altro dispositivo non riceve nulla — e allora deve *dirlo*, con la stessa
disciplina dello stato stantio della tappa 3: una schermata che resta ferma fingendo di
essere aggiornata è il difetto peggiore di tutta questa migrazione. Mostra i tabelloni,
che arrivano dal server e sono corretti, e dichiara di non poter mostrare il lotto
corrente.

### 2.5 Instradamento

Servono due URL — la proiezione va aperta in una seconda finestra. React Router rientra
qui, non nella tappa 5: era stato tolto perché c'era una rotta sola, e questa è la
seconda.

---

## 3. Tappa 5 — home, impostazioni, riepilogo

### 3.1 La home toglie il 409

Oggi il frontend React non si può aprire senza passare da `:8080`: senza un'asta aperta
ogni richiesta risponde `409 no-auction-selected`. La home lo risolve.

Elenca le aste esistenti — nome, ultima scrittura, acquisti, fase — e permette di
riprenderne una o crearne una nuova.

**Un'asta nasce quando si confermano le impostazioni, non quando si dichiara di volerla
cominciare.** È già così, ed è deliberato: creare al primo click lasciava dietro aste
vuote per chi si fermava alla schermata di conferma. La home React deve rispettare quel
confine — il pulsante «nuova asta» porta alle impostazioni, e l'asta esiste solo dopo.

### 3.2 Le impostazioni, e le loro validazioni

Partecipanti e regole di punteggio. È la parte delicata della tappa, e non per il
markup: le validazioni sono funzioni pure lato Java che restituiscono l'elenco completo
degli errori, non il primo soltanto, e quell'elenco è l'unica cosa che impedisce di
cominciare un'asta con numeri sbagliati.

Devono arrivare al client **per campo**, non come un banner. Un errore che dice «le
impostazioni non sono valide» costringe a cercare quale; un errore accanto al campo dice
cosa correggere. Il formato `problem+json` porta già un `type` stabile; questa tappa gli
aggiunge il dettaglio per campo.

### 3.3 Il riepilogo, e un debito che si salda qui

Le rose incolonnate, con l'annullamento di un acquisto preciso e l'esportazione CSV.

Qui si chiude un rinvio deciso durante le tappe 1–3: `revokePurchase` lancia lo stesso
`IllegalArgumentException` sia per «nessun acquisto con quell'id» sia per «già
annullato», e finiscono entrambi in un 422 generico indistinguibile. Era stato rimandato
apposta al piano che costruisce il suo consumatore, perché progettare un contratto
d'errore senza avere davanti chi lo consuma ha meno probabilità di venire giusto.

---

## 4. Tappa 6 — la rimozione, e il jar che serve la SPA

Template, controller HTML, HTMX e CSS eliminati in un commit solo, quando tutto il resto
è verde.

E qui si scioglie il rinvio dichiarato nel README: **il frontend impacchettato non è
ancora raggiungibile.** Il profilo `prod` lo mette nel jar, ma `/` è mappata da
`HomeController` e una request mapping vince sempre sulla pagina di benvenuto. Servirlo
prima avrebbe richiesto di scegliere come convive con le sei rotte Thymeleaf, e un
prefisso provvisorio tipo `/app/**` avrebbe creato una URL destinata a morire.

Tolte quelle rotte, la SPA va alla radice. Serve un fallback per le rotte lato client —
un percorso profondo ricaricato deve restituire `index.html`, non 404 — e quel fallback
non deve intercettare `/api`.

**La verifica della tappa 6 non è che i test passino.** È che `mvn -Pprod package`
produca un jar che si avvia e apre l'applicazione: la cosa che il README rivendica dal
primo giorno e che oggi non è vera.

---

## 5. Debiti che entrano in queste tappe

Iscritti durante le tappe 1–3 e
[documentati per esteso](../decisions/2026-09-08-tappe-1-3-decisioni.md):

| Debito | Tappa |
|---|---|
| Un metodo HTTP sbagliato su `/api` esce senza `problem+json`: l'eccezione precede la scelta dell'handler, quindi l'advice limitato al package non viene consultato. Stessa correzione già usata per i 404. | 4 |
| `walkAwayReason` arriva dall'API e nessuna schermata lo mostra — è la ragione per cui lasciar perdere un giocatore | 4 |
| Larghezza garantita del bersaglio tattile nella tabella di fase — oggi dipende dall'auto-layout e regge per caso | 4 |
| Tipizzare i due rifiuti di `revokePurchase` | 5 |
| Il numero del budget nel tabellone è nudo, senza etichetta né unità | 5 |
| React Router, tolto quando c'era una rotta sola | 4 |

---

## 6. Fuori perimetro

Invariato rispetto al sotto-progetto 1: account, database multi-lega, aggiornamenti in
tempo reale via SSE, hosting. Restano ai sotto-progetti 2, 3 e 4.

Una nota che vale la pena tenere: il `BroadcastChannel` della tappa 4 è la risposta
giusta *finché l'applicazione gira su una macchina sola*. Il sotto-progetto 4, portando
SSE, lo rende superfluo — e a quel punto va tolto, non stratificato.
