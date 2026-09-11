# Tappa 6 — decisioni prese durante l'esecuzione

Sei task, ventiquattro commit, ognuno con revisione e ciclo di correzione, più la
revisione finale di ramo e la sua ondata. Questo documento tiene ciò che non sta in git.

È l'ultima tappa della migrazione del frontend. Le precedenti stanno in
[`2026-09-08-tappe-1-3-decisioni.md`](2026-09-08-tappe-1-3-decisioni.md) e
[`2026-09-10-tappe-4-5-decisioni.md`](2026-09-10-tappe-4-5-decisioni.md).

---

## 1. La decisione che ha cambiato la tappa

**Le pagine Thymeleaf non si eliminano: si spostano sotto `/legacy`.** È una richiesta
esplicita — servono come termine di paragone durante la migrazione e per mostrare a che
punto è il lavoro.

Il motivo per cui la spec voleva eliminarle però resta intatto, ed è l'unica cosa che
questa tappa doveva assolutamente risolvere: `/` era mappata da `HomeController`, e una
request mapping vince sempre sulla pagina di benvenuto, quindi **il jar non poteva servire
la SPA**. Peggio, `/asta`, `/riepilogo` e `/impostazioni` erano mappate due volte, con
Thymeleaf che vinceva.

La soluzione è invertire il prefisso. La spec aveva scartato un `/app/**` provvisorio per
la SPA perché avrebbe creato una URL destinata a morire; prefissare il *vecchio* è
l'esatto contrario. Le URL brutte toccano a chi ha la data di scadenza.

---

## 2. L'ordine dei task, e la ragione sottile che lo imponeva

**Lo spostamento sotto `/legacy` doveva venire prima del fallback della SPA**, e non per
comodità.

I template contengono 51 riferimenti a URL, e gli 87 test di quelle sei classi **non ne
esercitano nemmeno uno**: colpiscono i controller direttamente. Un collegamento
dimenticato non sarebbe diventato rosso da nessuna parte.

Finché il fallback non esiste, quel collegamento dà almeno un 404 rumoroso. Dopo, viene
inghiottito e serve la pagina React al posto di quella vecchia — un bottone che, invece di
funzionare o rompersi, cambia silenziosamente applicazione. Un 404 lo si vede; una pagina
sbagliata che si apre senza errori, no.

**È successo comunque, nel terzo posto.** La guardia legge i template e il Java; le URL
vivevano anche in `static/app.js`, e due scorciatoie da tastiera — annulla e pannello
obiettivi — hanno smesso di funzionare in silenzio. L'ha trovata la revisione finale,
leggendo, non eseguendo. La correzione è stata riparare le due chiamate **e** estendere la
guardia ai file JavaScript nello stesso commit: la riparazione e il test che l'avrebbe
colta appartengono insieme.

---

## 3. Decisioni che hanno cambiato il codice

**Le rotte della SPA si elencano, non si inghiottono.** Un fallback generico vive di
esclusioni — `/api`, `/legacy`, le risorse statiche — e la prossima da ricordare la si
scopre in produzione: `/legacy` è nata in questo stesso ramo. E inghiottire tutto
trasforma un indirizzo sbagliato in una pagina bianca senza errore, che è il difetto che
questa migrazione ha passato due tappe a togliere dalle schermate. Ciò che non è
nell'elenco dà 404, che è la verità. Un test per riflessione confronta l'elenco con
`router.tsx` e con l'annotazione vera, così le copie non possono divergere in silenzio.

**I validatori crescono un metodo per campo, e il vecchio ne diventa l'appiattimento.**
La spec chiedeva errori per campo dalla prima tappa e non era possibile: i tre validatori
restituiscono frasi, e la loro firma serve anche alla pagina Thymeleaf. Una logica, due
consumatori, nessuna firma rotta. L'ordine dei messaggi è parte del contratto — i test di
`SettingsController` lo asseriscono senza saperlo — quindi la mappa è una `LinkedHashMap`
resa non modificabile, non una `Map.copyOf`, che l'ordine non lo conserva.

**Il checkbox del modificatore di difesa entra con la sua tabella.** `ScoringFieldset`
leggeva quel flag per disabilitare la tabella e nessuno in React lo scriveva: si poteva
accendere solo da `/legacy`. Un editor per una tabella che non si può accendere dalla
stessa schermata fallisce l'obiettivo della tappa nel modo meno visibile.

**`run.sh` non apre più niente da solo.** Apriva `:8080` dopo sei secondi, cioè la pagina
che il README appena riscritto dichiara vuota. Scartato anche ripuntarlo su `:5173`: il
dev server parte in un altro terminale, magari dopo, quindi lì potrebbe non esserci nulla
nemmeno stavolta. Uno script che apre la pagina sbagliata è peggio di uno che non ne apre
nessuna; al suo posto stampa quale indirizzo serve a cosa.

**Il `Content-Disposition` dell'esportazione si costruisce con `ContentDisposition`.**
Concatenava l'id dell'asta senza escape, sicuro solo perché gli id sono date — e il
Javadoc di `AuctionGuard` promette che un sotto-progetto successivo renderà le aste
nominabili. La sicurezza era un invariante non scritto che viveva lontano dal codice che
ne dipendeva.

---

## 4. La verifica che conta

`mvn -Pprod package`, jar avviato su una cartella dati usa e getta e una porta libera:

| Superficie | Esito |
|---|---|
| `/` | 200 `text/html`, con `<div id="root">` e il riferimento al bundle |
| `/assets/index-*.js` | 200 |
| `/riepilogo` (rotta profonda ricaricata) | 200, stessa SPA |
| `/legacy` | 200, Thymeleaf vero |
| `/api/...` inesistente | 404 `application/problem+json` |

**È la cosa che il README rivendicava dal primo giorno e che non era mai stata vera.**

---

## 5. Quello che ancora manca, dichiarato invece che promesso

La revisione finale ha risposto **no** alla domanda «si può condurre un'asta interamente
da React». Aveva ragione: `AuctionRoute` chiedeva sempre la prima pagina della fase, senza
paginazione né ricerca, quindi un giocatore oltre il venticinquesimo non si poteva
comprare da React.

La paginazione è stata ripristinata — i dati erano già nella risposta. **Restano due cose
che richiedono `/legacy`**, e il README ora le nomina invece di affermare il contrario:

- la **ricerca per nome** di un giocatore;
- il **pannello obiettivi**, che non ha nemmeno un endpoint API.

Sono lavoro da sotto-progetto, non da rifinitura. Dichiararle è più onesto che
prometterle.

---

## 6. Cosa ha retto

Gli 87 test delle sei classi Thymeleaf sono ancora 87 e ancora verdi, dopo essere stati
modificati **solo negli indirizzi** — la revisione li ha diffati riga per riga per
verificarlo. Sono stati la rete di sicurezza dell'intera migrazione per sei tappe, e
nell'ultima, quella che li ha spostati, hanno continuato a fare il loro mestiere.

Le quattro garanzie sulla confidenzialità del tetto, il canale unico di narrazione
ambientale, l'assenza di aggiornamenti ottimistici e di stato di dominio nel browser sono
state verificate contro il sorgente a fine tappa e reggono tutte.

E `/legacy` è sicuro da tenere: `AuctionGuard` rifiuta con un 404 tipizzato una scrittura
indirizzata all'asta sbagliata, e tutte le scritture passano dallo stesso `AuctionRuntime`
e dallo stesso registro. Resta la possibilità che due schede mostrino tabelloni diversi
finché una non si aggiorna — vera, ma accettabile per un'applicazione locale con un solo
operatore.
