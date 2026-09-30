# Club Notturno: fondamenta e asta — specifica

Il prodotto funziona: si crea una lega, si invita, si batte un'asta, la si proietta.
Questo documento descrive il primo passo di un ridisegno che deve portarlo da
«applicazione che funziona» a prodotto che si può lanciare: una direzione visiva
nuova per tutto il frontend, e la schermata dell'asta rifatta sopra di essa.

Non aggiunge funzioni e non tocca il backend. Non sostituisce le specifiche
precedenti: i vincoli del confine API, le cinque garanzie del sotto-progetto 1 e la
regola «il tetto non raggiunge la proiezione» restano in vigore.

Data: 30 settembre 2026.

---

## 1. Da dove viene

Il 30 settembre tutte le 15 pagine sono state fotografate (1440px e 390px, con
risposte finte al posto del backend) e analizzate due volte: da Lovable, sulle
tavole degli screenshot, e in locale, su codice e immagini. Le due letture
concordano su cinque problemi, in quest'ordine:

1. **Leggibilità.** Testi secondari e tabelle piccoli e poco staccati dal verde.
2. **Asta senza gerarchia.** Tetto, offerta, tempo e squadra in testa pesano uguale;
   col conto avviato il tetto è più grande dell'offerta e si scambia per il prezzo.
3. **Il telefono è il desktop impilato.** L'asta è alta 3250px.
4. **L'erba a tutta finestra domina il contenuto.** Si legge «tema calcistico», non
   marchio; le pagine corte sono un riquadro in mezzo a un campo vuoto.
5. **Tutto ha lo stesso peso.** Pannelli, bordi, pillole e bottoni parlano la stessa
   lingua, e l'oro è ovunque.

Fra tre direzioni visive è stata scelta **Club Notturno**, e il mockup dell'asta in
quella direzione (tre stati del banco a 1440×900, due schermate del telefono) è
stato approvato.

### Il ridisegno intero, in sei passi

| # | Passo | In questo documento |
|---|---|---|
| 1 | Fondamenta: palette, tipografia, forme, barra | sì |
| 2 | Asta (desktop e telefono) e proiezione | sì |
| 3 | Gestione: le mie leghe, lega, regole, impostazioni, importazione, profilo | no |
| 4 | Ingresso: accedi, registrati, recupero, verifica, invito, errori | no |
| 5 | Pagina pubblica, logo definitivo, meta e immagine social | no |
| 6 | Funzioni di lancio: primo accesso guidato, riepilogo condivisibile, pagine legali | no |

Ogni passo ha la sua specifica, il suo piano e la sua implementazione. Le pagine
dei passi 3 e 4 qui cambiano solo pelle (§6): non devono sembrare rotte nel
frattempo, ma la loro impaginazione si rifà al loro turno.

---

## 2. Cosa cambia, e cosa no

| Resta esattamente com'è | Cambia |
|---|---|
| Il backend, il confine API, i DTO, i codici di errore | La palette e i suoi test di contrasto |
| Le rotte e i loro indirizzi | Il fondo: uniforme, senza erba né righe in gesso fuori dall'ingresso |
| Il lessico: banco, banditore, «il tuo tetto» | La barra: una di navigazione, una dei comandi dell'asta |
| Chi può fare cosa (amministratore, membro, senza posto) | L'impaginazione dell'asta, su computer e su telefono |
| La disciplina degli avvisi: un solo `role="alert"` alla volta | Raggi e forme di pannelli, bottoni e campi |
| Il `/legacy`, che non si tocca | La misura minima dei testi |
| La regola oxlint che tiene i consigli fuori dalla proiezione | Il numero eroe del conto alla rovescia: l'offerta, non il tetto |

---

## 3. Fondamenta

### 3.1 Palette

Unica fonte resta `frontend/scripts/palette.mjs`; `tokens.css` si rigenera con
`npm run tokens`. I nomi dei token restano dove il significato resta, così il
cambio non è una rinomina su cento file.

| Token | Oggi | Club Notturno | Uso |
|---|---|---|---|
| `background` | `#2E6B34` | `#07130E` | il fondo della finestra |
| `bar` (nuovo) | — | `#0A1A12` | le barre in alto e la barra in basso del telefono |
| `surface` | `#12301E` | `#0D2117` | i pannelli |
| `surface-raised` | `#163A24` | `#143020` | la riga selezionata, la tua squadra, la casella dell'offerta |
| `panel-border` | `#9BD3A5` | `#274636` | il bordo dei pannelli: quieto, non li deve staccare dall'erba |
| `control-border` (nuovo) | — | `#5F8F75` | il bordo di bottoni secondari e campi |
| `foreground` | `#F1F7F2` | `#F3F6F2` | |
| `muted-foreground` | `#87A594` | `#A7B8AD` | |
| `accent` | `#FFC24B` | `#F5B942` | |
| `on-accent` | `#1B1400` | `#1B1400` | |
| `positive` | `#5FD08A` | `#4ED187` | |
| `destructive` | `#F07A5C` | `#F06A6A` | |
| `role-p` `role-d` `role-c` `role-a` | | `#FFB84D` `#55D98A` `#63B3FF` `#FF6F91` | |
| `crest-1…6` | | invariati | |
| `grass`, `grass-stripe` | (`background`, `grass-stripe`) | `#2E6B34`, `#29612F` | solo la metà campo delle pagine d'ingresso |
| `line`, `line-strong` | bianco 15%, 25% | bianco 9%, 18% | divisori dentro i pannelli |
| `chalk` | bianco 40% | invariato | solo le righe della metà campo d'ingresso |

Contrasti calcolati con `contrastRatio` di `palette.mjs`:

| Coppia | Rapporto | Soglia |
|---|---|---|
| `foreground` su `background` / `surface` / `surface-raised` | 17,4 / 15,5 / 13,1 | 4,5 |
| `muted-foreground` su `background` / `surface` / `surface-raised` | 9,1 / 8,1 / 6,9 | 4,5 |
| `accent` su `surface` / `surface-raised` | 9,5 / 8,1 | 4,5 |
| `on-accent` su `accent` / `positive` / `destructive` | 10,4 / 9,4 / 6,1 | 4,5 |
| `positive` su `surface` / `surface-raised` | 8,7 / 7,3 | 4,5 |
| `destructive` su `surface` / `surface-raised` | 5,6 / 4,7 | 4,5 |
| `role-p` / `d` / `c` / `a` su `surface` | 9,8 / 9,4 / 7,6 / 6,4 | 4,5 |
| `control-border` su `background` / `surface` / `surface-raised` | 5,1 / 4,6 / 3,9 | 3 |
| `panel-border` su `surface` | 1,6 | nessuna |

**Il bordo dei pannelli scende sotto 3:1, ed è voluto.** Oggi `panel-border` deve
staccare un pannello scuro dall'erba chiara, e il test lo pretende a 3:1. Senza
erba il pannello non è un controllo: lo distingue la sua luminosità e un bordo
sottile. La soglia di 3:1 passa a `control-border`, che disegna ciò che si preme
e ciò in cui si scrive. `contrast.test.ts` cambia di conseguenza: le coppie con
`grass-stripe` e `panel-border` escono, entrano quelle con `control-border` e
`bar`; le coppie di `foreground` e `accent` sull'erba restano, contro `grass`,
perché il marchio delle pagine d'ingresso ci poggia ancora sopra.

### 3.2 L'erba esce dall'app

- `AppFrame` non monta più `PitchGrass`: il fondo è `bg-background`, uniforme.
- `PitchGrass` e le classi `.pitch-grass` restano, montati solo dentro
  `HalfPitch`, cioè nella colonna destra delle pagine d'ingresso. Lì il campo è la
  firma del prodotto, e sarà rivisto al passo 4.
- `PitchFrame` perde il perimetro in gesso e gli archi d'angolo e diventa il
  contenitore di pagina: larghezza massima 96rem, centrato, con i margini di oggi.
  Si rinomina `PageFrame`. `HalfwayLine` si toglie: fra le due colonne resta il
  solo spazio.
- L'utility `pitch-frame` di `index.css` si toglie con loro.

### 3.3 Tipografia

Archivo variabile resta l'unica famiglia, con l'asse di larghezza già in uso
(`w-cond`, `w-exp`) e le cifre tabulari (`tnum`).

- **Testo che porta informazione: mai sotto 13px.** `text-xs` (12px) oggi compare
  in nove componenti dell'asta e nella pagina delle leghe; resta ammesso solo per
  ciò che è `aria-hidden` o ripetuto altrove a parole. Due misure nuove in
  `@theme`: `text-meta` (13px) per etichette e seconde righe, `text-body` (15px)
  per righe di elenco e tabelle.
- **Un numero eroe per schermata**, come già vuole `weights.test.ts`. Cambia chi è
  l'eroe mentre il conto corre: l'offerta corrente (§4.4).
- Titoli di pannello: 13px, peso 600, `muted-foreground`. Il titolo dice cosa c'è
  dentro, non compete col contenuto.

### 3.4 Forme e controlli

Oggi nel sorgente ci sono 64 `rounded-full`, 47 `rounded-2xl` e 37 `rounded-xl`:
tutto è una pillola, e niente si distingue.

- Pannelli, bottoni, campi: raggio 8px (`rounded-lg`).
- `rounded-full` resta a ciò che è uno stato o un'etichetta: il distintivo del
  ruolo, «Solo tu», il conteggio delle richieste, l'avatar.
- Le classi dei controlli oggi sono stringhe ripetute (`SECONDARY_BUTTON` è
  definita due volte, in `LeaguesRoute` e `LeagueRoute`; `PRIMARY_BUTTON` sta in
  `AuthForm`). Si raccolgono in `domain/controls.ts`, accanto a `CONTROL_H` e
  `BID_CONTROL_H` che ci sono già:

  | Costante | Forma |
  |---|---|
  | `BUTTON_PRIMARY` | fondo `accent`, testo `on-accent`, 44px |
  | `BUTTON_SECONDARY` | bordo `control-border`, fondo trasparente, 44px |
  | `BUTTON_DESTRUCTIVE` | fondo `destructive`, testo `on-accent`, 44px |
  | `FIELD` | bordo `control-border`, fondo `surface`, 48px |

  L'utility `panel` di `index.css` prende il raggio: chi la usa non lo ripete.
- Bersagli da almeno 44×44px, come oggi. Il contorno di messa a fuoco resta
  `FOCUS_RING`, in oro.

### 3.5 Dove va l'oro

Quattro posti, e basta:

1. l'azione principale della schermata (un bottone solo);
2. il numero su cui si decide: il tetto a riposo e col lotto, l'offerta corrente
   col conto avviato, i crediti della tua squadra;
3. «dove sei»: la scheda attiva, la vista attiva sul telefono;
4. ciò che è tuo in un elenco di tutti: il bordo sinistro della tua squadra.

Esce da: avatar dei membri, voce «Le mie leghe» della barra, bordi delle card,
ogni altro bottone.

### 3.6 Le due barre

`AppShell` oggi mette in una riga sola marchio, «Le mie leghe», fase, proiezione,
annulla, impostazioni, stato e profilo; sul telefono va su tre righe.

- **Barra di navigazione** (56px, `bar`, ferma in cima): marchio, percorso, stato
  della connessione, profilo. Il percorso è una prop nuova, `trail`: un elenco di
  `{ label, to }` di cui l'ultimo è la pagina corrente (`aria-current="page"`,
  senza collegamento). Sostituisce la voce «Le mie leghe» e i «Torna alla lega»
  sparsi. Sul telefono del percorso si vede solo il penultimo passo, come freccia
  indietro.
- **Barra dei comandi** (56px, sotto la prima, ferma anche lei): esiste solo se la
  pagina passa `slotActions`. All'asta porta la fase a sinistra e proiezione,
  annulla e impostazioni a destra, **con il nome scritto** accanto all'icona.
- `chrome="none"` (la proiezione) resta senza navigazione e senza comandi.
- `--header-h` diventa l'altezza di quello che c'è: 3,5rem con una barra, 7rem con
  due.

---

## 4. L'asta sul computer (da `lg` in su)

### 4.1 La griglia

Tutto ciò che serve durante l'asta sta nella finestra, e la pagina non scorre.

```
┌──────────────── barra di navigazione (56) ────────────────┐
├──────────────── barra dei comandi (56) ───────────────────┤
│ Squadre │ Ricerca (48)                       │ I tuoi     │
│  232px  ├────────────────────────────────────┤ consigli   │
│         │ Banco (380, fisso)                 │  328px     │
│         ├────────────────────────────────────┤            │
│         │ Giocatori liberi | Rose squadre    │            │
│         │ (quello che resta, scorre dentro)  │            │
└─────────┴────────────────────────────────────┴────────────┘
```

- Altezza della griglia: `100dvh` meno le due barre e i margini. La tabella prende
  ciò che resta sotto il banco e non scende sotto 236px (schede, intestazione, tre
  righe e mezza); se la finestra è più bassa di così, scorre la pagina.
- A 1440×900 si vedono quasi cinque righe di tabella; a 1920×1080, nove. Oggi alla
  stessa misura se ne vedono zero.
- Senza posto in asta la colonna dei consigli non c'è, come oggi, e il centro si
  allarga.

### 4.2 Squadre

Un pannello solo con righe separate da una linea, non otto card dentro una card.
Ogni riga: nome su due righe al massimo (niente puntini), crediti a destra in
cifre tabulari, sotto «cerca N centrocampisti». Le righe si dividono l'altezza
della colonna. La tua: fondo `surface-raised`, bordo sinistro oro, crediti in oro.

### 4.3 Il banco: 380px, in ogni stato

Misurato oggi a 1440×900 con otto squadre, il contenuto del banco è alto 332px
col lotto, 366px col conto che corre, 456px a tempo scaduto. La misura nuova
nasce dallo stato più alto rifatto (§4.4), non da una stima: **va rimisurata su
uno screenshot vero a implementazione fatta, prima di fissarla**, e il valore
scritto qui si corregge se serve. Resta la valvola di oggi: se qualcosa esce (più
di otto squadre, zoom del browser), il banco scorre dentro di sé.

| Stato | Contenuto |
|---|---|
| A riposo | «La tua squadra · nome». A sinistra sei numeri su due righe: crediti rimasti (oro), posti liberi, media per posto; e per la fase squadre che cercano, il più ricco, liberi per posti. A destra «Ultimi acquisti», quattro righe. |
| Lotto sul banco | Nome, ruolo, squadra e quotazione sulla stessa riga; «Togli dal banco» a destra. Sotto il distintivo «Lo vedi solo tu»: tetto (eroe, oro) col verdetto accanto, mercato, margine, e separato da una linea «puoi offrire al massimo». In fondo, sulla stessa riga, «Avvia il conto alla rovescia» (oro, 56px) e «Aggiudica direttamente» (secondario, 56px). |
| Lotto, senza consigli | L'amministratore senza posto: nome e quotazione, poi i due bottoni. Niente distintivo, niente numeri privati. |
| Lotto, non amministratore | Come «lotto sul banco», senza i due bottoni. |
| Conto che corre | §4.4 |
| Tempo scaduto | §4.4 |

«Invece di lui» esce dal banco e va nella colonna dei consigli (§4.6): nel banco
restava sotto i bottoni e ne decideva l'altezza.

### 4.4 Il conto alla rovescia

Tre caselle di misura fissa, in quest'ordine:

| Tempo | Offerta corrente | In testa |
|---|---|---|
| secondi, 60px | **eroe**, 84px, oro, su `surface-raised` | nome della squadra su due righe al massimo, «in testa», «sei tu» se sei tu |

- **Il tetto non è più una casella.** Scende nella riga sotto, col distintivo «Lo
  vedi solo tu»: «il tuo tetto 72 · 71 sotto · Prendi», e accanto il «se lo prendi
  a N» che c'è già. Oggi è il numero più grande del riquadro mentre si rilancia, e
  si legge come il prezzo.
- La barra del tempo sotto le caselle resta.
- Riga dei rilanci, tutti a 64px: «Rilancia +1» (oro), «+5», «+10», il campo
  dell'offerta diretta, «Offri». Sotto, i tasti: Spazio, Esc.
- **A tempo scaduto** la casella del tempo esce e ne restano due. Sotto: «A chi va»,
  i bottoni delle squadre in una griglia a quattro colonne, poi «Aggiudica a … per
  N» (oro) e «Riprendi le offerte». I tasti 1–9 restano.
- `weights.test.ts`: `BidderDialog.tsx` scende da tre eroi a uno.
- La casella «in testa» non si tinge più d'oro: l'oro è dell'offerta.

### 4.5 Giocatori liberi e rose

Un pannello con due schede, come oggi, ma alto quanto lo spazio che resta.

- La riga delle schede porta a destra quante righe ci sono, le due frecce di
  pagina (al posto di `PhasePager` sotto la tabella) e, dove c'è larghezza, la
  legenda in una riga: «in rosso i tetti che il mercato supera». Sotto `xl` la
  legenda va a capo sotto le schede.
- Intestazione della tabella ferma in alto, righe da 44px, testo a 15px, «Il tuo
  tetto» in bianco e peso 700 mentre le altre colonne sono smorzate.
- Le rose scorrono dentro il pannello nei due sensi, con la tua colonna ferma a
  sinistra e le intestazioni di squadra ferme in alto.
- Ad asta conclusa e per chi non ha un posto le rose restano a pagina intera,
  come oggi: lì non c'è un banco da tenere in vista.

### 4.6 I tuoi consigli

Un pannello alto quanto la griglia, col distintivo «Solo tu» nell'intestazione.

| Stato | Contenuto |
|---|---|
| A riposo | «Occasioni fra i centrocampisti» (le cinque di `useTargets`), poi «La tua rosa»: una riga per ruolo con «3 di 8» e i nomi coi prezzi, presi dalla tua colonna di `/board`. |
| Col lotto | «Perché 72»: l'affidabilità della stima a parole («Stima affidabile: 4 su 5») al posto delle stelle, i driver, poi «Invece di lui» con le alternative. Col conto avviato le alternative restano in vista ma non si scelgono. |

«La tua rosa» è un blocco nuovo fatto di dati che la schermata legge già: nessun
calcolo, nessun endpoint.

### 4.7 Quello che resta uguale

L'avviso dell'acquisto in basso con «Annulla», la pagina ad asta conclusa, la
frase per chi non ha un posto, il 404, lo stato stantio, la conferma in due tempi
di «Togli dal banco» col conto aperto, `AuctionAnnouncer`.

---

## 5. L'asta sul telefono (sotto `lg`)

Non è la griglia del computer messa in colonna. È una schermata sola alta quanto
la finestra, con quattro viste e una barra in basso per passare dall'una
all'altra.

- **In alto**: la barra di navigazione su una riga (marchio, stato, profilo). Per
  l'amministratore un bottone «Comandi» apre un menu con cambio di fase, annulla
  ultimo acquisto, proiezione, impostazioni: la barra dei comandi sul telefono
  non c'è.
- **Sotto**, sempre in vista: la fase a sinistra, «120 crediti · 11 posti» a
  destra; poi la ricerca.
- **In basso**, ferma: Banco, Giocatori, Squadre, Rose. Bersagli da 64px, la vista
  attiva in oro. È un `tablist`, con le frecce che spostano il fuoco.

| Vista | Contenuto |
|---|---|
| Banco | Il lotto col tetto e i quattro numeri in una riga, il bottone del conto per l'amministratore, e sotto «Perché 72». A riposo, i numeri della tua squadra e gli ultimi acquisti. Col conto avviato: le tre caselle, la riga privata, i rilanci su due righe. L'obiettivo è che stia in 844px senza scorrere: va verificato su uno screenshot. |
| Giocatori | L'elenco della fase: nome con squadra e titolarità sotto, quotazione, tetto. Righe da 56px. Toccare un giocatore lo mette sul banco e porta alla vista Banco. |
| Squadre | Le righe di §4.2, a tutta larghezza. |
| Rose | Una squadra alla volta, scelta da un selettore in cima; la tua per prima. |

La vista scelta è stato locale della schermata e riparte da Banco a ogni apertura.

---

## 6. Le altre pagine, in questo passo

Cambiano pelle e nient'altro: fondo uniforme, pannelli e controlli con le forme
nuove, oro secondo §3.5, percorso nella barra al posto dei «Torna a…».

- **Proiezione**: palette nuova e fondo uniforme; i nomi delle squadre vanno su due
  righe invece di troncarsi («Real…», «Atle…»). Il resto resta com'è.
- **Le mie leghe, lega, regole, impostazioni, importazione, profilo**: stessa
  impaginazione di oggi dentro `PageFrame`. Le due colonne di leghe e lega restano,
  senza la linea di metà campo in mezzo.
- **Ingresso**: il pannello del modulo prende palette e forme nuove; la metà campo
  a destra resta com'è.

Dopo il cambio ogni pagina va guardata a 1440×900 e a 390×844: se la pelle nuova
rende una pagina peggiore di oggi (un vuoto che l'erba mascherava), lo si annota
per il passo che la riguarda, non lo si rattoppa qui.

---

## 7. Come si verifica

**Prove automatiche.**

- `contrast.test.ts`: le coppie di §3.1.
- `weights.test.ts`: un eroe in `BidderDialog.tsx`.
- `AuctionRoute.test.tsx`: la prova che oggi cerca `lg:h-[min(39rem,…)]` sulla riga
  dell'asta si riscrive sulla griglia nuova. Prove nuove: le quattro viste del
  telefono e il salto a Banco dopo la scelta di un giocatore; il menu «Comandi»
  solo per l'amministratore.
- `AppShell.test.tsx`: il percorso, con `aria-current` sull'ultimo passo; la barra
  dei comandi assente senza `slotActions` e con `chrome="none"`.
- Un test nuovo che cerca nel sorgente, come fa già quello delle opacità: nessun
  `text-xs`, salvo un elenco di deroghe motivate una per una, sul modello di
  `DECORATIVE` in `contrast.test.ts`.
- La suite intera resta verde; la regola oxlint sulla proiezione
  non si allarga.

**Verifica a vista.** Le prove in jsdom non dicono niente su proporzioni e vuoti.
Lo script usato per l'analisi (Vite, Playwright, `page.route()` al posto del
backend) entra nel repo come `frontend/scripts/screens.mjs` e fotografa:

- l'asta nei cinque stati del banco a 1440×900, 1920×1080 e 1280×720;
- le quattro viste del telefono a 390×844, più il conto avviato;
- ogni altra pagina a 1440×900 e 390×844.

Su ogni screenshot dell'asta lo script controlla che nessun riquadro abbia
contenuto più alto di sé e che la pagina non scorra. Il banco si dichiara
«fisso» solo dopo aver guardato lo stato a tempo scaduto con otto squadre.

---

## 8. Fuori da questo passo

- L'impaginazione nuova delle pagine di gestione e d'ingresso (passi 3 e 4).
- Il logo: `Wordmark` resta quello provvisorio, con i colori nuovi.
- La pagina pubblica, l'immagine social, le pagine legali, il primo accesso
  guidato, il riepilogo condivisibile.
- Il banco condiviso fra i dispositivi: oggi ognuno sceglie da sé il giocatore da
  guardare, e resta così finché non arriva il tempo reale.
- Un tema chiaro.

---

## 9. Alternative scartate

- **Il campo che resta come cornice** fuori dall'asta: tenuto in considerazione e
  scartato a favore del fondo uniforme ovunque tranne l'ingresso.
- **Tribuna Editoriale** (tema chiaro, titoli con le grazie) e **Spogliatoio Pro**
  (nero, giallo, corallo): la prima è poco adatta a una serata d'asta, la seconda
  rischia di sembrare un'app di scommesse.
- **Il banco che si allunga a tempo scaduto**, coprendo la tabella che in quel
  momento è comunque bloccata: darebbe più righe di tabella a riposo, ma una
  scatola che cambia misura mentre si aggiudica è il difetto che la misura fissa
  esiste per evitare.
- **La colonna delle squadre come selettore «a chi va»**, senza i bottoni nel
  banco: toglie un doppione, ma sposta il gesto più delicato dell'asta lontano dal
  bottone che lo conferma.

---

## 10. Rischi

- **Meno di cinque righe di tabella a 900px di altezza** sono poche per scegliere dalla
  tabella: a quell'altezza si sceglie soprattutto dalla ricerca e dalle occasioni.
  Se alla prova risulta stretto, la leva è l'altezza del banco, non la tabella.
- **Molte prove affermano classi**. Il cambio di raggi e di colori ne tocca tante
  in modo meccanico: va fatto in un passaggio suo, separato dal cambio di
  impaginazione, così un rosso dice una cosa sola.
- **Fra 768px e 1023px** vale l'impaginazione del telefono, a tutta larghezza. È
  accettabile, non è progettata.
