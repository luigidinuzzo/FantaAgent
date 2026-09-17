# Regole per asta, cartella dell'asta e cancellazione — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ogni asta porta nella sua cartella regole della lega, partecipanti, punteggio, preferenze del battitore ed export; «Crea asta» rende crediti e slot configurabili; dalla home si cancella un'asta con conferma.

**Architecture:** `LeagueRules`, preferenze del battitore e impostazioni di punteggio entrano in `RuntimeSnapshot`, caricati dall'archivio dell'asta con ripiego su un modello (`AuctionTemplate`, porto in uscita implementato in `config`). I servizi leggono le regole dallo scope a ogni richiesta. La creazione riceve tutto in un `AuctionSetup` già validato. La cancellazione sposta la cartella in un cestino.

**Tech Stack:** Java 25, Spring Boot 3.5.6, JUnit 5 + AssertJ + MockMvc, SnakeYAML; React 19 + TypeScript + Vite, TanStack Query, Tailwind v4, vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-17-regole-per-asta-design.md`

## Global Constraints

- `/legacy` è abbandonato: **nessuna modifica** a `adapter/in/web/**`, ai template Thymeleaf e ai loro test. Devono compilare e restare verdi: per questo `AuctionRuntime.createNew(String)`, `AuctionRuntime.rebuild()`, `AuctionRuntime.setParticipants(List<Participant>)` e il bean `AuctionSettingsHolder` restano. Verifica di fine task: `git diff main -- src/main/java/com/fantaagent/adapter/in/web src/main/resources/templates src/test/java/com/fantaagent/adapter/in/web` vuoto.
- Il formato di `events.jsonl`, `league-members.yml`, `league-settings.yml`, `auction-settings.yml` non cambia.
- File nuovi nella cartella dell'asta: `league-rules.yml`, `auction-settings.yml`, `rose.csv`. Cestino: `<data-dir>/auctions-cestino/<id>-<yyyyMMdd-HHmmss UTC>/`.
- Limiti: crediti ≥ 1; slot per ruolo fra 1 e 30; partecipanti ≥ 2; timer fra 1 e 120 (`AuctionSettingsValidator.MIN_SECONDS`/`MAX_SECONDS`).
- Messaggi di validazione, esatti: «I crediti per squadra devono essere almeno 1: indicati N.»; «Gli slot dei portieri / dei difensori / dei centrocampisti / degli attaccanti devono essere fra 1 e 30: indicati N.»; «Servono almeno 2 partecipanti.»; «Ad asta aperta non si aggiungono né si tolgono partecipanti.»; «Le regole della lega sono obbligatorie.»
- Motivo del blocco ad asta aperta, esatto: «Asta in corso: crediti, slot e numero di squadre sono bloccati, perché cambiarli ricalcolerebbe budget e rose già pagate.»
- Nessun test tocca `res/` o `data/` del progetto: `@TempDir` per Java; verifica a mano sul jar solo con `--fantaagent.data-dir` su una copia fuori dal progetto e `--server.port=8099`. Non avviare le spec Playwright.
- Ogni guardia nuova va vista fallire con una mutazione deliberata prima del commit (annotare la mutazione nel messaggio del task report, non nel codice).
- Il codice segue l'idioma del progetto: commenti in italiano che spiegano il perché, nomi dei test Java in italiano camelCase, `role="alert"` unico per schermata, bersagli 44×44.
- Messaggi di commit in italiano; ogni commit termina con le righe di attribuzione indicate dalla sessione.
- Comandi: Java `mvn -q test` (singolo: `mvn -q test -Dtest=NomeTest`); frontend da `frontend/`: `npx vitest run <file>`, `npm test`, `npm run lint`, `npm run build`.

---

## File map

**Backend — nuovi**
- `src/main/java/com/fantaagent/config/LeagueRulesSettings.java` — budget e slot come si salvano.
- `src/main/java/com/fantaagent/config/LeagueRulesSettingsStore.java` — `league-rules.yml`.
- `src/main/java/com/fantaagent/config/LeagueRulesValidator.java` — validazione per campo.
- `src/main/java/com/fantaagent/application/port/out/AuctionTemplate.java` — il modello da cui parte un'asta.
- `src/main/java/com/fantaagent/config/ConfigAuctionTemplate.java` — il modello letto da `application.yml` e dai file globali.
- `src/main/java/com/fantaagent/application/service/AuctionSetup.java` — ciò che serve a creare un'asta.

**Backend — modificati**
- `application/port/out/AuctionArchive.java`, `adapter/out/file/FileAuctionArchive.java` — regole, battitore, export, cancellazione.
- `application/service/RuntimeSnapshot.java`, `AuctionScope.java`, `AuctionRuntime.java`, `AuctionService.java`, `PlayerAnalysisService.java`.
- `config/BeanConfig.java`, `config/LeagueProperties.java`, `config/StartupValidator.java`, `src/main/resources/application.yml`.
- `adapter/in/api/SettingsApi.java`, `dto/SettingsDtos.java`, `board/PublicBidderApi.java`, `ExportApi.java`, `AuctionsApi.java`.

**Frontend — nuovi**
- `frontend/src/domain/StepperField.tsx` (+ test) — campo numerico con − e +.
- `frontend/src/domain/LeagueRulesFieldset.tsx` (+ test) — sostituisce `ConfigChips`.
- `frontend/src/domain/DeleteAuctionDialog.tsx` (+ test) — la modale di conferma.

**Frontend — modificati / rimossi**
- `api/types.ts`, `api/client.ts`, `api/hooks.ts`, `routes/SettingsRoute.tsx`, `routes/HomeRoute.tsx`, `domain/ParticipantsFieldset.tsx`, `setupTests.ts`.
- Rimossi: `domain/ConfigChips.tsx`, `domain/ConfigChips.test.tsx`.

---

### Task 1: Regole della lega come valori salvabili

**Files:**
- Create: `src/main/java/com/fantaagent/config/LeagueRulesSettings.java`
- Create: `src/main/java/com/fantaagent/config/LeagueRulesSettingsStore.java`
- Create: `src/main/java/com/fantaagent/config/LeagueRulesValidator.java`
- Test: `src/test/java/com/fantaagent/config/LeagueRulesSettingsStoreTest.java`
- Test: `src/test/java/com/fantaagent/config/LeagueRulesValidatorTest.java`

**Interfaces:**
- Produces:
  - `record LeagueRulesSettings(int budget, Map<Role, Integer> slots)` con `LeagueRules toRules(int participants, List<Role> phases)` e `static LeagueRulesSettings from(LeagueRules rules)`.
  - `class LeagueRulesSettingsStore(Path dir)`: `FILE_NAME = "league-rules.yml"`, `Path file()`, `Optional<LeagueRulesSettings> load()`, `void save(LeagueRulesSettings)`.
  - `final class LeagueRulesValidator`: `MIN_BUDGET = 1`, `MIN_SLOTS = 1`, `MAX_SLOTS = 30`, `MIN_PARTICIPANTS = 2`, `static Map<String, List<String>> validateByField(LeagueRulesSettings rules, int participants)`.

- [ ] **Step 1: Write the failing tests**

`LeagueRulesValidatorTest.java`:

```java
package com.fantaagent.config;

import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class LeagueRulesValidatorTest {

    private static Map<Role, Integer> slots(int p, int d, int c, int a) {
        return Map.of(Role.P, p, Role.D, d, Role.C, c, Role.A, a);
    }

    @Test
    void regoleValideNonDannoErrori() {
        assertThat(LeagueRulesValidator.validateByField(
                new LeagueRulesSettings(500, slots(3, 8, 8, 6)), 8)).isEmpty();
    }

    @Test
    void creditiSottoUnoStannoSottoLaChiaveBudget() {
        assertThat(LeagueRulesValidator.validateByField(
                new LeagueRulesSettings(0, slots(3, 8, 8, 6)), 8))
                .containsExactly(Map.entry("budget",
                        List.of("I crediti per squadra devono essere almeno 1: indicati 0.")));
    }

    @Test
    void ogniRuoloFuoriLimiteHaLaSuaChiave() {
        var errors = LeagueRulesValidator.validateByField(
                new LeagueRulesSettings(500, slots(0, 31, 8, 6)), 8);
        assertThat(errors).containsOnlyKeys("slots[P]", "slots[D]");
        assertThat(errors.get("slots[P]"))
                .containsExactly("Gli slot dei portieri devono essere fra 1 e 30: indicati 0.");
        assertThat(errors.get("slots[D]"))
                .containsExactly("Gli slot dei difensori devono essere fra 1 e 30: indicati 31.");
    }

    /** Un ruolo assente dal corpo e' un ruolo a zero slot, non un NullPointerException. */
    @Test
    void unRuoloMancanteEUnErroreDiCampo() {
        var errors = LeagueRulesValidator.validateByField(
                new LeagueRulesSettings(500, Map.of(Role.P, 3, Role.D, 8, Role.C, 8)), 8);
        assertThat(errors.get("slots[A]"))
                .containsExactly("Gli slot degli attaccanti devono essere fra 1 e 30: indicati 0.");
    }

    @Test
    void menoDiDuePartecipantiStaSottoLaChiaveParticipants() {
        assertThat(LeagueRulesValidator.validateByField(
                new LeagueRulesSettings(500, slots(3, 8, 8, 6)), 1))
                .containsExactly(Map.entry("participants", List.of("Servono almeno 2 partecipanti.")));
    }
}
```

`LeagueRulesSettingsStoreTest.java`:

```java
package com.fantaagent.config;

import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LeagueRulesSettingsStoreTest {

    @TempDir
    Path dir;

    @Test
    void senzaFileNonCeNiente() {
        assertThat(new LeagueRulesSettingsStore(dir).load()).isEmpty();
    }

    @Test
    void cioCheSiSalvaSiRilegge() {
        var store = new LeagueRulesSettingsStore(dir);
        var saved = new LeagueRulesSettings(300, Map.of(Role.P, 2, Role.D, 6, Role.C, 7, Role.A, 5));
        store.save(saved);

        assertThat(store.file()).isEqualTo(dir.resolve("league-rules.yml"));
        assertThat(store.load()).contains(saved);
    }

    @Test
    void ilFileNonPortaNeSquadreNeFasi() throws Exception {
        var store = new LeagueRulesSettingsStore(dir);
        store.save(new LeagueRulesSettings(500, Map.of(Role.P, 3, Role.D, 8, Role.C, 8, Role.A, 6)));
        String yaml = Files.readString(store.file());
        assertThat(yaml).contains("budget: 500").contains("P: 3").contains("A: 6");
        assertThat(yaml).doesNotContain("participants").doesNotContain("phases");
    }

    @Test
    void unFileIllegibileLoDiceConIlSuoPercorso() throws Exception {
        Files.writeString(dir.resolve("league-rules.yml"), "- non una mappa\n");
        assertThatThrownBy(() -> new LeagueRulesSettingsStore(dir).load())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("league-rules.yml");
    }

    @Test
    void leRegoleDelDominioSiCostruisconoConPartecipantiEFasi() {
        var s = new LeagueRulesSettings(500, Map.of(Role.P, 3, Role.D, 8, Role.C, 8, Role.A, 6));
        LeagueRules rules = s.toRules(6, List.of(Role.P, Role.D, Role.C, Role.A));
        assertThat(rules.participants()).isEqualTo(6);
        assertThat(rules.budget()).isEqualTo(500);
        assertThat(LeagueRulesSettings.from(rules)).isEqualTo(s);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `mvn -q test -Dtest='LeagueRules*Test'`
Expected: compilazione fallita, `LeagueRulesSettings` non esiste.

- [ ] **Step 3: Implement**

`LeagueRulesSettings.java`:

```java
package com.fantaagent.config;

import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.player.Role;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Crediti e slot per ruolo di un'asta, come si salvano in {@code league-rules.yml}.
 *
 * <p>Non e' {@link LeagueRules}: mancano apposta il numero di squadre, che e' la
 * lunghezza della lista dei partecipanti, e l'ordine delle fasi, che resta globale.
 * Salvare qui un numero di squadre vorrebbe dire due fonti per la stessa cosa.
 */
public record LeagueRulesSettings(int budget, Map<Role, Integer> slots) {

    public LeagueRulesSettings {
        slots = Map.copyOf(slots);
    }

    public LeagueRules toRules(int participants, List<Role> phases) {
        return new LeagueRules(participants, budget, slots, phases);
    }

    public static LeagueRulesSettings from(LeagueRules rules) {
        return new LeagueRulesSettings(rules.budget(), new EnumMap<>(rules.slots()));
    }
}
```

`LeagueRulesSettingsStore.java` — stesso schema di `AuctionSettingsStore` (lettura SnakeYAML in `Map`, errori `IllegalStateException` con il percorso, scrittura con commento d'intestazione):

```java
package com.fantaagent.config;

import com.fantaagent.domain.player.Role;
import org.yaml.snakeyaml.Yaml;

import java.io.IOException;
import java.io.Reader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.EnumMap;
import java.util.Map;
import java.util.Optional;

/** Le regole della lega di un'asta: {@code league-rules.yml} nella sua cartella. */
public class LeagueRulesSettingsStore {

    public static final String FILE_NAME = "league-rules.yml";

    private final Path file;

    public LeagueRulesSettingsStore(Path dir) {
        this.file = dir.resolve(FILE_NAME);
    }

    public Path file() {
        return file;
    }

    @SuppressWarnings("unchecked")
    public Optional<LeagueRulesSettings> load() {
        if (!Files.exists(file)) {
            return Optional.empty();
        }
        try (Reader reader = Files.newBufferedReader(file, StandardCharsets.UTF_8)) {
            Object parsed = new Yaml().load(reader);
            if (!(parsed instanceof Map<?, ?> root)) {
                throw new IllegalStateException("il file " + file + " non contiene una mappa YAML");
            }
            Map<String, Object> map = (Map<String, Object>) root;
            Map<Role, Integer> slots = new EnumMap<>(Role.class);
            if (map.get("slots") instanceof Map<?, ?> raw) {
                for (Role role : Role.values()) {
                    Object v = raw.get(role.name());
                    // Un ruolo assente resta assente: lo rifiuta LeagueRules, con il
                    // nome del ruolo, invece di inventargli un numero qui.
                    if (v != null) {
                        slots.put(role, integer(v));
                    }
                }
            }
            return Optional.of(new LeagueRulesSettings(integer(map.get("budget")), slots));
        } catch (IOException e) {
            throw new UncheckedIOException("impossibile leggere " + file, e);
        } catch (RuntimeException e) {
            throw new IllegalStateException(
                    "regole della lega non interpretabili in " + file + ": " + e.getMessage(), e);
        }
    }

    public void save(LeagueRulesSettings s) {
        try {
            Files.createDirectories(file.getParent());
            Files.writeString(file, """
                    # Regole della lega per questa asta.
                    # Scritto dall'applicazione alla creazione dell'asta. Le squadre sono i
                    # partecipanti in league-members.yml; l'ordine delle fasi e' globale.

                    budget: %d
                    slots:
                      P: %d
                      D: %d
                      C: %d
                      A: %d
                    """.formatted(s.budget(), s.slots().get(Role.P), s.slots().get(Role.D),
                    s.slots().get(Role.C), s.slots().get(Role.A)), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException("impossibile scrivere " + file, e);
        }
    }

    private static int integer(Object o) {
        if (o instanceof Number n) {
            return n.intValue();
        }
        if (o == null) {
            throw new IllegalStateException("valore mancante");
        }
        return Integer.parseInt(o.toString().trim());
    }
}
```

`LeagueRulesValidator.java`:

```java
package com.fantaagent.config;

import com.fantaagent.domain.player.Role;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Validazione di crediti, slot e numero di squadre al salvataggio, come funzione pura.
 *
 * <p>Il limite di {@link #MAX_SLOTS} non e' una regola del gioco: e' una sponda contro
 * un refuso (300 al posto di 3), che altrimenti costruirebbe rose impossibili senza
 * dire niente.
 */
public final class LeagueRulesValidator {

    public static final int MIN_BUDGET = 1;
    public static final int MIN_SLOTS = 1;
    public static final int MAX_SLOTS = 30;
    public static final int MIN_PARTICIPANTS = 2;

    private static final Map<Role, String> ROLE_PLURAL = Map.of(
            Role.P, "dei portieri", Role.D, "dei difensori",
            Role.C, "dei centrocampisti", Role.A, "degli attaccanti");

    private LeagueRulesValidator() {
    }

    public static Map<String, List<String>> validateByField(LeagueRulesSettings rules, int participants) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        if (rules.budget() < MIN_BUDGET) {
            add(errors, "budget", "I crediti per squadra devono essere almeno " + MIN_BUDGET
                    + ": indicati " + rules.budget() + ".");
        }
        for (Role role : Role.values()) {
            int n = rules.slots().getOrDefault(role, 0);
            if (n < MIN_SLOTS || n > MAX_SLOTS) {
                add(errors, "slots[" + role.name() + "]", "Gli slot " + ROLE_PLURAL.get(role)
                        + " devono essere fra " + MIN_SLOTS + " e " + MAX_SLOTS
                        + ": indicati " + n + ".");
            }
        }
        if (participants < MIN_PARTICIPANTS) {
            add(errors, "participants", "Servono almeno " + MIN_PARTICIPANTS + " partecipanti.");
        }
        return Collections.unmodifiableMap(errors);
    }

    private static void add(Map<String, List<String>> errors, String key, String message) {
        errors.computeIfAbsent(key, k -> new ArrayList<>()).add(message);
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `mvn -q test -Dtest='LeagueRules*Test'`
Expected: PASS. Mutazione da provare: `n > MAX_SLOTS` → `n > MAX_SLOTS + 1`, il test sui 31 slot deve fallire.

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/fantaagent/config/LeagueRules*.java src/test/java/com/fantaagent/config/LeagueRules*Test.java
git commit -m "Regole della lega come valori salvabili: league-rules.yml e validazione per campo"
```

---

### Task 2: L'archivio conserva regole, battitore, export e cestino

**Files:**
- Modify: `src/main/java/com/fantaagent/application/port/out/AuctionArchive.java`
- Modify: `src/main/java/com/fantaagent/adapter/out/file/FileAuctionArchive.java`
- Test: `src/test/java/com/fantaagent/adapter/out/file/FileAuctionArchiveTest.java` (crearlo se non esiste; se esiste, aggiungere i test)

**Interfaces:**
- Consumes: `LeagueRulesSettings`, `LeagueRulesSettingsStore` (Task 1); `AuctionSettings`, `AuctionSettingsStore` (esistenti).
- Produces, su `AuctionArchive`:
  - `Optional<LeagueRulesSettings> rules(String auctionId)`
  - `void saveRules(String auctionId, LeagueRulesSettings settings)`
  - `Optional<AuctionSettings> bidder(String auctionId)`
  - `void saveBidder(String auctionId, AuctionSettings settings)`
  - `void saveExport(String auctionId, String csv)` — scrive `rose.csv` in UTF-8.
  - `void delete(String auctionId)` — sposta la cartella in `<data-dir>/auctions-cestino/<id>-<yyyyMMdd-HHmmss>`; `IllegalArgumentException` se l'asta non esiste.
- Produces su `FileAuctionArchive`: costruttore aggiuntivo `FileAuctionArchive(Path dataDir, Clock clock)`; quello esistente delega con `Clock.systemUTC()`. Costanti `EXPORT_NAME = "rose.csv"`, `TRASH_DIR = "auctions-cestino"`.

- [ ] **Step 1: Write the failing tests**

```java
package com.fantaagent.adapter.out.file;

import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.LeagueRulesSettings;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FileAuctionArchiveRulesAndTrashTest {

    @TempDir
    Path data;

    private static final Clock CLOCK =
            Clock.fixed(Instant.parse("2026-09-17T20:15:30Z"), ZoneOffset.UTC);

    private FileAuctionArchive archive() {
        return new FileAuctionArchive(data, CLOCK);
    }

    private void createWithLog(FileAuctionArchive archive, String id) {
        archive.open(id).appendWithNextSeq(seq ->
                new AuctionEvent.AuctionStarted(seq, Instant.parse("2026-09-17T19:00:00Z"), "Prova"));
    }

    @Test
    void regoleEBattitoreSiSalvanoNellaCartellaDellAsta() {
        var archive = archive();
        var rules = new LeagueRulesSettings(300, Map.of(Role.P, 2, Role.D, 6, Role.C, 7, Role.A, 5));
        archive.saveRules("a1", rules);
        archive.saveBidder("a1", new AuctionSettings(12, false));

        assertThat(data.resolve("auctions/a1/league-rules.yml")).exists();
        assertThat(data.resolve("auctions/a1/auction-settings.yml")).exists();
        assertThat(archive.rules("a1")).contains(rules);
        assertThat(archive.bidder("a1")).contains(new AuctionSettings(12, false));
    }

    @Test
    void unAstaVecchiaNonHaNeRegoleNeBattitore() {
        var archive = archive();
        createWithLog(archive, "vecchia");
        assertThat(archive.rules("vecchia")).isEmpty();
        assertThat(archive.bidder("vecchia")).isEmpty();
    }

    @Test
    void lExportSiScriveComeRoseCsvInUtf8() throws Exception {
        var archive = archive();
        createWithLog(archive, "a1");
        archive.saveExport("a1", "Portieri;Sommer\n");
        assertThat(Files.readString(data.resolve("auctions/a1/rose.csv"), StandardCharsets.UTF_8))
                .isEqualTo("Portieri;Sommer\n");
    }

    @Test
    void cancellareSpostaLaCartellaNelCestinoConDataEOra() {
        var archive = archive();
        createWithLog(archive, "a1");

        archive.delete("a1");

        assertThat(data.resolve("auctions/a1")).doesNotExist();
        assertThat(data.resolve("auctions-cestino/a1-20260917-201530/events.jsonl")).exists();
        assertThat(archive.auctionIds()).doesNotContain("a1");
        assertThat(archive.exists("a1")).isFalse();
    }

    @Test
    void cancellareUnAstaInesistenteVieneRifiutato() {
        assertThatThrownBy(() -> archive().delete("nessuna"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void unIdentificativoConPercorsoVieneRifiutatoAncheInCancellazione() {
        assertThatThrownBy(() -> archive().delete("../fuori"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
```

Verificare prima la firma reale di `AuctionEventStore.appendWithNextSeq` e del costruttore di `AuctionEvent.AuctionStarted` in `AuctionRuntime.createNew` e adeguare le due righe di `createWithLog`.

- [ ] **Step 2: Run to verify failure**

Run: `mvn -q test -Dtest=FileAuctionArchiveRulesAndTrashTest`
Expected: compilazione fallita sui metodi mancanti.

- [ ] **Step 3: Implement**

In `AuctionArchive.java` aggiungere, con javadoc breve:

```java
    /** Crediti e slot dell'asta; vuoto per le aste create prima che esistessero. */
    Optional<LeagueRulesSettings> rules(String auctionId);

    /** Chiamato solo alla creazione: le regole di un'asta aperta non cambiano. */
    void saveRules(String auctionId, LeagueRulesSettings settings);

    Optional<AuctionSettings> bidder(String auctionId);

    void saveBidder(String auctionId, AuctionSettings settings);

    /** L'ultimo export scaricato, come {@code rose.csv} nella cartella dell'asta. */
    void saveExport(String auctionId, String csv);

    /**
     * Toglie l'asta dall'archivio spostandone la cartella nel cestino, intera e con una
     * sola mossa: il registro non si tronca e non si riscrive.
     *
     * @throws IllegalArgumentException se l'asta non esiste
     */
    void delete(String auctionId);
```

In `FileAuctionArchive.java`:

```java
    static final String EXPORT_NAME = "rose.csv";
    static final String TRASH_DIR = "auctions-cestino";
    private static final DateTimeFormatter TRASH_STAMP =
            DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss").withZone(ZoneOffset.UTC);

    private final Path root;
    private final Path trash;
    private final Clock clock;

    public FileAuctionArchive(Path dataDir) {
        this(dataDir, Clock.systemUTC());
    }

    public FileAuctionArchive(Path dataDir, Clock clock) {
        this.root = dataDir.resolve("auctions");
        this.trash = dataDir.resolve(TRASH_DIR);
        this.clock = clock;
    }

    @Override
    public Optional<LeagueRulesSettings> rules(String auctionId) {
        return new LeagueRulesSettingsStore(directoryOf(auctionId)).load();
    }

    @Override
    public void saveRules(String auctionId, LeagueRulesSettings settings) {
        new LeagueRulesSettingsStore(ensureDirectory(auctionId)).save(settings);
    }

    @Override
    public Optional<AuctionSettings> bidder(String auctionId) {
        return new AuctionSettingsStore(directoryOf(auctionId)).load();
    }

    @Override
    public void saveBidder(String auctionId, AuctionSettings settings) {
        new AuctionSettingsStore(ensureDirectory(auctionId)).save(settings);
    }

    @Override
    public void saveExport(String auctionId, String csv) {
        Path file = ensureDirectory(auctionId).resolve(EXPORT_NAME);
        try {
            Files.writeString(file, csv, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException("impossibile scrivere " + file, e);
        }
    }

    /**
     * Deroga dichiarata a "questa classe non cancella": non distrugge, sposta. La
     * cartella esce da {@code auctions/} e l'id torna libero; rimetterla a mano la
     * recupera. Una {@code Files.move} sullo stesso filesystem e' atomica: se fallisce,
     * la cartella e' ancora al suo posto.
     */
    @Override
    public void delete(String auctionId) {
        Path source = directoryOf(auctionId);
        if (!Files.isDirectory(source)) {
            throw new IllegalArgumentException("nessuna asta con identificativo " + auctionId);
        }
        Path target = trash.resolve(auctionId + "-" + TRASH_STAMP.format(clock.instant()));
        try {
            Files.createDirectories(trash);
            Files.move(source, target, StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException e) {
            throw new UncheckedIOException("impossibile spostare " + source + " nel cestino", e);
        }
    }

    private Path ensureDirectory(String auctionId) {
        Path dir = directoryOf(auctionId);
        try {
            Files.createDirectories(dir);
        } catch (IOException e) {
            throw new UncheckedIOException("impossibile creare la cartella di " + auctionId, e);
        }
        return dir;
    }
```

Rifattorizzare `saveParticipants` e `saveScoring` perché usino `ensureDirectory` (stesso comportamento, meno duplicazione). Aggiornare il javadoc di classe: non più «dentro il solo `events.jsonl`» ma l'elenco dei file della spec §2, e la frase «nessun metodo che cancelli» diventa «nessun metodo che tronchi o riscriva un registro; `delete` sposta la cartella intera».

Se nei test di `@TempDir` `ATOMIC_MOVE` non fosse supportato (sullo stesso filesystem lo è), non ripiegare in silenzio su una copia: lasciar fallire.

- [ ] **Step 4: Run tests**

Run: `mvn -q test -Dtest='FileAuctionArchive*Test,AuctionRuntimeTest'`
Expected: PASS. Mutazione: togliere `.withZone(ZoneOffset.UTC)` o cambiare il pattern → il test del cestino fallisce.

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/fantaagent/application/port/out/AuctionArchive.java src/main/java/com/fantaagent/adapter/out/file/FileAuctionArchive.java src/test/java/com/fantaagent/adapter/out/file/
git commit -m "L'archivio conserva regole, battitore ed export dell'asta, e cancella spostando nel cestino"
```

---

### Task 3: Le regole viaggiano nello scope, non nei costruttori

Refactoring senza cambiamento di comportamento: il runtime ha ancora regole fisse, ma i servizi smettono di catturarle.

**Files:**
- Modify: `src/main/java/com/fantaagent/application/service/RuntimeSnapshot.java`
- Modify: `src/main/java/com/fantaagent/application/service/AuctionScope.java`
- Modify: `src/main/java/com/fantaagent/application/service/AuctionRuntime.java`
- Modify: `src/main/java/com/fantaagent/application/service/AuctionService.java`
- Modify: `src/main/java/com/fantaagent/application/service/PlayerAnalysisService.java`
- Modify: `src/main/java/com/fantaagent/config/BeanConfig.java`
- Modify (call site dei costruttori): `src/test/java/com/fantaagent/application/service/{AuctionServiceTest,IdempotentPurchaseTest,PlayerSearchServiceTest,PlayerSearchServiceLatencyTest,PurchaseRejectionTest,PurchaseRevocationTest}.java` e ogni altro file che `grep -rn "new PlayerAnalysisService(\|new AuctionScope(\|new RuntimeSnapshot(" src/test` trova.
- Test: `src/test/java/com/fantaagent/application/service/AuctionServiceRulesFromScopeTest.java`

**Interfaces:**
- Produces:
  - `record AuctionScope(String auctionId, AuctionEventStore store, List<Participant> participants, LeagueRules rules)`
  - `record RuntimeSnapshot(String auctionId, AuctionEventStore store, List<Participant> participants, LeagueRules rules, ValuationChain chain)` — `scope()` passa `rules`.
  - `AuctionService(PlayerCatalog catalog, Supplier<AuctionScope> scope)`; la forma fissa `AuctionService(LeagueRules rules, List<Participant> participants, PlayerCatalog catalog, AuctionEventStore store)` resta con la stessa firma.
  - `PlayerAnalysisService(PlayerCatalog catalog, Supplier<ValuationChain> chain, AuctionService auction)` e `PlayerAnalysisService(PlayerCatalog catalog, ProjectionRegistry projections, ValuationEngine engine, AuctionService auction)`.

- [ ] **Step 1: Write the failing test**

```java
package com.fantaagent.application.service;

import com.fantaagent.adapter.out.file.InMemoryPlayerCatalog;
import com.fantaagent.adapter.out.file.JsonlAuctionEventStore;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Le regole sono dell'asta: il servizio le legge dallo scope a ogni richiesta. Se le
 * catturasse alla costruzione, passare a un'asta con un altro budget lascerebbe i
 * crediti residui calcolati con quello di prima.
 */
class AuctionServiceRulesFromScopeTest {

    @TempDir
    Path tmp;

    private static LeagueRules rules(int budget) {
        return new LeagueRules(2, budget, Map.of(Role.P, 1, Role.D, 1, Role.C, 1, Role.A, 1),
                List.of(Role.P, Role.D, Role.C, Role.A));
    }

    @Test
    void cambiandoScopeCambianoAncheLeRegole() {
        List<Participant> people = List.of(
                new Participant("me", "Io", 'I', true), new Participant("p2", "Tu", 'T', false));
        var store = new JsonlAuctionEventStore(tmp.resolve("events.jsonl"));
        var scope = new AtomicReference<>(new AuctionScope("a", store, people, rules(100)));
        var service = new AuctionService(new InMemoryPlayerCatalog(List.of(), List.of()), scope::get);

        assertThat(service.state().rules().budget()).isEqualTo(100);

        scope.set(new AuctionScope("b", store, people, rules(300)));

        assertThat(service.state().rules().budget()).isEqualTo(300);
    }
}
```

Verificare i costruttori reali di `JsonlAuctionEventStore` e `InMemoryPlayerCatalog` (vedi `AuctionRuntimeTest`) e adeguare.

- [ ] **Step 2: Run to verify failure**

Run: `mvn -q test -Dtest=AuctionServiceRulesFromScopeTest`
Expected: compilazione fallita (`AuctionScope` a 3 argomenti, costruttore di `AuctionService` a 2).

- [ ] **Step 3: Implement**

`AuctionScope`:

```java
public record AuctionScope(String auctionId, AuctionEventStore store,
                           List<Participant> participants, LeagueRules rules) {

    public AuctionScope {
        participants = List.copyOf(participants);
        Objects.requireNonNull(rules, "rules");
    }
}
```

`RuntimeSnapshot`: aggiungere `LeagueRules rules` fra `participants` e `chain`, `Objects.requireNonNull(rules, "rules")` nel costruttore compatto, e `return new AuctionScope(auctionId, store, participants, rules);` in `scope()`. Aggiornare il javadoc: regole e catena nascono nella stessa assegnazione.

`AuctionRuntime`: ogni `new RuntimeSnapshot(id, store, participants, chain)` diventa `new RuntimeSnapshot(id, store, participants, rules, chain)` usando il campo `rules` esistente (quattro punti: costruttore, `select`, `createNew`, `deselect`, più `setParticipants` e `rebuild` che copiano `base.rules()`).

`AuctionService`:
- togliere il campo `rules`;
- costruttore principale `AuctionService(PlayerCatalog catalog, Supplier<AuctionScope> scope)`;
- forma fissa: `this(catalog, fixedScope(rules, participants, store)); syncResumeSummary();` con `fixedScope` che costruisce `new AuctionScope("fissa", store, participants, rules)`;
- `state(AuctionScope s)` usa `s.rules()`;
- `advancePhase()`: `AuctionState current = state(); Optional<Role> next = current.rules().nextPhase(current.currentPhase());`
- `selectPhase(Role role)`: leggere `AuctionScope current = scope.get();` una volta, usare `current.rules().phases()` e `state(current).currentPhase()`, e `current.store()` per le scritture — un solo scope per tutta la mutazione, non tre letture che potrebbero vedere aste diverse.

`PlayerAnalysisService`: togliere il campo `rules` e il primo parametro dei due costruttori; `priceModelFor` usa `state.rules()`:

```java
    public PriceModel priceModelFor(AuctionState state, ValuationChain chain) {
        return PriceModel.build(state.rules(), state, chain.projections().all(),
                id -> catalog.byId(id).map(Player::listPrice).orElse(1));
    }
```

`BeanConfig`: `auctionService(catalog, runtime)` → `new AuctionService(catalog, runtime.scopes())`; `playerAnalysisService(catalog, runtime, auction)` → `new PlayerAnalysisService(catalog, runtime.chains(), auction)`. Togliere il parametro `LeagueRules rules` da questi due metodi.

Test esistenti: togliere il primo argomento `RULES` da ogni `new PlayerAnalysisService(...)`; aggiungere `RULES` come quarto argomento a ogni `new AuctionScope(...)` e come quarto a ogni `new RuntimeSnapshot(...)` (prima della catena). Le chiamate alla forma fissa `new AuctionService(RULES, participants, catalog, store)` non cambiano.

- [ ] **Step 4: Run all Java tests**

Run: `mvn -q test`
Expected: PASS, stesso numero di test di prima più uno. Mutazione: in `AuctionService.state(AuctionScope)` sostituire `s.rules()` con le regole di uno scope catturato alla costruzione → il nuovo test fallisce.

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/fantaagent/application src/main/java/com/fantaagent/config/BeanConfig.java src/test/java/com/fantaagent/application
git commit -m "Le regole della lega viaggiano nello scope dell'asta, non nei costruttori dei servizi"
```

---

### Task 4: Il runtime carica tutto dall'asta, con il modello come ripiego

**Files:**
- Create: `src/main/java/com/fantaagent/application/port/out/AuctionTemplate.java`
- Create: `src/main/java/com/fantaagent/config/ConfigAuctionTemplate.java`
- Create: `src/main/java/com/fantaagent/application/service/AuctionSetup.java`
- Modify: `src/main/java/com/fantaagent/application/service/RuntimeSnapshot.java`
- Modify: `src/main/java/com/fantaagent/application/service/AuctionRuntime.java`
- Modify: `src/main/java/com/fantaagent/config/BeanConfig.java`
- Modify: `src/main/java/com/fantaagent/config/LeagueProperties.java`, `StartupValidator.java`, `src/main/resources/application.yml`
- Modify: `src/test/java/com/fantaagent/application/service/AuctionRuntimeTest.java`, `AuctionRuntimeAtomicityTest.java`, `src/test/java/com/fantaagent/config/StartupValidatorTest.java`, e ogni `@SpringBootTest`/yml di test che imposti `league.participants`
- Create: `src/test/java/com/fantaagent/application/service/TestAuctionTemplate.java`
- Test: `src/test/java/com/fantaagent/application/service/AuctionRuntimePerAuctionTest.java`

**Interfaces:**
- Consumes: Task 1, 2, 3.
- Produces:
  - `interface AuctionTemplate { LeagueRulesSettings rules(); List<Participant> participants(); ScoringSettings scoring(); AuctionSettings bidder(); ScoringRules scoringRules(ScoringSettings settings); }`
  - `record AuctionSetup(String name, LeagueRulesSettings rules, List<Participant> participants, ScoringSettings scoring, AuctionSettings bidder)`
  - `record RuntimeSnapshot(String auctionId, AuctionEventStore store, List<Participant> participants, LeagueRules rules, ScoringSettings scoring, AuctionSettings bidder, ValuationChain chain)`
  - `AuctionRuntime(PlayerCatalog catalog, List<Double> seasonWeights, List<Role> phases, AuctionTemplate template, AuctionArchive archive)`
  - Su `AuctionRuntime`: `String createNew(AuctionSetup setup)`; `String createNew(String name)` (solo `/legacy`: crea dal modello); `void setBidder(AuctionSettings settings)` (`IllegalStateException` senza asta aperta); `void delete(String auctionId)` (`IllegalArgumentException` se non esiste); accessori `LeagueRules rules()`, `ScoringSettings scoringSettings()`, `AuctionSettings bidder()`, `List<Participant> participants()` che leggono lo snapshot corrente; `select`, `deselect`, `setParticipants`, `rebuild`, `auctions` con la firma di oggi.
  - `ConfigAuctionTemplate(LeagueProperties props, ScoringSettingsStore scoringStore, LeagueMembersSettingsStore membersStore, AuctionSettingsStore auctionStore)`; bean `AuctionTemplate` in `BeanConfig`.

- [ ] **Step 1: Write the test helper and the failing tests**

`TestAuctionTemplate.java` — un modello modificabile per i test:

```java
package com.fantaagent.application.service;

import com.fantaagent.application.port.out.AuctionTemplate;
import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.LeagueRulesSettings;
import com.fantaagent.config.ScoringSettings;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.league.ScoringRules;
import com.fantaagent.domain.player.Role;

import java.util.List;
import java.util.Map;

/** Il modello di un'asta, con campi pubblici: un test cambia quello che gli serve. */
final class TestAuctionTemplate implements AuctionTemplate {

    LeagueRulesSettings rules = new LeagueRulesSettings(100,
            Map.of(Role.P, 1, Role.D, 1, Role.C, 1, Role.A, 1));
    List<Participant> participants = List.of(
            new Participant("me", "Io", 'I', true),
            new Participant("marco", "Marco", 'M', false));
    ScoringSettings scoring;
    AuctionSettings bidder = AuctionSettings.DEFAULTS;

    TestAuctionTemplate(ScoringSettings scoring) {
        this.scoring = scoring;
    }

    @Override public LeagueRulesSettings rules() { return rules; }
    @Override public List<Participant> participants() { return participants; }
    @Override public ScoringSettings scoring() { return scoring; }
    @Override public AuctionSettings bidder() { return bidder; }
    @Override public ScoringRules scoringRules(ScoringSettings settings) {
        return settings.toScoringRules(0.55);
    }
}
```

Il `ScoringSettings` di partenza si ricava con `ScoringSettings.from(scoring(), true)` dal metodo `scoring()` già presente in `AuctionRuntimeTest` (spostarlo in un metodo statico condiviso se serve a entrambi i test).

`AuctionRuntimePerAuctionTest.java`:

```java
package com.fantaagent.application.service;

import com.fantaagent.adapter.out.file.FileAuctionArchive;
import com.fantaagent.adapter.out.file.InMemoryPlayerCatalog;
import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.LeagueRulesSettings;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AuctionRuntimePerAuctionTest {

    @TempDir
    Path tmp;

    private TestAuctionTemplate template;
    private FileAuctionArchive archive;
    private AuctionRuntime runtime;

    @BeforeEach
    void setUp() {
        template = new TestAuctionTemplate(AuctionRuntimeTest.scoringSettings());
        archive = new FileAuctionArchive(tmp);
        runtime = new AuctionRuntime(
                new InMemoryPlayerCatalog(List.of(new Player("d1", "Difensore", "Inter", Role.D, 20)), List.of()),
                List.of(1.0), List.of(Role.P, Role.D, Role.C, Role.A), template, archive);
    }

    private AuctionSetup setup(String name, int budget, List<Participant> people, int timer) {
        return new AuctionSetup(name,
                new LeagueRulesSettings(budget, Map.of(Role.P, 1, Role.D, 2, Role.C, 1, Role.A, 1)),
                people, template.scoring, new AuctionSettings(timer, false));
    }

    private static List<Participant> people(int n) {
        return java.util.stream.IntStream.range(0, n)
                .mapToObj(i -> new Participant("p" + i, "Nome" + i, (char) ('A' + i), i == 0))
                .toList();
    }

    @Test
    void creareScriveICinqueFileNellaCartellaDellAsta() {
        String id = runtime.createNew(setup("Prima", 300, people(3), 9));
        Path dir = tmp.resolve("auctions").resolve(id);
        assertThat(dir.resolve("events.jsonl")).exists();
        assertThat(dir.resolve("league-members.yml")).exists();
        assertThat(dir.resolve("league-settings.yml")).exists();
        assertThat(dir.resolve("league-rules.yml")).exists();
        assertThat(dir.resolve("auction-settings.yml")).exists();
    }

    @Test
    void ogniAstaHaLeSueRegoleESquadrePariAiPartecipanti() {
        String prima = runtime.createNew(setup("Prima", 300, people(3), 9));
        String seconda = runtime.createNew(setup("Seconda", 700, people(5), 20));

        runtime.select(prima);
        assertThat(runtime.rules().budget()).isEqualTo(300);
        assertThat(runtime.rules().participants()).isEqualTo(3);
        assertThat(runtime.rules().slots(Role.D)).isEqualTo(2);
        assertThat(runtime.bidder()).isEqualTo(new AuctionSettings(9, false));
        assertThat(runtime.snapshot().chain()).isNotNull();

        runtime.select(seconda);
        assertThat(runtime.rules().budget()).isEqualTo(700);
        assertThat(runtime.rules().participants()).isEqualTo(5);
        assertThat(runtime.bidder().bidTimerSeconds()).isEqualTo(20);
    }

    @Test
    void unAstaVecchiaRicadeSulModello() throws Exception {
        Path dir = tmp.resolve("auctions").resolve("2026-08-30");
        Files.createDirectories(dir);
        Files.writeString(dir.resolve("events.jsonl"),
                "{\"type\":\"AuctionStarted\",\"seq\":1,\"at\":\"2026-08-30T08:00:00Z\"}\n");

        runtime.select("2026-08-30");

        assertThat(runtime.rules().budget()).isEqualTo(100);
        assertThat(runtime.rules().participants()).isEqualTo(2);
        assertThat(runtime.bidder()).isEqualTo(AuctionSettings.DEFAULTS);
    }

    @Test
    void creareNonTocicaIlModello() {
        var modello = template.rules;
        runtime.createNew(setup("Prima", 300, people(3), 9));
        runtime.deselect();
        assertThat(template.rules).isSameAs(modello);
        assertThat(runtime.rules().budget()).isEqualTo(100);
    }

    /** Il registro per ultimo: un errore prima lascia una cartella che la home non elenca. */
    @Test
    void seUnFilePrimaDelRegistroFallisceLAstaNonCompareNellElenco() {
        var broken = setup("Rotta", 300, people(3), 9);
        var failing = new FileAuctionArchive(tmp) {
            @Override
            public void saveBidder(String auctionId, AuctionSettings settings) {
                throw new java.io.UncheckedIOException(new java.io.IOException("disco pieno"));
            }
        };
        var rt = new AuctionRuntime(new InMemoryPlayerCatalog(List.of(), List.of()), List.of(1.0),
                List.of(Role.P, Role.D, Role.C, Role.A), template, failing);

        assertThatThrownBy(() -> rt.createNew(broken)).isInstanceOf(java.io.UncheckedIOException.class);
        assertThat(rt.auctions()).isEmpty();
        assertThat(rt.hasAuction()).isFalse();
    }

    @Test
    void setBidderScriveNellAstaApertaERipubblica() {
        String id = runtime.createNew(setup("Prima", 300, people(3), 9));
        runtime.setBidder(new AuctionSettings(15, true));
        assertThat(runtime.bidder()).isEqualTo(new AuctionSettings(15, true));
        assertThat(archive.bidder(id)).contains(new AuctionSettings(15, true));
    }

    @Test
    void setBidderSenzaAstaVieneRifiutato() {
        assertThatThrownBy(() -> runtime.setBidder(AuctionSettings.DEFAULTS))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void cancellareLAstaApertaPrimaLaChiude() {
        String id = runtime.createNew(setup("Prima", 300, people(3), 9));
        runtime.delete(id);
        assertThat(runtime.hasAuction()).isFalse();
        assertThat(runtime.auctions()).isEmpty();
        assertThat(tmp.resolve("auctions-cestino")).isDirectoryContaining(p ->
                p.getFileName().toString().startsWith(id + "-"));
    }

    @Test
    void cancellareUnAltraAstaLasciaApertaQuellaCorrente() {
        String prima = runtime.createNew(setup("Prima", 300, people(3), 9));
        String seconda = runtime.createNew(setup("Seconda", 300, people(3), 9));
        runtime.delete(prima);
        assertThat(runtime.currentAuctionId()).isEqualTo(seconda);
    }

    @Test
    void cancellareUnAstaInesistenteVieneRifiutato() {
        assertThatThrownBy(() -> runtime.delete("nessuna")).isInstanceOf(IllegalArgumentException.class);
    }

    /** /legacy crea ancora con il solo nome: dal modello. */
    @Test
    void creareColSoloNomeUsaIlModello() {
        String id = runtime.createNew("Legacy");
        assertThat(runtime.rules().budget()).isEqualTo(100);
        assertThat(archive.rules(id)).contains(template.rules);
    }
}
```

Correggere il refuso nel nome `creareNonTocicaIlModello` → `creareNonToccaIlModello` scrivendo il test. `AuctionRuntimeTest.scoringSettings()` è un nuovo metodo statico package-private: `return ScoringSettings.from(scoring(), true);` (rendere `scoring()` statico se non lo è già — lo è).

- [ ] **Step 2: Run to verify failure**

Run: `mvn -q test -Dtest=AuctionRuntimePerAuctionTest`
Expected: compilazione fallita.

- [ ] **Step 3: Implement**

`AuctionTemplate.java`:

```java
package com.fantaagent.application.port.out;

import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.LeagueRulesSettings;
import com.fantaagent.config.ScoringSettings;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.league.ScoringRules;

import java.util.List;

/**
 * Il modello da cui parte un'asta, e il ripiego per le aste che non hanno un file.
 *
 * <p>Riletto a ogni chiamata, non fotografato all'avvio: le pagine /legacy riscrivono
 * ancora i file globali, e il modello deve dire quello che c'e' su disco adesso.
 */
public interface AuctionTemplate {

    LeagueRulesSettings rules();

    List<Participant> participants();

    ScoringSettings scoring();

    AuctionSettings bidder();

    /** Le regole di punteggio del dominio: la sigma delle medie e' configurazione. */
    ScoringRules scoringRules(ScoringSettings settings);
}
```

`AuctionSetup.java`:

```java
package com.fantaagent.application.service;

import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.LeagueRulesSettings;
import com.fantaagent.config.ScoringSettings;
import com.fantaagent.domain.league.Participant;

import java.util.List;
import java.util.Objects;

/** Tutto cio' che serve a creare un'asta, gia' validato da chi la chiede. */
public record AuctionSetup(String name, LeagueRulesSettings rules, List<Participant> participants,
                           ScoringSettings scoring, AuctionSettings bidder) {

    public AuctionSetup {
        Objects.requireNonNull(rules, "rules");
        Objects.requireNonNull(scoring, "scoring");
        Objects.requireNonNull(bidder, "bidder");
        participants = List.copyOf(participants);
    }
}
```

`ConfigAuctionTemplate.java` (in `config`):

```java
package com.fantaagent.config;

import com.fantaagent.application.port.out.AuctionTemplate;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.league.ScoringRules;

import java.util.EnumMap;
import java.util.List;

/**
 * Il modello letto da application.yml e dai file globali in data-dir: i valori con cui
 * si giocava prima che ogni asta avesse i suoi. In sola lettura per la SPA.
 */
public class ConfigAuctionTemplate implements AuctionTemplate {

    private final LeagueProperties props;
    private final ScoringSettingsStore scoringStore;
    private final LeagueMembersSettingsStore membersStore;
    private final AuctionSettingsStore auctionStore;

    public ConfigAuctionTemplate(LeagueProperties props, ScoringSettingsStore scoringStore,
                                 LeagueMembersSettingsStore membersStore,
                                 AuctionSettingsStore auctionStore) {
        this.props = props;
        this.scoringStore = scoringStore;
        this.membersStore = membersStore;
        this.auctionStore = auctionStore;
    }

    @Override
    public LeagueRulesSettings rules() {
        return new LeagueRulesSettings(props.budget(), new EnumMap<>(props.slots()));
    }

    @Override
    public List<Participant> participants() {
        return BeanConfig.loadParticipants(props, membersStore);
    }

    @Override
    public ScoringSettings scoring() {
        return scoringStore.load().orElseGet(() ->
                ScoringSettings.from(SettingsConfig.loadScoringRules(scoringStore, props), true));
    }

    @Override
    public AuctionSettings bidder() {
        return auctionStore.load().orElse(AuctionSettings.DEFAULTS);
    }

    @Override
    public ScoringRules scoringRules(ScoringSettings settings) {
        return settings.toScoringRules(props.scoring().matchdayRatingSigma());
    }
}
```

Nota: oggi il ripiego del punteggio senza file globale passa da `SettingsConfig.loadScoringRules`, che senza file restituisce `fromProperties(props)`. `scoringRules(scoring())` in quel caso deve dare le stesse regole di prima: `ScoringSettings.from(rules, true).toScoringRules(sigma)` — verificare in `ScoringSettingsTest` o con un test piccolo in `ConfigAuctionTemplateTest` che il giro di andata e ritorno conservi assist, bonus e tabella difesa. Se non le conserva (per esempio il modificatore del portiere), il caricatore del runtime deve usare `loadScoringRules` direttamente quando l'asta non ha `league-settings.yml` e il modello non ha file: annotarlo nel report del task.

`RuntimeSnapshot`: firma `(String auctionId, AuctionEventStore store, List<Participant> participants, LeagueRules rules, ScoringSettings scoring, AuctionSettings bidder, ValuationChain chain)`, tutti non null tranne `auctionId`/`store` (vincolo esistente).

`AuctionRuntime` — sostituire campi e costruttore:

```java
    private final PlayerCatalog catalog;
    private final List<Double> seasonWeights;
    private final List<Role> phases;
    private final AuctionTemplate template;
    private final AuctionArchive archive;
    private volatile RuntimeSnapshot current;

    public AuctionRuntime(PlayerCatalog catalog, List<Double> seasonWeights, List<Role> phases,
                          AuctionTemplate template, AuctionArchive archive) {
        this.catalog = catalog;
        this.seasonWeights = List.copyOf(seasonWeights);
        this.phases = List.copyOf(phases);
        this.template = template;
        this.archive = archive;
        this.current = snapshotOf(null);
    }

    /**
     * Lo snapshot di un'asta, o del modello con id null. Ogni parte viene dall'asta se
     * ha il suo file, altrimenti dal modello: le aste create prima dei file nuovi
     * ricadono sui valori con cui sono state giocate.
     */
    private RuntimeSnapshot snapshotOf(String auctionId) {
        if (auctionId == null) {
            return build(null, null, template.participants(), template.rules(),
                    template.scoring(), template.bidder());
        }
        return build(auctionId, archive.open(auctionId),
                archive.participants(auctionId).orElseGet(template::participants),
                archive.rules(auctionId).orElseGet(template::rules),
                archive.scoring(auctionId).orElseGet(template::scoring),
                archive.bidder(auctionId).orElseGet(template::bidder));
    }

    private RuntimeSnapshot build(String auctionId, AuctionEventStore store,
                                  List<Participant> participants, LeagueRulesSettings rulesSettings,
                                  ScoringSettings scoring, AuctionSettings bidder) {
        LeagueRules rules = rulesSettings.toRules(participants.size(), phases);
        ValuationChain chain = ValuationChain.build(rules, template.scoringRules(scoring),
                catalog, seasonWeights);
        return new RuntimeSnapshot(auctionId, store, participants, rules, scoring, bidder, chain);
    }
```

Metodi:

```java
    public synchronized void select(String auctionId) {
        if (!archive.exists(auctionId)) {
            throw new IllegalArgumentException("nessuna asta con identificativo " + auctionId);
        }
        current = snapshotOf(auctionId);
    }

    public synchronized String createNew(AuctionSetup setup) {
        String id = freeId(LocalDate.now().toString());
        // Il registro per ULTIMO: auctionIds() elenca solo le cartelle con events.jsonl,
        // quindi un errore su uno dei file prima lascia una cartella che la home non
        // mostra e che freeId non riusa.
        archive.saveParticipants(id, setup.participants());
        archive.saveScoring(id, setup.scoring());
        archive.saveRules(id, setup.rules());
        archive.saveBidder(id, setup.bidder());
        AuctionEventStore store = archive.open(id);
        store.appendWithNextSeq(seq -> new AuctionEvent.AuctionStarted(seq, Instant.now(), setup.name()));
        current = build(id, store, setup.participants(), setup.rules(), setup.scoring(), setup.bidder());
        return id;
    }

    /** Solo per /legacy, che non conosce le regole: crea dal modello. */
    public synchronized String createNew(String name) {
        return createNew(new AuctionSetup(name, template.rules(), template.participants(),
                template.scoring(), template.bidder()));
    }

    public synchronized void deselect() {
        current = snapshotOf(null);
    }

    public synchronized void setParticipants(List<Participant> participants) {
        RuntimeSnapshot base = current;
        if (base.auctionId() != null) {
            archive.saveParticipants(base.auctionId(), participants);
        }
        current = build(base.auctionId(), base.store(), participants,
                LeagueRulesSettings.from(base.rules()), base.scoring(), base.bidder());
    }

    public synchronized void setBidder(AuctionSettings bidder) {
        RuntimeSnapshot base = current;
        if (base.auctionId() == null) {
            throw new IllegalStateException("nessuna asta aperta a cui dare le preferenze del battitore");
        }
        archive.saveBidder(base.auctionId(), bidder);
        current = new RuntimeSnapshot(base.auctionId(), base.store(), base.participants(),
                base.rules(), base.scoring(), bidder, base.chain());
    }

    public synchronized void delete(String auctionId) {
        if (!archive.exists(auctionId)) {
            throw new IllegalArgumentException("nessuna asta con identificativo " + auctionId);
        }
        if (auctionId.equals(current.auctionId())) {
            current = snapshotOf(null);
        }
        archive.delete(auctionId);
    }

    /** Rilegge dall'archivio e dal modello l'asta corrente. Usato da /legacy. */
    public synchronized void rebuild() {
        current = snapshotOf(current.auctionId());
    }

    public LeagueRules rules() { return current.rules(); }
    public ScoringSettings scoringSettings() { return current.scoring(); }
    public AuctionSettings bidder() { return current.bidder(); }
    public List<Participant> participants() { return current.participants(); }
```

`setParticipants` con una lista di lunghezza diversa ricostruisce regole e catena: è il comportamento corretto per `/legacy` e per la preparazione; la SPA ad asta aperta lo impedisce a monte (Task 5).

`auctions()`: `lastPhase(events, phases.getFirst())`.

Rimuovere i campi `rules`, `scoringLoader`, `participantsLoader`, `scoringSnapshot`, il metodo `participantsOf` e il loro javadoc; tenere nel javadoc di classe il paragrafo sull'atomicità e aggiornare quello su `createNew` (niente più «copia le regole in vigore»).

`BeanConfig`:

```java
    @Bean
    public LeagueRules leagueRules(LeagueProperties props, List<Participant> participants) {
        // Il valore PREDEFINITO: le squadre sono i partecipanti del modello. Serve alla
        // validazione d'avvio; le regole in uso stanno nello snapshot del runtime.
        return new LeagueRules(participants.size(), props.budget(), props.slots(), props.phases());
    }

    @Bean
    public AuctionTemplate auctionTemplate(LeagueProperties props, ScoringSettingsStore scoringStore,
                                           LeagueMembersSettingsStore membersStore,
                                           AuctionSettingsStore auctionStore) {
        return new ConfigAuctionTemplate(props, scoringStore, membersStore, auctionStore);
    }

    @Bean
    public AuctionRuntime auctionRuntime(PlayerCatalog catalog, LeagueProperties props,
                                         AuctionTemplate template, AuctionArchive archive) {
        return new AuctionRuntime(catalog, props.scoring().seasonWeights(), props.phases(),
                template, archive);
    }
```

(con gli import al posto dei nomi qualificati, se il file li usa già; altrimenti seguire lo stile qualificato del file.)

`LeagueProperties`: togliere `int participants`. `application.yml`: togliere `participants: 8` sotto `league:` (e da ogni yml di test che lo imposti: `grep -rn "participants:" src/test/resources src/main/resources`). `StartupValidator`: togliere il primo controllo (partecipanti ≠ `league.participants`); il resto invariato. `StartupValidatorTest`: togliere il test che si aspettava quell'errore (quello con `participants(9)`), e dove costruisce `LeagueRules` usare `participants.size()`.

`AuctionRuntimeTest` e `AuctionRuntimeAtomicityTest`: costruire il runtime con `new AuctionRuntime(catalog, List.of(1.0), PHASES, template, archive)` usando `TestAuctionTemplate`. I test che oggi passano loader lambda per distinguere due aste (bonus gol diverso, partecipanti «globali» che cambiano) si riscrivono cambiando i campi del template fra una creazione e l'altra: il significato del test resta — configurare la seconda asta non cambia i numeri né i nomi della prima. `createNew("x")` nei test esistenti può restare (usa il modello). `AuctionRuntimeAtomicityTest.ilRuntimeHaUnSoloCampoMutabileEdEVolatile` deve restare verde senza modifiche alla sua logica.

- [ ] **Step 4: Run all Java tests**

Run: `mvn -q test`
Expected: PASS. Mutazioni da provare, una alla volta: (a) in `createNew(AuctionSetup)` spostare l'append dell'evento in cima → `seUnFilePrimaDelRegistroFallisce...` fallisce; (b) in `snapshotOf` usare `template.rules()` anche per un'asta con file → `ogniAstaHaLeSueRegole...` fallisce; (c) in `delete` togliere il ramo che chiude l'asta corrente → `cancellareLAstaApertaPrimaLaChiude` fallisce.

Controllo `/legacy`: `git diff main -- src/main/java/com/fantaagent/adapter/in/web src/test/java/com/fantaagent/adapter/in/web` vuoto.

- [ ] **Step 5: Commit**

```bash
git add src/main src/test
git commit -m "Il runtime carica regole, punteggio e battitore dall'asta, con il modello come ripiego"
```

---

### Task 5: API — impostazioni per asta, battitore, export su disco, cancellazione

**Files:**
- Modify: `src/main/java/com/fantaagent/adapter/in/api/dto/SettingsDtos.java`
- Modify: `src/main/java/com/fantaagent/adapter/in/api/SettingsApi.java`
- Modify: `src/main/java/com/fantaagent/adapter/in/api/board/PublicBidderApi.java`
- Modify: `src/main/java/com/fantaagent/adapter/in/api/ExportApi.java`
- Modify: `src/main/java/com/fantaagent/adapter/in/api/AuctionsApi.java`
- Modify: `src/test/java/com/fantaagent/adapter/in/api/{SettingsApiTest,SettingsApiCreationTest,SettingsBodies,ExportApiTest,AuctionsApiTest}.java`, `board/PublicBidderApiTest.java`

**Interfaces:**
- Consumes: Task 1, 4 (`AuctionRuntime.createNew(AuctionSetup)`, `setBidder`, `setParticipants`, `delete`, `rules()`, `scoringSettings()`, `bidder()`, `participants()`, `hasAuction()`; `AuctionTemplate`).
- Produces (JSON, per il Task 6):
  - `SettingsDtos.RulesSection(int budget, Map<Role, Integer> slots)`
  - `SaveRequest(String auctionName, BidderSettings bidder, List<ParticipantSettings> participants, ScoringSection scoring, RulesSection rules)`
  - `SettingsResponse.rules` resta `LeagueRulesView(int participants, int budget, Map<Role,Integer> slots)`, ora dello snapshot.
  - `DELETE /api/leagues/{leagueId}/auctions/{auctionId}` → 204; 404 `unknown-auction`.
  - `GET …/export.csv` scrive anche `rose.csv`.

- [ ] **Step 1: Write the failing tests**

In `SettingsApiCreationTest` (runtime finto) aggiungere/sostituire:

```java
    @Test
    void inPreparazioneCreaLAstaConRegolePartecipantiPunteggioEBattitore() throws Exception {
        when(runtime.hasAuction()).thenReturn(false);
        when(runtime.createNew(any(AuctionSetup.class))).thenReturn("2026-09-17");

        mvc.perform(put(URL).contentType(MediaType.APPLICATION_JSON)
                        .content(SettingsBodies.valid("Serata", 400, Map.of("P", 2, "D", 7, "C", 7, "A", 5))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.auctionId").value("2026-09-17"));

        ArgumentCaptor<AuctionSetup> captor = ArgumentCaptor.forClass(AuctionSetup.class);
        verify(runtime).createNew(captor.capture());
        assertThat(captor.getValue().name()).isEqualTo("Serata");
        assertThat(captor.getValue().rules().budget()).isEqualTo(400);
        assertThat(captor.getValue().rules().slots()).containsEntry(Role.D, 7);
        verify(runtime, never()).setParticipants(anyList());
        verify(runtime, never()).setBidder(any());
    }

    @Test
    void salvareNonScriveNessunFileGlobale() throws Exception {
        when(runtime.hasAuction()).thenReturn(false);
        when(runtime.createNew(any(AuctionSetup.class))).thenReturn("2026-09-17");
        mvc.perform(put(URL).contentType(MediaType.APPLICATION_JSON)
                        .content(SettingsBodies.valid("Serata", 500, Map.of("P", 3, "D", 8, "C", 8, "A", 6))))
                .andExpect(status().isOk());
        // SettingsApi non dipende piu' dagli store globali: se tornasse a scriverli,
        // dovrebbe tornare a riceverli nel costruttore, e questo test lo vedrebbe.
        assertThat(SettingsApi.class.getConstructors()[0].getParameterTypes())
                .doesNotContain(ScoringSettingsStore.class, LeagueMembersSettingsStore.class,
                        AuctionSettingsStore.class, AuctionSettingsHolder.class);
    }

    @Test
    void adAstaApertaAggiornaNomiEBattitoreEIgnoraLeRegole() throws Exception {
        when(runtime.hasAuction()).thenReturn(true);
        when(runtime.participants()).thenReturn(SettingsBodies.PARTICIPANTS);

        mvc.perform(put(URL).contentType(MediaType.APPLICATION_JSON)
                        .content(SettingsBodies.valid("", 1, Map.of("P", 99, "D", 99, "C", 99, "A", 99))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.auctionId").doesNotExist());

        verify(runtime).setParticipants(anyList());
        verify(runtime).setBidder(any(AuctionSettings.class));
        verify(runtime, never()).createNew(any(AuctionSetup.class));
    }

    @Test
    void adAstaApertaUnPartecipanteInPiuVieneRifiutato() throws Exception {
        when(runtime.hasAuction()).thenReturn(true);
        when(runtime.participants()).thenReturn(SettingsBodies.PARTICIPANTS.subList(0, 2));

        mvc.perform(put(URL).contentType(MediaType.APPLICATION_JSON)
                        .content(SettingsBodies.valid("", 500, Map.of("P", 3, "D", 8, "C", 8, "A", 6))))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.participants[0]")
                        .value("Ad asta aperta non si aggiungono né si tolgono partecipanti."));
        verify(runtime, never()).setParticipants(anyList());
    }
```

In `SettingsApiTest` (runtime vero, profilo dev):

```java
    @Test
    void regoleFuoriLimiteTornanoSottoLaLoroChiave() throws Exception {
        mvc.perform(put(URL).contentType(MediaType.APPLICATION_JSON)
                        .content(SettingsBodies.valid("Serata", 0, Map.of("P", 0, "D", 8, "C", 8, "A", 31))))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.budget[0]")
                        .value("I crediti per squadra devono essere almeno 1: indicati 0."))
                .andExpect(jsonPath("$.errors['slots[P]']").exists())
                .andExpect(jsonPath("$.errors['slots[A]']").exists());
    }

    @Test
    void senzaRegoleInPreparazioneTornaUn422() throws Exception {
        mvc.perform(put(URL).contentType(MediaType.APPLICATION_JSON)
                        .content(SettingsBodies.withoutRules("Serata")))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.rules[0]").value("Le regole della lega sono obbligatorie."));
    }

    @Test
    void leRegoleLetteHannoSquadrePariAiPartecipanti() throws Exception {
        mvc.perform(get(URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rules.participants").value(runtime.participants().size()));
    }
```

`SettingsBodies`: aggiungere `valid(String name, int budget, Map<String,Integer> slots)`, `withoutRules(String name)` e la costante `PARTICIPANTS` (lista di `Participant` coerente con i partecipanti del corpo). Leggere il file esistente e riusarne la forma dei corpi; ogni corpo valido esistente guadagna `"rules": {"budget": 500, "slots": {"P":3,"D":8,"C":8,"A":6}}`.

`PublicBidderApiTest`: sostituire `@MockitoBean AuctionSettingsHolder settings` con `@MockitoBean AuctionRuntime runtime` e gli stub `when(settings.get())` con `when(runtime.bidder())`. `AuctionGuard` dipende da `AuctionService`, già mockato nel test.

`ExportApiTest`:

```java
    @Test
    void scaricareScriveAncheRoseCsvNellaCartellaDellAsta() throws Exception {
        // costruire il contesto come fanno i test esistenti del file; poi:
        MvcResult result = mvc.perform(get(URL)).andExpect(status().isOk()).andReturn();
        verify(archive).saveExport(eq(AUCTION_ID), eq(result.getResponse().getContentAsString(StandardCharsets.UTF_8)));
    }

    @Test
    void seLaScritturaSuDiscoFallisceIlDownloadParteComunque() throws Exception {
        doThrow(new UncheckedIOException(new IOException("disco pieno")))
                .when(archive).saveExport(anyString(), anyString());
        mvc.perform(get(URL)).andExpect(status().isOk());
    }
```

(`@MockitoBean AuctionArchive archive`; adattare `URL` e `AUCTION_ID` a come `ExportApiTest` costruisce oggi l'asta aperta.)

`AuctionsApiTest`:

```java
    @Test
    void cancellareUnAstaRisponde204() throws Exception {
        mvc.perform(delete("/api/leagues/default/auctions/2026-09-02"))
                .andExpect(status().isNoContent());
        verify(runtime).delete("2026-09-02");
    }

    @Test
    void cancellareUnAstaSconosciutaRisponde404Problem() throws Exception {
        doThrow(new IllegalArgumentException("nessuna")).when(runtime).delete("pippo");
        mvc.perform(delete("/api/leagues/default/auctions/pippo"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.type").value("https://fantaagent.local/problems/unknown-auction"));
    }
```

- [ ] **Step 2: Run to verify failure**

Run: `mvn -q test -Dtest='SettingsApi*Test,PublicBidderApiTest,ExportApiTest,AuctionsApiTest'`
Expected: FAIL / compilazione fallita.

- [ ] **Step 3: Implement**

`SettingsDtos`: aggiungere `public record RulesSection(int budget, Map<Role, Integer> slots) { }`, il campo `RulesSection rules` in coda a `SaveRequest`, e `LeagueRulesView.from(LeagueRules)` invariato.

`SettingsApi` — dipendenze: `LeagueGuard`, `AuctionRuntime`. Nient'altro.

```java
    @GetMapping
    public SettingsDtos.SettingsResponse read(@PathVariable String leagueId) {
        leagues.check(leagueId);
        AuctionSettings bidder = runtime.bidder();
        return new SettingsDtos.SettingsResponse(
                new SettingsDtos.BidderSettings(bidder.bidTimerSeconds(), bidder.beepEnabled()),
                runtime.participants().stream().map(SettingsApi::cardOf).toList(),
                sectionOf(runtime.scoringSettings()),
                runtime.hasAuction(),
                SettingsDtos.LeagueRulesView.from(runtime.rules()));
    }
```

`save`: mantenere la raccolta errori esistente per nome, punteggio, partecipanti, battitore; poi:

```java
        LeagueRulesSettings rules = null;
        if (preparing) {
            if (body.rules() == null) {
                addError(errors, "rules", "Le regole della lega sono obbligatorie.");
            } else {
                rules = new LeagueRulesSettings(body.rules().budget(), rolesOf(body.rules().slots()));
                mergeErrors(errors, LeagueRulesValidator.validateByField(rules, members.size()));
            }
        } else if (!sameIds(members, runtime.participants())) {
            // Il numero di squadre e' il numero di partecipanti: aggiungerne o toglierne
            // uno a meta' serata ricalcolerebbe budget e rose gia' pagate. L'interfaccia
            // non lo offre; il server non si fida.
            addError(errors, "participants", "Ad asta aperta non si aggiungono né si tolgono partecipanti.");
        }

        if (!errors.isEmpty()) {
            throw new InvalidSettingsException(errors);
        }

        if (preparing) {
            return new SettingsDtos.SaveResult(runtime.createNew(
                    new AuctionSetup(name, rules, members, scoring, bidder)));
        }
        runtime.setParticipants(members);
        runtime.setBidder(bidder);
        return new SettingsDtos.SaveResult(null);
```

con

```java
    /** Una mappa assente o con un ruolo mancante diventa un ruolo a zero, che il validatore nomina. */
    private static Map<Role, Integer> rolesOf(Map<Role, Integer> slots) {
        Map<Role, Integer> out = new EnumMap<>(Role.class);
        for (Role role : Role.values()) {
            out.put(role, slots == null ? 0 : slots.getOrDefault(role, 0));
        }
        return out;
    }

    private static boolean sameIds(List<Participant> a, List<Participant> b) {
        return a.stream().map(Participant::id).collect(Collectors.toSet())
                .equals(b.stream().map(Participant::id).collect(Collectors.toSet()))
                && a.size() == b.size();
    }
```

Togliere `currentScoring()`, `defenceActive()`, i campi e gli import degli store e di `AuctionSettingsHolder`, `LeagueRules` iniettato. Aggiornare il commento sulla «configurazione generale come modello»: ora il modello non si scrive.

`PublicBidderApi`: dipendenza `AuctionRuntime runtime` al posto di `AuctionSettingsHolder`; `AuctionSettings current = runtime.bidder();`.

`ExportApi`: aggiungere `AuctionArchive archive` al costruttore;

```java
        String csvText = RosterCsvExporter.toCsv(auction);
        byte[] csv = csvText.getBytes(StandardCharsets.UTF_8);
        try {
            archive.saveExport(auction.auctionId(), csvText);
        } catch (RuntimeException e) {
            // Scaricare e' cio' che l'utente ha chiesto; il file su disco e' una copia.
            log.warn("export dell'asta {} non salvato su disco: {}", auction.auctionId(), e.getMessage(), e);
        }
```

(`private static final Logger log = LoggerFactory.getLogger(ExportApi.class);`)

`AuctionsApi`:

```java
    @DeleteMapping("/{auctionId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String leagueId, @PathVariable String auctionId) {
        leagues.check(leagueId);
        try {
            runtime.delete(auctionId);
        } catch (IllegalArgumentException e) {
            throw new UnknownAuctionException(auctionId, e);
        }
    }
```

Se `ApiProblemShapeTest` o un test di copertura delle rotte elenca i metodi HTTP ammessi, aggiungere `DELETE` lì.

- [ ] **Step 4: Run all Java tests**

Run: `mvn -q test`
Expected: PASS. Mutazioni: (a) togliere il controllo `sameIds` → il test del partecipante in più fallisce; (b) togliere il `try/catch` in `ExportApi` → il test del disco pieno fallisce; (c) in `AuctionsApi.delete` non tradurre l'eccezione → il test 404 fallisce.

Controllo `/legacy`: diff vuoto come nei vincoli globali.

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/fantaagent/adapter/in/api src/test/java/com/fantaagent/adapter/in/api
git commit -m "API: impostazioni e battitore dell'asta, regole al salvataggio, rose.csv su disco, DELETE di un'asta"
```

---

### Task 6: «Crea asta» — Regole della lega con − e +

**Files:**
- Create: `frontend/src/domain/StepperField.tsx`, `frontend/src/domain/StepperField.test.tsx`
- Create: `frontend/src/domain/LeagueRulesFieldset.tsx`, `frontend/src/domain/LeagueRulesFieldset.test.tsx`
- Delete: `frontend/src/domain/ConfigChips.tsx`, `frontend/src/domain/ConfigChips.test.tsx`
- Modify: `frontend/src/api/types.ts`
- Modify: `frontend/src/routes/SettingsRoute.tsx`, `frontend/src/routes/SettingsRoute.test.tsx`
- Modify: `frontend/src/domain/ParticipantsFieldset.tsx`, `frontend/src/domain/ParticipantsFieldset.test.tsx`

**Interfaces:**
- Consumes (Task 5): `SaveSettingsRequest.rules: { budget: number; slots: Record<Role, number> }`; errori con chiavi `budget`, `slots[P]`…`slots[A]`, `rules`, `participants`.
- Produces:
  - `export interface RulesSection { budget: number; slots: Record<Role, number> }`; `SaveSettingsRequest.rules: RulesSection`.
  - `StepperField({ id, value, onChange, min, max, step, decreaseLabel, increaseLabel, disabled?, describedBy?, invalid? })`.
  - `LeagueRulesFieldset({ value, onChange, participants, errors, disabled })`.
  - `ParticipantsFieldset` guadagna `lockCount?: boolean`: se vero, niente «Aggiungi partecipante» né X.

- [ ] **Step 1: Write the failing tests**

`StepperField.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { StepperField } from './StepperField';

function Harness({ initial = 10 }: { initial?: number }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <label htmlFor="f">Crediti</label>
      <StepperField
        id="f"
        value={value}
        onChange={setValue}
        min={1}
        max={30}
        step={5}
        decreaseLabel="Meno crediti"
        increaseLabel="Più crediti"
      />
    </>
  );
}

describe('StepperField', () => {
  it('− e + cambiano il valore del passo', async () => {
    render(<Harness />);
    const field = screen.getByLabelText('Crediti');
    await userEvent.click(screen.getByRole('button', { name: 'Più crediti' }));
    expect(field).toHaveValue(15);
    await userEvent.click(screen.getByRole('button', { name: 'Meno crediti' }));
    await userEvent.click(screen.getByRole('button', { name: 'Meno crediti' }));
    expect(field).toHaveValue(5);
  });

  it('si ferma ai limiti invece di superarli, e disattiva il bottone', async () => {
    render(<Harness initial={28} />);
    await userEvent.click(screen.getByRole('button', { name: 'Più crediti' }));
    expect(screen.getByLabelText('Crediti')).toHaveValue(30);
    expect(screen.getByRole('button', { name: 'Più crediti' })).toBeDisabled();
  });

  it('il campo resta scrivibile', async () => {
    render(<Harness />);
    const field = screen.getByLabelText('Crediti');
    await userEvent.clear(field);
    await userEvent.type(field, '1');
    expect(field).toHaveValue(1);
    expect(screen.getByRole('button', { name: 'Meno crediti' })).toBeDisabled();
  });
});
```

`LeagueRulesFieldset.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { RulesSection } from '../api/types';
import { LeagueRulesFieldset } from './LeagueRulesFieldset';

const RULES: RulesSection = { budget: 500, slots: { P: 3, D: 8, C: 8, A: 6 } };

function Harness({ disabled = false, onValue }: { disabled?: boolean; onValue?: (r: RulesSection) => void }) {
  const [value, setValue] = useState(RULES);
  return (
    <LeagueRulesFieldset
      value={value}
      onChange={(next) => { setValue(next); onValue?.(next); }}
      participants={7}
      errors={{}}
      disabled={disabled}
    />
  );
}

describe('LeagueRulesFieldset', () => {
  it('crediti a passi di 10 e slot a passi di 1', async () => {
    let last: RulesSection | null = null;
    render(<Harness onValue={(r) => { last = r; }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Dieci crediti in più' }));
    expect(screen.getByLabelText('Crediti per squadra')).toHaveValue(510);
    await userEvent.click(screen.getByRole('button', { name: 'Uno slot in meno: difensori' }));
    expect(last!.slots.D).toBe(7);
  });

  it('le squadre sono i partecipanti, in sola lettura', () => {
    render(<Harness />);
    const group = screen.getByRole('group', { name: 'Regole della lega' });
    expect(within(group).getByText('7')).toBeInTheDocument();
    expect(within(group).getByText('squadre')).toBeInTheDocument();
    expect(within(group).queryByLabelText(/squadre/i)).not.toBeInTheDocument();
  });

  it('ad asta aperta i campi sono bloccati e dicono perche', () => {
    render(<Harness disabled />);
    const budget = screen.getByLabelText('Crediti per squadra');
    expect(budget).toBeDisabled();
    expect(budget).toHaveAccessibleDescription(
      'Asta in corso: crediti, slot e numero di squadre sono bloccati, perché cambiarli ricalcolerebbe budget e rose già pagate.',
    );
    expect(screen.getByRole('button', { name: 'Dieci crediti in più' })).toBeDisabled();
  });

  it('un errore di slot sta accanto al suo campo', () => {
    render(
      <LeagueRulesFieldset
        value={RULES}
        onChange={() => {}}
        participants={7}
        errors={{ 'slots[P]': ['Gli slot dei portieri devono essere fra 1 e 30: indicati 0.'] }}
        disabled={false}
      />,
    );
    expect(screen.getByLabelText(/slot.*portieri/i)).toHaveAccessibleDescription(/fra 1 e 30/);
  });
});
```

In `ParticipantsFieldset.test.tsx`:

```tsx
  it('con lockCount non si aggiungono né si tolgono righe, ma i nomi restano modificabili', () => {
    render(
      <ParticipantsFieldset
        value={[{ id: 'anna', name: 'Anna', initial: 'A', me: true }]}
        onChange={() => {}}
        errors={{}}
        lockCount
      />,
    );
    expect(screen.queryByRole('button', { name: /aggiungi partecipante/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Togli Anna' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Nome del partecipante')).not.toBeDisabled();
  });
```

In `SettingsRoute.test.tsx`: aggiornare il salvataggio atteso (il corpo PUT contiene `rules: { budget: 500, slots: {...} }` da `SETTINGS.rules`) e aggiungere:

```tsx
  it('il salvataggio invia le regole modificate', async () => {
    const put = vi.fn(() => Promise.resolve(jsonResponse({ auctionId: null })));
    renderSettings(put);
    await userEvent.click(await screen.findByRole('button', { name: 'Dieci crediti in più' }));
    await userEvent.type(screen.getByLabelText("Nome dell'asta"), 'Serata');
    await userEvent.click(screen.getByRole('button', { name: /salva/i }));
    // leggere il corpo come fanno gli altri test del file che ispezionano la PUT
    expect(lastPutBody().rules.budget).toBe(510);
  });

  it('ad asta aperta non si aggiungono partecipanti', async () => {
    // come il test esistente "ad asta aperta i parametri di punteggio sono bloccati"
    expect(await screen.findByLabelText('Crediti per squadra')).toBeDisabled();
    expect(screen.queryByRole('button', { name: /aggiungi partecipante/i })).not.toBeInTheDocument();
  });
```

Adattare `renderSettings`/`lastPutBody` agli helper realmente presenti nel file (leggerlo prima); se l'ispezione della PUT non ha un helper, estrarre il corpo da `fetchMock.mock.calls` filtrando `method === 'PUT'` e `JSON.parse(init.body)`.

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && npx vitest run src/domain/StepperField.test.tsx src/domain/LeagueRulesFieldset.test.tsx src/domain/ParticipantsFieldset.test.tsx src/routes/SettingsRoute.test.tsx`
Expected: FAIL (moduli mancanti).

- [ ] **Step 3: Implement**

`types.ts`:

```ts
/** Crediti e slot che l'utente sceglie per l'asta che sta creando. Le squadre no: sono i partecipanti. */
export interface RulesSection {
  budget: number;
  slots: Record<Role, number>;
}
```

`SaveSettingsRequest` guadagna `rules: RulesSection`. Aggiornare il commento di `LeagueRulesView`: non più «di sola lettura, il server non li scrive» ma «le regole dell'asta aperta, o del modello; `participants` è calcolato».

`StepperField.tsx` — estratto dal countdown di `SettingsRoute` (stesse classi `STEP_BUTTON` e del campo):

```tsx
import { NumberField } from './NumberField';

const STEP_BUTTON =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line-strong text-xl font-bold hover:bg-line disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent';

/**
 * Un numero con − e + ai lati: si regola senza tastiera, a passi, dentro limiti che
 * rispecchiano quelli del validatore lato server. Il campo resta scrivibile; i
 * bottoni si fermano ai limiti invece di superarli.
 */
export function StepperField({
  id, value, onChange, min, max, step = 1, decreaseLabel, increaseLabel,
  disabled = false, describedBy, invalid = false,
}: {
  id: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  decreaseLabel: string;
  increaseLabel: string;
  disabled?: boolean;
  describedBy?: string;
  invalid?: boolean;
}) {
  const set = (next: number) => onChange(Math.min(max, Math.max(min, next)));
  return (
    <div className="mt-1 flex items-center gap-2">
      <button type="button" aria-label={decreaseLabel} disabled={disabled || value <= min}
        onClick={() => set(value - step)} className={STEP_BUTTON}>
        <span aria-hidden="true">−</span>
      </button>
      <NumberField
        id={id}
        value={value}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onChange={onChange}
        className="tnum block min-h-11 w-full min-w-0 flex-1 rounded-full border border-line-strong bg-transparent px-4 text-center font-bold disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      />
      <button type="button" aria-label={increaseLabel} disabled={disabled || value >= max}
        onClick={() => set(value + step)} className={STEP_BUTTON}>
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}
```

In `SettingsRoute.tsx` il countdown usa `StepperField` (`min={MIN_TIMER_SECONDS}`, `max={MAX_TIMER_SECONDS}`, etichette «Un secondo in meno»/«Un secondo in più», `invalid`/`describedBy` dagli errori del timer); togliere `STEP_BUTTON`, `setBidTimer` e `loaded` da lì. I test esistenti del countdown non cambiano.

`LeagueRulesFieldset.tsx`:

```tsx
import { useId } from 'react';
import type { Role, RulesSection } from '../api/types';
import { FieldErrors } from './FieldErrors';
import { RoleBadge } from './RoleBadge';
import { ROLES, ROLE_NAME_PLURAL } from './roles';
import { StepperField } from './StepperField';

/** I minimi e il massimo degli slot sono quelli di LeagueRulesValidator. */
const MIN_BUDGET = 1;
/** Solo dell'interfaccia: il server non ha un massimo, ma il + deve fermarsi da qualche parte. */
const MAX_BUDGET = 9999;
const MIN_SLOTS = 1;
const MAX_SLOTS = 30;

const LOCK_TEXT =
  'Asta in corso: crediti, slot e numero di squadre sono bloccati, perché cambiarli ricalcolerebbe budget e rose già pagate.';

/**
 * Le regole della lega per l'asta che si sta creando. Le squadre non sono un campo:
 * sono i partecipanti, e cambiano mentre se ne aggiungono o tolgono righe.
 */
export function LeagueRulesFieldset({
  value, onChange, participants, errors, disabled,
}: {
  value: RulesSection;
  onChange: (next: RulesSection) => void;
  participants: number;
  errors: Record<string, string[]>;
  disabled: boolean;
}) {
  const baseId = useId();
  const lockId = `${baseId}-lock`;
  const describe = (key: string) =>
    disabled ? lockId : (errors[key]?.length ?? 0) > 0 ? `${baseId}-${key}` : undefined;

  return (
    <fieldset className="m-0 space-y-3 border-0 p-0">
      <legend className="text-sm font-bold text-muted-foreground">Regole della lega</legend>
      {disabled ? <p id={lockId} className="text-sm text-muted-foreground">{LOCK_TEXT}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label htmlFor={`${baseId}-budget`} className="block text-sm">Crediti per squadra</label>
          <StepperField
            id={`${baseId}-budget`}
            value={value.budget}
            onChange={(budget) => onChange({ ...value, budget })}
            min={MIN_BUDGET}
            max={MAX_BUDGET}
            step={10}
            decreaseLabel="Dieci crediti in meno"
            increaseLabel="Dieci crediti in più"
            disabled={disabled}
            describedBy={describe('budget')}
            invalid={!disabled && (errors.budget?.length ?? 0) > 0}
          />
          <FieldErrors id={`${baseId}-budget`} errors={errors.budget ?? []} />
        </div>

        {ROLES.map((role: Role) => {
          const key = `slots[${role}]`;
          const name = ROLE_NAME_PLURAL[role];
          return (
            <div key={role}>
              <label htmlFor={`${baseId}-${role}`} className="flex min-h-6 items-center gap-1.5 text-sm">
                Slot <RoleBadge role={role} /> <span className="sr-only">{name}</span>
              </label>
              <StepperField
                id={`${baseId}-${role}`}
                value={value.slots[role]}
                onChange={(n) => onChange({ ...value, slots: { ...value.slots, [role]: n } })}
                min={MIN_SLOTS}
                max={MAX_SLOTS}
                decreaseLabel={`Uno slot in meno: ${name}`}
                increaseLabel={`Uno slot in più: ${name}`}
                disabled={disabled}
                describedBy={describe(key)}
                invalid={!disabled && (errors[key]?.length ?? 0) > 0}
              />
              <FieldErrors id={`${baseId}-${key}`} errors={errors[key] ?? []} />
            </div>
          );
        })}

        <div className="flex items-end">
          <span className="tnum inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line-strong px-4 font-extrabold">
            {participants}
            <span className="font-normal text-muted-foreground">squadre</span>
          </span>
        </div>
      </div>
    </fieldset>
  );
}
```

Verificare in `roles.ts` il nome esatto della mappa dei plurali (`ROLE_NAME_PLURAL`: «portieri», «difensori», …) e in `RoleBadge` che il suo sr-only non raddoppi il nome nell'etichetta: se `RoleBadge` porta già il nome per esteso in sr-only, togliere lo `<span className="sr-only">{name}</span>` aggiunto qui e verificare il nome accessibile con il test `getByLabelText(/slot.*portieri/i)`. `FieldErrors` va chiamato con l'id che `describe` restituisce (`${baseId}-${key}`): allineare i due se il componente usa una firma diversa.

`SettingsRoute.tsx`:
- lo stato iniziale del modulo guadagna `rules: { budget: settings.data.rules.budget, slots: settings.data.rules.slots }`;
- `<ConfigChips rules={settings.data.rules} />` diventa `<LeagueRulesFieldset value={form.rules} onChange={(rules) => setForm({ ...form, rules })} participants={form.participants.length} errors={errors} disabled={auctionOpen} />`, in una riga propria sopra i partecipanti;
- `<ParticipantsFieldset ... lockCount={auctionOpen} />`;
- `FIELD_LABELS` guadagna `budget: 'crediti per squadra'`, `rules: 'regole della lega'`; `fieldLabel` riconosce `/^slots\[(P|D|C|A)]$/` → `slot ${ROLE_NAME_PLURAL[role]}`;
- togliere l'import di `ConfigChips` e cancellare i due file.

`ParticipantsFieldset.tsx`: prop `lockCount = false`; con `lockCount` non rendere la colonna azioni (né `<th>` né `<td>`) e «Aggiungi partecipante». Commento: il numero di squadre è il numero di partecipanti, e ad asta aperta non cambia.

`HomeRoute.test.tsx` e `SettingsRoute.test.tsx` hanno già `rules` nei dati: nessuna modifica oltre a quanto sopra.

- [ ] **Step 4: Run frontend suite**

Run: `cd frontend && npm test && npm run lint && npm run build`
Expected: PASS, lint 0 errori. Mutazioni: (a) in `StepperField.set` togliere il `Math.min(max, …)` → il test dei limiti fallisce; (b) in `SettingsRoute` passare `participants={8}` fisso → il test «le squadre sono i partecipanti» nel route (aggiungerne uno che aggiunge una riga e controlla il numero, se il test del fieldset da solo non lo copre) fallisce; (c) `lockCount` ignorato → il test dei partecipanti fallisce.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "Crea asta: regole della lega modificabili con − e +, squadre dai partecipanti, blocco ad asta aperta"
```

---

### Task 7: Cancellare un'asta dalla home, con conferma

**Files:**
- Create: `frontend/src/domain/DeleteAuctionDialog.tsx`, `frontend/src/domain/DeleteAuctionDialog.test.tsx`
- Modify: `frontend/src/api/client.ts`, `frontend/src/api/hooks.ts`
- Modify: `frontend/src/routes/HomeRoute.tsx`, `frontend/src/routes/HomeRoute.test.tsx`
- Modify: `frontend/src/setupTests.ts`

**Interfaces:**
- Consumes (Task 5): `DELETE /api/leagues/{leagueId}/auctions/{auctionId}` → 204; 404 `unknown-auction`.
- Produces:
  - `apiLeagueDelete(path: string): Promise<null>` in `client.ts`.
  - `useDeleteAuction()` in `hooks.ts`: `mutationFn: (auctionId: string) => apiLeagueDelete(\`/auctions/${encodeURIComponent(auctionId)}\`)`, `onSuccess: () => client.invalidateQueries()`.
  - `DeleteAuctionDialog({ auction, pending, error, onConfirm, onCancel })` dove `auction: AuctionCard | null` (null = chiusa), `error: string | null`.

- [ ] **Step 1: Polyfill and failing tests**

`setupTests.ts` — jsdom non implementa `showModal`/`close`:

```ts
import '@testing-library/jest-dom/vitest';

// jsdom non implementa la modale nativa. Il polyfill fa il minimo che i test
// osservano — l'attributo open — senza fingere il focus trap o l'inerzia dello
// sfondo, che restano del browser.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}
```

`DeleteAuctionDialog.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AuctionCard } from '../api/types';
import { DeleteAuctionDialog } from './DeleteAuctionDialog';

const AUCTION: AuctionCard = {
  id: '2026-09-02', label: 'Lega No Name', lastWritten: null, purchases: 3, phase: 'D', selected: false,
};

describe('DeleteAuctionDialog', () => {
  it('chiede conferma nominando asta, acquisti e cestino, con il focus su Annulla', () => {
    render(<DeleteAuctionDialog auction={AUCTION} pending={false} error={null} onConfirm={() => {}} onCancel={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'Eliminare «Lega No Name»?' });
    expect(dialog).toHaveTextContent('3 acquisti');
    expect(dialog).toHaveTextContent('res/auctions-cestino');
    expect(screen.getByRole('button', { name: 'Annulla' })).toHaveFocus();
  });

  it('Elimina conferma, Annulla ed Esc no', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<DeleteAuctionDialog auction={AUCTION} pending={false} error={null} onConfirm={onConfirm} onCancel={onCancel} />);

    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onConfirm).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Elimina' }));
    expect(onConfirm).toHaveBeenCalledWith('2026-09-02');
  });

  it('in corso dice Elimino… e non si ripreme', () => {
    render(<DeleteAuctionDialog auction={AUCTION} pending error={null} onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole('button', { name: 'Elimino…' })).toBeDisabled();
  });

  it("un errore resta dentro la modale come unico alert", () => {
    render(<DeleteAuctionDialog auction={AUCTION} pending={false} error="Asta non trovata." onConfirm={() => {}} onCancel={() => {}} />);
    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(screen.getByRole('dialog')).toContainElement(alerts[0]);
  });

  it('chiusa non rende niente di interattivo', () => {
    render(<DeleteAuctionDialog auction={null} pending={false} error={null} onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
```

In `HomeRoute.test.tsx`:

```tsx
  it('il cestino apre la conferma, e confermare cancella e ricarica', async () => {
    const fetchMock = vi.fn((input: RequestInfo, init?: RequestInit) => {
      if (init?.method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }));
      return Promise.resolve(json([CLOSED_AUCTION]));
    });
    vi.stubGlobal('fetch', fetchMock);
    renderHome();

    await userEvent.click(await screen.findByRole('button', { name: `Elimina ${CLOSED_AUCTION.label}` }));
    await userEvent.click(screen.getByRole('button', { name: 'Elimina' }));

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/leagues/default/auctions/${CLOSED_AUCTION.id}`,
      expect.objectContaining({ method: 'DELETE' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { level: 1, name: 'Le tue aste' })).toHaveFocus();
  });

  it('annullare non chiama il server', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json([CLOSED_AUCTION]));
    vi.stubGlobal('fetch', fetchMock);
    renderHome();
    await userEvent.click(await screen.findByRole('button', { name: `Elimina ${CLOSED_AUCTION.label}` }));
    await userEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
  });

  it('la card dell asta aperta non ha il cestino', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([OPEN_AUCTION])));
    renderHome();
    await screen.findByRole('button', { name: `Riprendi l'asta aperta, ${OPEN_AUCTION.label}` });
    expect(screen.getAllByRole('button', { name: /^Elimina / })).toHaveLength(1);
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && npx vitest run src/domain/DeleteAuctionDialog.test.tsx src/routes/HomeRoute.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

`client.ts`:

```ts
/** Gemello di {@link apiLeaguePost} per le cancellazioni: l'asta si toglie dall'archivio. */
export async function apiLeagueDelete(path: string): Promise<null> {
  return request<null>(leagueUrl(path), {
    method: 'DELETE',
    headers: { accept: 'application/json' },
  }) as Promise<null>;
}
```

(verificare che `request` gestisca un 204 senza corpo come fa per `select`.)

`hooks.ts`:

```ts
export function useDeleteAuction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (auctionId: string) =>
      apiLeagueDelete(`/auctions/${encodeURIComponent(auctionId)}`),
    // Nessun aggiornamento ottimistico: l'elenco si rilegge dal server.
    onSuccess: () => client.invalidateQueries(),
  });
}
```

`DeleteAuctionDialog.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import type { AuctionCard } from '../api/types';

/**
 * La conferma prima di cancellare un'asta.
 *
 * <p>{@code <dialog>} nativo aperto con showModal(): il browser intrappola il focus,
 * rende inerte lo sfondo e trasforma Esc in un evento cancel. Il focus parte da
 * «Annulla», non da «Elimina»: un Invio di troppo non deve cancellare niente.
 */
export function DeleteAuctionDialog({
  auction, pending, error, onConfirm, onCancel,
}: {
  auction: AuctionCard | null;
  pending: boolean;
  error: string | null;
  onConfirm: (auctionId: string) => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !auction) return;
    if (!dialog.open) dialog.showModal();
    cancelRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [auction]);

  if (!auction) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="delete-auction-title"
      onCancel={(e) => { e.preventDefault(); onCancel(); }}
      className="panel m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl p-6 text-foreground backdrop:bg-black/60"
    >
      <h2 id="delete-auction-title" className="w-exp text-lg font-extrabold">
        Eliminare «{auction.label}»?
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        <span className="tnum">{auction.purchases}</span> acquisti. L'asta sparisce dall'elenco e
        la sua cartella va nel cestino (res/auctions-cestino), da dove si può recuperare a mano.
      </p>
      {error ? (
        <p role="alert" className="mt-3 text-sm font-bold text-destructive">{error}</p>
      ) : null}
      <div className="mt-5 flex justify-end gap-3">
        <button ref={cancelRef} type="button" onClick={onCancel}
          className="min-h-11 rounded-full border border-line-strong px-5 font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
          Annulla
        </button>
        <button type="button" disabled={pending} onClick={() => onConfirm(auction.id)}
          className="min-h-11 rounded-full bg-destructive px-5 font-extrabold text-on-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground">
          {pending ? 'Elimino…' : 'Elimina'}
        </button>
      </div>
    </dialog>
  );
}
```

Controllo di contrasto: `on-accent` su `destructive` non è fra le coppie di `contrast.test.ts`. Aggiungerla (`['on-accent', 'destructive', 4.5]`); se non passa, usare `text-foreground` su `bg-destructive` solo se quella coppia passa, altrimenti bottone `border-destructive text-destructive` su pannello (coppia già verificata). Il dialogo è `panel`, pieno: nessun testo sull'erba.

Il testo «3 acquisti» in `getByRole('dialog')` è dentro lo stesso `<p>`: `toHaveTextContent('3 acquisti')` lo trova anche con lo `<span>`.

`HomeRoute.tsx`:
- `const remove = useDeleteAuction();`, `const [toDelete, setToDelete] = useState<AuctionCard | null>(null);`, `const headingRef = useRef<HTMLHeadingElement>(null);`
- l'`h1` sr-only «Le tue aste» guadagna `ref={headingRef}` e `tabIndex={-1}`;
- nella riga, dopo «Riprendi»:

```tsx
                  <button
                    type="button"
                    aria-label={`Elimina ${a.label}`}
                    onClick={() => { remove.reset(); setToDelete(a); }}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-line hover:text-destructive focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    <TrashIcon />
                  </button>
```

con un `TrashIcon` SVG `aria-hidden` locale al file (stesso stile di `GavelIcon`: `stroke="currentColor"`, `strokeWidth` 2, 20×20);
- in fondo al frammento della sezione Asta:

```tsx
      <DeleteAuctionDialog
        auction={toDelete}
        pending={remove.isPending}
        error={remove.error instanceof ProblemError ? remove.error.detail
          : remove.error ? "Errore di rete: l'asta non è stata eliminata. Riprova." : null}
        onCancel={() => setToDelete(null)}
        onConfirm={(id) =>
          remove.mutate(id, {
            onSuccess: () => {
              setToDelete(null);
              // Il bottone che aveva aperto la modale non esiste piu': il focus
              // torna all'inizio della pagina invece di perdersi sul body.
              headingRef.current?.focus();
            },
          })
        }
      />
```

- l'`alertMessage` della pagina **non** include `remove.error`: l'errore vive dentro la modale, che è l'unico alert mentre è aperta. Aggiornare il commento sull'unico `role="alert"`.

- [ ] **Step 4: Run frontend suite**

Run: `cd frontend && npm test && npm run lint && npm run build`
Expected: PASS. Mutazioni: (a) focus iniziale su «Elimina» → test del focus fallisce; (b) `onCancel` che chiama `onConfirm` → test Esc fallisce; (c) niente `headingRef.current?.focus()` → test della home fallisce.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "Home: cestino accanto a ogni asta, con modale di conferma"
```

---

### Task 8: Verifica d'insieme, README, giro sul jar

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README**

Nella tabella dei file dati (intorno alla riga 104) aggiungere una sezione breve sulla cartella dell'asta, in italiano, coerente con il tono del file:

```markdown
### La cartella di ogni asta

Ogni asta vive in `res/auctions/<id>/`, creata quando si conferma «Salva e comincia
l'asta»: `events.jsonl` (il registro), `league-members.yml`, `league-settings.yml`,
`league-rules.yml` (crediti e slot), `auction-settings.yml` (timer e avviso) e
`rose.csv`, riscritto a ogni download dell'export. I file in `res/` fuori da
`auctions/` sono il modello da cui parte ogni nuova asta: la schermata «Crea asta» non
li riscrive.

Eliminare un'asta dalla home sposta la sua cartella in `res/auctions-cestino/`: per
recuperarla basta rimetterla sotto `res/auctions/`.
```

E togliere/aggiornare ogni riga del README che descriva crediti e squadre come «solo da application.yml» (`grep -n "participants\|crediti\|squadre" README.md`).

- [ ] **Step 2: Suite complete**

Run: `mvn -q test && cd frontend && npm test && npm run lint && npm run build`
Expected: tutto verde. Ripetere `npm test` tre volte di fila: nessun test instabile.

Run: `git diff main -- src/main/java/com/fantaagent/adapter/in/web src/main/resources/templates src/test/java/com/fantaagent/adapter/in/web`
Expected: vuoto.

- [ ] **Step 3: Giro a mano sul jar, su dati usa e getta**

```bash
SP=<scratchpad della sessione>
rm -rf "$SP/data" && cp -R res "$SP/data"
mvn -q -Pprod -DskipTests package
java -jar target/fanta-agent-0.1.0-SNAPSHOT.jar --fantaagent.data-dir="$SP/data" --server.port=8099
```

Controllare nel browser su `http://localhost:8099`:
1. «Crea asta» mostra «Regole della lega» con 500 crediti e 3/8/8/6; aggiungere un partecipante fa salire «squadre».
2. Cambiare crediti a 400 e slot D a 7, creare: in `$SP/data/auctions/<id>/` ci sono i cinque file, `league-rules.yml` dice 400 e D: 7; `$SP/data/league-settings.yml` e `$SP/data/league-members.yml` sono identici a quelli di `res/` (`diff`).
3. Nell'asta, il tetto di spesa e i crediti residui riflettono 400.
4. Scaricare il CSV: `rose.csv` compare nella cartella con lo stesso contenuto.
5. Tornare in home, riaprire un'asta vecchia: crediti 500.
6. Impostazioni ad asta aperta: regole bloccate con il motivo, niente «Aggiungi partecipante»; cambiare il timer e salvare → `auction-settings.yml` della cartella aggiornato.
7. Home: cestino su un'asta, Esc chiude senza cancellare; confermare → sparisce, cartella in `$SP/data/auctions-cestino/`.

Fermare il jar. Non toccare `res/` del progetto.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "README: la cartella di ogni asta e il cestino"
```
