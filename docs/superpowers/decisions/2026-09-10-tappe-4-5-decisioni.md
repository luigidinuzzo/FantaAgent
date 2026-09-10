# Tappe 4–5 — decisioni prese durante l'esecuzione

Tredici task, ventinove commit, ognuno con revisione e ciclo di correzione, più due
revisioni finali di ramo con la loro ondata. Questo documento tiene ciò che non sta in
git: cosa è stato deciso, perché, e cosa costerebbe se la decisione fosse sbagliata. Il
registro operativo da cui viene è stato cancellato a merge avvenuto.

Come per le tappe 1–3, le decisioni sono di due specie: quelle che hanno cambiato il
codice, e quelle che hanno corretto il piano — perché sbagliava il piano, non
l'implementazione.

---

## 1. Difetti del piano corretti prima o durante l'esecuzione

La scansione pre-volo ne ha trovati otto nella tappa 4 e tre nella tappa 5, prima che
l'esecuzione cominciasse. Le revisioni ne hanno trovati altri durante. Elencarli è il
motivo per cui quella scansione esiste.

**`useBidCountdown` avrebbe chiamato `onExpire` una trentina di volte, non una.**
`setRunning(false)` non ha effetto finché React non ri-renderizza, e
`vi.advanceTimersByTime` esegue tutti i tick in un turno sincrono. Con un'aggiudicazione
in gioco, trenta chiamate invece di una. L'intervallo va fermato **nello stesso tick** che
tocca lo zero.

**`bidChannel.ts` importava `Role` senza usarlo**, e `noUnusedLocals` avrebbe fatto
fallire `npm run build`.

**Il blocco Interfaces del task 5 contraddiceva il proprio codice**, dichiarando ancora
`playerName`, `team` e `role` nel messaggio fra finestre. Sono dati di dominio: farli
attraversare un canale browser-a-browser creerebbe una seconda verità accanto al server.

**Un test cliccava un bottone che a quel punto non esiste.** Il form di aggiudicazione
compare solo a countdown scaduto, e con timer reali non scadeva mai dentro il test.

**Il controllo «non ricevo» verificava la cosa sbagliata.**
`typeof BroadcastChannel !== 'undefined'` dice se il browser **ha** l'API, mentre il
commento accanto giurava che dicesse se questa finestra **sente** l'altra. Nel caso reale
— proiezione su un altro dispositivo — l'API c'è, quindi l'avviso non sarebbe scattato
mai. Un avviso che non può scattare, sotto un commento che afferma il contrario, fa
sembrare verificato il silenzio.

**`BidderDialog` non era montato da nessuna schermata.** Il piano lo creava, lo testava e
non lo collegava mai: la tappa avrebbe consegnato un componente morto e una proiezione in
attesa perpetua di un messaggio che nessuno manda — perché quel dialogo è l'unico che
chiama `publishBid`.

**`save()` calcolava le impostazioni di punteggio anche ad asta aperta**, contraddicendo
l'invariante dichiarata dal commento due righe sopra, e sollevando un NPE col runtime
finto.

**Un commento diceva che `SettingsController` sta sotto `/legacy`.** Ci starà nella tappa
6; scriverlo al presente descriveva una decisione futura come un fatto.

**I test delle impostazioni avrebbero scritto file veri dentro `data/`**, che non è
ignorata da git — lo stesso tipo di incidente per cui un acquisto vero era già finito nel
registro durante le tappe 1–3.

**Un'asserzione era insoddisfacibile per costruzione.** `getNodeText` di Testing Library
concatena solo i figli testuali diretti, quindi «3 acquisti» non poteva risultare da uno
`<span>` contenente il solo numero. Andava cambiato il markup, non il test.

**Sette commenti spiegavano male un meccanismo.** Il più istruttivo: il rilancio da dentro
un `@ExceptionHandler` fa passare al resolver successivo **sempre**, non perché si
rilancia la stessa istanza — quella scelta evita solo un WARN spurio nel log. Il
comportamento era giusto, la spiegazione no.

---

## 2. Decisioni che hanno cambiato il codice

**Il canale fra le finestre porta solo ciò che sul server non esiste** — `playerId`,
prezzo, tempo residuo. Nome e squadra li chiede al server, che è autoritativo e sta sotto
la regola ArchUnit. È ciò che rende necessario l'endpoint del battitore proiettato invece
che decorativo.

**Il dialogo ripubblica dieci volte al secondo**, aprendo e chiudendo un canale a ogni
tick, perché l'orologio proiettato non ha altra fonte e un messaggio fermo lo
congelerebbe. Scartato il canale unico in cache: il test che prova il degrado gentile
stubba `BroadcastChannel` a `undefined`, e un'istanza sopravvissuta allo stub lo farebbe
passare senza provare niente.

**Dopo il gong il dialogo continua a mostrare il proprio lotto** invece di cedere il
canale al battito cardiaco, che pubblica `idle` — e `idle` significa «nessun lotto». Il
prezzo sarebbe sparito dal proiettore nell'istante in cui si sceglie l'acquirente.

**Un battito cardiaco dalla schermata privata** distingue «non sono collegato» da «non c'è
nessun lotto aperto», e la proiezione misura la staleness col medesimo idioma già usato
per il collegamento al server.

**La tabella dei giocatori si blocca mentre un lotto è aperto.** Un lotto per volta è come
funziona la stanza, e un clic distratto non deve spostare un rilancio in corso su un altro
giocatore — cosa che sul proiettore si vedrebbe pure.

**Il riepilogo consuma `/board` invece di avere un'API propria.** Quell'endpoint porta già
rose per ruolo, `seq`, nome e prezzo pagato; una seconda che assembla gli stessi eventi
sarebbe una seconda verità. In più eredita la regola ArchUnit, quindi il riepilogo non può
mostrare per sbaglio un prezzo consigliato accanto a uno pagato.

**La revoca si indirizza con l'`auctionId` del tabellone, non col letterale `corrente`.**
Il `seq` è per-registro: con una scheda lasciata aperta su un'asta e un'altra selezionata
altrove, la revoca sarebbe andata a buon fine sul registro sbagliato, su un acquisto
diverso.

**«Nuova asta» chiude prima l'asta aperta.** Senza, si finiva sulle impostazioni di quella
in corso — senza campo per il nome — e il salvataggio ne riscriveva i partecipanti invece
di crearne una nuova. Il difetto era già stato corretto una volta lato Thymeleaf, e il
codice per evitarlo esisteva su questo ramo senza chiamanti.

**La navigazione sta in `AppShell`, con un test che la impone.** Due revisioni finali di
fila hanno trovato la stessa cosa — una rotta aggiunta al router e nessun task che possiede
il collegamento. Ora «rotta senza collegamento» è un test rosso, non una scoperta.

**Il nome dell'asta ha una chiave d'errore sua**, accanto a partecipanti, punteggio e
battitore: non appartiene a nessuna delle tre, e sotto «punteggio» si andrebbe a cercarlo
accanto ai bonus.

**Un solo `role="alert"` sulla schermata Impostazioni**, col conto e le sezioni; il
dettaglio accanto a ciascuna. Tre alert che si popolano insieme se ne mangiano due.

**`ProblemError` porta il corpo intero del problem**, non un campo tipizzato: altrimenti
ogni endpoint che aggiunge una proprietà al proprio 422 costringerebbe a modificare una
classe che non lo riguarda.

**I numeri del punteggio si digitano in un buffer di testo.** Su un `<input type=number>`
controllato, `value` legge `""` per un numero parziale: digitare `-` dava `0` e React
cancellava il segno, rendendo `-0.5` irraggiungibile da tastiera su otto campi che lo
usano normalmente.

---

## 3. Decisioni di rinvio, con la loro ragione

**L'esportazione CSV va alla tappa 6.** `RosterCsvExporter` è package-private dentro
`adapter/in/web`: le alternative erano toccare la rete di sicurezza o scrivere due volte
lo stesso formato. E rinviare non costa niente all'utente, perché finché le pagine vecchie
esistono l'esportazione esiste.

**La tabella delle soglie del modificatore di difesa** non ha ancora un editor React: ha
un'interfaccia sua — righe che si aggiungono, ordine crescente, bonus non decrescente — e
avrebbe raddoppiato il task. Il valore si rispedisce invariato, e un test lo dimostra.

**Gli errori restano per sezione, non per campo.** I tre validatori restituiscono frasi in
italiano, e la loro firma serve anche a `SettingsController`. Nella tappa 6 crescono un
metodo per campo e il `validate()` di oggi ne diventa l'appiattimento: una logica, due
consumatori.

---

## 4. Debiti iscritti alla tappa 6

| Debito | Perché lì |
|---|---|
| Le pagine Thymeleaf si spostano sotto `/legacy` invece di sparire | Restano come termine di paragone; il prefisso tocca a chi ha la data di scadenza, così la SPA prende la radice e il jar può finalmente servirla |
| I validatori crescono un metodo per campo | Serve a dare errori per campo senza rompere la firma che la pagina legacy usa |
| `RosterCsvExporter` esce da `adapter/in/web` e prende un endpoint | È lì che diventa spostabile senza toccare la rete di sicurezza |
| La schermata delle soglie | L'ultima cosa per cui bisogna passare da `/legacy` |
| `MAX_NAME` e i messaggi duplicati | Muoiono con `SettingsController` |
| Due alert possono convivere sulla home | Stessa disciplina già applicata a Impostazioni e Riepilogo, non generalizzata alla home |

---

## 5. Cosa ha retto

`adapter/in/web` non è stato toccato in ventinove commit, e i suoi 87 test sono passati a
ogni task senza che una riga venisse modificata per farli passare — inclusa la tappa 5,
che scrive negli stessi file della vecchia schermata Impostazioni e in cui quei test sono
la prova che l'ordine delle scritture è giusto.

Le garanzie della tappa 4 sono state verificate contro il sorgente a fine tappa 5 e
reggono ancora: il tetto non può raggiungere il proiettore per quattro vie indipendenti,
nessun aggiornamento ottimistico anticipa il `fsync`, un solo canale di narrazione
ambientale, e nessuno stato di dominio specchiato nel browser.

Le quattro garanzie strutturali sulla confidenzialità sono state **rotte di proposito**
una per una per dimostrare che mordono: la regola ArchUnit su due file, la regola di lint
su entrambi i file che protegge. Una regola che non si è vista fallire è una regola non
verificata — in questo progetto ne era già passata una che non controllava niente.
