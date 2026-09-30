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
