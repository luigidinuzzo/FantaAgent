# Redesign del frontend — analisi e piano

Documento di analisi richiesto prima di qualunque implementazione. Non contiene
codice: contiene la fotografia di com'è fatto il frontend oggi, la valutazione
della migrazione a React, e il piano che propongo.

---

## 1. Architettura attuale, misurata

| | |
|---|---|
| Rendering | Server-side, Thymeleaf |
| Interattività | HTMX 2 (50 KB), più 550 righe di JavaScript nativo |
| Build del frontend | **nessuna** — niente Node, niente npm, niente bundler |
| Endpoint | 24, **tutti restituiscono HTML**; l'unica eccezione è il CSV |
| API JSON | **non esiste** |
| Template | 11 file, 1.053 righe |
| CSS | 1 file, 606 righe, con token già introdotti |
| JavaScript | `app.js` 127, `bidder.js` 357, `recap.js` 66 |
| Test sul livello web | 70, con **108 asserzioni sull'HTML reso** |
| Latenza di render | `/asta` 17 ms · tabella di fase 42 ms · riepilogo 14 ms · battitore 12 ms |

Lo stato dell'asta vive in un registro append-only sul server. Ogni schermata è
una **proiezione** di quello stato: non esiste stato di dominio nel browser, e
l'unico stato client vero è il countdown del battitore.

### Cosa è logica di business (non si tocca)

`AuctionService.recordPurchase` con le sue validazioni, il proiettore del
registro, il motore di valutazione E2, `RosterCsvExporter`, i validatori delle
impostazioni, `AuctionRuntime` con la sua ricostruzione atomica.

### Cosa è presentazione (si può sostituire)

Gli 11 template, il CSS, i tre file JavaScript, i `ViewModels` — che sono già
DTO di presentazione ben separati dal dominio, e sono il punto di attacco
naturale per qualunque nuova UI.

### Debito tecnico rilevato

- `index.html` a 217 righe e `settings.html` a 221 fanno troppe cose ciascuno.
- Il markup dei bottoni e dei campi è ripetuto invece che estratto in fragment.
- `bidder.js` a 357 righe mescola timer, tastiera, audio e chiamate di rete.
- Il pannello del tabellone ripete stringhe grezze (`"1P 3D 0C 0A"`) dove
  servirebbe una rappresentazione visiva.
- Nessuno stato di caricamento: la tabella di fase compare di colpo.

---

## 2. La migrazione a React: valutazione

Il brief chiede di valutarla prima di eseguirla. Ecco la valutazione, con i
numeri di sopra.

### Cosa costa davvero

**Serve costruire un'API JSON da zero.** Non esiste. Ventiquattro endpoint che
oggi restituiscono HTML dovrebbero avere un gemello JSON, con i propri DTO e i
propri test. Il brief chiede di non riscrivere il backend: questa migrazione lo
richiede, non come effetto collaterale ma come primo passo.

**Si perdono 108 asserzioni su 70 test.** Verificano che il markup contenga i
valori giusti — ed è la rete che oggi ha preso difetti veri: il max bid assente
dalla pagina proiettata, il popup sbagliato, il form nascosto. Andrebbero
riscritte contro JSON *mentre* si cambia tutto il resto: si toglie la rete
esattamente nel momento in cui serve di più.

**Si introduce un passo di build.** Oggi `mvn package` produce un jar che parte
e basta. Con React servono Node, npm, un bundler e qualche decina di dipendenze
transitive. La sera dell'asta, "un jar che parte e basta" non è un dettaglio.

**Non c'è un problema di prestazioni da risolvere.** Il server rende in 12–42 ms.
Una SPA aggiungerebbe un round-trip JSON e un render client per ottenere lo
stesso risultato.

**Lo stato è già del server.** L'interfaccia è una proiezione di un registro
append-only. React porterebbe una copia di quello stato nel browser, cioè una
seconda verità da tenere allineata: è la classe di bug più costosa in
un'applicazione d'asta.

### Cosa si guadagnerebbe davvero

Un modello a componenti con props tipizzate; primitive già pronte per tooltip,
dropdown, toast, dialog e skeleton; un bacino di sviluppatori molto più ampio.
Sono guadagni reali, non li minimizzo.

### Raccomandazione

**Non migrare.** Il brief stesso prevede questa uscita: «If the current project
is better served by keeping the existing technology, you may keep it, but
reproduce the same design principles and component architecture.»

Il valore che cerchi — gerarchia, componenti riusabili, stati, densità, qualità
percepita — **non dipende da React**. Dipende da un sistema di design e da una
libreria di componenti, che in Thymeleaf si costruiscono con i fragment: sono
componenti server con parametri tipizzati dai `ViewModels`.

Ciò che manca davvero (toast, tooltip, skeleton, dropdown accessibile) sono
circa 150 righe di JavaScript nativo, contro un albero di dipendenze npm.

Resta una tua scelta, ed è legittimo decidere diversamente: se il progetto deve
essere mantenuto da sviluppatori frontend che non conoscono Thymeleaf, quello è
un argomento che i miei numeri non superano.

---

## 3. Architettura obiettivo proposta

Stessa tecnologia, disciplina nuova.

```
templates/
  layouts/app.html            scheletro unico: shell, nav, slot del contenuto
  components/                 la libreria: un fragment per componente
    button.html  input.html  select.html  badge.html  card.html
    stat.html    table.html  dialog.html  toast.html  skeleton.html
    empty.html   error.html  progress.html  avatar.html  tabs.html
  domain/                     componenti di dominio
    player-row.html   player-table.html   player-detail.html
    manager-card.html league-panel.html   roster-slots.html
    budget-card.html  auction-status.html bid-input.html
    ai-insight.html
  pages/                      solo composizione, niente stile
    home.html  auction.html  battitore.html  recap.html  settings.html
static/
  tokens.css      colore, tipografia, spazio, forma, ombra, movimento
  components.css  una sezione per componente, nessun selettore di pagina
  app.js          scorciatoie e comportamenti globali
  ui.js           toast, tooltip, dialog, skeleton — ~150 righe
  bidder.js       diviso: timer / tastiera / audio
```

**Regola che rende il sistema reale:** nessuna pagina definisce stile proprio.
Se una schermata ha bisogno di qualcosa che non esiste, si aggiunge un
componente — non una regola CSS locale. È esattamente il vizio che ha prodotto
l'icona da otto pixel: due regole in conflitto lasciate stratificate.

---

## 4. Sistema di design

Token già presenti, da completare: colore semantico (background, surface,
elevated, border, primary, accent, text, muted, success, warning, danger, info),
scala tipografica, scala di spazio, raggi, elevazione, durate.

Tre principi che governano le scelte, in ordine:

1. **Gerarchia dell'informazione prima dell'estetica.** Il requisito dominante
   resta registrare un acquisto in meno di tre secondi guardando lo schermo un
   secondo per volta.
2. **Nessuna risorsa esterna.** La stanza dell'asta può essere senza rete.
   Niente font da CDN, niente icone remote. Icone SVG in linea.
3. **I numeri sono dati.** Cifre tabellari ovunque si confronti in colonna.

---

## 5. La schermata d'asta

È la schermata che conta. Struttura proposta:

```
┌──────────────────────────────────────────────────────────────┐
│ FANTAAGENT   FASE D ●●●○   venduti 47   TU 312cr  8/25   ⌘Z  │
├───────────────────────────────────────┬──────────────────────┤
│  ⌕ cerca giocatore                    │  LEGA                │
│                                       │  ┌────────────────┐  │
│  ┌─────────────────────────────────┐  │  │ ANNA      312 │  │
│  │ BASTONI            D · Inter    │  │  │ ███████░░ 8/25 │  │
│  │                                 │  │  └────────────────┘  │
│  │    MAX BID      MERCATO         │  │  ┌────────────────┐  │
│  │       47           38     +9    │  │  │ Bruno       289 │  │
│  │                                 │  │  │ ██████░░░ 6/25 │  │
│  │  ▸ budget · alternativa · conc. │  │  └────────────────┘  │
│  │                                 │  │       …              │
│  │  [ 47 ] [ Anna ▾ ]  ASSEGNA    │  │                      │
│  └─────────────────────────────────┘  │                      │
│                                       │                      │
│  GIOCATORI FASE D          312 disp.  │                      │
│  ─────────────────────────────────    │                      │
│  Nome        Sq   Val  Max  FM   Tit  │                      │
│  …righe dense, hover, selezione…      │                      │
└───────────────────────────────────────┴──────────────────────┘
```

Cosa cambia rispetto a oggi: la scheda del giocatore diventa il fuoco visivo con
il max bid come numero dominante; il tabellone diventa un pannello leggibile in
due secondi con barre di riempimento invece di stringhe come `1P 3D 0C 0A`; la
tabella resta densa ma acquista intestazione fissa, stati di riga e allineamento
numerico; i controlli di assegnazione diventano un gruppo unico con l'azione
primaria dominante.

---

## 6. La componente AI

**Non esiste ancora.** La fase 7 è pianificata
(`2026-09-01-integrazione-claude-fase-7.md`) e non implementata.

Il brief vieta AI finta, e sono d'accordo: qui si progetta lo **spazio** che
l'insight occuperà nella scheda del giocatore, con i suoi stati reali —
non configurata, in attesa, non disponibile — e si lascia vuoto il contenuto
finché la fase 7 non lo produce. Nessun testo d'esempio che sembri un consiglio.

---

## 7. Rischi

| Rischio | Perché | Come lo contengo |
|---|---|---|
| Rompere flussi funzionanti | 70 test asseriscono sull'HTML; cambiando markup falliscono | Cambiare i selettori **prima**, a comportamento fermo, e tenere la suite verde ad ogni passo |
| Perdere velocità d'uso | Una UI più ariosa allontana i numeri dall'occhio | La tabella resta densa; ogni schermata va cronometrata sul gesto «registra un acquisto» |
| Regressioni invisibili | Nessun test esegue JavaScript o CSS | Prova manuale dichiarata a ogni fase, con l'elenco di cosa non è coperto |
| Sistema che si sfalda | È già successo: due regole in conflitto sulla stessa icona | Nessuno stile fuori dai componenti; audit di duplicazione a fine lavoro |

---

## 8. Cosa NON deve cambiare

Contratti degli endpoint e loro URL; `recordPurchase` e le sue validazioni; il
formato del registro e la sua proiezione; il motore di valutazione e i suoi
numeri; il formato del CSV di export byte per byte; il vincolo che la pagina
BATTITORE non riceva alcuna valutazione; le scorciatoie da tastiera esistenti.

---

## 9. Piano per fasi

1. **Token e scheletro** — `tokens.css`, layout unico, nav. Nessun cambio funzionale.
2. **Libreria di componenti** — i quindici fragment di base, con tutti gli stati.
3. **Schermata d'asta** — scheda giocatore, pannello lega, tabella, controlli.
4. **Battitore** — popup e pagina proiettata sui componenti nuovi.
5. **Riepilogo, impostazioni, home**.
6. **Responsive** — tablet e mobile progettati, non rimpiccioliti.
7. **Stati e micro-interazioni** — skeleton, toast, transizioni brevi.
8. **Revisione di coerenza** — caccia a stili duplicati e valori fuori token.
9. **Regressione funzionale** — suite verde più prova manuale cronometrata.

Ogni fase finisce con la suite verde e un commit.
