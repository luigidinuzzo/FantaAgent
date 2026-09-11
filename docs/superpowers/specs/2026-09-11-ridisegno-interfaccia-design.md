# Ridisegno dell'interfaccia — specifica

Il sotto-progetto 1 è chiuso: sei tappe, il confine API, la SPA alla radice del jar,
le pagine Thymeleaf sotto `/legacy`. L'applicazione funziona e si conduce da React.

Questo documento descrive il passaggio successivo, che non aggiunge quasi nessuna
funzione: **rifà il livello di presentazione** per avvicinarlo a quattro mockup
forniti — home, impostazioni, e due viste della schermata d'asta — e nel farlo
chiude uno dei due debiti che ancora obbligano a passare da `/legacy`.

Non sostituisce
[la specifica del sotto-progetto 1](2026-09-07-frontend-app-api-design.md): i vincoli
globali, la disciplina sullo stato e le cinque garanzie restano in vigore e non si
ripetono qui se non dove il ridisegno le mette alla prova.

Data: 11 settembre 2026.

---

## 1. Cosa cambia, e cosa no

| Resta esattamente com'è | Cambia |
|---|---|
| Il confine API, i DTO, i codici di errore | Ogni componente di presentazione in `frontend/src` |
| L'architettura esagonale e la regola ArchUnit sul tabellone | La palette: quattro colori nuovi, nessuno tolto |
| L'append-only, l'undo per compensazione | L'instradamento: `/riepilogo` sparisce come pagina |
| Le cinque garanzie del sotto-progetto 1 | Una funzione nuova: la ricerca per nome |
| `adapter/in/web` e i suoi 87 test | Un endpoint nuovo, e un metodo nuovo nel servizio di ricerca |

**La direzione visiva non cambia direzione.** La palette «Campo» — fondo verde scuro,
accento oro, linee bianche in alfa — resta quella. Quello che i mockup portano è la
*grammatica*: pillole arrotondate, card con bordo luminoso, fasce di ruolo colorate,
griglia delle rose a colonne. Il viola e il magenta dei mockup non entrano.

---

## 2. Quello che i mockup chiedono e il backend non ha

Tre cose sono disegnate nei mockup come controlli e non possono esserlo. Dirlo qui
è il punto: scoperte a metà implementazione costerebbero un task.

### 2.1 Crediti squadre, numero squadre, limiti per ruolo

Nel mockup delle impostazioni sono quattro controlli attivi: «Crediti Squadre 500»,
«Numero Squadre 8», e le pillole `P 3 · D 8 · C 8 · A 6`.

Da noi `LeagueRules` è un record di configurazione letto da `application.yml`,
validato all'avvio da `StartupValidator`, e iniettato come bean dentro `PriceModel`,
`ReplacementLevels` e `ValuationChain`. Non è per asta, e non passa da
`SaveSettingsRequest`, che porta solo nome, battitore, partecipanti e punteggio.

Renderlo modificabile significherebbe dargli un ciclo di vita per asta e ricostruire
la catena di valutazione a ogni salvataggio: è lavoro del sotto-progetto della
persistenza, non di un ridisegno.

**Decisione.** I quattro numeri appaiono **con la forma esatta del mockup ma in sola
lettura**, dentro un gruppo etichettato «dalla configurazione». Sembrano quelli e non
mentono. Non sono `<input disabled>` — un campo disabilitato promette che un giorno,
in qualche stato, si potrà scrivere — ma testo dentro una pillola, con l'etichetta
che dice da dove viene il numero.

### 2.2 «$476 MAX» sulle card squadra

È il massimo che una squadra può ancora offrire per un singolo giocatore: il budget
residuo meno quanto serve a riempire gli slot rimanenti. Il numero non esiste in
`ParticipantView`, che porta `budgetRemaining` e `slotsRemaining` separati.

Calcolarlo nel browser è aritmetica su fatti del server, ma la formula è una regola
di lega — e questa migrazione ha un solo vincolo che non ha mai ceduto: nessuna
regola di dominio vive in due posti. Una formula nel browser e una in Java è come
nascono le due verità che poi divergono.

**Decisione.** Omesso. Le card portano budget, barra di riempimento, slot occupati su
totali e conteggi per ruolo — tutto dato che arriva così com'è. Quando il numero
servirà davvero, è un campo in più in `StateDtos`, non una funzione in TypeScript.

### 2.3 Tutto il resto che non ha una funzione dietro

Turno di chiamata, «Assegna / Chiama», chat, video, pausa, Magic Asta, le news, il
modo Mantra, le Euroleghe, il cestino che cancella un'asta, la colonna di icone sul
bordo destro della schermata d'asta, il riquadro premium in fondo alla barra
laterale.

**Decisione.** Fuori. Un pulsante che non fa niente è peggio di un pulsante assente:
il secondo si nota subito, il primo si scopre la sera dell'asta.

Il cestino merita una riga a parte, perché è l'unico che sarebbe *implementabile*:
cancellare un'asta vorrebbe dire cancellare il suo registro, e il registro è
append-only per scelta. Un'asta si abbandona, non si cancella.

---

## 3. La palette, e le linee del campo

### 3.1 Quattro colori di ruolo

`asta2` colora le fasce per ruolo: arancio i portieri, verde i difensori, blu i
centrocampisti, rosso gli attaccanti. Oggi `LeagueBoard` se li improvvisa con tre
`color-mix` e un token preso in prestito, perché quattro colori di ruolo non
esistono.

`scripts/palette.mjs` guadagna `role-p`, `role-d`, `role-c`, `role-a`, e `tokens.css`
si rigenera con `npm run tokens`. Entrano in `contrast.test.ts` come tutti gli altri,
contro `background` e contro `surface`, alla soglia 4.5:1 — le fasce portano testo
piccolo, non solo colore.

**Non riusano i token semantici.** `positive` è verde e il difensore è verde;
`destructive` è rosso-arancio e l'attaccante è rosso. Sono coincidenze cromatiche,
non lo stesso significato: il giorno in cui «positivo» diventasse blu, i difensori
non devono seguirlo.

**Il colore non porta mai il ruolo da solo.** La lettera `P`, `D`, `C`, `A` sta
dentro la pillola, come nel mockup. Questo non è una concessione all'accessibilità
aggiunta dopo: è il mockup che ha già ragione.

### 3.2 Le linee del campo

Un componente `PitchLines`: un SVG inline con linea di metà campo, cerchio di
centrocampo e due aree di rigore, tracciato in `--line`, `aria-hidden`, dietro il
contenuto e senza eventi del puntatore.

Due tarature, una per contesto:

- **nell'applicazione** l'opacità è bassissima, sotto la soglia in cui potrebbe
  intaccare il contrasto del testo che ci passa sopra. Il test di contrasto non può
  verificarlo (misura coppie di token, non sovrapposizioni), quindi il limite è
  scritto nel sorgente accanto al valore, con il motivo.
- **sulla proiezione** può alzare il tono: lo schermo è grande, il testo è enorme, e
  quella schermata esiste per essere guardata da lontano.

`PlayerDecisionCard` ha già un arco d'angolo commentato come «una linea di campo, non
un ornamento». È il precedente: le linee del campo sono parte del linguaggio, non una
texture applicata sopra.

---

## 4. `/` — la home

Barra laterale a sinistra, area principale a due colonne.

**La barra laterale** porta il nome dell'applicazione in alto, la navigazione al
centro, e in fondo lo stato della connessione. Sostituisce la barra superiore
attuale, ma **non** la regola che la governa: la navigazione vive in `AppShell`
perché è l'unico elemento che ogni schermata condivide, e il test che verifica che
ogni rotta del router sia raggiungibile da un link resta, aggiornato alle rotte
nuove. Due revisioni finali consecutive avevano trovato «una rotta aggiunta e nessuno
che la collega»: un ridisegno non è motivo per riaprire quella porta.

**Colonna sinistra:**

- la card-eroe, con il martelletto e il pulsante verde grande **CREA ASTA**. È
  l'attuale `startNew`, con il comportamento che non si tocca: chiude prima l'asta
  eventualmente aperta chiamando l'endpoint di uscita e **aspettando la sua
  conferma**, poi va alle impostazioni. L'asta nasce quando le impostazioni vengono
  confermate, mai prima.
- sotto, le aste in righe-pillola: pallino di stato, nome, fase, acquisti, ultima
  scrittura, «Riprendi». Il pallino non basta da solo a dire quale asta è aperta —
  resta il testo «In corso», che è come chi ascolta lo scopre.

**Colonna destra:** l'asta aperta, grande, con fase e acquisti, e il suo «Riprendi».
Se non ce n'è nessuna, l'`EmptyState` che esiste già.

Il conteggio degli errori resta com'è: un solo `role="alert"` per schermata,
l'errore della mutazione più recente ha la precedenza su quello di caricamento.

---

## 5. `/impostazioni` — «Crea Asta»

Freccia indietro in alto a sinistra, titolo centrato, e sotto la griglia di controlli
a pillola del mockup.

| Posizione nel mockup | Cosa ci va davvero |
|---|---|
| Nome Asta, largo al centro | `auctionName` |
| Modalità di chiamata / di rilancio | Timer del battitore, e il beep |
| Crediti Squadre, Numero Squadre | I due numeri di configurazione, in sola lettura (§2.1) |
| Limite singolo per ruolo, pillole `P 3 D 8 C 8 A 6` | Gli slot per ruolo, in sola lettura (§2.1) |
| Modifica Ruolo Giocatori | La disclosure delle regole di punteggio |
| CONFERMA E CREA ASTA, verde, in fondo al centro | Il salvataggio |

I partecipanti prendono una fascia propria sotto la griglia, nella stessa forma:
nome, iniziale, e chi sei tu. Esistono già come `ParticipantsFieldset`, con l'iniziale
in un campo suo — è quella che il comando «giocatore prezzo iniziale» usa per
riconoscere l'acquirente, e due Anna devono poter scegliere lettere diverse.

**Le regole di punteggio non stanno nel mockup**, e sono la parte più grande del
modulo: soglie del modificatore di difesa, bonus per ruolo, e una dozzina di voci.
Vanno dietro una disclosure con la forma del controllo «Modifica Ruolo Giocatori» —
chiusa quando non ci sono errori dentro, **aperta quando ce ne sono**. Un errore
nascosto dentro una sezione chiusa è un modulo che rifiuta di salvare senza dire
perché.

Ad asta aperta i parametri di punteggio restano bloccati, come oggi, e la schermata
lo dice: cambiarli riscriverebbe i numeri con cui una rosa già pagata era stata
valutata.

Gli errori restano per campo, accanto al campo che li causa, e il riassunto in cima
continua a dire il conto e il dove.

---

## 6. `/asta` — la schermata che conduce l'asta

È la schermata che cambia di più, e assorbe il riepilogo.

### 6.1 La barra superiore

A sinistra `‹` e il nome dell'asta. A destra i selettori di fase come controllo
segmentato, e tre pulsanti icona con una funzione ciascuno:

- apri la proiezione sul secondo schermo (`target="_blank"`),
- annulla l'ultimo acquisto,
- impostazioni.

Icone SVG, mai emoji, bersaglio da 44×44 px, nome accessibile su ognuna. La colonna
di icone sul bordo destro del mockup — appunti, bersaglio, altoparlante, documento,
cronologia — non ha nessuna funzione dietro e sparisce.

Il cambio fase merita la barra e non un menù: è l'unico modo di passare dai portieri
ai difensori, e nella versione attuale è un controllo in mezzo alla pagina.

### 6.2 Le tre zone

1. **La ricerca**, al centro in alto, con i filtri `TUTTI P D C A` — dove il mockup
   la mette, ed è la funzione nuova (§8).
2. **La card del lotto**, col bordo dorato luminoso: valutazione, prezzo, battitore.
   È `PlayerDecisionCard` con dentro `BidPanel` o `BidderDialog`, ridisegnati. **I due
   dialoghi restano due file, due tipi, e la regola di lint che vieta al pubblico di
   importare il tipo della valutazione non si tocca.** Il gradiente di
   `PlayerDecisionCard` — «l'unico effetto decorativo del progetto» — smette di essere
   l'unico, ma resta il più marcato: è la card che decide.
3. **Il pannello di analisi**, a destra, dove il mockup scrive «Martinez Jo. è il 7°
   portiere di Serie A per fantamedia». Lì vanno i driver della valutazione, il tetto
   duro e le stelle di confidenza.

Su `hardCap` e `confidenceStars` vale la pena essere precisi: arrivano dall'API dalla
tappa 1 e **nessuna schermata li ha mai mostrati**. Il pannello di analisi è dove
chiudono. `walkAwayReason` invece è già in scena da quando la card esiste, e resta
dov'è: sotto il verdetto «Lascia», che è il momento in cui serve leggerlo.

### 6.3 Le schede

Una striscia con due schede — **Fase corrente** e **Rose squadre** — e
l'esportazione CSV all'estremità destra.

*Fase corrente* è la tabella che esiste, col suo paginatore. Il comportamento resta:
cambiare pagina non tocca la selezione, cambiare fase riporta a pagina 1, e la
tabella si blocca mentre il battitore è aperto — un lotto alla volta.

### 6.4 Le rose, che erano il riepilogo

Sotto le schede, la fila di card squadra, e sotto ancora la griglia di `asta2`: una
colonna per partecipante, sezioni di ruolo con la fascia colorata, la percentuale di
riempimento e il chevron che le chiude, righe-slot vuote comprese. Ogni riga piena
porta la sua revoca.

Questo **è** il riepilogo. Legge da `/board`, che è già la sua fonte oggi: una
seconda API che riassembla gli stessi eventi sarebbe una seconda verità, e `/board`
sta nel package che la regola ArchUnit tiene lontano dalle valutazioni — quindi
questa parte della schermata non può mostrare per sbaglio un prezzo consigliato
accanto a uno pagato. Il riepilogo dice cosa è stato speso, non cosa valeva.

La revoca conserva le sue due difese: solo la riga in volo si disabilita (non tutte),
e il `seq` viaggia con l'`auctionId` che **la board ha appena letto**, non con quello
del contesto della finestra.

Perché una scheda e non una sezione sempre in vista: la fila di card squadra basta a
sapere chi ha quanto, e la griglia intera — otto colonne per venticinque righe —
spingerebbe la card del lotto fuori dallo schermo proprio mentre si sta aggiudicando.
La scheda si apre quando si vuole guardare, non mentre si conduce.

---

## 7. `/proiezione`

Stesso linguaggio visivo: card squadra e griglia dei ruoli in grande, linee del campo
più marcate, il lotto corrente al centro.

Il vincolo permanente non si muove di un millimetro: **zero pulsanti, zero caselle di
testo, e mai il prezzo consigliato.** `nav={false}` continua a far sparire anche il
nome-come-link. La garanzia della confidenzialità del tetto resta strutturale in
quattro posti — il record Java senza il campo, il tipo TypeScript senza il campo, il
messaggio del `BroadcastChannel` senza il campo, la regola oxlint — e un ridisegno
non è motivo per farla diventare tre.

Il `BroadcastChannel` resta com'è, compreso l'avviso quando la proiezione è aperta su
un dispositivo che non riceve niente: una schermata ferma che finge di essere
aggiornata è il difetto peggiore di tutta questa migrazione.

---

## 8. La ricerca per nome

È l'unica funzione nuova, ed è nel mockup al centro della schermata d'asta perché è
lì che serve: un giocatore chiamato al tavolo non è quasi mai il prossimo della
tabella di fase.

Oggi la ricerca per nome esiste **solo in `/legacy`**. È uno dei due motivi per cui
quelle pagine sono ancora necessarie.

### 8.1 L'endpoint

`GET /api/leagues/{leagueId}/auctions/{auctionId}/players/search?q=&role=`

Vive in `PlayersApi`, accanto a `/phase` e `/{playerId}/valuation`, sotto lo stesso
`AuctionGuard`. Restituisce righe leggere: identificativo, nome, squadra, ruolo,
quotazione.

**Non restituisce valutazioni.** `PlayerSearchService.search` non le calcola, e
calcolarle costa qualche decina di millisecondi ciascuna — otto risultati a ogni
tasto premuto sarebbero centinaia di millisecondi buttati per numeri che l'utente non
sta ancora guardando. Si sceglie un risultato, e la valutazione arriva dall'endpoint
che esiste già.

Il parametro `role` è opzionale: assente significa «tutti».

### 8.2 Il servizio

`PlayerSearchService` guadagna un metodo che accetta il filtro di ruolo e il limite.
Il metodo `search(String)` esistente **non si tocca**: lo usano i controller
Thymeleaf, e cambiarne il comportamento cambierebbe il frontend vecchio che
sopravvive apposta per confronto.

Il filtro va applicato *dentro* la ricerca, non sui risultati: filtrare dopo aver
tagliato a otto svuoterebbe l'elenco ogni volta che i primi otto sono del ruolo
sbagliato.

### 8.3 Nel browser

La richiesta parte quando la digitazione si ferma, non a ogni tasto. Una risposta
che arriva dopo una richiesta più recente va scartata, non mostrata: il risultato di
«Mar» non deve sostituire quello di «Martinez» solo perché la rete l'ha consegnato
dopo.

La selezione di un risultato è la stessa selezione della tabella di fase — imposta
il giocatore corrente, la valutazione lo segue — non un secondo percorso parallelo.

---

## 9. Instradamento

| Rotta | Prima | Dopo |
|---|---|---|
| `/` | home | home, ridisegnata |
| `/asta` | asta | asta, con dentro le rose e la ricerca |
| `/impostazioni` | impostazioni | impostazioni, ridisegnate |
| `/proiezione` | proiezione | proiezione, ridisegnata |
| `/riepilogo` | pagina | **reindirizza a `/asta`** |

`/riepilogo` non sparisce come indirizzo. È nel README, in `SpaRoutesController`, e
quasi certamente in qualche segnalibro: un indirizzo che ha funzionato deve
continuare a portare da qualche parte. Il reindirizzamento vale sia lato client sia
nella lista esplicita di `SpaRoutesController`, che va tenuta d'accordo con il router
— sono due elenchi della stessa cosa, ed è esattamente il tipo di coppia che diverge
in silenzio.

Il test che verifica che ogni rotta del router sia raggiungibile da un link resta, e
va aggiornato: `/proiezione` è l'eccezione voluta di sempre (si apre solo dal suo
collegamento in `/asta`), e `/riepilogo` diventa la seconda — un reindirizzamento non
è una destinazione da collegare. Le eccezioni vanno scritte con il loro perché, non
aggiunte a una lista.

---

## 10. Quello che non si negozia

Il ridisegno tocca ogni componente. Questi vincoli sono il motivo per cui può farlo
senza rompere quello che è costato sei tappe.

**Le tre forme dell'annuncio.** Qualificatore di valore (`sr-only` in linea), stato di
regione (paragrafo `sr-only` a sé), stato di controllo (`sr-only` più
`aria-describedby`). Un segnale che raggiunge solo chi guarda lo schermo è un segnale
mancante: nelle tappe 1–3 questo difetto è stato trovato sette volte.

**Un solo canale `role="status"`** di narrazione ambientale per schermata:
`AuctionAnnouncer`. Un `role="alert"` legato a un campo è legittimo, ma **uno alla
volta** per schermata.

**Solo token, mai colori letterali.** I quattro di ruolo entrano dalla porta
principale, generati e testati come gli altri.

**Icone SVG, mai emoji. Bersagli da 44×44 px. `.tnum` su ogni cifra che si incolonna.
Tabelle semantiche** con intestazioni di riga e colonna dove ci sono davvero righe e
colonne — la griglia delle rose ne è una.

**Nessun aggiornamento ottimistico.** La cache è la risposta del server, non una
previsione. Un test lo impone ispezionando la cache mentre la mutazione è in volo, e
resta.

**Nessuno stato di dominio nel browser.** Il `BroadcastChannel` porta solo ciò che sul
server non esiste — quale lotto, a che prezzo, quanto manca — mai nome, squadra o
ruolo, che sono dati di dominio e hanno già una fonte autoritativa.

---

## 11. I test

I test attuali sono di due specie, e il ridisegno le tratta diversamente.

**Quelli che asseriscono su ruoli ARIA, nomi accessibili e testo sopravvivono** e
sono il motivo per cui questo lavoro è fattibile: «il bottone che dice Riprendi porta
all'asta» resta vero qualunque forma prenda il bottone. Un test che smette di passare
solo perché il markup è cambiato attorno a un `getByRole` stava verificando il markup,
non il comportamento, e va riscritto — non aggirato.

**Quelli che asseriscono sulla struttura vanno riscritti**: conteggi di elementi,
`data-testid` su contenitori che spariscono, gerarchie di `<div>`.

Restano obbligatori, perché sono garanzie e non dettagli:

- il test del contrasto, esteso ai quattro colori di ruolo;
- il test che ogni rotta del router sia collegata;
- il test che la cache non venga anticipata;
- i test di confidenzialità sul battitore pubblico e sulla proiezione, in tutti e
  quattro i punti;
- i 87 test di `adapter/in/web`, che continuano a passare senza che una riga di quel
  package venga toccata.

Ogni guardia nuova va **vista fallire** prima di essere considerata una guardia. È la
lezione più cara delle tappe precedenti: una regola ArchUnit che passava a vuoto, una
scansione di link il cui pattern non trovava niente, test d'ordine tautologici.
Rompere deliberatamente ciò che la guardia protegge, vedere il rosso, rimettere a
posto.

---

## 12. Fuori perimetro

Invariato: account, database multi-lega, aggiornamenti in tempo reale via SSE,
hosting. Restano ai sotto-progetti 2, 3 e 4.

In più, dichiarati qui perché i mockup li suggeriscono:

| Cosa | Perché non ora |
|---|---|
| Crediti, numero squadre e slot modificabili | Ciclo di vita di `LeagueRules` per asta: sotto-progetto 2 |
| Il «MAX» sulle card squadra | Un campo in `StateDtos`, quando servirà davvero (§2.2) |
| Cancellare un'asta | Il registro è append-only: un'asta si abbandona |
| Il pannello obiettivi | Resta il secondo e ultimo motivo per cui `/legacy` serve |

Il pannello obiettivi è il debito che sopravvive a questo ridisegno. Dopo questa
tappa il README deve nominare lui solo, non più «la ricerca per nome e il pannello
obiettivi».
