# Tappe 1–3 — decisioni prese durante l'esecuzione

Diciassette task, trentasette commit, ognuno con revisione e ciclo di correzione.
Questo documento tiene le decisioni che non stanno in git: cosa è stato deciso, perché,
e cosa costa se la decisione era sbagliata. Il registro operativo da cui vengono è stato
cancellato a merge avvenuto.

Le decisioni sono di due specie, e vale la pena tenerle separate: quelle che hanno
cambiato il codice, e quelle che hanno corretto il piano o la spec — perché il piano
sbagliava, non l'implementazione.

---

## 1. Difetti del piano corretti prima o durante l'esecuzione

Tredici. Elencarli non è autoflagellazione: sono il motivo per cui la scansione
pre-volo e la revisione per task esistono, e la stessa scansione va rifatta per le
tappe successive.

**Il generatore di token produceva variabili circolari.** `:root` avrebbe emesso
`--color-background: oklch(…)` e `@theme inline` avrebbe emesso
`--color-background: var(--color-background)`. Tailwind non avrebbe generato **nessuna**
utility, e i test sarebbero rimasti verdi mentre ogni componente appariva senza stile.
Corretto al pattern shadcn: `--background` in `:root`, `--color-background: var(--background)`
nella mappatura.

**`vite.config.ts` importava `defineConfig` da `vite`** invece che da `vitest/config`,
che è l'unico ad accettare la chiave `test`.

**I test di due task implementavano `PlayerCatalog` a mano, con due metodi su cinque.**
Non compilavano. Esisteva già `InMemoryPlayerCatalog`, usato da quattro test.

**Un test il cui nome mentiva.** `chiaviDiverseScrivonoDueEventi` comprava una volta
sola e verificava un evento solo. Sostituito con la verifica che conta: che la chiave di
idempotenza **non mascheri un rifiuto di dominio**.

**`npm run build` era rotto** e nessuno se ne era accorto perché lo script è
`tsc -b && vite build` e le verifiche erano state fatte con `npx vite build`, che salta
`tsc`. Avevo classificato il rischio come ipotetico nella scansione pre-volo: era reale.

**La motivazione sull'ordine dei gestori d'errore era falsa.** Il piano diceva «l'ordine
conta». Spring risolve per specificità della gerarchia, non per ordine di dichiarazione —
verificato disassemblando `ExceptionHandlerMethodResolver`. Il comportamento sarebbe
stato corretto lo stesso, ma il commento avrebbe insegnato una cosa sbagliata.

**`transient` su un campo enum di un'eccezione.** Gli enum sono serializzabili: non
serviva, e faceva perdere il motivo alla deserializzazione lasciando `reason()` a `null`.

**Quattro istanze di un vizio sistematico: segnali che raggiungevano solo chi vede lo
schermo.** `aria-busy` che i lettori di schermo non annunciano; una `<section>` senza
nome accessibile, invisibile alla navigazione per regioni; `aria-current` che diceva
«corrente» senza dire corrente di cosa; il superamento del tetto affidato al solo colore;
il partecipante «sei tu» distinto dal solo bordo; un bottone disabilitato che non diceva
perché. Una settima è stata trovata dalla revisione finale: `<html lang="en">` su
un'applicazione tutta in italiano, che fa leggere al sintetizzatore l'unico canale di
annuncio con fonetica inglese.

**La regola «una sola live region» era scritta male.** Ne esistono due: `role="status"`
per la narrazione ambientale e `role="alert"` legato al campo del pannello. È legittimo
perché discendono dalla stessa mutation, i cui `data` ed `error` sono mutuamente
esclusivi. La regola corretta è **«un solo canale `role="status"` di narrazione
ambientale»**, non «una sola live region».

**La spec vietava `useState` su un «prezzo»**, ma il pannello ne tiene uno
legittimamente: è input dell'utente, non valore del server. Riformulata: i valori
derivati dal server non si specchiano mai in `useState`; l'input scritto dall'utente è
stato client per definizione.

**La spec rivendicava che il test di confidenzialità verificasse il valore del tetto
calcolato.** Non lo fa, e col mock non può: verifica un vocabolario di otto parole sul
corpo serializzato. La spec ora lo dice.

**Il piano nominava librerie che non sono arrivate** — TanStack Table, React Router,
`lucide-react`, shadcn/ui con la cartella `src/ui/`. Assenze deliberate, ora dichiarate
in un riquadro invece che lasciate a contraddire l'inventario.

**Il reset del prezzo si sarebbe riscritto sotto le dita.** Il piano azzerava il campo a
ogni cambio del tetto suggerito — ma `useValuation` rivaluta ogni cinque secondi, e il
rilancio di un avversario sposta il tetto anche restando sullo stesso giocatore. Stai
digitando 47, qualcuno rilancia, e il campo cambia da solo.

---

## 2. Decisioni che hanno cambiato il codice

**Il limite della tabella di fase, nel controller e non nel servizio.** Ogni riga costa
una valutazione completa — circa 12 ms, e 2,3 secondi per l'intera fase dei difensori.
Una GET non autenticata con `limit` enorme era un vettore di esaurimento risorse.
Il tetto sta nel controller perché `PlayerSearchService` serve anche i controller
Thymeleaf, e cambiarne il contratto ne cambierebbe il comportamento.

**La corsa sulla chiave di idempotenza, chiusa con un lock sull'istanza dello store.**
`seqOf` leggeva il registro senza lock, poi si scriveva: due richieste simultanee con la
stessa chiave passavano entrambe il controllo e scrivevano entrambe — il doppio acquisto
che il task esisteva per impedire, in un registro che non cancella. Il lock è sullo
store e non sul metodo così aste diverse non si bloccano quando il sotto-progetto 2 ne
aprirà più d'una. Rosso dimostrato cinque volte su cinque prima della correzione.

**Nessun aggiornamento ottimistico, e un test che lo impone.** La garanzia era difesa
dalla sola assenza di `onMutate`: aggiungerne uno domani avrebbe lasciato tutti i test
verdi. Ora un test ispeziona la cache mentre la mutazione è in volo.

**L'annuncio composto dopo la conferma del server.** `onSuccess` non attendeva
`invalidateQueries()`, quindi al primo render con l'acquisto riuscito lo stato era
ancora quello precedente: la frase veniva **pronunciata con i numeri vecchi** e solo poi
corretta. Su schermo non si nota; per chi ascolta è l'unico canale.

**`participantId` risincronizzato quando i dati arrivano.** Era seminato una volta al
mount, e il pannello monta garantito con la lista vuota: restava `''` per sempre mentre
il `<select>` mostrava il primo nome per ripiego del browser. Premere «Aggiudica» senza
toccare il menu scriveva `participantId: ''` nel registro.

**Il 201 composto dall'evento scritto, non dalla richiesta.** Era l'unico punto in cui
l'API poteva affermare qualcosa che il registro non contiene.

**`{auctionId}` reso reale.** Era decorativo: qualunque valore restituiva l'asta
corrente. Ora un `AuctionGuard` accetta l'id dell'asta aperta e il letterale riservato
`corrente`, e rifiuta il resto con 404 in `problem+json`.

---

## 3. Decisioni di rinvio, con la loro ragione

**Il jar non serve ancora la SPA.** Il profilo `prod` la impacchetta ma `/` è mappata da
`HomeController`, e una request mapping vince sulla pagina di benvenuto. Servirla adesso
vorrebbe dire scegliere come convive con le sei rotte Thymeleaf, che è esattamente ciò
che la tappa 6 risolve smontandole; un prefisso provvisorio creerebbe una URL destinata
a morire. Il difetto era il silenzio: ora è scritto nel README e nel piano.

**La tipizzazione degli errori di `revokePurchase`.** «Nessun acquisto con quell'id» e
«già annullato» cadono entrambi in un 422 generico, indistinguibili per il client. Il
difetto è reale ma l'unico consumatore di quell'endpoint è la pagina di riepilogo, che
appartiene alla tappa 5: progettare il contratto d'errore insieme al suo consumatore ha
più probabilità di venire giusto.

---

## 4. Debiti iscritti alle tappe successive

| Debito | Dove va |
|---|---|
| Un metodo HTTP sbagliato su `/api` esce senza `problem+json` — l'eccezione precede la scelta dell'handler, quindi l'advice limitato al package non viene consultato. La correzione è lo stesso idioma già usato per i 404. | tappa 4 |
| Tipizzare i due rifiuti di `revokePurchase` | tappa 5, col riepilogo |
| React Router: tolto perché c'era una rotta sola, torna quando ce ne sono quattro | tappa 5 |
| `encodeURIComponent` sui segmenti di `url()`, e il contesto d'asta a livello di modulo | sotto-progetto 2, quando gli id diventano dati dell'utente |
| Il numero del budget nel tabellone è nudo, senza etichetta né unità | tappa 5, che ricostruisce quel pannello |
| `walkAwayReason` arriva dall'API e la scheda non lo usa | tappa 4 |
| `<caption>` e larghezza garantita del bersaglio tattile nella tabella | tappa 4 |

---

## 5. Cosa ha retto

`adapter/in/web` non è stato toccato in trentasette commit. Gli 87 test delle sei classi
Thymeleaf — la rete di sicurezza dell'intera migrazione — sono passati a ogni singolo
task senza che una riga venisse modificata per farli passare.

Le cinque garanzie sono state verificate a livello di ramo, contro il sorgente e non
contro i resoconti dei task: il tabellone proiettato non può portare il prezzo
consigliato (e il frontend non chiama nemmeno quell'endpoint), nessun aggiornamento
ottimistico anticipa il `fsync`, un solo canale di narrazione ambientale, nessuno stato
di dominio nel browser, e i registri scritti prima dell'idempotenza si rileggono ancora.
