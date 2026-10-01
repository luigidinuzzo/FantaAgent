# Club Notturno: le pagine di gestione — specifica

Passo 3 dei sei del ridisegno (vedi
`2026-09-30-club-notturno-fondamenta-asta-design.md`, §1). Fondamenta e asta, sul
computer e sul telefono, sono su main. Qui cambiano l'impaginazione e la gerarchia
di sei pagine: le mie leghe (la home), lega, regole della lega, impostazioni
dell'asta, importazione, profilo. Restano fuori le pagine d'ingresso (passo 4).

## 1. Da dove viene

Le pagine hanno già la pelle nuova (palette, forme, barra), ma l'impaginazione di
prima. Guardate a 1440×900 e a 390×844, e analizzate anche con Lovable (un
messaggio, 1 credito), mostrano gli stessi difetti:

- **La home non porta alle aste.** Il gesto più frequente — entrare nell'asta in
  corso — chiede due passaggi: aprire la lega, cercare l'asta. Intanto «Crea una
  lega» e «Unisciti a una lega», azioni di una volta, occupano metà del computer e
  quasi tutto il telefono, e sotto l'elenco delle leghe resta mezza pagina vuota.
- **La lega dà a tutto lo stesso peso.** Aste, richieste, membri e inviti si
  contendono la pagina; il pannello delle aste resta vuoto sotto due righe;
  «Togli» ripetuto su undici membri rende facile l'azione distruttiva; «Accetta»
  oro su ogni richiesta rompe la regola di una sola azione oro.
- **Le impostazioni non si somigliano.** Regole (indice a sinistra, titolo centrato,
  salvataggio in fondo al riquadro), impostazioni dell'asta (una colonna lunga, due
  salvataggi oro) e profilo (due riquadri sospesi nel vuoto) risolvono lo stesso
  problema in tre modi.
- **L'importazione è un riquadro piccolo in mezzo al nulla**, col controllo del
  browser in inglese («Choose Files — No file chosen») e nessuna spiegazione di
  cosa deve contenere la cartella.

## 2. Decisioni

- La home è **centrata sulle aste**: in cima le tue aste di tutte le leghe, con
  «Entra nell'asta» a un tocco; le leghe sotto; creare e unirsi diventano azioni
  secondarie.
- **Stesse pagine, stessi indirizzi.** Nessuna pagina nuova, nessuna fusione: ogni
  pagina si riprogetta sugli schemi comuni di §3.
- Il dato «le mie aste» lo dà **un endpoint nuovo del backend** (§4.1), non una
  chiamata per lega.
- Valgono le regole già fissate: una sola azione oro per schermata; nessun grande
  vuoto, giudicando la pagina intera; riquadri di misura decisa in anticipo; ordine
  del documento uguale all'ordine visivo; bersagli da 44px; testi per chi usa
  l'app, senza file, server o codice; «banditore», mai «battitore».

## 3. Schemi comuni

### 3.1 Intestazione di pagina

Ogni pagina comincia con la stessa intestazione dentro il contenuto: titolo (h1),
una riga di contesto in `text-muted-foreground`, e a destra al massimo due bottoni
normali (`BUTTON_SECONDARY`). L'oro non sta mai nell'intestazione: l'azione oro
della pagina, se c'è, è nel contenuto. Sotto `sm` i bottoni vanno sotto il titolo,
a tutta larghezza se sono uno, affiancati a metà se sono due.

### 3.2 Righe con un'azione

Elenchi di aste, leghe, membri, richieste, risultati di ricerca: righe di altezza
fissa (`min-h-16`), il testo a sinistra (titolo + riga di dettaglio, mai troncato
quando distingue due righe simili), l'azione principale a destra sempre nella
stessa colonna, le azioni rare dentro un menu «…» per riga. Le azioni distruttive
stanno solo nei menu e chiedono conferma.

### 3.3 Lo schema «impostazioni»

Per regole della lega, impostazioni dell'asta e profilo.

- **Computer (da `lg`):** a sinistra l'indice delle sezioni, fermo (`sticky`),
  largo 14rem, con la sezione visibile evidenziata (`useActiveSection`, già in uso
  nelle regole). A destra il contenuto, largo fino a 48rem: abbastanza perché i
  campi del punteggio non si taglino.
- **Telefono e tablet (sotto `lg`):** l'indice diventa una fila di sezioni sotto la
  barra in alto, ferma mentre si scorre; toccarne una porta alla sezione. Se le
  sezioni non stanno in larghezza, la fila si stringe (testo più corto), non scorre
  di lato.
- **Una sola barra di salvataggio**, fissa in fondo alla finestra, che non copre
  mai i campi (il contenuto ha in fondo lo spazio della barra). Due stati di misura
  identica: «Tutto salvato» (nessun bottone attivo) e «Modifiche non salvate» con
  «Annulla» (normale) e «Salva» (oro). Un errore di salvataggio sta nella barra,
  `role="alert"`, uno solo per schermata.
- Le sezioni non si aprono e chiudono: tutte visibili, una dopo l'altra.

### 3.4 Finestre sopra la pagina

«Crea una lega» e «Unisciti a una lega» si aprono in una finestra modale
(`<dialog>` con fuoco intrappolato, Esc chiude, il fuoco torna al bottone che l'ha
aperta). Al computer larga 32rem e alta quanto il suo stato più alto; sotto `sm` a
tutto schermo. Il resto della pagina non cambia mentre è aperta.

### 3.5 Stati vuoti

Alti quanto il loro contenuto, mai un contenitore grande con una frase in mezzo.
Dicono cosa manca e offrono la prossima azione.

## 4. La home: le tue aste

### 4.1 Il dato: `GET /api/auctions`

Nuovo endpoint del backend. Per l'utente autenticato restituisce le aste non
eliminate in cui ha un posto, di tutte le sue leghe, ordinate per ultima attività
(la più recente prima; un'asta senza acquisti conta la sua creazione):

```
{ id, leagueId, leagueName, name,
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'CONCLUDED',
  phase: 'P' | 'D' | 'C' | 'A',
  budgetRemaining, slotsRemaining,
  lastActivity, admin }
```

`NOT_STARTED`: nessun acquisto. `CONCLUDED`: tutti i posti di tutte le squadre
pieni, con la stessa regola che l'asta usa per dirsi conclusa. Altrimenti
`IN_PROGRESS`. `admin` è vero se l'utente amministra la lega. Un'asta di una lega
da cui l'utente è stato tolto non compare. Test Java come il resto del backend:
autorizzazione (solo le proprie), i tre stati, l'ordine, le eliminate escluse.

### 4.2 Impaginazione

Dall'alto:

1. **Intestazione** (§3.1): «Le tue aste», con «Crea una lega» e «Unisciti a una
   lega».
2. **Aste in corso e da iniziare**: una in evidenza, le altre in righe. Niente
   griglia di schede: chi gioca ha di solito quattro o cinque aste aperte, e una
   griglia a tre colonne lasciava l'ultima fila corta (deciso con l'utente il
   2026-10-01).
   - **In evidenza** l'asta con l'attività più recente fra le non concluse, in un
     riquadro largo: nome della lega (piccolo), stato, nome dell'asta come titolo,
     fase («Centrocampisti»), «N crediti · M posti» e «Entra nell'asta», l'unico
     oro della pagina. Dal `md` il testo a sinistra e il bottone a destra, centrato
     in altezza e largo fisso; sotto `md` uno sotto l'altro, il bottone a tutta
     larghezza. L'altezza è decisa prima (misure finali) e non cambia col numero
     di aste.
   - **Altre aste**, solo se ce ne sono: un pannello come «Concluse», con righe
     (§3.2) — nome dell'asta e «· lega» (a capo fra le parole), stato, «Entra»
     normale.
3. **Concluse**: un elenco compatto (§3.2) delle ultime tre, con «Mostra tutte» se
   sono di più (si allunga nell'elenco, nessuna pagina nuova). Il gesto della riga
   apre l'asta, che da conclusa mostra il riepilogo.
4. **Le tue leghe**: righe (§3.2) con iniziale, nome, la tua squadra, «N membri,
   M aste» e l'avviso «N richieste» per chi amministra; la riga apre la lega. Le
   richieste d'ingresso mandate stanno qui, con «In attesa» e «Ritira».

Senza aste in corso né da iniziare, la sezione 2 diventa una riga sola: «Nessuna
asta in corso» e, per chi amministra una lega, «Prepara un'asta» che porta alla
lega. Senza leghe, al posto delle sezioni 2–4 c'è uno stato vuoto (§3.5) con i
due bottoni dell'intestazione ripetuti come azioni grandi; «Crea una lega» è oro.
Il primo accesso guidato vero resta al passo 6.

### 4.3 Crea e unisciti

- **Crea una lega** (§3.4): nome della lega, nome della tua squadra, «Crea la
  lega» (oro). Riuscita, porta alla lega nuova.
- **Unisciti a una lega** (§3.4): il campo di ricerca in cima, i risultati in righe
  (§3.2) con nome, amministratore e membri, e l'azione nella stessa colonna:
  «Chiedi di entrare», «Richiesta inviata» (non attivo), «Apri» se ne fai già
  parte. Sotto, separato da una riga, «Hai un link d'invito?» con il campo e
  «Entra con il link». La finestra ha l'altezza dello stato con più risultati
  (sei righe; oltre, i risultati scorrono dentro la loro area).

## 5. La lega

- **Intestazione** (§3.1): iniziale, nome della lega, «Amministri tu · N membri ·
  M aste»; «Regole della lega» come bottone normale.
- **Computer (da `lg`):** due colonne, 2fr e 1fr.
  - **Aste** (colonna principale): «Nuova asta» e «Importa un'asta» come bottoni
    normali in testa alla sezione; «Nuova asta» apre il campo del nome in cima
    all'elenco, con «Crea l'asta» (oro) e «Annulla». Ogni asta è una riga (§3.2):
    nome, stato, fase, «ti restano N crediti», «Entra», menu «…» con impostazioni,
    rinomina, elimina. La sezione è alta quanto il suo contenuto.
  - **Colonna laterale**, nell'ordine: richieste d'ingresso (solo se ce ne sono;
    «Accetta» e «Rifiuta» bottoni normali), membri (righe compatte, menu «…» per
    riga con «Togli dalla lega» e conferma; un elenco che scorre in colonne
    dall'alto in basso, non una griglia di celle con l'ultima fila corta), inviti («Crea un link d'invito», i
    link attivi con «Ritira»).
- **Telefono:** lo stesso ordine del documento, una colonna: intestazione, aste,
  richieste, membri, inviti.
- **Chi non amministra** vede intestazione, aste (senza «Nuova asta», «Importa» e
  menu) e membri; niente richieste né inviti.
- L'unica azione oro della pagina è «Crea l'asta», quando il campo è aperto.

## 6. Regole della lega, impostazioni dell'asta, profilo

Tutte e tre sullo schema di §3.3.

- **Regole della lega:** sezioni «Banditore», «Crediti e posti», «Punteggio».
  Nessun titolo centrato: l'intestazione è quella di §3.1 («Regole della lega»,
  «Valgono per le prossime aste. Quelle già create tengono le loro.»). I campi
  del punteggio in una griglia che non taglia le etichette: due colonne sul
  telefono, quattro dal contenuto largo 48rem.
- **Impostazioni dell'asta:** sezioni «Turno di chiamata» e «Banditore». Un solo
  «Salva» salva insieme ciò che è cambiato (turno, banditore o entrambi); se una
  delle due scritture fallisce, la barra dice quale. Il turno tiene le frecce su e
  giù (funzionano da tastiera e con i lettori di schermo), righe alte almeno 44px,
  frecce da 44px.
- **Profilo:** sezioni «Il tuo nome» e «Accesso» (indirizzo, conferma, «Mandami di
  nuovo la conferma»). «Esci» sta in fondo alla pagina, staccato, come bottone
  normale: non è un salvataggio e non va nella barra.

## 7. Importa un'asta

Due passaggi numerati nello stesso riquadro, che ha da subito l'altezza del
passaggio più alto:

1. **Scegli la cartella.** Prima della scelta, cosa deve contenere (la cartella di
   un'asta giocata con FantaAgent sul computer). Il controllo è nostro: un bottone
   «Scegli la cartella» da 44px che apre la scelta del browser; il controllo nativo
   resta nel documento, nascosto alla vista ma non all'accessibilità. Dopo la
   scelta, il nome della cartella e quanti acquisti contiene, oppure l'errore
   spiegato.
2. **Abbina i partecipanti.** Come oggi, ogni partecipante dell'asta a un membro
   della lega; «Importa l'asta» (oro).

## 8. Come si verifica

- Test per ogni componente nuovo o cambiato; test Java per l'endpoint (§4.1).
- Screenshot con `npm run screens` a 1440×900, 390×844 e 360×740, con 3 e con 11
  squadre: nessuna pagina scorre di lato, nessun nome tagliato a metà parola, una
  sola azione oro per schermata, nessun vuoto grande nella pagina intera.
- I test di sorgente esistenti (`contrast`, `weights`, `shapes`, `sizes`) passano.
- Le pagine dell'asta non cambiano: i loro screenshot restano identici.

## 9. Fuori da questo passo

- Le pagine d'ingresso (passo 4), la pagina pubblica e il logo (passo 5), il primo
  accesso guidato (passo 6).
- Il trascinamento per riordinare il turno.
- Date programmate per le aste («prossima asta il…»): il dato non esiste.
