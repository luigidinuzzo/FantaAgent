# Club Notturno, fondamenta — cosa si è visto

Piano: [2026-09-30-club-notturno-fondamenta.md](../plans/2026-09-30-club-notturno-fondamenta.md) ·
Spec: [2026-09-30-club-notturno-fondamenta-asta-design.md](../specs/2026-09-30-club-notturno-fondamenta-asta-design.md)

Confronto fatto con `npm run screens`, a 1440×900 e 390×844, prima e dopo.

## Pagina per pagina

| Schermata | Computer | Telefono | A quale passo tocca |
|---|---|---|---|
| 01 Accedi | Niente da segnalare: erba e gesso solo nella metà campo di destra, bordi dei campi visibili. | Niente da segnalare: nessuna erba, pannelli impilati su fondo uniforme. | 4 — ingresso |
| 02 Registrati | Niente da segnalare. | Niente da segnalare. | 4 — ingresso |
| 03 Password dimenticata | Niente da segnalare. | Niente da segnalare. | 4 — ingresso |
| 04 Nuova password | Niente da segnalare. | Niente da segnalare. | 4 — ingresso |
| 05 Verifica email | Niente da segnalare. | Niente da segnalare. | 4 — ingresso |
| 06 Invito | Niente da segnalare. | Niente da segnalare. | 4 — ingresso |
| 07 Errore | Niente da segnalare. | Niente da segnalare. | 4 — ingresso |
| 08 Le mie leghe | Niente da segnalare: nessuna erba, barra di navigazione con marchio e «Le mie leghe» come passo corrente. Le iniziali dei membri non sono più oro (atteso, task 7). | Niente da segnalare: sul telefono la pagina di casa non mostra il percorso, come previsto. | 3 — gestione |
| 08b Le mie leghe, ricerca | Niente da segnalare: i risultati e i bottoni «Chiedi di entrare» / «Apri» hanno bordo visibile. | Niente da segnalare. | 3 — gestione |
| 09 Lega | Niente da segnalare: percorso «Le mie leghe › Lega dei Colizzati» corretto, iniziali dei membri senza oro. | Niente da segnalare: sul telefono resta una sola freccia «‹» indietro, come da ruling del task 6. | 3 — gestione |
| 10 Regole della lega | Niente da segnalare: percorso «Le mie leghe › Lega › Regole» — «Lega» è il segnaposto atteso perché la pagina è aperta direttamente e il nome non è ancora in cache. | Niente da segnalare (il bottone «Salva le regole» appare a metà pagina per via dello scroll dello screenshot intero: capita identico anche in «prima», non è una novità di questo passo). | 3 — gestione |
| 11 Importa un'asta | Il pannello resta corto e centrato, ma senza l'erba a riempire lo sfondo il vuoto sopra e sotto è grande e uniforme — vedi «Rimandato». | Il pannello è a piena larghezza, il vuoto è molto meno evidente che sul computer. | 3 — gestione |
| 12 Profilo | Stesso vuoto di «Importa un'asta»: due pannelli corti al centro di una finestra scura — vedi «Rimandato». | Meno evidente, come per «Importa un'asta»: i pannelli sono a piena larghezza. | 3 — gestione |
| 13 Asta a riposo | Niente da segnalare: due barre (percorso sopra, comandi sotto), tutti i bordi di pannelli e bottoni visibili. | Niente da segnalare: la barra dei comandi va a capo e mostra solo icone (fase, proiezione, annulla, impostazioni), come previsto dal ruling del task 6. | 2 — asta |
| 14 Asta, giocatore sul banco | Niente da segnalare. | Niente da segnalare (la colonna «mercato» resta tagliata a destra della tabella dei liberi: capita identico in «prima», non è una novità). | 2 — asta |
| 14b Asta, conto avviato | Niente da segnalare. | Niente da segnalare. | 2 — asta |
| 14d Asta, tempo scaduto | Niente da segnalare. | Niente da segnalare. | 2 — asta |
| 14c Asta, rose | Niente da segnalare: colonne di squadra affiancate, ognuna con bordo visibile. | Niente da segnalare. | 2 — asta |
| 15 Impostazioni dell'asta | Niente da segnalare: qui il percorso mostra il nome vero della lega e dell'asta (pagina raggiunta dopo che erano già in cache). | Niente da segnalare. | 3 — gestione |
| 16 Proiezione | Niente da segnalare come difetto: il nome della squadra va ora su due righe (atteso, ultimo commit del task 7); su un nome composto («Borussia Porcmund») lo spezzare va a metà parola («Borus» / «sia…») — leggibile, ma da rivedere quando si disegnerà la proiezione per bene. | Scorre di lato di +16px, come in «prima» (era salito a +30px con questo piano, corretto nel passo di rifinitura finale — vedi «Corretto in questo passo»). | 2 — asta |

## Il banco, misurato

Altezza del contenuto del banco a 1440×900 con otto squadre, dopo le fondamenta
(misurata con uno script Playwright temporaneo che apre `/leghe/L1/aste/A1`, seleziona
il primo centrocampista libero e legge
`document.querySelector('[data-testid=auction-row]').children[1].querySelector('section .overflow-y-auto').firstElementChild.getBoundingClientRect().height`
nei tre stati): lotto sul banco **332px**, conto avviato **368px**, tempo scaduto
**462px**. Il piano dell'asta parte da questi numeri, non dai 380px stimati nella
specifica — lo stato più alto (tempo scaduto, con la griglia «a chi va») supera già la
stima di oltre 80px.

## Corretto in questo passo

Dalla revisione finale di tutto il ramo sono arrivati cinque correttivi, applicati in un
solo passo:

- Il campo di ricerca dell'asta (`PlayerSearchBox`) non aveva un contorno a 3:1 sul
  fondo: il pannello che lo disegna ora porta `border-control-border` invece del
  `panel-border` più tenue di `@utility panel`.
- L'altezza della riga dell'asta sottraeva ancora la vecchia barra unica (13rem): ora
  sottrae le due barre di oggi separatamente (`--header-h` più la nuova `--commands-h`,
  3,5625rem) più il resto invariato (8,6875rem).
- Lo stato in testata (`slotStatus` di `AppShell`) non si stringeva più su nessuna
  pagina: ora `shrink-0` resta solo con la navigazione (`chrome="top"`), mentre sulla
  proiezione (`chrome="none"`) `min-w-0` lascia il testo andare a capo — la correzione
  di `16-proiezione-telefono`, sotto.
- Il percorso (`Trail`) con un solo passo lasciava un `<nav>` vuoto sul telefono (ogni
  `li` è `max-sm:hidden`): ora è il `<nav>` stesso a nascondersi quando i passi sono
  meno di due.
- Commenti non più veri (il riferimento all'erba in `PlayerSearchBox` e in `Wordmark`,
  la descrizione mancante di `.pitch-grass`) e due test di cornice (`shapes.test.ts`,
  `sizes.test.ts`) rafforzati contro un passaggio vuoto.

Nessun'altra correzione: nessuna delle 40 coppie di schermate mostra erba o gesso fuori
dalle pagine d'ingresso, testo illeggibile, o un bordo di bottone o di campo che non si
vede. Le altre differenze trovate rispetto a «prima» sono i cambi voluti dalle
fondamenta (niente erba, raggi a 8px, due barre, iniziali senza oro, nomi squadra su
due righe in proiezione) o difetti già presenti prima di questo piano.

## Rimandato

**Vuoto grande su «Importa un'asta» e «Profilo», a 1440×900.** Prima, l'erba a righe e
le linee di gesso riempivano tutta la larghezza della finestra dietro ai due pannelli
corti e centrati; ora lo sfondo è un unico colore scuro e il vuoto sopra e sotto i
pannelli si vede molto di più. Sul telefono il problema è minore perché i pannelli sono
già a piena larghezza. Non è un difetto di questo passo (le pagine hanno la stessa
impaginazione di prima, come da regola del piano) — è materiale per chi disegnerà
queste due pagine.

**`16-proiezione-telefono` scorreva di lato più che prima (+16px → +30px), corretto in
questo passo.** La causa non era `ProjectionRoute`: era `AppShell`. Il contenitore dello
stato in testata (`slotStatus`), `<div className="ml-auto shrink-0">`, era diventato
`shrink-0` su ogni pagina col task 6 — anche sulla proiezione, dove lo stato («Il
giocatore all'asta non compare su questo schermo» accanto a «In diretta») è l'unica cosa
oltre al marchio e può essere lungo (~404px, contro i 390px del telefono). Non potendo
stringersi, spingeva l'intera pagina a 420px. Corretto rendendo `shrink-0` condizionato
a `chrome === 'top'` (dove percorso e profilo non lasciano comunque spazio da cedere) e
dando a `chrome === 'none'` un `min-w-0` che lascia il testo andare a capo. Misurato di
nuovo con `npm run screens -- test-results/screens/finale`: `16-proiezione-telefono`
torna a +16px, lo stesso scarto di «prima» (dovuto ad altre righe della testata, non a
questo stato) — nessun'altra pagina compare nella `larghe:`.

**Il nome «Borussia Porcmund» si spezza a metà parola in proiezione (computer).** Con
`line-clamp-2 break-words`, la seconda riga diventa «sia…»: resta leggibile ma è
scomodo da leggere al volo su un proiettore. Non è un difetto di questo passo (il
comportamento è quello introdotto dall'ultimo commit del task 7 ed è coerente con la
regola delle due righe), ma vale la pena rivederlo quando si ridisegnerà la proiezione.

## Deviazioni dalla specifica

**`--header-h` copre solo la barra di navigazione, non le due barre insieme.** La spec
(§3.6) dice: «`--header-h` diventa l'altezza di quello che c'è: 3,5rem con una barra,
7rem con due». In pratica `--header-h` è rimasta ferma a 3,5rem (l'altezza della sola
barra di navigazione, fissa su ogni pagina) e la barra dei comandi ha una variabile sua,
`--commands-h` (3,5625rem: 56px di `min-h-14` più 1px di bordo) — perché esiste solo
sulle pagine che passano `slotActions` e non è sempre alta 56px esatti come
`--header-h`. Chi ha bisogno di sapere dove comincia il contenuto sotto le due barre
(oggi solo `AuctionRoute`, per l'altezza della riga del banco) sottrae entrambe le
variabili, non una sola «altezza totale» calcolata a monte.

## L'asta sul computer — misure finali

Misurato con `SIZES=1440x900,1920x1080,1280x720,390x844 npm run screens --
test-results/screens/asta-misure`: lo script ora stampa, per le schermate 13 e 14 da
1024px in su, l'altezza del banco, il contenuto che gli serve e quello che mostra
(`traboccano:`), e le pagine che scorrono in verticale (`scorrono:`).

**Da dove si partiva (Task 7, a 1440×900).** Banco 380px in ogni stato, di cui 90 del
banco stesso (padding, testata col suo spazio, bordo): restavano 290px di contenuto. Il
lotto chiedeva 315px, il conto alla rovescia 339, il tempo scaduto 451: i bottoni in
fondo si tagliavano e il banco scorreva. La barra dei comandi era alta 59px e non 57
come diceva `--commands-h`, e la pagina scorreva di 2px. L'intestazione della tabella
era 60px (i bottoni d'ordinamento, 44, più il padding delle celle), e sotto il banco si
vedevano quattro righe.

**Cosa si è corretto, nell'ordine deciso, rimisurando dopo ogni passo.** Il banco non
poteva salire oltre ~409px (753 − ricerca 48 − due spazi 32 − una tabella di 264: schede
44 + intestazione 44 + quattro righe da 44), quindi si sono accorciati gli stati. Sono
serviti tutti e sei i passi:

1. **Il nome del giocatore una volta sola.** La testata del banco porta nome (grande),
   ruolo, squadra · quotazione, e «Togli dal banco» a destra; la scheda di decisione e il
   conto alla rovescia, dentro il banco, non rendono più la loro (`hideHeader`). Il nome
   accessibile del banco resta «Sul banco · nome» (un prefisso solo per chi ascolta). Il
   giocatore senza consigli (amministratore senza posto) non ha più una scheda sua: la
   testata dice già chi è, di che squadra e quanto quota, e sotto restano i gesti.
   Lotto 315 → entra; conto 339 → 299; scaduto 451 → 411.
2. **`--commands-h` = 3,6875rem (59px), la misura vera.** La pagina non scorre più.
3. **Intestazione della tabella a 44px** con `fill`, da lg (`lg:py-0` sulle celle).
4. **Il conto alla rovescia più basso, da lg:** celle del tabellone `lg:py-3` invece di
   `py-5`, righe del riquadro a 8px invece di 12. L'offerta resta a 84px. Conto 299 →
   entra; scaduto 411 → 383.
5. **A tempo scaduto niente riga di riferimento** (mercato, margine, verdetto: si
   registra un esito, non si decide) e i tasti sulla riga di «Aggiudica», a destra.
   Scaduto 383 → 351.
6. **Da xl le otto squadre su una riga sola**, con la nota («se lo prende», i crediti)
   su una riga anche nel bottone stretto. Scaduto 351 → 292.

**`--banco-h` = 24rem (384px).** Lo stato più alto misurato è il tempo scaduto, 292px
di contenuto (291,4 arrotondato), più i 90 del banco: 382, al quarto di rem in su 384.
Sotto il tetto di ~409. La riga dell'asta non scende sotto ricerca + banco + 14,75rem di
tabella + i due spazi: prima era un 43,5rem scritto a mano, ora è
`calc(var(--banco-h) + 19.75rem)`, così segue il banco se cambia.

| | 1440×900 | 1920×1080 |
|---|---|---|
| banco | 384px (contenuto 294) | 384px (contenuto 294) |
| riposo, contenuto naturale | 267 | 267 |
| lotto | 263 | 263 |
| conto alla rovescia | 271 | 271 |
| tempo scaduto | 292 | 292 |
| righe di tabella in vista | 4 intere (e un filo della quinta) | 8 intere |
| la pagina scorre | no | no |

(Il contenuto «naturale» è misurato togliendo il riempimento: a banco pieno gli stati
col riempimento occupano comunque i 294px, e lo scorrimento del banco non si vede.)

**A 1280×720** la pagina scorre di 127px per costruzione (720 − 147 di barre e margini
< 700 di minimo della riga): non è un difetto. Lì però anche il banco scorre: la colonna
centrale è più stretta e le cose vanno a capo — riposo 325px, conto 347, scaduto 327 in
294. Il piano chiedeva 1440 e 1920; a 1280 resta da decidere.

**Il telefono (390×844)** non cambia fuori da questi punti, che valgono a ogni misura:
la testata del lotto (nome, sotto la pillola del ruolo, sotto squadra · quotazione;
«Togli dal banco» a destra, su una riga sola) al posto di «Sul banco · nome» più la
testata della scheda; a tempo scaduto niente mercato/margine/verdetto e i tasti sotto i
bottoni di «Aggiudica»; l'amministratore senza posto non vede più la quotazione come
numero grande (è nella testata). Tutto il resto dei passi 3, 4 e 6 è `lg:`/`xl:`.

**Restano.** Da xl, a 1440, i nomi delle squadre nei bottoni a tempo scaduto si troncano
dopo tre o quattro lettere («Rea…», «Atle…»): il numero del tasto e i crediti restano, e
la squadra in testa è scritta per intero nel tabellone e nel bottone «Aggiudica». Il
banco è tagliato sugli stati misurati: una frase in più — il perché del «Lascia» mentre
il conto corre, «X non può comprarlo» o un errore a tempo scaduto — aggiunge una riga
(~28px) e il banco scorre dentro di sé, che è la valvola prevista. Nella nota sulle
deviazioni, qui sopra, `--commands-h` è scritto 3,5625rem: era la misura di allora, ora è
3,6875rem.

## L'asta sul telefono — misure finali

Misurato con le risposte finte di `scripts/screens.mjs`, pagina in cima: il fondo del
banco contro il bordo superiore della barra delle viste (64px più il bordo, inchiodata
in fondo). Positivo = margine sopra la barra, negativo = quanto del banco resta sotto
la piega. «Togli» è la conferma di «Togli dal banco» col conto aperto. Prima = all'inizio
di questo passo; dopo = alla fine.

**Otto squadre**

| stato del banco | 390×844 prima → dopo | 360×780 prima → dopo |
|---|---|---|
| riposo (la tua squadra) | −56 → **+54** | −138 → −28 |
| lotto (scheda di decisione) | +93 → **+145** | +29 → +81 |
| conto alla rovescia | −129 → **+92** | −213 → +8 |
| conto, «Togli» in conferma | −207 → **+58** | −339 → −50 |
| tempo scaduto | −140 → **−80** | −204 → −172 |

**Undici squadre** (dopo): a 390×844 riposo +54, lotto +145, conto +92, «Togli» +58,
tempo scaduto −198; a 360×740 riposo −68, lotto +41, conto −32, «Togli» −66, tempo
scaduto −344.

**Cosa è cambiato, tutto sotto `sm` o sotto `lg` (dal computer in su niente):**
1. Conto alla rovescia: le tre caselle su una riga anche sotto `sm`, secondi
   `max-sm:text-4xl`, offerta `max-sm:text-5xl` (conto a 390: −129 → −12).
2. Riga privata: «se lo prendi a N» comincia una riga sua sotto il tetto
   (`max-sm:basis-full`). A 390 era già di due righe; a 360 va a capo una volta in più.
3. Scheda del lotto: i tre numeri in `grid-cols-3` sotto il tetto (già dal Task 5).
4. Tempo scaduto, bottoni squadra: la seconda riga (crediti, «se lo prende») non si
   vede sotto `sm` e resta per chi ascolta (`max-sm:sr-only`).
5. Le scorciatoie da tastiera («Spazio», «Esc», «1–8») non si vedono sotto `lg`: senza
   tastiera non servono. Restano nel documento.
6. «Rilancia +1», «+5», «+10» su una riga sotto `sm`: +5 e +10 larghi 4rem,
   «Rilancia» prende il resto.
7. Tempo scaduto: «Riprendi le offerte» larga quanto «Aggiudica a …» sotto `sm`; la
   legenda dice «A chi va», il resto della frase resta per chi ascolta.
8. Tempo scaduto, nomi delle squadre: sotto `sm` non si troncano più, vanno a capo fra
   le parole; la sillabazione italiana solo per parole di almeno 12 lettere, che nel
   bottone non ci starebbero (`hyphenate-limit-chars`, e per WebKit i limiti
   `-webkit-`, vedi sotto). Due colonne, almeno 44px.
9. Lotto: sotto `lg` lo spazio riservato alla spiegazione del «Lascia» prende l'altezza
   della frase, e vuoto non c'è. Era la fascia vuota di ~80px sopra «Avvia il conto alla
   rovescia» (lotto a 390: +93 → +145). Da `lg` resta riservato, perché lì i bottoni non
   devono spostarsi fra un lotto e l'altro.
10. Riposo: sotto `sm` gli ultimi acquisti a vista sono due invece di quattro (+110px).
    Tre starebbero a 390 con 5px di margine, che la zona sicura di un telefono con la
    barra del sistema (34px) si mangia: due.
11. La conferma di «Togli dal banco», sotto `sm`, va su una riga sua a tutta larghezza:
    accanto al nome lo stringeva fino a sillabarlo («Mkhita-ryan», tre righe a 360). Ora
    il nome sta su una riga, anche «Milinkovic-Savic» a 360×740.
    La conferma torna a riposo anche da sola: dopo 4 secondi, aprendo o chiudendo il
    conto, cambiando lotto, e quando il tempo scade o le offerte riprendono. In Safari
    un bottone toccato non prende il fuoco, e l'uscita dal bottone — l'unico ritorno
    a riposo che c'era, anche su `main` — non arrivava mai: un tocco molto dopo
    toglieva il lotto senza una conferma fresca. Lo script lo verifica in WebKit
    (`conferma rimasta armata (WebKit):` vuoto).
12. L'avviso dell'aggiudicazione sta sopra la barra contando anche la zona sicura
    (`bottom: calc(5rem + env(safe-area-inset-bottom))`).

**Decisioni.** Il tempo scaduto può scorrere: con undici squadre (−198 a 390×844) e
anche con otto, dove a 390×844 esce ancora di 80px perché i nomi che ora vanno a capo
(«Atletico Ma Non Troppo», «Borussia Porcmund») alzano la loro riga di bottoni. In tutti
e due i casi «Aggiudica a …», in oro, sta nella prima schermata (finisce a 498px a
390×844 e a 360×740), e il gesto principale si vede. Lo stesso vale per la conferma di
«Togli», che dura un attimo. A 360 si annota senza obbligo.

**Controlli** a 390×844 e 360×740, otto e undici squadre, ognuna delle quattro viste in
cima e in fondo alla pagina (32 in tutto): barra in fondo allo schermo da bordo a bordo,
vista attiva in oro, testata su una riga (57px), riga della fase e dei crediti presente,
niente scorrimento di lato. Tutti superati. Sul computer (1440×900) le schermate sono
quelle di `main`, salvo il rumore di antialiasing già accettato su 14-asta-giocatore (22
pixel, al massimo 2/255).

**Safari.** WebKit non conosce `hyphenate-limit-chars`: senza altro, a tempo scaduto
spezzava «Borussia Porc-mund» e «Olympique Marsi-glia Nera» (390) e «Dinamo Spri-tz»,
«Patetico Ma-drid», «Inter Nazio-nale» (360). Nomi delle squadre e nome del lotto hanno
anche `-webkit-hyphenate-limit-before/after: 6`; lo script delle fotografie rifà in
WebKit il conto in conferma e il tempo scaduto a 390×844 e 360×740 e stampa
`parole spezzate:` — vuoto, con otto e con undici squadre. Il nome del lotto si sillaba
solo sotto `lg`; da `lg` è troncato su una riga, come su `main`.

**Resta.** La pagina della proiezione scorre di lato sul telefono (+16px), come su `main`.
