# Integrazione Claude — Fase 7

> **Per chi esegue:** questo piano si esegue task per task. Ogni task finisce con un
> deliverable testabile da solo e con un commit.

**Obiettivo:** aggiungere alla schermata d'asta un riquadro in cui Claude legge
criticamente l'evidenza sotto i numeri del motore, senza mai portare fatti propri e
senza mai muovere una cifra.

**Architettura:** una porta `StrategicAdvisor` in `application/port/out`, due adapter
(uno di fixture senza rete, uno reale su SDK Anthropic), un assemblatore di contesto
deterministico nel dominio, e un riquadro SSE nella scheda di analisi. Il ramo
deterministico e quello generativo partono insieme e arrivano separatamente (ADR-6).

**Stack:** `com.anthropic:anthropic-java` (ADR-5), Spring `SseEmitter`, HTMX SSE
extension. Nessun build step, nessun npm (ADR-7).

**Spec:** `docs/superpowers/specs/2026-08-30-fantacalcio-auction-assistant-design.md`,
sezione 9 come emendata il 2026-09-01, e ADR-5, 6, 8, 9.

## Vincoli globali

Valgono per ogni task; una violazione e' un difetto anche se i test passano.

1. **Claude non porta fatti.** Nel contesto entrano solo dati dell'applicazione. Il
   prompt di sistema vieta esplicitamente il ricorso a conoscenza propria sul calcio.
2. **Claude non muove numeri.** `AuctionAdvice` non ha alcun campo numerico che finisca
   a schermo come cifra. `maxBid` resta del motore.
3. **Mai sulla pagina BATTITORE.** Quella e' proiettata: nessuna valutazione, nessun
   consiglio. Il vincolo e' strutturale — `BattitoreController` non riceve la porta.
4. **Degradazione silenziosa a runtime** (ADR-9). Nessun errore di Claude puo' rompere
   la scheda, bloccare un acquisto o comparire come stack trace. Sparisce un riquadro.
5. **La chiave solo da `ANTHROPIC_API_KEY`**, mai nel repository, mai nei log, mai in un
   messaggio d'errore.
6. **Nessun test tocca la rete.** La suite deve restare eseguibile offline e la sua
   durata non deve dipendere dall'API.
7. **Mai scrivere sotto `res/`** nei test: usare `@TempDir`.
8. Testo a schermo in italiano, identificatori e chiavi di configurazione in inglese,
   commenti in italiano.

---

## Prerequisito bloccante

`ANTHROPIC_API_KEY` non e' impostata su questa macchina. Serve una chiave da
`console.anthropic.com` esportata nell'ambiente. **I task 1-4 e 8 non ne hanno bisogno**
e si possono fare subito; i task 5, 6 e 7 la richiedono.

---

## Task 1 — La porta e la forma del consiglio

**File:** creare `application/port/out/StrategicAdvisor.java`,
`domain/advice/AuctionAdvice.java`, `domain/advice/Caution.java`,
`domain/advice/AdviceValidator.java`; test corrispondenti.

**Interfaccia prodotta** (la usano tutti i task successivi):

```java
public interface StrategicAdvisor {
    /** @param onDelta riceve i frammenti di testo man mano che arrivano */
    AuctionAdvice advise(AdviceContext context, Consumer<String> onDelta);
    boolean available();
}
```

```java
public record AuctionAdvice(Caution caution, String oneLiner,
                            List<String> strengths, List<String> risks,
                            String rationale) {}
public enum Caution { CONFERMA, CAUTELA, ALLARME }
```

**Nessun campo numerico**: e' il vincolo 2 reso impossibile da violare, non ricordato a
parole. Chi volesse far correggere il prezzo a Claude dovrebbe aggiungere un campo qui,
cioe' compiere un gesto visibile in revisione.

**Passi:**
1. Test che una risposta con `oneLiner` di 121 caratteri viene rifiutata; che 4
   `strengths` vengono rifiutate; che i campi nulli vengono rifiutati.
2. Implementare `AdviceValidator.validate(AuctionAdvice)` che restituisce la lista
   degli errori, sullo schema di `ScoringSettingsValidator`.
3. Test che una risposta valida passa.
4. Commit.

---

## Task 2 — Il contesto: cosa vede Claude

**File:** creare `domain/advice/AdviceContext.java`, `application/service/AdviceContextAssembler.java`; test.

E' il task in cui si vince o si perde l'accuratezza. Tutto il resto e' idraulica.

`AdviceContext` raccoglie, per il giocatore in esame:
- le `SeasonStats` grezze delle quattro stagioni, in ordine cronologico fisso, **con il
  numero di presenze sempre accanto a ogni media** (una fantamedia senza il suo campione
  e' il modo piu' facile per far sbagliare chi legge, umano o modello);
- la `PlayerProjection` con `observedAppearances`, che distingue una proiezione basata su
  dati da una basata su un prior;
- la `PriceRecommendation` completa: `expectedPrice`, `maxBid`, `hardCap`, `margin`,
  `confidence` e i `Driver` con le loro spiegazioni;
- lo stato d'asta: fase, crediti e slot residui dell'utente, inflazione corrente,
  quanti avversari cercano ancora quel ruolo;
- le migliori tre alternative disponibili nel ruolo, con prezzo atteso e punti attesi.

**Passi:**
1. Test: per un giocatore con storico su una sola stagione, il contesto riporta
   `observedAppearances` basso e le tre stagioni mancanti come assenti — non come zeri.
   Uno zero e' un dato, un'assenza no, e confonderli e' esattamente cio' che porta a
   consigli sbagliati.
2. Implementare l'assemblatore.
3. Test che il contesto non contiene mai `null` in un campo testuale.
4. Commit.

---

## Task 3 — Resa deterministica del contesto

**File:** creare `adapter/out/llm/AdviceContextRenderer.java`; test.

Trasforma `AdviceContext` nel testo che entra nel blocco utente del prompt.

**Deve essere deterministico byte per byte**: stesse chiavi nello stesso ordine, decimali
con `Locale.ROOT` e cifre fisse, nessun timestamp, nessun `HashMap` iterato. Un solo byte
che oscilla manda a vuoto la cache del prefisso e, peggio, rende irriproducibile il
replay del task 8.

**Passi:**
1. Test che due rese dello stesso contesto sono stringhe identiche.
2. Test che una resa contiene le presenze accanto a ogni media.
3. Implementare.
4. Test golden: la resa di un contesto noto corrisponde a un file di riferimento
   committato, cosi' una modifica del formato si vede in diff invece di passare
   inosservata.
5. Commit.

---

## Task 4 — Il riquadro nella scheda, con adapter di fixture

**File:** creare `adapter/out/llm/FixtureStrategicAdvisor.java`, il fragment del
riquadro, il CSS; modificare `index.html` e `AuctionController`.

Chiude il percorso end-to-end **senza rete**: il riquadro compare, si popola, degrada.

`FixtureStrategicAdvisor` restituisce consigli registrati, emettendo i delta a scatti per
riprodurre lo streaming. E' anche l'adapter usato da tutti i test successivi.

**Passi:**
1. Test che la scheda di analisi contiene il riquadro con lo stato "in attesa".
2. Test che il riquadro **non** compare in nessuna risposta di `BattitoreController`
   (vincolo 3), sullo schema del test strutturale gia' esistente.
3. Implementare fixture, fragment e CSS.
4. Verifica a mano con l'app avviata: il riquadro si popola.
5. Commit.

---

## Task 5 — Adapter Anthropic reale

**File:** creare `adapter/out/llm/ClaudeStrategicAdvisor.java`,
`adapter/out/llm/SystemPrompt.java`; aggiungere la dipendenza al `pom.xml`; config.

Modello `claude-opus-5`, thinking adattivo (`thinking: {type: "adaptive"}` — su Opus 5
`budget_tokens` viene rifiutato con 400), streaming, output tipizzato.

Il prompt di sistema porta le regole di lega, la semantica dei driver, il formato di
output e **il divieto esplicito**: non usare conoscenza propria sul calcio; ogni
affermazione deve citare un numero presente nel contesto; se un dato non c'e', dirlo
invece di supplirlo. Con `cache_control` sul breakpoint di sistema.

`available()` restituisce falso se la chiave manca, e in quel caso l'applicazione parte
lo stesso: l'assenza di chiave e' una configurazione legittima, non un errore d'avvio
(ADR-9 vale per le regole di lega, non per una funzione facoltativa).

**Passi:**
1. Test che senza chiave `available()` e' falso e l'applicazione si avvia.
2. Test che il prompt di sistema contiene il divieto e non contiene la chiave.
3. Implementare.
4. Prova manuale con chiave vera su un giocatore reale, verificando
   `cache_read_input_tokens` maggiore di zero dalla seconda chiamata.
5. Commit.

---

## Task 6 — Resilienza

**File:** creare `adapter/out/llm/ResilientStrategicAdvisor.java` (decoratore); test.

Timeout 8 s; un solo retry su 429/5xx/errori di connessione, mai su 400; circuit breaker
che dopo due fallimenti consecutivi disabilita Claude per 60 s.

**Passi:**
1. Test con un advisor che lancia sempre: dopo due fallimenti il terzo non chiama
   nemmeno, e dopo 60 s simulati riprova. L'orologio va iniettato, non atteso.
2. Test che un 400 non viene ritentato.
3. Test che un timeout produce degradazione e non eccezione risalente.
4. Implementare.
5. Commit.

---

## Task 7 — Streaming SSE nella UI

**File:** creare l'endpoint `GET /asta/consiglio` con `SseEmitter`, `advice.js`;
modificare il fragment del riquadro.

E' il pezzo con piu' rischio di comportamento non testabile in Java: lo streaming vive
nel browser. Va provato a mano, e va detto nel report che i test non lo coprono.

**Passi:**
1. Test che l'endpoint restituisce `text/event-stream` e chiude il flusso a fine
   risposta.
2. Test che una richiesta per un giocatore inesistente chiude senza errori.
3. Implementare endpoint e JavaScript.
4. Prova manuale: primo byte visibile, riquadro che si popola, e comportamento con la
   rete staccata a meta' risposta.
5. Commit.

---

## Task 8 — Registro delle chiamate e replay

**File:** creare `adapter/out/llm/LlmCallLog.java`, `adapter/out/llm/ReplayStrategicAdvisor.java`; test.

Ogni chiamata su `llm-calls.jsonl`: hash del prompt, modello, token in ingresso e in
uscita, token letti da cache, latenza, costo stimato, risposta completa (ADR-8).

`ReplayStrategicAdvisor` rilegge quel file e restituisce la risposta registrata per lo
stesso hash: rende riproducibile un'analisi post-asta senza contattare l'API e senza
spendere.

**Passi:**
1. Test su `@TempDir` che una chiamata registrata viene riprodotta identica.
2. Test che un hash sconosciuto degrada invece di lanciare.
3. Test che il file non contiene mai la chiave API.
4. Implementare.
5. Commit.

---

## Come si giudica il risultato

I test verdi non bastano, e su questa fase meno che mai. Il criterio e' un'ispezione
manuale su venti giocatori reali presi dal listone, scelti per coprire i casi difficili:
un titolare con quattro stagioni piene, un giovane con nove presenze, un rientro da
infortunio lungo, un portiere di seconda fascia, un attaccante con fantamedia gonfiata
dai rigori.

Per ognuno si verifica una cosa sola, ma senza sconti: **ogni affermazione del riquadro
poggia su un numero presente nel contesto.** Un'affermazione che non lo fa e' un difetto
da correggere nel prompt, non una sfumatura da accettare — e' il segnale che il modello
sta supplendo con la propria memoria, cioe' proprio cio' che questa fase esiste per
impedire.
