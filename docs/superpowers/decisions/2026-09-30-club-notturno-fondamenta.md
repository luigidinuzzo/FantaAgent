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
| 16 Proiezione | Niente da segnalare come difetto: il nome della squadra va ora su due righe (atteso, ultimo commit del task 7); su un nome composto («Borussia Porcmund») lo spezzare va a metà parola («Borus» / «sia Porc…») — leggibile, ma da rivedere quando si disegnerà la proiezione per bene. | Scorre di lato di +30px (era già +16px in «prima»): vedi «Rimandato» per la causa. Non è una novità introdotta da questo passo, il difetto esisteva già. | 2 — asta |

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

Nessuna correzione: nessuna delle 40 coppie di schermate mostra erba o gesso fuori
dalle pagine d'ingresso, testo illeggibile, o un bordo di bottone o di campo che non si
vede. Le uniche differenze trovate rispetto a «prima» sono i cambi voluti dalle
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

**`16-proiezione-telefono` scorre di lato di più che prima (+16px → +30px).** La
proiezione è pensata per un proiettore, non per un telefono, quindi non si corregge
qui — ma la causa dell'aumento è stata trovata con un secondo script Playwright
temporaneo che misura, dentro la pagina, ogni elemento la cui `right` supera 390px:
è la riga di stato in testa alla proiezione (`slotStatus` di `AppShell`, in
`ProjectionRoute`), quella che dice «Il giocatore all'asta non compare su questo
schermo» accanto a «In diretta». Il contenitore `<div className="flex items-center
gap-4">` con dentro il messaggio (`<div className="ml-auto shrink-0">`) non va a capo
sul telefono: la sua larghezza naturale (~404px) supera i 390px del viewport e spinge
tutta la pagina a 420px. Il difetto esisteva già in «prima» (+16px, probabilmente per
altre righe della testata rimosse dal task 6); le fondamenta lo hanno solo allargato
spostando il messaggio «non compare su questo schermo» dentro la stessa riga flessibile
del segnale «In diretta». Chi scriverà il piano dell'asta sul telefono dovrà far andare
a capo (o accorciare) quella riga di stato.

**Il nome «Borussia Porcmund» si spezza a metà parola in proiezione (computer).** Con
`line-clamp-2 break-words`, la seconda riga diventa «sia Porc…»: resta leggibile ma è
scomodo da leggere al volo su un proiettore. Non è un difetto di questo passo (il
comportamento è quello introdotto dall'ultimo commit del task 7 ed è coerente con la
regola delle due righe), ma vale la pena rivederlo quando si ridisegnerà la proiezione.
