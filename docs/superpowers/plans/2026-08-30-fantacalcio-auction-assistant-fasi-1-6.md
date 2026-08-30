# Fantasy Football Auction Assistant — Piano di implementazione (fasi 1-6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** costruire l'applicazione locale di supporto all'asta fino al punto in cui è
utilizzabile in un'asta reale senza Claude: import dei dati, stato dell'asta durevole,
motore di valutazione E2 che produce il prezzo massimo, ricerca e UI da tastiera.

**Architecture:** monolite Spring Boot locale con architettura esagonale leggera in un
singolo modulo Maven. Tre package (`domain`, `application`, `adapter`) con dipendenza
unidirezionale verificata da ArchUnit. Il dominio non conosce Spring, Jackson né alcun
SDK. Lo stato dell'asta è un log JSONL append-only con `fsync`, proiettato in memoria.
Il motore di valutazione (E2) calcola il prezzo massimo come il prezzo oltre il quale
il valore della migliore rosa ancora completabile smette di crescere.

**Tech Stack:** Java 25, Spring Boot 3.5.x (web, thymeleaf, validation, actuator),
Maven a modulo singolo, Apache POI (XLSX), Apache Commons CSV, JUnit 5, AssertJ,
ArchUnit. Frontend server-rendered con Thymeleaf + HTMX + JavaScript nativo, senza
build step e senza npm.

**Spec:** `docs/superpowers/specs/2026-08-30-fantacalcio-auction-assistant-design.md`

---

## Global Constraints

Questi vincoli valgono per **ogni** task del piano.

- **Java 25**, Maven a modulo singolo. `maven.compiler.release` = `25`.
- **Package radice:** `com.fantaagent`.
- **Il package `domain` non può importare** `org.springframework.*`,
  `com.fasterxml.*`, `org.apache.poi.*`, `org.apache.commons.*`, `jakarta.*`.
  Verificato da ArchUnit (Task 2). Serializzazione e framework vivono negli adapter.
- **Il package `application` non può importare `com.fantaagent.adapter`.**
- **Tutti i tipi di dominio sono `record` o `enum` immutabili**, salvo dove il piano
  indica esplicitamente `final class` con soli metodi statici o puri.
- **Regole di lega (valori fissi del progetto):** 8 partecipanti, budget 500,
  rosa 25, slot `3 P / 8 D / 8 C / 6 A`, sequenza fasi `P, D, C, A`.
- **Replacement level:** indice `partecipanti * slot(ruolo) + 1` per ruolo, cioè
  25° portiere, 65° difensore, 65° centrocampista, 49° attaccante.
- **Vincolo di budget invariante:** `maxSpendableNow = budgetRemaining - (slotsRemaining - 1)`.
  Nessun prezzo raccomandato può superarlo, in nessun percorso di codice.
- **Le tabelle dei modificatori sono configurazione**, mai valori cablati nel codice.
  Finché non sono confermate, `league.scoring.modifiers-confirmed: false` e
  l'avvio in profilo di produzione viene rifiutato (Task 3).
- **Nessuna chiamata di rete** in tutte le fasi 1-6. L'integrazione Claude è fuori
  scope di questo piano.
- **Test:** ogni task termina con test verdi ed esattamente un commit.
  Comando di riferimento: `mvn -q test`.
- **Lingua**, tre categorie distinte:
  - identificatori, nomi di metodo e chiavi di configurazione: **inglese**;
  - messaggi che raggiungono l'utente — validazioni di `AuctionService`, mostrate
    come toast durante l'asta, e messaggi di `StartupValidator`, letti a terminale
    all'avvio: **italiano**, perché li legge lui;
  - messaggi di violazione di invariante nei tipi di dominio (`Player`, `SeasonStats`,
    `LeagueRules`, `ModifierTable`, `AuctionEvent`, `Squad`): **inglese**, perché
    segnalano un errore di programmazione, non raggiungono mai l'utente e vengono
    letti solo in uno stack trace.
  - commenti e stringhe esplicative dei test: **italiano**.

---

## File Structure

### Sorgenti principali

| File | Responsabilità |
|---|---|
| `pom.xml` | Dipendenze e configurazione build |
| `run.sh` | Avvio locale |
| `.env.example` | Modello delle variabili d'ambiente |
| `src/main/resources/application.yml` | Regole di lega, partecipanti, tabelle bonus/malus e modificatori |
| **domain/player** | |
| `domain/player/Role.java` | Enum P, D, C, A |
| `domain/player/Player.java` | Anagrafica immutabile |
| `domain/player/SeasonStats.java` | Statistiche grezze di una stagione |
| `domain/player/PlayerProjection.java` | Punti attesi base derivati |
| `domain/player/Tier.java` | Fascia derivata dai punti attesi |
| `domain/player/RoleLookup.java` | Interfaccia funzionale: id giocatore -> ruolo |
| **domain/league** | |
| `domain/league/LeagueRules.java` | Budget, slot, partecipanti, sequenza fasi |
| `domain/league/ScoringRules.java` | Bonus/malus + riferimenti alle tabelle modificatori |
| `domain/league/ModifierTable.java` | Tabella a gradini soglia -> bonus |
| `domain/league/Participant.java` | Partecipante, con iniziale e flag `me` |
| **domain/auction** | |
| `domain/auction/AuctionEvent.java` | `sealed interface` degli eventi |
| `domain/auction/Holding.java` | Giocatore posseduto: id, ruolo, prezzo |
| `domain/auction/Squad.java` | Rosa di un partecipante, con aritmetica di budget |
| `domain/auction/AuctionState.java` | Proiezione completa dello stato |
| `domain/auction/AuctionProjector.java` | Fold degli eventi in stato |
| **domain/strategy** | |
| `domain/strategy/ReplacementLevels.java` | Punti e media voto del giocatore marginale per ruolo |
| `domain/strategy/ModifierCalculator.java` | Punti da modificatori difesa/portiere |
| `domain/strategy/PriceModel.java` | Prezzo atteso di mercato, con inflazione |
| `domain/strategy/RosterCompleter.java` | Completamento greedy della rosa |
| `domain/strategy/LocalSearch.java` | Raffinamento del completamento per scambi |
| `domain/strategy/ValuationEngine.java` | Ricerca binaria del prezzo massimo |
| `domain/strategy/ValuationContext.java` | Input serializzabile al motore |
| `domain/strategy/PriceRecommendation.java` | Output del motore |
| `domain/strategy/Driver.java` | Fattore con contributo numerico |
| `domain/strategy/ConfidenceScore.java` | Confidenza aggregata e fattori |
| `domain/strategy/MarketPressure.java` | `maxRivalBid` e domanda residua |
| **domain/search** | |
| `domain/search/PlayerSearch.java` | Ricerca fuzzy con ranking |
| `domain/search/CommandParser.java` | Parsing di `giocatore prezzo partecipante` |
| **application** | |
| `application/port/out/PlayerCatalog.java` | Accesso ai giocatori |
| `application/port/out/AuctionEventStore.java` | Persistenza degli eventi |
| `application/service/AuctionService.java` | Registrazione acquisti, avanzamento fase |
| `application/service/PlayerAnalysisService.java` | Orchestrazione della valutazione |
| `application/service/PlayerSearchService.java` | Ricerca e comando |
| **adapter/out/file** | |
| `adapter/out/file/InMemoryPlayerCatalog.java` | Catalogo caricato all'avvio |
| `adapter/out/file/JsonlAuctionEventStore.java` | Log append-only con fsync |
| `adapter/out/file/event/EventDto.java` | Mapping Jackson degli eventi |
| **adapter/in/web** | |
| `adapter/in/web/AuctionController.java` | Endpoint HTMX di asta e ricerca |
| `adapter/in/web/dto/*.java` | DTO di presentazione |
| **ingestion** | |
| `ingestion/NameResolver.java` | Normalizzazione e risoluzione alias |
| `ingestion/ListoneImporter.java` | Import XLSX del listone |
| `ingestion/StatsImporter.java` | Import CSV delle statistiche |
| `ingestion/ReconciliationReport.java` | Esito dell'import |
| `ingestion/ImportCommand.java` | Comando di import |
| **config** | |
| `config/LeagueProperties.java` | Binding di `application.yml` |
| `config/StartupValidator.java` | Validazione bloccante all'avvio |
| `config/BeanConfig.java` | Wiring dei bean di dominio |

### Test

| File | Copre |
|---|---|
| `architecture/ArchitectureTest.java` | Boundary dei package |
| `config/StartupValidatorTest.java` | Validazione della configurazione |
| `ingestion/NameResolverTest.java` | Normalizzazione e alias |
| `ingestion/ListoneImporterTest.java` | Import listone e scarti |
| `ingestion/StatsImporterTest.java` | Import statistiche |
| `domain/player/ProjectionCalculatorTest.java` | Shrinkage, bonus, punti base |
| `domain/strategy/ReplacementLevelsTest.java` | Indici marginali |
| `domain/auction/SquadTest.java` | Aritmetica di budget e slot |
| `domain/auction/AuctionProjectorTest.java` | Fold, annullamento, correzione |
| `adapter/out/file/JsonlAuctionEventStoreTest.java` | Durabilità e ripristino |
| `domain/strategy/ModifierCalculatorTest.java` | Comportamento a soglia |
| `domain/strategy/PriceModelTest.java` | Inflazione forward-looking |
| `domain/strategy/RosterCompleterTest.java` | Greedy e vincolo di budget |
| `domain/strategy/ValuationEngineTest.java` | maxBid, property test, golden test |
| `domain/search/PlayerSearchTest.java` | Ranking e tolleranza ai refusi |
| `domain/search/CommandParserTest.java` | Grammatica del comando |
| `adapter/in/web/AuctionControllerTest.java` | Endpoint |

---

# FASE 1 — Skeleton

### Task 1: Progetto Maven e avvio dell'applicazione

**Files:**
- Create: `pom.xml`
- Create: `src/main/java/com/fantaagent/FantaAgentApplication.java`
- Create: `src/main/resources/application.yml`
- Create: `run.sh`
- Create: `.env.example`
- Test: `src/test/java/com/fantaagent/FantaAgentApplicationTest.java`

**Interfaces:**
- Consumes: niente.
- Produces: applicazione Spring Boot avviabile su `http://localhost:8080`; profilo
  `dev` usato da tutti i test delle fasi 1-5.

- [ ] **Step 1: Scrivere il test di avvio (fallisce: il progetto non esiste)**

`src/test/java/com/fantaagent/FantaAgentApplicationTest.java`

```java
package com.fantaagent;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("dev")
class FantaAgentApplicationTest {

    @Test
    void contextLoads() {
        // Se il contesto non si avvia, il test fallisce.
    }
}
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `mvn -q test`
Expected: FAIL — non esiste `pom.xml`, Maven non trova un progetto.

- [ ] **Step 3: Creare `pom.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>

  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.5.6</version>
    <relativePath/>
  </parent>

  <groupId>com.fantaagent</groupId>
  <artifactId>fanta-agent</artifactId>
  <version>0.1.0-SNAPSHOT</version>
  <name>fanta-agent</name>

  <properties>
    <java.version>25</java.version>
    <maven.compiler.release>25</maven.compiler.release>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    <archunit.version>1.3.0</archunit.version>
    <poi.version>5.3.0</poi.version>
    <commons-csv.version>1.11.0</commons-csv.version>
  </properties>

  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-thymeleaf</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-validation</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-actuator</artifactId>
    </dependency>
    <dependency>
      <groupId>org.apache.poi</groupId>
      <artifactId>poi-ooxml</artifactId>
      <version>${poi.version}</version>
    </dependency>
    <dependency>
      <groupId>org.apache.commons</groupId>
      <artifactId>commons-csv</artifactId>
      <version>${commons-csv.version}</version>
    </dependency>

    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-test</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>com.tngtech.archunit</groupId>
      <artifactId>archunit-junit5</artifactId>
      <version>${archunit.version}</version>
      <scope>test</scope>
    </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-maven-plugin</artifactId>
      </plugin>
    </plugins>
  </build>
</project>
```

> **Verifica delle versioni:** se `mvn -q test` fallisce con un errore di risoluzione
> su `spring-boot-starter-parent:3.5.6`, eseguire
> `mvn -q org.apache.maven.plugins:maven-help-plugin:3.5.1:evaluate -Dexpression=project.version -DforceStdout`
> non serve; cercare invece l'ultima 3.5.x su
> `https://repo1.maven.org/maven2/org/springframework/boot/spring-boot-starter-parent/`
> e sostituire il numero. Stesso criterio per POI, Commons CSV e ArchUnit se la
> risoluzione fallisce.

- [ ] **Step 4: Creare la classe di avvio**

`src/main/java/com/fantaagent/FantaAgentApplication.java`

```java
package com.fantaagent;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class FantaAgentApplication {

    public static void main(String[] args) {
        SpringApplication.run(FantaAgentApplication.class, args);
    }
}
```

- [ ] **Step 5: Creare `application.yml` con le regole di lega**

`src/main/resources/application.yml`

I valori sotto `scoring` sono **segnaposto dichiarati**: `modifiers-confirmed: false`
li marca come non ancora confermati e il validatore del Task 3 rifiuta l'avvio in
profilo non-`dev` finché il flag resta `false`. I nomi dei partecipanti vanno
sostituiti con quelli reali della lega.

```yaml
spring:
  application:
    name: fanta-agent
  thymeleaf:
    cache: false

server:
  port: 8080

management:
  endpoints:
    web:
      exposure:
        include: health,info

fantaagent:
  data-dir: data

league:
  participants: 8
  budget: 500
  slots:
    P: 3
    D: 8
    C: 8
    A: 6
  phases: [P, D, C, A]
  members:
    - { id: me, name: "Io",         initial: I, me: true }
    - { id: p2, name: "Marco",      initial: M, me: false }
    - { id: p3, name: "Luca",       initial: L, me: false }
    - { id: p4, name: "Anna",       initial: A, me: false }
    - { id: p5, name: "Dario",      initial: D, me: false }
    - { id: p6, name: "Giulia",     initial: G, me: false }
    - { id: p7, name: "Stefano",    initial: S, me: false }
    - { id: p8, name: "Federico",   initial: F, me: false }
  scoring:
    modifiers-confirmed: false
    goal-bonus:
      P: 3.0
      D: 4.0
      C: 3.5
      A: 3.0
    assist: 1.0
    penalty-scored: 3.0
    penalty-missed: -3.0
    penalty-saved: 3.0
    yellow-card: -0.5
    red-card: -1.0
    goal-conceded: -1.0
    clean-sheet: 1.0
    defence-modifier:
      defenders-counted: 3
      thresholds:
        - { min-average: 0.0, bonus: 0.0 }
        - { min-average: 6.0, bonus: 1.0 }
        - { min-average: 6.25, bonus: 2.0 }
        - { min-average: 6.5, bonus: 3.0 }
        - { min-average: 6.75, bonus: 4.0 }
    goalkeeper-modifier:
      defenders-counted: 0
      thresholds:
        - { min-average: 0.0, bonus: 0.0 }
        - { min-average: 6.0, bonus: 0.5 }
        - { min-average: 6.5, bonus: 1.0 }

---
spring:
  config:
    activate:
      on-profile: dev
fantaagent:
  dev-profile: true
```

- [ ] **Step 6: Creare `run.sh` e `.env.example`**

`run.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

( sleep 6 && command -v open >/dev/null && open http://localhost:8080 ) &
exec mvn -q -DskipTests spring-boot:run
```

`.env.example`

```
# Copiare in .env (gitignorato) e compilare.
# Serve solo dalla fase 7 in poi; le fasi 1-6 funzionano senza.
ANTHROPIC_API_KEY=
```

- [ ] **Step 7: Rendere eseguibile `run.sh` ed eseguire il test**

```bash
chmod +x run.sh
mvn -q test
```

Expected: PASS — il contesto Spring si avvia.

- [ ] **Step 8: Commit**

```bash
git add pom.xml run.sh .env.example src/
git commit -m "feat: skeleton Spring Boot con regole di lega in configurazione"
```

---

### Task 2: Boundary architetturali con ArchUnit

**Files:**
- Test: `src/test/java/com/fantaagent/architecture/ArchitectureTest.java`
- Create: `src/main/java/com/fantaagent/domain/package-info.java`

**Interfaces:**
- Consumes: struttura dei package dal Task 1.
- Produces: garanzia verificata che `domain` resti privo di framework e che
  `application` non dipenda da `adapter`. Ogni task successivo che violi il boundary
  fallisce qui.

- [ ] **Step 1: Scrivere il test di architettura**

`src/test/java/com/fantaagent/architecture/ArchitectureTest.java`

```java
package com.fantaagent.architecture;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

class ArchitectureTest {

    private static JavaClasses classes;

    @BeforeAll
    static void importClasses() {
        classes = new ClassFileImporter()
                .withImportOption(new ImportOption.DoNotIncludeTests())
                .importPackages("com.fantaagent");
    }

    @Test
    void domainDoesNotDependOnFrameworks() {
        noClasses().that().resideInAPackage("com.fantaagent.domain..")
                .should().dependOnClassesThat().resideInAnyPackage(
                        "org.springframework..",
                        "com.fasterxml..",
                        "org.apache.poi..",
                        "org.apache.commons..",
                        "jakarta..")
                .because("il dominio deve restare testabile senza framework")
                .check(classes);
    }

    @Test
    void domainDoesNotDependOnApplicationOrAdapter() {
        noClasses().that().resideInAPackage("com.fantaagent.domain..")
                .should().dependOnClassesThat().resideInAnyPackage(
                        "com.fantaagent.application..",
                        "com.fantaagent.adapter..",
                        "com.fantaagent.config..",
                        "com.fantaagent.ingestion..")
                .because("il dominio è il livello più interno")
                .check(classes);
    }

    @Test
    void applicationDoesNotDependOnAdapter() {
        noClasses().that().resideInAPackage("com.fantaagent.application..")
                .should().dependOnClassesThat().resideInAnyPackage(
                        "com.fantaagent.adapter..")
                .because("l'applicazione dipende dalle porte, non dalle implementazioni")
                .check(classes);
    }
}
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `mvn -q test -Dtest=ArchitectureTest`
Expected: FAIL — `ClassFileImporter` non trova il package `com.fantaagent.domain`,
oppure ArchUnit fallisce con "Rules should not be empty".

- [ ] **Step 3: Creare il package di dominio**

`src/main/java/com/fantaagent/domain/package-info.java`

```java
/**
 * Livello di dominio: logica pura, immutabile, priva di framework.
 *
 * <p>Nessuna classe di questo package può dipendere da Spring, Jackson, POI,
 * Commons o Jakarta. Il vincolo è verificato da
 * {@code com.fantaagent.architecture.ArchitectureTest}.
 */
package com.fantaagent.domain;
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `mvn -q test -Dtest=ArchitectureTest`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/test/java/com/fantaagent/architecture src/main/java/com/fantaagent/domain
git commit -m "test: boundary architetturali verificati da ArchUnit"
```

---

### Task 3: Regole di lega tipizzate e validazione bloccante all'avvio

**Files:**
- Create: `src/main/java/com/fantaagent/domain/player/Role.java`
- Create: `src/main/java/com/fantaagent/domain/league/LeagueRules.java`
- Create: `src/main/java/com/fantaagent/domain/league/ModifierTable.java`
- Create: `src/main/java/com/fantaagent/domain/league/ScoringRules.java`
- Create: `src/main/java/com/fantaagent/domain/league/Participant.java`
- Create: `src/main/java/com/fantaagent/config/LeagueProperties.java`
- Create: `src/main/java/com/fantaagent/config/StartupValidator.java`
- Create: `src/main/java/com/fantaagent/config/BeanConfig.java`
- Test: `src/test/java/com/fantaagent/config/StartupValidatorTest.java`
- Test: `src/test/java/com/fantaagent/domain/league/ModifierTableTest.java`

**Interfaces:**
- Consumes: `application.yml` dal Task 1.
- Produces:
  - `enum Role { P, D, C, A }`
  - `record LeagueRules(int participants, int budget, Map<Role,Integer> slots, List<Role> phases)`
    con `int rosterSize()`, `int slots(Role)`, `Role firstPhase()`, `Optional<Role> nextPhase(Role)`
  - `record ModifierTable(int defendersCounted, List<Threshold> thresholds)` con
    `record Threshold(double minAverage, double bonus)` e `double bonusFor(double average)`
  - `record ScoringRules(boolean modifiersConfirmed, Map<Role,Double> goalBonus, double assist, double penaltyScored, double penaltyMissed, double penaltySaved, double yellowCard, double redCard, double goalConceded, double cleanSheet, ModifierTable defenceModifier, ModifierTable goalkeeperModifier)`
  - `record Participant(String id, String name, char initial, boolean me)`
  - bean Spring `LeagueRules`, `ScoringRules`, `List<Participant>` esposti da `BeanConfig`

- [ ] **Step 1: Scrivere i test (falliscono: i tipi non esistono)**

`src/test/java/com/fantaagent/domain/league/ModifierTableTest.java`

```java
package com.fantaagent.domain.league;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ModifierTableTest {

    private final ModifierTable table = new ModifierTable(3, List.of(
            new ModifierTable.Threshold(0.0, 0.0),
            new ModifierTable.Threshold(6.0, 1.0),
            new ModifierTable.Threshold(6.5, 3.0)));

    @Test
    void returnsBonusOfHighestThresholdReached() {
        assertThat(table.bonusFor(5.99)).isEqualTo(0.0);
        assertThat(table.bonusFor(6.00)).isEqualTo(1.0);
        assertThat(table.bonusFor(6.49)).isEqualTo(1.0);
        assertThat(table.bonusFor(6.50)).isEqualTo(3.0);
        assertThat(table.bonusFor(9.00)).isEqualTo(3.0);
    }

    @Test
    void rejectsNonMonotonicThresholds() {
        assertThatThrownBy(() -> new ModifierTable(3, List.of(
                new ModifierTable.Threshold(6.5, 3.0),
                new ModifierTable.Threshold(6.0, 1.0))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("monotonic");
    }

    @Test
    void rejectsEmptyTable() {
        assertThatThrownBy(() -> new ModifierTable(3, List.of()))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
```

`src/test/java/com/fantaagent/config/StartupValidatorTest.java`

```java
package com.fantaagent.config;

import com.fantaagent.domain.league.ModifierTable;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.ScoringRules;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class StartupValidatorTest {

    private static final ModifierTable ANY_TABLE = new ModifierTable(3,
            List.of(new ModifierTable.Threshold(0.0, 0.0)));

    private static LeagueRules rules(Map<Role, Integer> slots) {
        return new LeagueRules(8, 500, slots, List.of(Role.P, Role.D, Role.C, Role.A));
    }

    private static Map<Role, Integer> validSlots() {
        return Map.of(Role.P, 3, Role.D, 8, Role.C, 8, Role.A, 6);
    }

    private static ScoringRules scoring(boolean confirmed) {
        return new ScoringRules(confirmed,
                Map.of(Role.P, 3.0, Role.D, 4.0, Role.C, 3.5, Role.A, 3.0),
                1.0, 3.0, -3.0, 3.0, -0.5, -1.0, -1.0, 1.0,
                ANY_TABLE, ANY_TABLE);
    }

    private static List<Participant> participants(int n) {
        return java.util.stream.IntStream.range(0, n)
                .mapToObj(i -> new Participant("p" + i, "P" + i, (char) ('A' + i), i == 0))
                .toList();
    }

    @Test
    void acceptsAValidConfiguration() {
        assertThatCode(() -> new StartupValidator(
                rules(validSlots()), scoring(true), participants(8), false).validate())
                .doesNotThrowAnyException();
    }

    @Test
    void rejectsWhenSlotsDoNotMatchParticipantCount() {
        List<Participant> nine = participants(9);
        assertThatThrownBy(() -> new StartupValidator(
                rules(validSlots()), scoring(true), nine, false).validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("participants");
    }

    @Test
    void rejectsDuplicateInitials() {
        List<Participant> clashing = List.of(
                new Participant("a", "Anna", 'A', true),
                new Participant("b", "Aldo", 'A', false));
        assertThatThrownBy(() -> new StartupValidator(
                new LeagueRules(2, 500, validSlots(), List.of(Role.P, Role.D, Role.C, Role.A)),
                scoring(true), clashing, false).validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("initial");
    }

    @Test
    void rejectsExactlyOneOwnerFlagViolation() {
        List<Participant> noMe = List.of(
                new Participant("a", "Anna", 'A', false),
                new Participant("b", "Bea", 'B', false));
        assertThatThrownBy(() -> new StartupValidator(
                new LeagueRules(2, 500, validSlots(), List.of(Role.P, Role.D, Role.C, Role.A)),
                scoring(true), noMe, false).validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("exactly one");
    }

    @Test
    void rejectsUnconfirmedModifiersOutsideDevProfile() {
        assertThatThrownBy(() -> new StartupValidator(
                rules(validSlots()), scoring(false), participants(8), false).validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("modifiers-confirmed");
    }

    @Test
    void allowsUnconfirmedModifiersInDevProfile() {
        assertThatCode(() -> new StartupValidator(
                rules(validSlots()), scoring(false), participants(8), true).validate())
                .doesNotThrowAnyException();
    }
}
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `mvn -q test -Dtest='ModifierTableTest,StartupValidatorTest'`
Expected: FAIL — errori di compilazione, i tipi non esistono.

- [ ] **Step 3: Creare i tipi di dominio**

`src/main/java/com/fantaagent/domain/player/Role.java`

```java
package com.fantaagent.domain.player;

public enum Role {
    P, D, C, A
}
```

`src/main/java/com/fantaagent/domain/league/LeagueRules.java`

```java
package com.fantaagent.domain.league;

import com.fantaagent.domain.player.Role;

import java.util.List;
import java.util.Map;
import java.util.Optional;

public record LeagueRules(int participants, int budget, Map<Role, Integer> slots, List<Role> phases) {

    public LeagueRules {
        if (participants < 2) {
            throw new IllegalArgumentException("participants must be at least 2");
        }
        if (budget < 1) {
            throw new IllegalArgumentException("budget must be positive");
        }
        slots = Map.copyOf(slots);
        phases = List.copyOf(phases);
        for (Role role : Role.values()) {
            if (!slots.containsKey(role)) {
                throw new IllegalArgumentException("missing slot count for role " + role);
            }
        }
    }

    public int rosterSize() {
        return slots.values().stream().mapToInt(Integer::intValue).sum();
    }

    public int slots(Role role) {
        return slots.get(role);
    }

    /** Indice, a partire da 1, del giocatore marginale del ruolo. */
    public int replacementIndex(Role role) {
        return participants * slots(role) + 1;
    }

    public Role firstPhase() {
        return phases.getFirst();
    }

    public Optional<Role> nextPhase(Role current) {
        int i = phases.indexOf(current);
        if (i < 0 || i == phases.size() - 1) {
            return Optional.empty();
        }
        return Optional.of(phases.get(i + 1));
    }
}
```

`src/main/java/com/fantaagent/domain/league/ModifierTable.java`

```java
package com.fantaagent.domain.league;

import java.util.List;

/**
 * Tabella a gradini che mappa una media voto sul bonus in gol del modificatore.
 *
 * @param defendersCounted quanti difensori entrano nel calcolo della media di reparto;
 *                         0 per un modificatore che guarda solo il portiere
 */
public record ModifierTable(int defendersCounted, List<Threshold> thresholds) {

    public record Threshold(double minAverage, double bonus) {
    }

    public ModifierTable {
        thresholds = List.copyOf(thresholds);
        if (thresholds.isEmpty()) {
            throw new IllegalArgumentException("modifier table must have at least one threshold");
        }
        for (int i = 1; i < thresholds.size(); i++) {
            if (thresholds.get(i).minAverage() <= thresholds.get(i - 1).minAverage()) {
                throw new IllegalArgumentException("modifier thresholds must be strictly monotonic");
            }
        }
    }

    /** Bonus della soglia più alta raggiunta dalla media indicata. */
    public double bonusFor(double average) {
        double bonus = thresholds.getFirst().bonus();
        for (Threshold t : thresholds) {
            if (average >= t.minAverage()) {
                bonus = t.bonus();
            } else {
                break;
            }
        }
        return bonus;
    }
}
```

`src/main/java/com/fantaagent/domain/league/ScoringRules.java`

```java
package com.fantaagent.domain.league;

import com.fantaagent.domain.player.Role;

import java.util.Map;

public record ScoringRules(
        boolean modifiersConfirmed,
        Map<Role, Double> goalBonus,
        double assist,
        double penaltyScored,
        double penaltyMissed,
        double penaltySaved,
        double yellowCard,
        double redCard,
        double goalConceded,
        double cleanSheet,
        ModifierTable defenceModifier,
        ModifierTable goalkeeperModifier) {

    public ScoringRules {
        goalBonus = Map.copyOf(goalBonus);
        for (Role role : Role.values()) {
            if (!goalBonus.containsKey(role)) {
                throw new IllegalArgumentException("missing goal bonus for role " + role);
            }
        }
    }

    public double goalBonus(Role role) {
        return goalBonus.get(role);
    }
}
```

`src/main/java/com/fantaagent/domain/league/Participant.java`

```java
package com.fantaagent.domain.league;

public record Participant(String id, String name, char initial, boolean me) {

    public Participant {
        if (id == null || id.isBlank()) {
            throw new IllegalArgumentException("participant id must not be blank");
        }
        initial = Character.toUpperCase(initial);
    }
}
```

- [ ] **Step 4: Creare il binding di configurazione e il validatore**

`src/main/java/com/fantaagent/config/LeagueProperties.java`

```java
package com.fantaagent.config;

import com.fantaagent.domain.player.Role;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;
import java.util.Map;

@ConfigurationProperties(prefix = "league")
public record LeagueProperties(
        int participants,
        int budget,
        Map<Role, Integer> slots,
        List<Role> phases,
        List<Member> members,
        Scoring scoring) {

    public record Member(String id, String name, char initial, boolean me) {
    }

    public record Scoring(
            boolean modifiersConfirmed,
            Map<Role, Double> goalBonus,
            double assist,
            double penaltyScored,
            double penaltyMissed,
            double penaltySaved,
            double yellowCard,
            double redCard,
            double goalConceded,
            double cleanSheet,
            Table defenceModifier,
            Table goalkeeperModifier) {
    }

    public record Table(int defendersCounted, List<Row> thresholds) {
        public record Row(double minAverage, double bonus) {
        }
    }
}
```

`src/main/java/com/fantaagent/config/BeanConfig.java`

```java
package com.fantaagent.config;

import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.ModifierTable;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.league.ScoringRules;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class BeanConfig {

    @Bean
    public LeagueRules leagueRules(LeagueProperties props) {
        return new LeagueRules(props.participants(), props.budget(), props.slots(), props.phases());
    }

    @Bean
    public ScoringRules scoringRules(LeagueProperties props) {
        LeagueProperties.Scoring s = props.scoring();
        return new ScoringRules(
                s.modifiersConfirmed(), s.goalBonus(), s.assist(),
                s.penaltyScored(), s.penaltyMissed(), s.penaltySaved(),
                s.yellowCard(), s.redCard(), s.goalConceded(), s.cleanSheet(),
                toTable(s.defenceModifier()), toTable(s.goalkeeperModifier()));
    }

    @Bean
    public List<Participant> participants(LeagueProperties props) {
        return props.members().stream()
                .map(m -> new Participant(m.id(), m.name(), m.initial(), m.me()))
                .toList();
    }

    private static ModifierTable toTable(LeagueProperties.Table table) {
        return new ModifierTable(table.defendersCounted(),
                table.thresholds().stream()
                        .map(r -> new ModifierTable.Threshold(r.minAverage(), r.bonus()))
                        .toList());
    }
}
```

`src/main/java/com/fantaagent/config/StartupValidator.java`

```java
package com.fantaagent.config;

import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.league.ScoringRules;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Validazione bloccante della configurazione di lega.
 *
 * <p>Politica degli errori: un errore di configurazione deve impedire l'avvio, perché
 * produrrebbe numeri sbagliati per tutta l'asta senza segnalarsi.
 */
@Component
public class StartupValidator {

    private final LeagueRules rules;
    private final ScoringRules scoring;
    private final List<Participant> participants;
    private final boolean devProfile;

    public StartupValidator(LeagueRules rules, ScoringRules scoring,
                            List<Participant> participants,
                            @Value("${fantaagent.dev-profile:false}") boolean devProfile) {
        this.rules = rules;
        this.scoring = scoring;
        this.participants = participants;
        this.devProfile = devProfile;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void validateOnStartup() {
        validate();
    }

    public void validate() {
        if (participants.size() != rules.participants()) {
            throw new IllegalStateException(
                    "configured participants (" + participants.size()
                    + ") do not match league.participants (" + rules.participants() + ")");
        }
        Set<Character> initials = new HashSet<>();
        for (Participant p : participants) {
            if (!initials.add(p.initial())) {
                throw new IllegalStateException(
                        "duplicate participant initial '" + p.initial() + "'");
            }
        }
        long owners = participants.stream().filter(Participant::me).count();
        if (owners != 1) {
            throw new IllegalStateException(
                    "exactly one participant must have me=true, found " + owners);
        }
        if (rules.rosterSize() < 1) {
            throw new IllegalStateException("roster size must be positive");
        }
        if (!scoring.modifiersConfirmed() && !devProfile) {
            throw new IllegalStateException(
                    "league.scoring.modifiers-confirmed is false: sostituire le tabelle "
                    + "segnaposto dei modificatori prima di usare l'applicazione in asta");
        }
    }
}
```

> Nota: un solo costruttore, così Spring non deve scegliere. Il flag arriva da
> `fantaagent.dev-profile`, che vale `true` solo nel blocco `dev` di `application.yml`;
> i test possono istanziare il validatore passando direttamente il booleano, senza
> contesto Spring.

- [ ] **Step 5: Eseguire i test e verificare che passino**

Run: `mvn -q test`
Expected: PASS — inclusi `ArchitectureTest` e `FantaAgentApplicationTest`.

- [ ] **Step 6: Commit**

```bash
git add src/main/java/com/fantaagent src/test/java/com/fantaagent
git commit -m "feat: regole di lega tipizzate e validazione bloccante all'avvio"
```

---

# FASE 2 — Ingestion dei dati

### Task 4: Modello del giocatore e catalogo in memoria

**Files:**
- Create: `src/main/java/com/fantaagent/domain/player/Player.java`
- Create: `src/main/java/com/fantaagent/domain/player/SeasonStats.java`
- Create: `src/main/java/com/fantaagent/domain/player/RoleLookup.java`
- Create: `src/main/java/com/fantaagent/application/port/out/PlayerCatalog.java`
- Create: `src/main/java/com/fantaagent/adapter/out/file/InMemoryPlayerCatalog.java`
- Test: `src/test/java/com/fantaagent/adapter/out/file/InMemoryPlayerCatalogTest.java`

**Interfaces:**
- Consumes: `Role` dal Task 3.
- Produces:
  - `record Player(String id, String name, String team, Role role, int listPrice)`
  - `record SeasonStats(String playerId, String season, int appearances, double averageRating, int goals, int assists, int yellowCards, int redCards, int penaltiesScored, int penaltiesMissed, int penaltiesSaved, int goalsConceded, int cleanSheets)`
  - `interface RoleLookup { Role roleOf(String playerId); }`
  - `interface PlayerCatalog extends RoleLookup` con
    `Optional<Player> byId(String)`, `List<Player> all()`, `List<Player> byRole(Role)`,
    `List<SeasonStats> statsOf(String playerId)`
  - `InMemoryPlayerCatalog implements PlayerCatalog` con costruttore
    `InMemoryPlayerCatalog(List<Player> players, List<SeasonStats> stats)`

- [ ] **Step 1: Scrivere il test**

`src/test/java/com/fantaagent/adapter/out/file/InMemoryPlayerCatalogTest.java`

```java
package com.fantaagent.adapter.out.file;

import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import com.fantaagent.domain.player.SeasonStats;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class InMemoryPlayerCatalogTest {

    private static final Player BASTONI = new Player("1", "Bastoni", "Inter", Role.D, 20);
    private static final Player LAUTARO = new Player("2", "Lautaro", "Inter", Role.A, 40);

    private final InMemoryPlayerCatalog catalog = new InMemoryPlayerCatalog(
            List.of(BASTONI, LAUTARO),
            List.of(new SeasonStats("1", "2025-26", 30, 6.2, 2, 1, 5, 0, 0, 0, 0, 0, 0)));

    @Test
    void findsPlayerById() {
        assertThat(catalog.byId("1")).contains(BASTONI);
        assertThat(catalog.byId("999")).isEmpty();
    }

    @Test
    void filtersByRole() {
        assertThat(catalog.byRole(Role.D)).containsExactly(BASTONI);
        assertThat(catalog.byRole(Role.C)).isEmpty();
    }

    @Test
    void exposesRoleLookup() {
        assertThat(catalog.roleOf("2")).isEqualTo(Role.A);
    }

    @Test
    void roleLookupFailsLoudlyForUnknownPlayer() {
        assertThatThrownBy(() -> catalog.roleOf("999"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("999");
    }

    @Test
    void returnsStatsForPlayerAndEmptyListWhenAbsent() {
        assertThat(catalog.statsOf("1")).hasSize(1);
        assertThat(catalog.statsOf("2")).isEmpty();
    }
}
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `mvn -q test -Dtest=InMemoryPlayerCatalogTest`
Expected: FAIL — i tipi non esistono.

- [ ] **Step 3: Creare i tipi di dominio e la porta**

`src/main/java/com/fantaagent/domain/player/Player.java`

```java
package com.fantaagent.domain.player;

public record Player(String id, String name, String team, Role role, int listPrice) {

    public Player {
        if (id == null || id.isBlank()) {
            throw new IllegalArgumentException("player id must not be blank");
        }
        if (listPrice < 1) {
            throw new IllegalArgumentException("list price must be at least 1 for " + name);
        }
    }
}
```

`src/main/java/com/fantaagent/domain/player/SeasonStats.java`

```java
package com.fantaagent.domain.player;

/**
 * Statistiche grezze di una stagione. Nessun bonus è già applicato: la fantamedia
 * viene ricalcolata con le regole della nostra lega, non con quelle della fonte.
 */
public record SeasonStats(
        String playerId,
        String season,
        int appearances,
        double averageRating,
        int goals,
        int assists,
        int yellowCards,
        int redCards,
        int penaltiesScored,
        int penaltiesMissed,
        int penaltiesSaved,
        int goalsConceded,
        int cleanSheets) {
}
```

`src/main/java/com/fantaagent/domain/player/RoleLookup.java`

```java
package com.fantaagent.domain.player;

@FunctionalInterface
public interface RoleLookup {

    /** @throws IllegalArgumentException se il giocatore è sconosciuto */
    Role roleOf(String playerId);
}
```

`src/main/java/com/fantaagent/application/port/out/PlayerCatalog.java`

```java
package com.fantaagent.application.port.out;

import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import com.fantaagent.domain.player.RoleLookup;
import com.fantaagent.domain.player.SeasonStats;

import java.util.List;
import java.util.Optional;

public interface PlayerCatalog extends RoleLookup {

    Optional<Player> byId(String playerId);

    List<Player> all();

    List<Player> byRole(Role role);

    List<SeasonStats> statsOf(String playerId);
}
```

- [ ] **Step 4: Creare l'adapter in memoria**

`src/main/java/com/fantaagent/adapter/out/file/InMemoryPlayerCatalog.java`

```java
package com.fantaagent.adapter.out.file;

import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import com.fantaagent.domain.player.SeasonStats;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

public class InMemoryPlayerCatalog implements PlayerCatalog {

    private final Map<String, Player> byId;
    private final Map<Role, List<Player>> byRole;
    private final Map<String, List<SeasonStats>> statsByPlayer;

    public InMemoryPlayerCatalog(List<Player> players, List<SeasonStats> stats) {
        this.byId = players.stream().collect(Collectors.toMap(
                Player::id, p -> p, (a, b) -> a, LinkedHashMap::new));
        this.byRole = players.stream()
                .collect(Collectors.groupingBy(Player::role,
                        Collectors.collectingAndThen(Collectors.toList(), List::copyOf)));
        this.statsByPlayer = stats.stream()
                .collect(Collectors.groupingBy(SeasonStats::playerId));
    }

    @Override
    public Optional<Player> byId(String playerId) {
        return Optional.ofNullable(byId.get(playerId));
    }

    @Override
    public List<Player> all() {
        return List.copyOf(byId.values());
    }

    @Override
    public List<Player> byRole(Role role) {
        return byRole.getOrDefault(role, List.of());
    }

    @Override
    public List<SeasonStats> statsOf(String playerId) {
        return statsByPlayer.getOrDefault(playerId, List.of()).stream()
                .sorted(Comparator.comparing(SeasonStats::season).reversed())
                .toList();
    }

    @Override
    public Role roleOf(String playerId) {
        Player player = byId.get(playerId);
        if (player == null) {
            throw new IllegalArgumentException("unknown player id: " + playerId);
        }
        return player.role();
    }
}
```

- [ ] **Step 5: Eseguire il test e verificare che passi**

Run: `mvn -q test -Dtest=InMemoryPlayerCatalogTest`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/main/java/com/fantaagent src/test/java/com/fantaagent
git commit -m "feat: modello del giocatore e catalogo in memoria"
```

---

### Task 5: Risoluzione dei nomi tra listone e statistiche

**Files:**
- Create: `src/main/java/com/fantaagent/ingestion/NameResolver.java`
- Test: `src/test/java/com/fantaagent/ingestion/NameResolverTest.java`

**Interfaces:**
- Consumes: `Player` dal Task 4.
- Produces:
  - `NameResolver(Collection<Player> players, Map<String,String> aliases)` —
    la mappa alias associa un nome grezzo a un id giocatore
  - `static String normalize(String raw)` — minuscole, accenti rimossi,
    punteggiatura rimossa, spazi compattati
  - `Optional<String> resolve(String rawName)` — id del giocatore, se risolvibile

- [ ] **Step 1: Scrivere il test**

`src/test/java/com/fantaagent/ingestion/NameResolverTest.java`

```java
package com.fantaagent.ingestion;

import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class NameResolverTest {

    private final List<Player> players = List.of(
            new Player("1", "Bastoni", "Inter", Role.D, 20),
            new Player("2", "Thuram M.", "Inter", Role.A, 35),
            new Player("3", "Dimarco", "Inter", Role.D, 22),
            new Player("4", "Gonzalez N.", "Juventus", Role.C, 18));

    private final NameResolver resolver = new NameResolver(players,
            Map.of("marcus thuram", "2"));

    @Test
    void normalizesCaseAccentsAndPunctuation() {
        assertThat(NameResolver.normalize("  Gonzàlez  N.  ")).isEqualTo("gonzalez n");
        assertThat(NameResolver.normalize("D'Ambrosio")).isEqualTo("dambrosio");
    }

    @Test
    void resolvesExactNormalizedMatch() {
        assertThat(resolver.resolve("BASTONI")).contains("1");
        assertThat(resolver.resolve("Thuram M.")).contains("2");
    }

    @Test
    void resolvesThroughExplicitAlias() {
        assertThat(resolver.resolve("Marcus Thuram")).contains("2");
    }

    @Test
    void resolvesSurnameWhenSourceOmitsInitial() {
        assertThat(resolver.resolve("Gonzalez")).contains("4");
    }

    @Test
    void refusesToGuessOnATypoAndLeavesItForTheReconciliationReport() {
        // In import nulla verifica il risultato: meglio un nome non risolto, che l'utente
        // vede nel report e sistema con un alias, che statistiche attribuite a un altro.
        assertThat(resolver.resolve("Bastony")).isEmpty();
        assertThat(resolver.resolve("Dimarko")).isEmpty();
    }

    @Test
    void refusesShortSurnamesThatDifferByOneCharacter() {
        // Conte/Conti, Grassi/Grossi: collisioni reali fra cognomi italiani plausibili.
        NameResolver conte = new NameResolver(List.of(
                new Player("50", "Conte A.", "Napoli", Role.C, 10)), Map.of());
        assertThat(conte.resolve("Conti")).isEmpty();
    }

    @Test
    void returnsEmptyWhenNoConfidentMatchExists() {
        assertThat(resolver.resolve("Cristiano Ronaldo")).isEmpty();
    }

    @Test
    void refusesWhenTwoPlayersNormaliseToTheSameName() {
        // Due "Rossi M." distinti nel listone: rispondere sarebbe una scelta arbitraria
        // fra i due, e nessuno se ne accorgerebbe.
        NameResolver duplicates = new NameResolver(List.of(
                new Player("60", "Rossi M.", "Empoli", Role.C, 5),
                new Player("61", "Rossi M.", "Genoa", Role.D, 6)), Map.of());
        assertThat(duplicates.resolve("Rossi M.")).isEmpty();
    }

    @Test
    void returnsEmptyWhenSurnameIsAmbiguous() {
        NameResolver ambiguous = new NameResolver(List.of(
                new Player("10", "Thuram M.", "Inter", Role.A, 35),
                new Player("11", "Thuram K.", "Juventus", Role.C, 12)), Map.of());
        assertThat(ambiguous.resolve("Thuram")).isEmpty();
    }
}
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `mvn -q test -Dtest=NameResolverTest`
Expected: FAIL — `NameResolver` non esiste.

- [ ] **Step 3: Implementare `NameResolver`**

`src/main/java/com/fantaagent/ingestion/NameResolver.java`

```java
package com.fantaagent.ingestion;

import com.fantaagent.domain.player.Player;

import java.text.Normalizer;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Risolve un nome grezzo proveniente da una fonte statistica sull'id del listone.
 *
 * <p>Strategia, in ordine: alias esplicito, match esatto normalizzato, match sul solo
 * cognome quando è univoco. Se nessun criterio produce un candidato univoco la
 * risoluzione fallisce e il nome finisce nel report di riconciliazione, dove l'utente
 * lo risolve aggiungendo un alias prima dell'asta.
 *
 * <p><b>Nessun matching fuzzy qui, deliberatamente.</b> In fase di import nulla verifica
 * il risultato: un match sbagliato attacca le statistiche di un giocatore a un altro e
 * corrompe in silenzio ogni proiezione costruita sopra. A distanza di edit 1 cognomi
 * italiani corti collidono con facilità — Conte/Conti, Grassi/Grossi — e il codice non
 * ha modo di accorgersene. Il matching approssimato vive invece in
 * {@code domain.search.PlayerSearch}, dove è utile e innocuo perché l'utente legge il
 * nome proposto prima di agire.
 */
public final class NameResolver {

    private final Map<String, String> byNormalizedName = new HashMap<>();
    private final Set<String> ambiguousNames = new HashSet<>();
    private final Map<String, String> bySurname = new HashMap<>();
    private final Set<String> ambiguousSurnames = new HashSet<>();
    private final Map<String, String> aliases = new HashMap<>();

    public NameResolver(Collection<Player> players, Map<String, String> aliases) {
        for (Player p : players) {
            String normalized = normalize(p.name());
            String previousName = byNormalizedName.putIfAbsent(normalized, p.id());
            if (previousName != null && !previousName.equals(p.id())) {
                ambiguousNames.add(normalized);
            }
            String surname = surnameOf(normalized);
            String previousSurname = bySurname.putIfAbsent(surname, p.id());
            if (previousSurname != null && !previousSurname.equals(p.id())) {
                ambiguousSurnames.add(surname);
            }
        }
        aliases.forEach((raw, id) -> this.aliases.put(normalize(raw), id));
    }

    public static String normalize(String raw) {
        String decomposed = Normalizer.normalize(raw, Normalizer.Form.NFD);
        String withoutAccents = decomposed.replaceAll("\\p{M}", "");
        String cleaned = withoutAccents.toLowerCase(Locale.ITALIAN)
                .replaceAll("[^a-z0-9 ]", "")
                .replaceAll("\\s+", " ")
                .trim();
        return cleaned;
    }

    public Optional<String> resolve(String rawName) {
        String normalized = normalize(rawName);

        String alias = aliases.get(normalized);
        if (alias != null) {
            return Optional.of(alias);
        }
        if (!ambiguousNames.contains(normalized)) {
            String exact = byNormalizedName.get(normalized);
            if (exact != null) {
                return Optional.of(exact);
            }
        }
        String surname = surnameOf(normalized);
        if (!ambiguousSurnames.contains(surname)) {
            String bySurnameMatch = bySurname.get(surname);
            if (bySurnameMatch != null) {
                return Optional.of(bySurnameMatch);
            }
        }
        return Optional.empty();
    }

    /** Primo token del nome normalizzato: nel listone il cognome precede l'iniziale. */
    private static String surnameOf(String normalized) {
        int space = normalized.indexOf(' ');
        return space < 0 ? normalized : normalized.substring(0, space);
    }

}
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `mvn -q test -Dtest=NameResolverTest`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/fantaagent/ingestion src/test/java/com/fantaagent/ingestion
git commit -m "feat: risoluzione dei nomi tra listone e statistiche"
```

---

### Task 6: Import del listone da XLSX

**Files:**
- Create: `src/main/java/com/fantaagent/ingestion/ReconciliationReport.java`
- Create: `src/main/java/com/fantaagent/ingestion/ListoneImporter.java`
- Test: `src/test/java/com/fantaagent/ingestion/ListoneImporterTest.java`

**Interfaces:**
- Consumes: `Player`, `Role`.
- Produces:
  - `record ReconciliationReport(List<String> warnings, int accepted, int rejected)`
    con `boolean clean()` e `String render()`
  - `record ListoneImport(List<Player> players, ReconciliationReport report)`
  - `ListoneImporter.importFrom(Path xlsx)` -> `ListoneImport`

Colonne attese nella prima riga del primo foglio, in qualsiasi ordine e senza
distinzione fra maiuscole e minuscole: `Id`, `R`, `Nome`, `Squadra`, `Qt.A`.
Una riga con ruolo sconosciuto, id mancante o quotazione non numerica viene scartata e
registrata nel report, senza interrompere l'import.

- [ ] **Step 1: Scrivere il test**

`src/test/java/com/fantaagent/ingestion/ListoneImporterTest.java`

```java
package com.fantaagent.ingestion;

import com.fantaagent.domain.player.Role;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class ListoneImporterTest {

    @TempDir
    Path tmp;

    private Path writeWorkbook(String[][] rows) throws Exception {
        Path file = tmp.resolve("listone.xlsx");
        try (XSSFWorkbook wb = new XSSFWorkbook(); OutputStream out = Files.newOutputStream(file)) {
            Sheet sheet = wb.createSheet("Tutti");
            for (int r = 0; r < rows.length; r++) {
                Row row = sheet.createRow(r);
                for (int c = 0; c < rows[r].length; c++) {
                    row.createCell(c).setCellValue(rows[r][c]);
                }
            }
            wb.write(out);
        }
        return file;
    }

    @Test
    void importsValidRows() throws Exception {
        Path file = writeWorkbook(new String[][]{
                {"Id", "R", "Nome", "Squadra", "Qt.A"},
                {"1", "D", "Bastoni", "Inter", "20"},
                {"2", "A", "Lautaro", "Inter", "40"}});

        ListoneImporter.ListoneImport result = new ListoneImporter().importFrom(file);

        assertThat(result.players()).hasSize(2);
        assertThat(result.players().getFirst().role()).isEqualTo(Role.D);
        assertThat(result.players().getFirst().listPrice()).isEqualTo(20);
        assertThat(result.report().clean()).isTrue();
    }

    @Test
    void toleratesColumnsInAnyOrderAndDifferentCase() throws Exception {
        Path file = writeWorkbook(new String[][]{
                {"squadra", "NOME", "qt.a", "id", "r"},
                {"Inter", "Bastoni", "20", "1", "D"}});

        ListoneImporter.ListoneImport result = new ListoneImporter().importFrom(file);

        assertThat(result.players()).hasSize(1);
        assertThat(result.players().getFirst().team()).isEqualTo("Inter");
    }

    @Test
    void rejectsBadRowsWithoutAbortingTheImport() throws Exception {
        Path file = writeWorkbook(new String[][]{
                {"Id", "R", "Nome", "Squadra", "Qt.A"},
                {"1", "D", "Bastoni", "Inter", "20"},
                {"2", "X", "Ignoto", "Inter", "10"},
                {"", "A", "SenzaId", "Inter", "10"},
                {"4", "A", "PrezzoRotto", "Inter", "n/d"}});

        ListoneImporter.ListoneImport result = new ListoneImporter().importFrom(file);

        assertThat(result.players()).hasSize(1);
        assertThat(result.report().rejected()).isEqualTo(3);
        assertThat(result.report().clean()).isFalse();
        assertThat(result.report().render()).contains("X").contains("n/d");
    }

    @Test
    void failsLoudlyWhenAMandatoryColumnIsMissing() throws Exception {
        Path file = writeWorkbook(new String[][]{
                {"Id", "Nome", "Squadra", "Qt.A"},
                {"1", "Bastoni", "Inter", "20"}});

        org.assertj.core.api.Assertions
                .assertThatThrownBy(() -> new ListoneImporter().importFrom(file))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("R");
    }
}
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `mvn -q test -Dtest=ListoneImporterTest`
Expected: FAIL — `ListoneImporter` non esiste.

- [ ] **Step 3: Implementare report e importer**

`src/main/java/com/fantaagent/ingestion/ReconciliationReport.java`

```java
package com.fantaagent.ingestion;

import java.util.List;

public record ReconciliationReport(List<String> warnings, int accepted, int rejected) {

    public ReconciliationReport {
        warnings = List.copyOf(warnings);
    }

    public boolean clean() {
        return rejected == 0 && warnings.isEmpty();
    }

    public String render() {
        StringBuilder sb = new StringBuilder();
        sb.append("accettati=").append(accepted)
          .append(" scartati=").append(rejected).append('\n');
        warnings.forEach(w -> sb.append("  - ").append(w).append('\n'));
        return sb.toString();
    }
}
```

`src/main/java/com/fantaagent/ingestion/ListoneImporter.java`

```java
package com.fantaagent.ingestion;

import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public class ListoneImporter {

    private static final List<String> REQUIRED = List.of("id", "r", "nome", "squadra", "qt.a");

    public record ListoneImport(List<Player> players, ReconciliationReport report) {
    }

    public ListoneImport importFrom(Path xlsx) {
        try (InputStream in = Files.newInputStream(xlsx); Workbook wb = new XSSFWorkbook(in)) {
            Sheet sheet = wb.getSheetAt(0);
            Map<String, Integer> columns = readHeader(sheet.getRow(0));
            for (String required : REQUIRED) {
                if (!columns.containsKey(required)) {
                    throw new IllegalStateException(
                            "colonna obbligatoria mancante nel listone: " + required.toUpperCase(Locale.ROOT));
                }
            }
            List<Player> players = new ArrayList<>();
            List<String> warnings = new ArrayList<>();
            int rejected = 0;
            for (int r = 1; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null) {
                    continue;
                }
                try {
                    players.add(toPlayer(row, columns));
                } catch (RuntimeException e) {
                    rejected++;
                    warnings.add("riga " + (r + 1) + ": " + e.getMessage());
                }
            }
            return new ListoneImport(players, new ReconciliationReport(warnings, players.size(), rejected));
        } catch (IOException e) {
            throw new IllegalStateException("impossibile leggere il listone: " + xlsx, e);
        }
    }

    private static Map<String, Integer> readHeader(Row header) {
        if (header == null) {
            throw new IllegalStateException("il listone non ha una riga di intestazione");
        }
        Map<String, Integer> columns = new HashMap<>();
        for (int c = 0; c < header.getLastCellNum(); c++) {
            String name = stringValue(header.getCell(c)).toLowerCase(Locale.ROOT).trim();
            if (!name.isBlank()) {
                columns.put(name, c);
            }
        }
        return columns;
    }

    private static Player toPlayer(Row row, Map<String, Integer> columns) {
        String id = stringValue(row.getCell(columns.get("id"))).trim();
        if (id.isBlank()) {
            throw new IllegalArgumentException("id mancante");
        }
        String roleRaw = stringValue(row.getCell(columns.get("r"))).trim().toUpperCase(Locale.ROOT);
        Role role;
        try {
            role = Role.valueOf(roleRaw);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("ruolo sconosciuto: " + roleRaw);
        }
        String name = stringValue(row.getCell(columns.get("nome"))).trim();
        String team = stringValue(row.getCell(columns.get("squadra"))).trim();
        String priceRaw = stringValue(row.getCell(columns.get("qt.a"))).trim();
        int price;
        try {
            price = (int) Math.round(Double.parseDouble(priceRaw.replace(',', '.')));
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("quotazione non numerica: " + priceRaw);
        }
        if (price < 1) {
            // Non silenziamo: il contratto dell'importer e' che ogni anomalia sia
            // visibile nel report, e una quotazione a zero e' un dato da guardare.
            throw new IllegalArgumentException("quotazione non positiva: " + priceRaw);
        }
        return new Player(id, name, team, role, price);
    }

    private static String stringValue(Cell cell) {
        if (cell == null) {
            return "";
        }
        CellType type = cell.getCellType() == CellType.FORMULA
                ? cell.getCachedFormulaResultType()
                : cell.getCellType();
        return switch (type) {
            // Una cella formula espone la formula, non il valore: leggiamo il risultato
            // memorizzato, altrimenti un listone con colonne calcolate verrebbe scartato
            // riga per riga la sera prima dell'asta.
            case NUMERIC -> {
                double d = cell.getNumericCellValue();
                yield d == Math.rint(d) ? String.valueOf((long) d) : String.valueOf(d);
            }
            case STRING -> cell.getStringCellValue();
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            case BLANK, _ -> "";
        };
    }
}
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `mvn -q test -Dtest=ListoneImporterTest`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/fantaagent/ingestion src/test/java/com/fantaagent/ingestion
git commit -m "feat: import del listone da XLSX con report di riconciliazione"
```

---

### Task 7: Import delle statistiche e catalogo caricato all'avvio

**Files:**
- Create: `src/main/java/com/fantaagent/ingestion/StatsImporter.java`
- Create: `src/main/java/com/fantaagent/ingestion/CatalogLoader.java`
- Modify: `src/main/java/com/fantaagent/config/BeanConfig.java` (aggiungere il bean `PlayerCatalog`)
- Test: `src/test/java/com/fantaagent/ingestion/StatsImporterTest.java`

**Interfaces:**
- Consumes: `NameResolver` (Task 5), `ListoneImporter` (Task 6), `InMemoryPlayerCatalog` (Task 4).
- Produces:
  - `record StatsImport(List<SeasonStats> stats, ReconciliationReport report)`
  - `StatsImporter.importFrom(Path csv, String season, NameResolver resolver)` -> `StatsImport`
  - `CatalogLoader.load(Path dataDir)` -> `record LoadedCatalog(PlayerCatalog catalog, ReconciliationReport report)`
  - bean Spring `PlayerCatalog`

Il CSV atteso ha intestazione con le colonne
`Nome,Pv,Mv,Gf,Ass,Amm,Esp,Rp,Rc,Rs,Gs,Imb`
(presenze, media voto, gol fatti, assist, ammonizioni, espulsioni, rigori parati,
rigori calciati e sbagliati, rigori segnati, gol subiti, porte inviolate). Le righe il
cui nome non è risolvibile vengono scartate e registrate nel report.

- [ ] **Step 1: Scrivere il test**

`src/test/java/com/fantaagent/ingestion/StatsImporterTest.java`

```java
package com.fantaagent.ingestion;

import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import com.fantaagent.domain.player.SeasonStats;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class StatsImporterTest {

    @TempDir
    Path tmp;

    private final NameResolver resolver = new NameResolver(List.of(
            new Player("1", "Bastoni", "Inter", Role.D, 20),
            new Player("2", "Sommer", "Inter", Role.P, 15)), Map.of());

    private Path csv(String body) throws Exception {
        Path file = tmp.resolve("stats.csv");
        Files.writeString(file, body, StandardCharsets.UTF_8);
        return file;
    }

    @Test
    void importsResolvableRows() throws Exception {
        Path file = csv("""
                Nome,Pv,Mv,Gf,Ass,Amm,Esp,Rp,Rc,Rs,Gs,Imb
                Bastoni,30,6.15,2,3,5,0,0,0,0,0,0
                Sommer,34,6.40,0,0,1,0,2,0,0,38,12
                """);

        StatsImporter.StatsImport result =
                new StatsImporter().importFrom(file, "2025-26", resolver);

        assertThat(result.stats()).hasSize(2);
        SeasonStats bastoni = result.stats().getFirst();
        assertThat(bastoni.playerId()).isEqualTo("1");
        assertThat(bastoni.appearances()).isEqualTo(30);
        assertThat(bastoni.averageRating()).isEqualTo(6.15);
        assertThat(bastoni.assists()).isEqualTo(3);
        assertThat(result.stats().get(1).cleanSheets()).isEqualTo(12);
        assertThat(result.report().clean()).isTrue();
    }

    @Test
    void reportsUnresolvableNamesInsteadOfGuessing() throws Exception {
        Path file = csv("""
                Nome,Pv,Mv,Gf,Ass,Amm,Esp,Rp,Rc,Rs,Gs,Imb
                Bastoni,30,6.15,2,3,5,0,0,0,0,0,0
                Giocatore Inesistente,10,6.00,0,0,0,0,0,0,0,0,0
                """);

        StatsImporter.StatsImport result =
                new StatsImporter().importFrom(file, "2025-26", resolver);

        assertThat(result.stats()).hasSize(1);
        assertThat(result.report().rejected()).isEqualTo(1);
        assertThat(result.report().render()).contains("Giocatore Inesistente");
    }

    @Test
    void acceptsCommaAsDecimalSeparator() throws Exception {
        Path file = csv("""
                Nome,Pv,Mv,Gf,Ass,Amm,Esp,Rp,Rc,Rs,Gs,Imb
                Bastoni,30,"6,15",2,3,5,0,0,0,0,0,0
                """);

        StatsImporter.StatsImport result =
                new StatsImporter().importFrom(file, "2025-26", resolver);

        assertThat(result.stats().getFirst().averageRating()).isEqualTo(6.15);
    }
}
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `mvn -q test -Dtest=StatsImporterTest`
Expected: FAIL — `StatsImporter` non esiste.

- [ ] **Step 3: Implementare `StatsImporter`**

`src/main/java/com/fantaagent/ingestion/StatsImporter.java`

```java
package com.fantaagent.ingestion;

import com.fantaagent.domain.player.SeasonStats;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;

import java.io.IOException;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public class StatsImporter {

    public record StatsImport(List<SeasonStats> stats, ReconciliationReport report) {
    }

    public StatsImport importFrom(Path csv, String season, NameResolver resolver) {
        CSVFormat format = CSVFormat.DEFAULT.builder()
                .setHeader()
                .setSkipHeaderRecord(true)
                .setIgnoreSurroundingSpaces(true)
                .setTrim(true)
                .get();

        List<SeasonStats> stats = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        int rejected = 0;

        try (Reader reader = Files.newBufferedReader(csv, StandardCharsets.UTF_8);
             CSVParser parser = CSVParser.parse(reader, format)) {
            for (CSVRecord record : parser) {
                String name = record.get("Nome");
                Optional<String> id = resolver.resolve(name);
                if (id.isEmpty()) {
                    rejected++;
                    warnings.add("nome non risolvibile: " + name);
                    continue;
                }
                stats.add(new SeasonStats(
                        id.get(), season,
                        intOf(record, "Pv"),
                        doubleOf(record, "Mv"),
                        intOf(record, "Gf"),
                        intOf(record, "Ass"),
                        intOf(record, "Amm"),
                        intOf(record, "Esp"),
                        intOf(record, "Rs"),
                        intOf(record, "Rc"),
                        intOf(record, "Rp"),
                        intOf(record, "Gs"),
                        intOf(record, "Imb")));
            }
        } catch (IOException e) {
            throw new IllegalStateException("impossibile leggere le statistiche: " + csv, e);
        }
        return new StatsImport(stats, new ReconciliationReport(warnings, stats.size(), rejected));
    }

    private static int intOf(CSVRecord record, String column) {
        String raw = record.get(column);
        return raw == null || raw.isBlank() ? 0 : (int) Math.round(parse(raw));
    }

    private static double doubleOf(CSVRecord record, String column) {
        String raw = record.get(column);
        return raw == null || raw.isBlank() ? 0.0 : parse(raw);
    }

    private static double parse(String raw) {
        return Double.parseDouble(raw.replace(',', '.'));
    }
}
```

- [ ] **Step 4: Implementare `CatalogLoader` e registrare il bean**

`src/main/java/com/fantaagent/ingestion/CatalogLoader.java`

```java
package com.fantaagent.ingestion;

import com.fantaagent.adapter.out.file.InMemoryPlayerCatalog;
import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.domain.player.SeasonStats;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

/**
 * Carica il catalogo dai file di riferimento.
 *
 * <p>Convenzioni: il listone è {@code <dataDir>/reference/listone.xlsx}; ogni file
 * {@code <dataDir>/reference/stats-<stagione>.csv} è una stagione, la cui etichetta è
 * ricavata dal nome del file. Se la directory non esiste il catalogo è vuoto: le fasi
 * 1-3 devono poter girare prima che i file reali siano disponibili.
 */
public class CatalogLoader {

    public record LoadedCatalog(PlayerCatalog catalog, ReconciliationReport report) {
    }

    public LoadedCatalog load(Path dataDir) {
        Path reference = dataDir.resolve("reference");
        Path listone = reference.resolve("listone.xlsx");
        if (!Files.exists(listone)) {
            return new LoadedCatalog(new InMemoryPlayerCatalog(List.of(), List.of()),
                    new ReconciliationReport(
                            List.of("listone assente: " + listone + " — catalogo vuoto"), 0, 0));
        }

        ListoneImporter.ListoneImport listoneImport = new ListoneImporter().importFrom(listone);
        NameResolver resolver = new NameResolver(listoneImport.players(), Map.of());

        List<SeasonStats> allStats = new ArrayList<>();
        List<String> warnings = new ArrayList<>(listoneImport.report().warnings());
        int rejected = listoneImport.report().rejected();

        try (Stream<Path> files = Files.list(reference)) {
            List<Path> statFiles = files
                    .filter(p -> p.getFileName().toString().startsWith("stats-"))
                    .filter(p -> p.getFileName().toString().endsWith(".csv"))
                    .sorted()
                    .toList();
            for (Path file : statFiles) {
                String fileName = file.getFileName().toString();
                String season = fileName.substring("stats-".length(), fileName.length() - ".csv".length());
                StatsImporter.StatsImport imported =
                        new StatsImporter().importFrom(file, season, resolver);
                allStats.addAll(imported.stats());
                warnings.addAll(imported.report().warnings());
                rejected += imported.report().rejected();
            }
        } catch (IOException e) {
            throw new IllegalStateException("impossibile elencare " + reference, e);
        }

        PlayerCatalog catalog = new InMemoryPlayerCatalog(listoneImport.players(), allStats);
        return new LoadedCatalog(catalog,
                new ReconciliationReport(warnings, listoneImport.players().size(), rejected));
    }
}
```

Aggiungere a `src/main/java/com/fantaagent/config/BeanConfig.java`:

```java
    @Bean
    public com.fantaagent.application.port.out.PlayerCatalog playerCatalog(
            @org.springframework.beans.factory.annotation.Value("${fantaagent.data-dir:data}") String dataDir) {
        com.fantaagent.ingestion.CatalogLoader.LoadedCatalog loaded =
                new com.fantaagent.ingestion.CatalogLoader().load(java.nio.file.Path.of(dataDir));
        org.slf4j.LoggerFactory.getLogger(BeanConfig.class)
                .info("catalogo caricato:\n{}", loaded.report().render());
        return loaded.catalog();
    }
```

- [ ] **Step 5: Eseguire tutti i test**

Run: `mvn -q test`
Expected: PASS — inclusi `FantaAgentApplicationTest` (il catalogo vuoto non impedisce l'avvio).

- [ ] **Step 6: Commit**

```bash
git add src/main/java/com/fantaagent src/test/java/com/fantaagent
git commit -m "feat: import delle statistiche e catalogo caricato all'avvio"
```

---

# FASE 3 — Proiezioni

### Task 8: Punti attesi base con shrinkage bayesiano

**Files:**
- Create: `src/main/java/com/fantaagent/domain/player/PlayerProjection.java`
- Create: `src/main/java/com/fantaagent/domain/player/ProjectionCalculator.java`
- Test: `src/test/java/com/fantaagent/domain/player/ProjectionCalculatorTest.java`

**Interfaces:**
- Consumes: `Player`, `SeasonStats`, `ScoringRules`, `Role`.
- Produces:
  - `record PlayerProjection(String playerId, Role role, double expectedRating, double bonusPerAppearance, double expectedAppearances, double basePoints, double observedAppearances)`
  - `ProjectionCalculator(ScoringRules scoring)` con
    `PlayerProjection project(Player player, List<SeasonStats> newestFirst, double roleAverageRating)`
    e `static Map<Role,Double> roleAverageRatings(List<Player> players, Function<String,List<SeasonStats>> statsOf)`

Modello, dalla spec §7.1:

```
expectedRating       = (n * ratingOsservato + K * mediaDiRuolo) / (n + K)     K = 15
bonusPerAppearance   = bonus totali pesati / presenze pesate
basePoints           = (expectedRating + bonusPerAppearance) * expectedAppearances
```

I pesi delle stagioni, dalla più recente, sono `0.5, 0.3, 0.2`, rinormalizzati sulle
stagioni effettivamente disponibili. I gol su rigore sono conteggiati con
`penaltyScored` e sottratti dai gol su azione, così che le due voci di configurazione
non si sommino sullo stesso evento.

Per un giocatore senza alcuno storico (neopromosso, acquisto dall'estero)
`observedAppearances` vale 0 e `expectedAppearances` usa un prior grezzo derivato dalla
quotazione di listino. È un'approssimazione dichiarata: `observedAppearances == 0` è il
segnale che il Task 17 usa per abbassare la confidenza.

- [ ] **Step 1: Scrivere il test**

`src/test/java/com/fantaagent/domain/player/ProjectionCalculatorTest.java`

```java
package com.fantaagent.domain.player;

import com.fantaagent.domain.league.ModifierTable;
import com.fantaagent.domain.league.ScoringRules;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class ProjectionCalculatorTest {

    private static final ModifierTable ANY = new ModifierTable(3,
            List.of(new ModifierTable.Threshold(0.0, 0.0)));

    private final ScoringRules scoring = new ScoringRules(true,
            Map.of(Role.P, 3.0, Role.D, 4.0, Role.C, 3.5, Role.A, 3.0),
            1.0, 3.0, -3.0, 3.0, -0.5, -1.0, -1.0, 1.0, ANY, ANY);

    private final ProjectionCalculator calculator = new ProjectionCalculator(scoring);

    private static SeasonStats stats(String season, int appearances, double rating,
                                     int goals, int assists, int yellow,
                                     int penScored, int penMissed) {
        return new SeasonStats("1", season, appearances, rating, goals, assists,
                yellow, 0, penScored, penMissed, 0, 0, 0);
    }

    @Test
    void appliesShrinkageAndBonusesForASingleSeason() {
        Player player = new Player("1", "Bomber", "Inter", Role.A, 40);
        // 30 presenze, mv 6.5, 10 gol di cui 2 su rigore, 5 assist, 3 gialli, 1 rigore sbagliato
        List<SeasonStats> history = List.of(stats("2025-26", 30, 6.5, 10, 5, 3, 2, 1));

        PlayerProjection p = calculator.project(player, history, 6.0);

        // (30*6.5 + 15*6.0) / 45 = 6.333...
        assertThat(p.expectedRating()).isCloseTo(6.3333, within(0.0005));
        // (8*3.0) + (2*3.0) + (5*1.0) + (1*-3.0) + (3*-0.5) = 30.5 su 30 presenze
        assertThat(p.bonusPerAppearance()).isCloseTo(1.01667, within(0.0005));
        assertThat(p.expectedAppearances()).isEqualTo(30.0);
        assertThat(p.basePoints()).isCloseTo(220.5, within(0.01));
        assertThat(p.observedAppearances()).isEqualTo(30.0);
    }

    @Test
    void weightsRecentSeasonsMoreHeavily() {
        Player player = new Player("1", "Veterano", "Inter", Role.D, 15);
        List<SeasonStats> history = List.of(
                stats("2025-26", 30, 6.5, 0, 0, 0, 0, 0),
                stats("2024-25", 20, 6.0, 0, 0, 0, 0, 0));

        PlayerProjection p = calculator.project(player, history, 6.0);

        // presenze pesate: 0.625*30 + 0.375*20 = 26.25
        assertThat(p.expectedAppearances()).isCloseTo(26.25, within(0.01));
        // rating pesato per presenze = 6.3571; shrinkage verso 6.0 con K=15
        assertThat(p.expectedRating()).isCloseTo(6.2273, within(0.0005));
    }

    @Test
    void shrinksSmallSamplesHardTowardsTheRoleAverage() {
        Player player = new Player("1", "Meteora", "Lecce", Role.A, 8);
        List<SeasonStats> history = List.of(stats("2025-26", 4, 8.5, 0, 0, 0, 0, 0));

        PlayerProjection p = calculator.project(player, history, 6.0);

        // (4*8.5 + 15*6.0) / 19 = 6.526 — non 8.5
        assertThat(p.expectedRating()).isCloseTo(6.5263, within(0.0005));
    }

    @Test
    void usesAListPricePriorForPlayersWithoutHistory() {
        Player expensive = new Player("1", "Neoacquisto", "Inter", Role.A, 30);
        Player cheap = new Player("2", "Riserva", "Lecce", Role.A, 5);

        PlayerProjection rich = calculator.project(expensive, List.of(), 6.0);
        PlayerProjection poor = calculator.project(cheap, List.of(), 6.0);

        assertThat(rich.observedAppearances()).isZero();
        assertThat(rich.expectedRating()).isEqualTo(6.0);
        assertThat(rich.expectedAppearances()).isGreaterThan(poor.expectedAppearances());
        assertThat(rich.basePoints()).isGreaterThan(0.0);
    }

    @Test
    void countsGoalkeeperSpecificBonuses() {
        Player keeper = new Player("1", "Portiere", "Inter", Role.P, 18);
        SeasonStats season = new SeasonStats("1", "2025-26", 30, 6.2,
                0, 0, 1, 0, 0, 0, 2, 30, 12);

        PlayerProjection p = calculator.project(keeper, List.of(season), 6.0);

        // 2*3.0 (rigori parati) + 1*-0.5 (giallo) + 30*-1.0 (gol subiti) + 12*1.0 (imbattuto)
        assertThat(p.bonusPerAppearance()).isCloseTo(-12.5 / 30.0, within(0.0005));
    }

    @Test
    void computesRoleAveragesWeightedByAppearances() {
        List<Player> players = List.of(
                new Player("1", "A", "Inter", Role.D, 20),
                new Player("2", "B", "Lecce", Role.D, 5));
        Map<String, List<SeasonStats>> byId = Map.of(
                "1", List.of(stats("2025-26", 30, 6.4, 0, 0, 0, 0, 0)),
                "2", List.of(new SeasonStats("2", "2025-26", 10, 5.8, 0, 0, 0, 0, 0, 0, 0, 0, 0)));

        Map<Role, Double> averages =
                ProjectionCalculator.roleAverageRatings(players, id -> byId.getOrDefault(id, List.of()));

        // (30*6.4 + 10*5.8) / 40 = 6.25
        assertThat(averages.get(Role.D)).isCloseTo(6.25, within(0.0005));
    }
}
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `mvn -q test -Dtest=ProjectionCalculatorTest`
Expected: FAIL — `PlayerProjection` e `ProjectionCalculator` non esistono.

- [ ] **Step 3: Creare `PlayerProjection`**

`src/main/java/com/fantaagent/domain/player/PlayerProjection.java`

```java
package com.fantaagent.domain.player;

/**
 * Punti attesi base di un giocatore, senza modificatori.
 *
 * <p>I modificatori dipendono dalla rosa e sono calcolati dal motore di valutazione:
 * questa proiezione resta perciò indipendente dal contesto e cacheabile.
 *
 * @param observedAppearances presenze pesate effettivamente osservate nello storico;
 *                            0 significa che {@code expectedAppearances} viene da un
 *                            prior e non da dati
 */
public record PlayerProjection(
        String playerId,
        Role role,
        double expectedRating,
        double bonusPerAppearance,
        double expectedAppearances,
        double basePoints,
        double observedAppearances) {

    public double startingProbability() {
        return Math.min(1.0, expectedAppearances / ProjectionCalculator.SEASON_MATCHES);
    }
}
```

- [ ] **Step 4: Implementare `ProjectionCalculator`**

`src/main/java/com/fantaagent/domain/player/ProjectionCalculator.java`

```java
package com.fantaagent.domain.player;

import com.fantaagent.domain.league.ScoringRules;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

public final class ProjectionCalculator {

    /** Pseudo-conteggio dello shrinkage: quante presenze "virtuali" alla media di ruolo. */
    public static final double SHRINKAGE_K = 15.0;

    public static final double SEASON_MATCHES = 38.0;

    /** Pesi delle stagioni, dalla più recente. Rinormalizzati su quelle disponibili. */
    private static final List<Double> SEASON_WEIGHTS = List.of(0.5, 0.3, 0.2);

    /** Prior grezzo di presenze per chi non ha storico, discriminato dalla quotazione. */
    private static final int STARTER_PRICE_THRESHOLD = 12;
    private static final double STARTER_PRIOR_APPEARANCES = 26.0;
    private static final double BENCH_PRIOR_APPEARANCES = 10.0;

    private final ScoringRules scoring;

    public ProjectionCalculator(ScoringRules scoring) {
        this.scoring = scoring;
    }

    public PlayerProjection project(Player player, List<SeasonStats> newestFirst,
                                    double roleAverageRating) {
        double weightedAppearances = 0.0;
        double weightedRatingNumerator = 0.0;
        double weightedBonus = 0.0;

        int seasons = Math.min(newestFirst.size(), SEASON_WEIGHTS.size());
        double weightSum = 0.0;
        for (int i = 0; i < seasons; i++) {
            weightSum += SEASON_WEIGHTS.get(i);
        }
        for (int i = 0; i < seasons; i++) {
            SeasonStats s = newestFirst.get(i);
            double w = SEASON_WEIGHTS.get(i) / weightSum;
            weightedAppearances += w * s.appearances();
            weightedRatingNumerator += w * s.appearances() * s.averageRating();
            weightedBonus += w * bonusPoints(s, player.role());
        }

        double observedRating = weightedAppearances > 0
                ? weightedRatingNumerator / weightedAppearances
                : roleAverageRating;
        double expectedRating =
                (weightedAppearances * observedRating + SHRINKAGE_K * roleAverageRating)
                / (weightedAppearances + SHRINKAGE_K);

        double bonusPerAppearance = weightedAppearances > 0
                ? weightedBonus / weightedAppearances
                : 0.0;

        double expectedAppearances = weightedAppearances > 0
                ? Math.min(SEASON_MATCHES, weightedAppearances)
                : priorAppearances(player);

        double basePoints = (expectedRating + bonusPerAppearance) * expectedAppearances;

        return new PlayerProjection(player.id(), player.role(), expectedRating,
                bonusPerAppearance, expectedAppearances, basePoints, weightedAppearances);
    }

    /** Punti bonus/malus totali di una stagione, con le regole della nostra lega. */
    private double bonusPoints(SeasonStats s, Role role) {
        int openPlayGoals = Math.max(0, s.goals() - s.penaltiesScored());
        double total = openPlayGoals * scoring.goalBonus(role)
                + s.penaltiesScored() * scoring.penaltyScored()
                + s.penaltiesMissed() * scoring.penaltyMissed()
                + s.assists() * scoring.assist()
                + s.yellowCards() * scoring.yellowCard()
                + s.redCards() * scoring.redCard();
        if (role == Role.P) {
            total += s.penaltiesSaved() * scoring.penaltySaved()
                    + s.goalsConceded() * scoring.goalConceded()
                    + s.cleanSheets() * scoring.cleanSheet();
        }
        return total;
    }

    private static double priorAppearances(Player player) {
        return player.listPrice() >= STARTER_PRICE_THRESHOLD
                ? STARTER_PRIOR_APPEARANCES
                : BENCH_PRIOR_APPEARANCES;
    }

    /** Media voto di ruolo, pesata per presenze: è il centro dello shrinkage. */
    public static Map<Role, Double> roleAverageRatings(
            List<Player> players, Function<String, List<SeasonStats>> statsOf) {
        Map<Role, double[]> accumulator = new EnumMap<>(Role.class);
        for (Role role : Role.values()) {
            accumulator.put(role, new double[2]);
        }
        for (Player player : players) {
            double[] acc = accumulator.get(player.role());
            for (SeasonStats s : statsOf.apply(player.id())) {
                acc[0] += s.appearances() * s.averageRating();
                acc[1] += s.appearances();
            }
        }
        Map<Role, Double> averages = new EnumMap<>(Role.class);
        for (Role role : Role.values()) {
            double[] acc = accumulator.get(role);
            averages.put(role, acc[1] > 0 ? acc[0] / acc[1] : 6.0);
        }
        return averages;
    }
}
```

- [ ] **Step 5: Eseguire il test e verificare che passi**

Run: `mvn -q test -Dtest=ProjectionCalculatorTest`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/main/java/com/fantaagent/domain/player src/test/java/com/fantaagent/domain/player
git commit -m "feat: proiezione dei punti attesi con shrinkage bayesiano"
```

---

### Task 9: Replacement level e fasce

**Files:**
- Create: `src/main/java/com/fantaagent/domain/strategy/ReplacementLevels.java`
- Create: `src/main/java/com/fantaagent/domain/player/Tier.java`
- Test: `src/test/java/com/fantaagent/domain/strategy/ReplacementLevelsTest.java`

**Interfaces:**
- Consumes: `PlayerProjection`, `LeagueRules`.
- Produces:
  - `record ReplacementLevels(Map<Role,Double> points, Map<Role,Double> ratings)` con
    `static ReplacementLevels from(LeagueRules rules, Collection<PlayerProjection> projections)`,
    `double points(Role)`, `double rating(Role)`
  - `enum Tier { ELITE, TOP, MID, DEPTH, FILLER }` con
    `static Tier of(int rankInRole, int replacementIndex)`

`ratings(Role)` serve al Task 13: quando la rosa non ha ancora abbastanza difensori, il
calcolo del modificatore usa la media voto del giocatore marginale come riempitivo, così
che il termine sia definito anche durante la fase portieri.

- [ ] **Step 1: Scrivere il test**

`src/test/java/com/fantaagent/domain/strategy/ReplacementLevelsTest.java`

```java
package com.fantaagent.domain.strategy;

import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.player.PlayerProjection;
import com.fantaagent.domain.player.Role;
import com.fantaagent.domain.player.Tier;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ReplacementLevelsTest {

    private static final LeagueRules RULES = new LeagueRules(2, 500,
            Map.of(Role.P, 1, Role.D, 2, Role.C, 2, Role.A, 1),
            List.of(Role.P, Role.D, Role.C, Role.A));

    private static PlayerProjection projection(String id, Role role, double points, double rating) {
        return new PlayerProjection(id, role, rating, 0.0, 30.0, points, 30.0);
    }

    @Test
    void picksThePlayerAtTheReplacementIndex() {
        // 2 partecipanti x 2 slot D + 1 = 5° difensore
        List<PlayerProjection> projections = new ArrayList<>();
        double[] points = {300, 250, 200, 150, 100, 50};
        for (int i = 0; i < points.length; i++) {
            projections.add(projection("d" + i, Role.D, points[i], 6.5 - i * 0.1));
        }

        ReplacementLevels levels = ReplacementLevels.from(RULES, projections);

        assertThat(RULES.replacementIndex(Role.D)).isEqualTo(5);
        assertThat(levels.points(Role.D)).isEqualTo(100.0);
        assertThat(levels.rating(Role.D)).isCloseTo(6.1, org.assertj.core.api.Assertions.within(1e-9));
    }

    @Test
    void fallsBackToTheWorstAvailableWhenThePoolIsTooSmall() {
        List<PlayerProjection> projections = List.of(
                projection("d0", Role.D, 300, 6.5),
                projection("d1", Role.D, 250, 6.4));

        ReplacementLevels levels = ReplacementLevels.from(RULES, projections);

        assertThat(levels.points(Role.D)).isEqualTo(250.0);
    }

    @Test
    void returnsZeroPointsForRolesWithNoPlayers() {
        ReplacementLevels levels = ReplacementLevels.from(RULES, List.of());

        assertThat(levels.points(Role.A)).isZero();
        assertThat(levels.rating(Role.A)).isEqualTo(6.0);
    }

    @Test
    void assignsTiersByRankRelativeToTheReplacementIndex() {
        assertThat(Tier.of(1, 65)).isEqualTo(Tier.ELITE);
        assertThat(Tier.of(9, 65)).isEqualTo(Tier.ELITE);
        assertThat(Tier.of(20, 65)).isEqualTo(Tier.TOP);
        assertThat(Tier.of(40, 65)).isEqualTo(Tier.MID);
        assertThat(Tier.of(64, 65)).isEqualTo(Tier.DEPTH);
        assertThat(Tier.of(120, 65)).isEqualTo(Tier.FILLER);
    }
}
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `mvn -q test -Dtest=ReplacementLevelsTest`
Expected: FAIL — i tipi non esistono.

- [ ] **Step 3: Implementare `Tier` e `ReplacementLevels`**

`src/main/java/com/fantaagent/domain/player/Tier.java`

```java
package com.fantaagent.domain.player;

/** Fascia di un giocatore, dal rango nel ruolo rapportato al giocatore marginale. */
public enum Tier {
    ELITE, TOP, MID, DEPTH, FILLER;

    public static Tier of(int rankInRole, int replacementIndex) {
        double ratio = (double) rankInRole / replacementIndex;
        if (ratio <= 0.15) {
            return ELITE;
        }
        if (ratio <= 0.35) {
            return TOP;
        }
        if (ratio <= 0.70) {
            return MID;
        }
        if (ratio <= 1.00) {
            return DEPTH;
        }
        return FILLER;
    }
}
```

`src/main/java/com/fantaagent/domain/strategy/ReplacementLevels.java`

```java
package com.fantaagent.domain.strategy;

import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.player.PlayerProjection;
import com.fantaagent.domain.player.Role;

import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Collection;

/**
 * Punti e media voto del giocatore marginale per ruolo, cioè quello che resterebbe
 * comunque disponibile una volta che tutte le squadre hanno riempito quel ruolo.
 */
public record ReplacementLevels(Map<Role, Double> points, Map<Role, Double> ratings) {

    private static final double DEFAULT_RATING = 6.0;

    public ReplacementLevels {
        points = Map.copyOf(points);
        ratings = Map.copyOf(ratings);
    }

    public static ReplacementLevels from(LeagueRules rules, Collection<PlayerProjection> projections) {
        Map<Role, Double> points = new EnumMap<>(Role.class);
        Map<Role, Double> ratings = new EnumMap<>(Role.class);

        for (Role role : Role.values()) {
            List<PlayerProjection> ranked = projections.stream()
                    .filter(p -> p.role() == role)
                    .sorted(Comparator.comparingDouble(PlayerProjection::basePoints).reversed())
                    .toList();
            if (ranked.isEmpty()) {
                points.put(role, 0.0);
                ratings.put(role, DEFAULT_RATING);
                continue;
            }
            int index = Math.min(rules.replacementIndex(role), ranked.size()) - 1;
            PlayerProjection marginal = ranked.get(index);
            points.put(role, marginal.basePoints());
            ratings.put(role, marginal.expectedRating());
        }
        return new ReplacementLevels(points, ratings);
    }

    public double points(Role role) {
        return points.get(role);
    }

    public double rating(Role role) {
        return ratings.get(role);
    }
}
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `mvn -q test -Dtest=ReplacementLevelsTest`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/fantaagent/domain src/test/java/com/fantaagent/domain
git commit -m "feat: replacement level per ruolo e classificazione in fasce"
```

---

# FASE 4 — Stato dell'asta

### Task 10: Rosa, budget e aritmetica degli slot

**Files:**
- Create: `src/main/java/com/fantaagent/domain/auction/Holding.java`
- Create: `src/main/java/com/fantaagent/domain/auction/Squad.java`
- Test: `src/test/java/com/fantaagent/domain/auction/SquadTest.java`

**Interfaces:**
- Consumes: `LeagueRules`, `Role`.
- Produces:
  - `record Holding(long seq, String playerId, Role role, String participantId, int price)`
  - `record Squad(String participantId, List<Holding> holdings, LeagueRules rules)` con
    `int spent()`, `int budgetRemaining()`, `int count(Role)`, `int slotsRemaining(Role)`,
    `int slotsRemaining()`, `int maxSpendableNow()`, `boolean hasRoom(Role)`,
    `Squad with(Holding)`, `List<String> playerIds()`

`maxSpendableNow()` è l'invariante di budget della spec: `budgetRemaining - (slotsRemaining - 1)`,
mai negativo, e 0 quando la rosa è completa.

- [ ] **Step 1: Scrivere il test**

`src/test/java/com/fantaagent/domain/auction/SquadTest.java`

```java
package com.fantaagent.domain.auction;

import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class SquadTest {

    private static final LeagueRules RULES = new LeagueRules(8, 500,
            Map.of(Role.P, 3, Role.D, 8, Role.C, 8, Role.A, 6),
            List.of(Role.P, Role.D, Role.C, Role.A));

    private static Holding holding(long seq, String playerId, Role role, int price) {
        return new Holding(seq, playerId, role, "me", price);
    }

    private final Squad empty = new Squad("me", List.of(), RULES);

    @Test
    void anEmptySquadHasTheFullBudgetAndAllSlots() {
        assertThat(empty.spent()).isZero();
        assertThat(empty.budgetRemaining()).isEqualTo(500);
        assertThat(empty.slotsRemaining()).isEqualTo(25);
        // 500 - 24 slot ancora da riempire a 1 credito ciascuno
        assertThat(empty.maxSpendableNow()).isEqualTo(476);
    }

    @Test
    void spendingReducesBudgetAndSlots() {
        Squad squad = empty.with(holding(1, "p1", Role.P, 30))
                          .with(holding(2, "d1", Role.D, 45));

        assertThat(squad.spent()).isEqualTo(75);
        assertThat(squad.budgetRemaining()).isEqualTo(425);
        assertThat(squad.slotsRemaining()).isEqualTo(23);
        assertThat(squad.count(Role.D)).isEqualTo(1);
        assertThat(squad.slotsRemaining(Role.D)).isEqualTo(7);
        assertThat(squad.maxSpendableNow()).isEqualTo(425 - 22);
    }

    @Test
    void maxSpendableIsZeroWhenTheRosterIsComplete() {
        Squad squad = empty;
        long seq = 0;
        for (Role role : Role.values()) {
            for (int i = 0; i < RULES.slots(role); i++) {
                squad = squad.with(holding(++seq, role + "-" + i, role, 1));
            }
        }
        assertThat(squad.slotsRemaining()).isZero();
        assertThat(squad.maxSpendableNow()).isZero();
        assertThat(squad.hasRoom(Role.A)).isFalse();
    }

    @Test
    void maxSpendableNeverGoesNegative() {
        Squad squad = empty.with(holding(1, "star", Role.A, 500));

        assertThat(squad.budgetRemaining()).isZero();
        assertThat(squad.maxSpendableNow()).isZero();
    }

    @Test
    void hasRoomReflectsPerRoleSlots() {
        Squad squad = empty
                .with(holding(1, "p1", Role.P, 1))
                .with(holding(2, "p2", Role.P, 1))
                .with(holding(3, "p3", Role.P, 1));

        assertThat(squad.hasRoom(Role.P)).isFalse();
        assertThat(squad.hasRoom(Role.D)).isTrue();
        assertThat(squad.playerIds()).containsExactly("p1", "p2", "p3");
    }
}
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `mvn -q test -Dtest=SquadTest`
Expected: FAIL — `Holding` e `Squad` non esistono.

- [ ] **Step 3: Implementare `Holding` e `Squad`**

`src/main/java/com/fantaagent/domain/auction/Holding.java`

```java
package com.fantaagent.domain.auction;

import com.fantaagent.domain.player.Role;

/**
 * Un giocatore posseduto da un partecipante. Il ruolo è denormalizzato qui perché
 * l'aritmetica degli slot deve funzionare senza consultare il catalogo.
 */
public record Holding(long seq, String playerId, Role role, String participantId, int price) {
}
```

`src/main/java/com/fantaagent/domain/auction/Squad.java`

```java
package com.fantaagent.domain.auction;

import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.player.Role;

import java.util.ArrayList;
import java.util.List;

public record Squad(String participantId, List<Holding> holdings, LeagueRules rules) {

    public Squad {
        holdings = List.copyOf(holdings);
    }

    public int spent() {
        return holdings.stream().mapToInt(Holding::price).sum();
    }

    public int budgetRemaining() {
        return rules.budget() - spent();
    }

    public int count(Role role) {
        return (int) holdings.stream().filter(h -> h.role() == role).count();
    }

    public int slotsRemaining(Role role) {
        return Math.max(0, rules.slots(role) - count(role));
    }

    public int slotsRemaining() {
        int total = 0;
        for (Role role : Role.values()) {
            total += slotsRemaining(role);
        }
        return total;
    }

    public boolean hasRoom(Role role) {
        return slotsRemaining(role) > 0;
    }

    /**
     * Massimo spendibile su un singolo giocatore adesso: ogni altro slot ancora
     * scoperto costa almeno 1 credito. Invariante di budget della spec.
     */
    public int maxSpendableNow() {
        int slots = slotsRemaining();
        if (slots == 0) {
            return 0;
        }
        return Math.max(0, budgetRemaining() - (slots - 1));
    }

    public Squad with(Holding holding) {
        List<Holding> next = new ArrayList<>(holdings);
        next.add(holding);
        return new Squad(participantId, next, rules);
    }

    public List<String> playerIds() {
        return holdings.stream().map(Holding::playerId).toList();
    }
}
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `mvn -q test -Dtest=SquadTest`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/fantaagent/domain/auction src/test/java/com/fantaagent/domain/auction
git commit -m "feat: rosa e aritmetica di budget e slot"
```

---

### Task 11: Eventi d'asta e proiezione dello stato

**Files:**
- Create: `src/main/java/com/fantaagent/domain/auction/AuctionEvent.java`
- Create: `src/main/java/com/fantaagent/domain/auction/AuctionState.java`
- Create: `src/main/java/com/fantaagent/domain/auction/AuctionProjector.java`
- Test: `src/test/java/com/fantaagent/domain/auction/AuctionProjectorTest.java`

**Interfaces:**
- Consumes: `Squad`, `Holding`, `LeagueRules`, `Participant`, `RoleLookup`.
- Produces:
  - `sealed interface AuctionEvent` con `long seq()`, `Instant at()` e i record annidati
    `AuctionEvent.AuctionStarted(long seq, Instant at)`,
    `AuctionEvent.PhaseAdvanced(long seq, Instant at, Role role)`,
    `AuctionEvent.PlayerPurchased(long seq, Instant at, String playerId, String participantId, int price)`,
    `AuctionEvent.PurchaseRevoked(long seq, Instant at, long targetSeq)`,
    `AuctionEvent.PurchaseCorrected(long seq, Instant at, long targetSeq, String newParticipantId, int newPrice)`
  - `record AuctionState(LeagueRules rules, Role currentPhase, String myParticipantId, Map<String,Squad> squads, List<Holding> holdings)`
    con `Squad squadOf(String)`, `Squad mySquad()`, `Set<String> soldPlayerIds()`
  - `AuctionProjector.project(LeagueRules, List<Participant>, RoleLookup, List<AuctionEvent>)` -> `AuctionState`

- [ ] **Step 1: Scrivere il test**

`src/test/java/com/fantaagent/domain/auction/AuctionProjectorTest.java`

```java
package com.fantaagent.domain.auction;

import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Role;
import com.fantaagent.domain.player.RoleLookup;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class AuctionProjectorTest {

    private static final LeagueRules RULES = new LeagueRules(2, 500,
            Map.of(Role.P, 3, Role.D, 8, Role.C, 8, Role.A, 6),
            List.of(Role.P, Role.D, Role.C, Role.A));

    private static final List<Participant> PARTICIPANTS = List.of(
            new Participant("me", "Io", 'I', true),
            new Participant("marco", "Marco", 'M', false));

    private static final Map<String, Role> ROLES = Map.of(
            "sommer", Role.P, "bastoni", Role.D, "dimarco", Role.D, "lautaro", Role.A);

    private static final RoleLookup LOOKUP = id -> {
        Role role = ROLES.get(id);
        if (role == null) {
            throw new IllegalArgumentException("unknown player id: " + id);
        }
        return role;
    };

    private static final Instant T = Instant.parse("2026-09-05T20:00:00Z");

    private AuctionState project(List<AuctionEvent> events) {
        return AuctionProjector.project(RULES, PARTICIPANTS, LOOKUP, events);
    }

    @Test
    void anEmptyLogYieldsTheFirstPhaseAndEmptySquads() {
        AuctionState state = project(List.of());

        assertThat(state.currentPhase()).isEqualTo(Role.P);
        assertThat(state.mySquad().holdings()).isEmpty();
        assertThat(state.squadOf("marco").budgetRemaining()).isEqualTo(500);
        assertThat(state.soldPlayerIds()).isEmpty();
    }

    @Test
    void purchasesLandInTheRightSquads() {
        AuctionState state = project(List.of(
                new AuctionEvent.AuctionStarted(1, T),
                new AuctionEvent.PlayerPurchased(2, T, "sommer", "me", 30),
                new AuctionEvent.PlayerPurchased(3, T, "bastoni", "marco", 45)));

        assertThat(state.mySquad().spent()).isEqualTo(30);
        assertThat(state.squadOf("marco").spent()).isEqualTo(45);
        assertThat(state.soldPlayerIds()).containsExactlyInAnyOrder("sommer", "bastoni");
        assertThat(state.holdings()).hasSize(2);
    }

    @Test
    void phaseAdvancesAreApplied() {
        AuctionState state = project(List.of(
                new AuctionEvent.AuctionStarted(1, T),
                new AuctionEvent.PhaseAdvanced(2, T, Role.D)));

        assertThat(state.currentPhase()).isEqualTo(Role.D);
    }

    @Test
    void revokingAPurchaseRestoresBudgetAndFreesThePlayer() {
        AuctionState state = project(List.of(
                new AuctionEvent.PlayerPurchased(1, T, "sommer", "me", 30),
                new AuctionEvent.PlayerPurchased(2, T, "bastoni", "me", 45),
                new AuctionEvent.PurchaseRevoked(3, T, 2)));

        assertThat(state.mySquad().spent()).isEqualTo(30);
        assertThat(state.soldPlayerIds()).containsExactly("sommer");
    }

    @Test
    void correctingAPurchaseUpdatesPriceAndOwnerWithoutChangingThePlayer() {
        AuctionState state = project(List.of(
                new AuctionEvent.PlayerPurchased(1, T, "lautaro", "me", 90),
                new AuctionEvent.PurchaseCorrected(2, T, 1, "marco", 75)));

        assertThat(state.mySquad().holdings()).isEmpty();
        assertThat(state.squadOf("marco").spent()).isEqualTo(75);
        assertThat(state.soldPlayerIds()).containsExactly("lautaro");
    }

    @Test
    void revokingAnAlreadyRevokedPurchaseIsANoOp() {
        AuctionState state = project(List.of(
                new AuctionEvent.PlayerPurchased(1, T, "sommer", "me", 30),
                new AuctionEvent.PurchaseRevoked(2, T, 1),
                new AuctionEvent.PurchaseRevoked(3, T, 1)));

        assertThat(state.holdings()).isEmpty();
        assertThat(state.mySquad().budgetRemaining()).isEqualTo(500);
    }

    @Test
    void projectionIsPureAndRepeatable() {
        List<AuctionEvent> events = List.of(
                new AuctionEvent.PlayerPurchased(1, T, "sommer", "me", 30),
                new AuctionEvent.PlayerPurchased(2, T, "dimarco", "marco", 40));

        assertThat(project(events)).isEqualTo(project(events));
    }
}
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `mvn -q test -Dtest=AuctionProjectorTest`
Expected: FAIL — i tipi non esistono.

- [ ] **Step 3: Creare `AuctionEvent`**

`src/main/java/com/fantaagent/domain/auction/AuctionEvent.java`

```java
package com.fantaagent.domain.auction;

import com.fantaagent.domain.player.Role;

import java.time.Instant;

/**
 * Evento immutabile del log d'asta. Il log è append-only: una correzione o un
 * annullamento sono nuovi eventi che ne referenziano uno precedente, mai una modifica
 * o una cancellazione di quello originale.
 */
public sealed interface AuctionEvent {

    long seq();

    Instant at();

    record AuctionStarted(long seq, Instant at) implements AuctionEvent {
    }

    record PhaseAdvanced(long seq, Instant at, Role role) implements AuctionEvent {
    }

    record PlayerPurchased(long seq, Instant at, String playerId, String participantId, int price)
            implements AuctionEvent {

        public PlayerPurchased {
            if (price < 1) {
                throw new IllegalArgumentException("price must be at least 1");
            }
        }
    }

    record PurchaseRevoked(long seq, Instant at, long targetSeq) implements AuctionEvent {
    }

    record PurchaseCorrected(long seq, Instant at, long targetSeq,
                             String newParticipantId, int newPrice) implements AuctionEvent {

        public PurchaseCorrected {
            if (newPrice < 1) {
                throw new IllegalArgumentException("price must be at least 1");
            }
        }
    }
}
```

- [ ] **Step 4: Creare `AuctionState` e `AuctionProjector`**

`src/main/java/com/fantaagent/domain/auction/AuctionState.java`

```java
package com.fantaagent.domain.auction;

import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.player.Role;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

public record AuctionState(
        LeagueRules rules,
        Role currentPhase,
        String myParticipantId,
        Map<String, Squad> squads,
        List<Holding> holdings) {

    public AuctionState {
        squads = Map.copyOf(squads);
        holdings = List.copyOf(holdings);
    }

    public Squad squadOf(String participantId) {
        Squad squad = squads.get(participantId);
        if (squad == null) {
            throw new IllegalArgumentException("unknown participant: " + participantId);
        }
        return squad;
    }

    public Squad mySquad() {
        return squadOf(myParticipantId);
    }

    public Set<String> soldPlayerIds() {
        return holdings.stream().map(Holding::playerId).collect(Collectors.toUnmodifiableSet());
    }
}
```

`src/main/java/com/fantaagent/domain/auction/AuctionProjector.java`

```java
package com.fantaagent.domain.auction;

import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Role;
import com.fantaagent.domain.player.RoleLookup;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Piega il log degli eventi nello stato corrente. Funzione pura: stessi eventi,
 * stesso stato. È il solo modo di costruire un {@link AuctionState}.
 */
public final class AuctionProjector {

    private AuctionProjector() {
    }

    public static AuctionState project(LeagueRules rules, List<Participant> participants,
                                       RoleLookup roles, List<AuctionEvent> events) {
        Map<Long, Holding> active = new LinkedHashMap<>();
        Role currentPhase = rules.firstPhase();

        for (AuctionEvent event : events) {
            switch (event) {
                case AuctionEvent.AuctionStarted ignored -> {
                    // nessun effetto sullo stato derivato
                }
                case AuctionEvent.PhaseAdvanced advanced -> currentPhase = advanced.role();
                case AuctionEvent.PlayerPurchased purchased -> active.put(purchased.seq(),
                        new Holding(purchased.seq(), purchased.playerId(),
                                roles.roleOf(purchased.playerId()),
                                purchased.participantId(), purchased.price()));
                case AuctionEvent.PurchaseRevoked revoked -> active.remove(revoked.targetSeq());
                case AuctionEvent.PurchaseCorrected corrected -> active.computeIfPresent(
                        corrected.targetSeq(),
                        (seq, holding) -> new Holding(holding.seq(), holding.playerId(),
                                holding.role(), corrected.newParticipantId(), corrected.newPrice()));
            }
        }

        List<Holding> holdings = List.copyOf(active.values());
        Map<String, Squad> squads = new LinkedHashMap<>();
        for (Participant participant : participants) {
            List<Holding> owned = holdings.stream()
                    .filter(h -> h.participantId().equals(participant.id()))
                    .toList();
            squads.put(participant.id(), new Squad(participant.id(), owned, rules));
        }

        String me = participants.stream()
                .filter(Participant::me)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("no participant flagged as me"))
                .id();

        return new AuctionState(rules, currentPhase, me, squads, holdings);
    }
}
```

- [ ] **Step 5: Eseguire il test e verificare che passi**

Run: `mvn -q test -Dtest=AuctionProjectorTest`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/main/java/com/fantaagent/domain/auction src/test/java/com/fantaagent/domain/auction
git commit -m "feat: eventi d'asta e proiezione pura dello stato"
```

---

### Task 12: Log degli eventi durevole su JSONL

**Files:**
- Create: `src/main/java/com/fantaagent/application/port/out/AuctionEventStore.java`
- Create: `src/main/java/com/fantaagent/adapter/out/file/event/EventDto.java`
- Create: `src/main/java/com/fantaagent/adapter/out/file/JsonlAuctionEventStore.java`
- Modify: `src/main/java/com/fantaagent/config/BeanConfig.java` (bean `AuctionEventStore`)
- Test: `src/test/java/com/fantaagent/adapter/out/file/JsonlAuctionEventStoreTest.java`

**Interfaces:**
- Consumes: `AuctionEvent` dal Task 11.
- Produces:
  - `interface AuctionEventStore { void append(AuctionEvent event); List<AuctionEvent> load(); long nextSeq(); void backup(String label); }`
  - `JsonlAuctionEventStore(Path file)`

Il dominio non conosce Jackson: la serializzazione vive in `EventDto`, un record piatto
con un campo discriminante `type`. Ogni `append` fa `force(true)` sul canale: un crash
non deve perdere l'ultimo acquisto registrato.

- [ ] **Step 1: Scrivere il test**

`src/test/java/com/fantaagent/adapter/out/file/JsonlAuctionEventStoreTest.java`

```java
package com.fantaagent.adapter.out.file;

import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class JsonlAuctionEventStoreTest {

    @TempDir
    Path tmp;

    private static final Instant T = Instant.parse("2026-09-05T20:00:00Z");

    @Test
    void startsEmptyWhenTheFileDoesNotExist() {
        JsonlAuctionEventStore store = new JsonlAuctionEventStore(tmp.resolve("events.jsonl"));

        assertThat(store.load()).isEmpty();
        assertThat(store.nextSeq()).isEqualTo(1L);
    }

    @Test
    void appendsAndReloadsEveryEventType() {
        Path file = tmp.resolve("events.jsonl");
        JsonlAuctionEventStore store = new JsonlAuctionEventStore(file);

        store.append(new AuctionEvent.AuctionStarted(1, T));
        store.append(new AuctionEvent.PhaseAdvanced(2, T, Role.D));
        store.append(new AuctionEvent.PlayerPurchased(3, T, "bastoni", "me", 47));
        store.append(new AuctionEvent.PurchaseCorrected(4, T, 3, "marco", 45));
        store.append(new AuctionEvent.PurchaseRevoked(5, T, 3));

        List<AuctionEvent> reloaded = new JsonlAuctionEventStore(file).load();

        assertThat(reloaded).containsExactly(
                new AuctionEvent.AuctionStarted(1, T),
                new AuctionEvent.PhaseAdvanced(2, T, Role.D),
                new AuctionEvent.PlayerPurchased(3, T, "bastoni", "me", 47),
                new AuctionEvent.PurchaseCorrected(4, T, 3, "marco", 45),
                new AuctionEvent.PurchaseRevoked(5, T, 3));
    }

    @Test
    void writesOneJsonObjectPerLine() throws Exception {
        Path file = tmp.resolve("events.jsonl");
        JsonlAuctionEventStore store = new JsonlAuctionEventStore(file);
        store.append(new AuctionEvent.PlayerPurchased(1, T, "bastoni", "me", 47));
        store.append(new AuctionEvent.PlayerPurchased(2, T, "dimarco", "me", 40));

        List<String> lines = Files.readAllLines(file);

        assertThat(lines).hasSize(2);
        assertThat(lines.getFirst()).startsWith("{").endsWith("}").contains("\"bastoni\"");
    }

    @Test
    void nextSeqContinuesAfterTheLastPersistedEvent() {
        Path file = tmp.resolve("events.jsonl");
        JsonlAuctionEventStore store = new JsonlAuctionEventStore(file);
        store.append(new AuctionEvent.PlayerPurchased(1, T, "bastoni", "me", 47));
        store.append(new AuctionEvent.PlayerPurchased(2, T, "dimarco", "me", 40));

        assertThat(store.nextSeq()).isEqualTo(3L);
        assertThat(new JsonlAuctionEventStore(file).nextSeq()).isEqualTo(3L);
    }

    @Test
    void backupCopiesTheWholeLogUnderALabelledName() {
        Path file = tmp.resolve("events.jsonl");
        JsonlAuctionEventStore store = new JsonlAuctionEventStore(file);
        store.append(new AuctionEvent.PlayerPurchased(1, T, "bastoni", "me", 47));

        store.backup("fine-P");

        Path backup = tmp.resolve("events-fine-P.jsonl.bak");
        assertThat(backup).exists();
        assertThat(new JsonlAuctionEventStore(backup).load()).hasSize(1);
    }

    @Test
    void backupIsANoOpWhenThereIsNothingToCopy() {
        JsonlAuctionEventStore store = new JsonlAuctionEventStore(tmp.resolve("events.jsonl"));

        store.backup("vuoto");

        assertThat(tmp.resolve("events-vuoto.jsonl.bak")).doesNotExist();
    }

    @Test
    void survivesAProcessRestartAfterEveryAppend() {
        Path file = tmp.resolve("events.jsonl");
        // Ogni append apre, scrive, forza su disco e chiude: simuliamo 50 crash.
        for (int i = 1; i <= 50; i++) {
            JsonlAuctionEventStore store = new JsonlAuctionEventStore(file);
            store.append(new AuctionEvent.PlayerPurchased(store.nextSeq(), T, "p" + i, "me", 1));
        }
        assertThat(new JsonlAuctionEventStore(file).load()).hasSize(50);
    }
}
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `mvn -q test -Dtest=JsonlAuctionEventStoreTest`
Expected: FAIL — `JsonlAuctionEventStore` non esiste.

- [ ] **Step 3: Creare la porta e il DTO**

`src/main/java/com/fantaagent/application/port/out/AuctionEventStore.java`

```java
package com.fantaagent.application.port.out;

import com.fantaagent.domain.auction.AuctionEvent;

import java.util.List;

public interface AuctionEventStore {

    /** Appende l'evento e ne garantisce la persistenza prima di ritornare. */
    void append(AuctionEvent event);

    List<AuctionEvent> load();

    /** Numero di sequenza da assegnare al prossimo evento. Parte da 1. */
    long nextSeq();

    /** Copia di sicurezza del log. Chiamata a ogni cambio di fase. */
    void backup(String label);
}
```

`src/main/java/com/fantaagent/adapter/out/file/event/EventDto.java`

```java
package com.fantaagent.adapter.out.file.event;

import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.player.Role;

import java.time.Instant;

/**
 * Forma serializzata degli eventi. Record piatto con discriminante esplicito: evita la
 * configurazione polimorfica di Jackson e tiene la libreria fuori dal dominio.
 */
public record EventDto(
        String type,
        long seq,
        Instant at,
        Role role,
        String playerId,
        String participantId,
        Integer price,
        Long targetSeq) {

    public static EventDto from(AuctionEvent event) {
        return switch (event) {
            case AuctionEvent.AuctionStarted e ->
                    new EventDto("AuctionStarted", e.seq(), e.at(), null, null, null, null, null);
            case AuctionEvent.PhaseAdvanced e ->
                    new EventDto("PhaseAdvanced", e.seq(), e.at(), e.role(), null, null, null, null);
            case AuctionEvent.PlayerPurchased e ->
                    new EventDto("PlayerPurchased", e.seq(), e.at(), null,
                            e.playerId(), e.participantId(), e.price(), null);
            case AuctionEvent.PurchaseRevoked e ->
                    new EventDto("PurchaseRevoked", e.seq(), e.at(), null,
                            null, null, null, e.targetSeq());
            case AuctionEvent.PurchaseCorrected e ->
                    new EventDto("PurchaseCorrected", e.seq(), e.at(), null,
                            null, e.newParticipantId(), e.newPrice(), e.targetSeq());
        };
    }

    public AuctionEvent toDomain() {
        return switch (type) {
            case "AuctionStarted" -> new AuctionEvent.AuctionStarted(seq, at);
            case "PhaseAdvanced" -> new AuctionEvent.PhaseAdvanced(seq, at, role);
            case "PlayerPurchased" ->
                    new AuctionEvent.PlayerPurchased(seq, at, playerId, participantId, price);
            case "PurchaseRevoked" -> new AuctionEvent.PurchaseRevoked(seq, at, targetSeq);
            case "PurchaseCorrected" ->
                    new AuctionEvent.PurchaseCorrected(seq, at, targetSeq, participantId, price);
            default -> throw new IllegalStateException("tipo di evento sconosciuto: " + type);
        };
    }
}
```

- [ ] **Step 4: Implementare lo store**

`src/main/java/com/fantaagent/adapter/out/file/JsonlAuctionEventStore.java`

```java
package com.fantaagent.adapter.out.file;

import com.fantaagent.adapter.out.file.event.EventDto;
import com.fantaagent.application.port.out.AuctionEventStore;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.List;

/**
 * Log append-only degli eventi d'asta, una riga JSON per evento.
 *
 * <p>Ogni append apre il file, scrive, forza la scrittura su disco e chiude. Aprire il
 * canale a ogni evento costa circa un millisecondo — ben dentro il budget di 100 ms —
 * e in cambio elimina ogni gestione di risorse a lungo termine e ogni rischio di
 * perdere l'ultima riga per un buffer non svuotato.
 */
public class JsonlAuctionEventStore implements AuctionEventStore {

    private static final ObjectMapper MAPPER = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    private final Path file;

    public JsonlAuctionEventStore(Path file) {
        this.file = file;
    }

    @Override
    public void append(AuctionEvent event) {
        try {
            Path parent = file.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            String line = MAPPER.writeValueAsString(EventDto.from(event)) + "\n";
            try (FileChannel channel = FileChannel.open(file,
                    StandardOpenOption.CREATE,
                    StandardOpenOption.WRITE,
                    StandardOpenOption.APPEND)) {
                channel.write(ByteBuffer.wrap(line.getBytes(StandardCharsets.UTF_8)));
                channel.force(true);
            }
        } catch (IOException e) {
            throw new UncheckedIOException("impossibile scrivere l'evento su " + file, e);
        }
    }

    @Override
    public List<AuctionEvent> load() {
        if (!Files.exists(file)) {
            return List.of();
        }
        try {
            List<AuctionEvent> events = new ArrayList<>();
            for (String line : Files.readAllLines(file, StandardCharsets.UTF_8)) {
                if (!line.isBlank()) {
                    events.add(MAPPER.readValue(line, EventDto.class).toDomain());
                }
            }
            return List.copyOf(events);
        } catch (IOException e) {
            throw new UncheckedIOException("impossibile leggere il log eventi " + file, e);
        }
    }

    @Override
    public long nextSeq() {
        List<AuctionEvent> events = load();
        return events.isEmpty() ? 1L : events.getLast().seq() + 1L;
    }

    @Override
    public void backup(String label) {
        if (!Files.exists(file)) {
            return;
        }
        try {
            Path target = file.resolveSibling("events-" + label + ".jsonl.bak");
            Files.copy(file, target, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new UncheckedIOException("impossibile creare il backup del log " + file, e);
        }
    }
}
```

Aggiungere a `BeanConfig`:

```java
    @Bean
    public com.fantaagent.application.port.out.AuctionEventStore auctionEventStore(
            @org.springframework.beans.factory.annotation.Value("${fantaagent.data-dir:data}") String dataDir,
            @org.springframework.beans.factory.annotation.Value("${fantaagent.auction-id:current}") String auctionId) {
        return new com.fantaagent.adapter.out.file.JsonlAuctionEventStore(
                java.nio.file.Path.of(dataDir, "auctions", auctionId, "events.jsonl"));
    }
```

- [ ] **Step 5: Eseguire tutti i test**

Run: `mvn -q test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/main/java/com/fantaagent src/test/java/com/fantaagent
git commit -m "feat: log degli eventi d'asta durevole su JSONL con fsync"
```

---

# FASE 5 — Motore di valutazione E2

### Task 13: Modificatori difesa e portiere

**Files:**
- Create: `src/main/java/com/fantaagent/domain/strategy/ModifierCalculator.java`
- Test: `src/test/java/com/fantaagent/domain/strategy/ModifierCalculatorTest.java`

**Interfaces:**
- Consumes: `ScoringRules`, `ModifierTable`, `ReplacementLevels`, `PlayerProjection`, `Role`.
- Produces: `ModifierCalculator(ScoringRules scoring, ReplacementLevels replacement)` con
  - `double modifierPoints(List<PlayerProjection> squad)`
  - `double squadPoints(List<PlayerProjection> squad)` — somma dei `basePoints` più i modificatori
  - `double marginalPoints(List<PlayerProjection> squad, PlayerProjection candidate)`

Modello, dalla spec §7.2. La media di reparto usa il portiere migliore in rosa e i
`defendersCounted` difensori con media voto più alta. **Gli slot ancora scoperti sono
riempiti con la media voto del giocatore marginale del ruolo**: è questo che rende il
termine definito già durante la fase portieri, quando la difesa non esiste ancora, ed è
la traduzione operativa del "piano di rosa" della spec.

- [ ] **Step 1: Scrivere il test**

`src/test/java/com/fantaagent/domain/strategy/ModifierCalculatorTest.java`

```java
package com.fantaagent.domain.strategy;

import com.fantaagent.domain.league.ModifierTable;
import com.fantaagent.domain.league.ScoringRules;
import com.fantaagent.domain.player.PlayerProjection;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class ModifierCalculatorTest {

    /** Un gradino a 6.0 che vale 1 gol, uno a 6.5 che ne vale 3. */
    private static final ModifierTable DEFENCE = new ModifierTable(3, List.of(
            new ModifierTable.Threshold(0.0, 0.0),
            new ModifierTable.Threshold(6.0, 1.0),
            new ModifierTable.Threshold(6.5, 3.0)));

    private static final ModifierTable KEEPER = new ModifierTable(0, List.of(
            new ModifierTable.Threshold(0.0, 0.0),
            new ModifierTable.Threshold(6.2, 1.0)));

    private final ScoringRules scoring = new ScoringRules(true,
            Map.of(Role.P, 3.0, Role.D, 4.0, Role.C, 3.5, Role.A, 3.0),
            1.0, 3.0, -3.0, 3.0, -0.5, -1.0, -1.0, 1.0, DEFENCE, KEEPER);

    /** Marginale: portieri 5.9, difensori 5.9 — sotto ogni soglia. */
    private final ReplacementLevels replacement = new ReplacementLevels(
            Map.of(Role.P, 100.0, Role.D, 100.0, Role.C, 100.0, Role.A, 100.0),
            Map.of(Role.P, 5.9, Role.D, 5.9, Role.C, 5.9, Role.A, 5.9));

    private final ModifierCalculator calculator = new ModifierCalculator(scoring, replacement);

    private static PlayerProjection player(String id, Role role, double rating, double points) {
        return new PlayerProjection(id, role, rating, 0.0, 30.0, points, 30.0);
    }

    @Test
    void anEmptySquadFallsBackToReplacementRatings() {
        // reparto tutto a 5.9: nessuna soglia raggiunta, nessun bonus
        assertThat(calculator.modifierPoints(List.of())).isZero();
    }

    @Test
    void reachingTheDefenceThresholdIsWorthAWholeStep() {
        // portiere 6.0 + tre difensori 6.4 -> media (6.0+6.4*3)/4 = 6.3 -> gradino 6.0 = 1 gol
        List<PlayerProjection> squad = List.of(
                player("gk", Role.P, 6.0, 150),
                player("d1", Role.D, 6.4, 150),
                player("d2", Role.D, 6.4, 150),
                player("d3", Role.D, 6.4, 150));

        // difesa: 38 * 1.0 ; portiere: 6.0 < 6.2 -> 0
        assertThat(calculator.modifierPoints(squad)).isCloseTo(38.0, within(0.001));
    }

    @Test
    void theGoalkeeperModifierDependsOnTheKeepersOwnRating() {
        // 6.0 e 6.2 lasciano la media di reparto sotto 6.0 in entrambi i casi
        // (con tre riempitivi a 5.9): cosi' varia solo il gradino del portiere.
        List<PlayerProjection> weak = List.of(player("gk", Role.P, 6.0, 150));
        List<PlayerProjection> strong = List.of(player("gk", Role.P, 6.2, 150));

        // difesa invariata; cambia solo il gradino del portiere: 38 * 1.0
        assertThat(calculator.modifierPoints(strong) - calculator.modifierPoints(weak))
                .isCloseTo(38.0, within(0.001));
    }

    @Test
    void onlyTheBestDefendersCountTowardsTheAverage() {
        List<PlayerProjection> squad = List.of(
                player("gk", Role.P, 6.0, 150),
                player("d1", Role.D, 6.8, 150),
                player("d2", Role.D, 6.8, 150),
                player("d3", Role.D, 6.8, 150),
                player("d4", Role.D, 4.0, 10));   // riserva scarsa, deve essere ignorata

        // media (6.0 + 6.8*3)/4 = 6.6 -> gradino 6.5
        assertThat(calculator.modifierPoints(squad)).isCloseTo(38.0 * 3.0, within(0.001));
    }

    @Test
    void marginalPointsIncludeTheModifierDelta() {
        // media attuale (6.4 + 6.8 + 6.8 + riempitivo 5.9) / 4 = 6.475 -> gradino 6.0
        List<PlayerProjection> squad = List.of(
                player("gk", Role.P, 6.4, 150),
                player("d1", Role.D, 6.8, 150),
                player("d2", Role.D, 6.8, 150));
        // il terzo sostituisce il riempitivo e porta la media a 6.7 -> gradino 6.5
        PlayerProjection third = player("d3", Role.D, 6.8, 120);

        double marginal = calculator.marginalPoints(squad, third);

        assertThat(marginal).isGreaterThan(third.basePoints());
    }

    @Test
    void aDefenderCrossingTheThresholdBeatsAStrongerOneThatDoesNot() {
        // È il comportamento distintivo del motore: se si rompe, l'app torna a essere un listone.
        List<PlayerProjection> squad = List.of(
                player("gk", Role.P, 6.6, 150),
                player("d1", Role.D, 6.6, 150),
                player("d2", Role.D, 6.6, 150));

        // media attuale con riempitivo 5.9: (6.6+6.6+6.6+5.9)/4 = 6.425 -> gradino 6.0
        PlayerProjection crosses = player("cross", Role.D, 6.6, 140);   // media 6.6 -> gradino 6.5
        PlayerProjection stronger = player("strong", Role.D, 5.9, 175); // media invariata

        assertThat(calculator.marginalPoints(squad, crosses))
                .isGreaterThan(calculator.marginalPoints(squad, stronger));
    }

    @Test
    void squadPointsSumBasePointsAndModifiers() {
        List<PlayerProjection> squad = List.of(
                player("gk", Role.P, 6.0, 150),
                player("d1", Role.D, 6.4, 100),
                player("d2", Role.D, 6.4, 100),
                player("d3", Role.D, 6.4, 100));

        assertThat(calculator.squadPoints(squad)).isCloseTo(450.0 + 38.0, within(0.001));
    }
}
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `mvn -q test -Dtest=ModifierCalculatorTest`
Expected: FAIL — `ModifierCalculator` non esiste.

- [ ] **Step 3: Implementare `ModifierCalculator`**

`src/main/java/com/fantaagent/domain/strategy/ModifierCalculator.java`

```java
package com.fantaagent.domain.strategy;

import com.fantaagent.domain.league.ScoringRules;
import com.fantaagent.domain.player.PlayerProjection;
import com.fantaagent.domain.player.ProjectionCalculator;
import com.fantaagent.domain.player.Role;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Traduce i modificatori di difesa e portiere in punti stagionali.
 *
 * <p>Il modificatore non è una proprietà del giocatore ma del reparto schierato: il
 * contributo di un singolo giocatore è quindi una differenza fra il reparto con e senza
 * di lui. Gli slot scoperti sono riempiti con la media voto del giocatore marginale del
 * ruolo, così che il termine sia definito anche a rosa vuota.
 */
public final class ModifierCalculator {

    private final ScoringRules scoring;
    private final ReplacementLevels replacement;

    public ModifierCalculator(ScoringRules scoring, ReplacementLevels replacement) {
        this.scoring = scoring;
        this.replacement = replacement;
    }

    public double modifierPoints(List<PlayerProjection> squad) {
        double keeperRating = bestRating(squad, Role.P).orElse(replacement.rating(Role.P));

        int defendersCounted = scoring.defenceModifier().defendersCounted();
        List<Double> defenderRatings = topRatings(squad, Role.D, defendersCounted);
        while (defenderRatings.size() < defendersCounted) {
            defenderRatings.add(replacement.rating(Role.D));
        }

        double sum = keeperRating;
        for (double rating : defenderRatings) {
            sum += rating;
        }
        double unitAverage = sum / (defenderRatings.size() + 1);

        double defenceBonus = scoring.defenceModifier().bonusFor(unitAverage);
        double keeperBonus = scoring.goalkeeperModifier().bonusFor(keeperRating);

        return ProjectionCalculator.SEASON_MATCHES * (defenceBonus + keeperBonus);
    }

    /** Valore complessivo della rosa: punti base dei giocatori più i modificatori. */
    public double squadPoints(List<PlayerProjection> squad) {
        double base = squad.stream().mapToDouble(PlayerProjection::basePoints).sum();
        return base + modifierPoints(squad);
    }

    /** Contributo del candidato alla rosa data, modificatori inclusi. */
    public double marginalPoints(List<PlayerProjection> squad, PlayerProjection candidate) {
        List<PlayerProjection> extended = new ArrayList<>(squad);
        extended.add(candidate);
        return candidate.basePoints() + (modifierPoints(extended) - modifierPoints(squad));
    }

    private static java.util.OptionalDouble bestRating(List<PlayerProjection> squad, Role role) {
        return squad.stream()
                .filter(p -> p.role() == role)
                .mapToDouble(PlayerProjection::expectedRating)
                .max();
    }

    private static List<Double> topRatings(List<PlayerProjection> squad, Role role, int howMany) {
        return new ArrayList<>(squad.stream()
                .filter(p -> p.role() == role)
                .map(PlayerProjection::expectedRating)
                .sorted(Comparator.reverseOrder())
                .limit(howMany)
                .toList());
    }
}
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `mvn -q test -Dtest=ModifierCalculatorTest`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/fantaagent/domain/strategy src/test/java/com/fantaagent/domain/strategy
git commit -m "feat: modificatori difesa e portiere come termine di reparto"
```

---

### Task 14: Prezzi attesi di mercato con inflazione forward-looking

**Files:**
- Create: `src/main/java/com/fantaagent/domain/strategy/PriceModel.java`
- Test: `src/test/java/com/fantaagent/domain/strategy/PriceModelTest.java`

**Interfaces:**
- Consumes: `AuctionState`, `Holding`, `PlayerProjection`, `LeagueRules`.
- Produces:
  - `record PriceModel(Map<String,Double> priors, double inflationForward, Map<Role,Double> roleBias)`
  - `static PriceModel build(LeagueRules rules, AuctionState state, Collection<PlayerProjection> allProjections, ToIntFunction<String> listPriceOf)`
  - `int expectedPrice(PlayerProjection projection)` — sempre almeno 1
  - `static Set<String> rosterWorthy(LeagueRules rules, Collection<PlayerProjection> all)`

Modello, dalla spec §7.3:

```
prior(p)           = listPrice(p) * scala, con scala tale che Σ prior sui roster-worthy
                     eguagli il monte crediti della lega a inizio asta
inflationForward   = crediti residui della lega / Σ prior dei roster-worthy ancora disponibili
roleBias(ruolo)    = rapporto pagato/prior osservato in quel ruolo, rapportato a quello
                     globale e smorzato verso 1 quando i campioni sono pochi
expectedPrice(p)   = round(prior(p) * inflationForward * roleBias(ruolo))
```

`rosterWorthy` sono i primi `partecipanti * slot(ruolo)` di ciascun ruolo per punti
attesi: i giocatori oltre quella soglia non assorbono budget significativo.

- [ ] **Step 1: Scrivere il test**

`src/test/java/com/fantaagent/domain/strategy/PriceModelTest.java`

```java
package com.fantaagent.domain.strategy;

import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.auction.AuctionProjector;
import com.fantaagent.domain.auction.AuctionState;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.PlayerProjection;
import com.fantaagent.domain.player.Role;
import com.fantaagent.domain.player.RoleLookup;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class PriceModelTest {

    private static final Instant T = Instant.parse("2026-09-05T20:00:00Z");

    private static final LeagueRules RULES = new LeagueRules(2, 100,
            Map.of(Role.P, 1, Role.D, 2, Role.C, 2, Role.A, 1),
            List.of(Role.P, Role.D, Role.C, Role.A));

    private static final List<Participant> PARTICIPANTS = List.of(
            new Participant("me", "Io", 'I', true),
            new Participant("marco", "Marco", 'M', false));

    private final Map<String, Integer> listPrices = new HashMap<>();
    private final Map<String, Role> roles = new HashMap<>();
    private final List<PlayerProjection> projections = new ArrayList<>();

    private PlayerProjection add(String id, Role role, double points, int listPrice) {
        PlayerProjection p = new PlayerProjection(id, role, 6.0, 0.0, 30.0, points, 30.0);
        projections.add(p);
        listPrices.put(id, listPrice);
        roles.put(id, role);
        return p;
    }

    private final RoleLookup lookup = id -> roles.get(id);

    private AuctionState state(List<AuctionEvent> events) {
        return AuctionProjector.project(RULES, PARTICIPANTS, lookup, events);
    }

    private PriceModel build(AuctionState state) {
        return PriceModel.build(RULES, state, projections, id -> listPrices.get(id));
    }

    private void seedBalancedPool() {
        // 2 partecipanti * 100 crediti = 200 di monte crediti.
        // roster-worthy: 2 P, 4 D, 4 C, 2 A. Somma quotazioni = 200 -> scala 1.0.
        add("p1", Role.P, 300, 20);
        add("p2", Role.P, 290, 20);
        add("d1", Role.D, 280, 20);
        add("d2", Role.D, 270, 20);
        add("d3", Role.D, 260, 20);
        add("d4", Role.D, 250, 20);
        add("c1", Role.C, 240, 15);
        add("c2", Role.C, 230, 15);
        add("c3", Role.C, 220, 15);
        add("c4", Role.C, 210, 15);
        add("a1", Role.A, 200, 10);
        add("a2", Role.A, 190, 10);
    }

    @Test
    void atTheStartOfTheAuctionExpectedPriceEqualsTheScaledPrior() {
        seedBalancedPool();
        PriceModel model = build(state(List.of()));

        assertThat(model.inflationForward()).isCloseTo(1.0, org.assertj.core.api.Assertions.within(1e-9));
        assertThat(model.expectedPrice(projections.getFirst())).isEqualTo(20);
    }

    @Test
    void pricesRiseWhenManyCreditsChaseFewRemainingPlayers() {
        seedBalancedPool();
        // Marco compra due giocatori quasi gratis: restano molti crediti e pochi giocatori
        PriceModel model = build(state(List.of(
                new AuctionEvent.PlayerPurchased(1, T, "p1", "marco", 1),
                new AuctionEvent.PlayerPurchased(2, T, "d1", "marco", 1))));

        assertThat(model.inflationForward()).isGreaterThan(1.0);
        assertThat(model.expectedPrice(projections.get(2))).isGreaterThan(20);
    }

    @Test
    void pricesFallWhenTheLeagueHasOverspentEarly() {
        seedBalancedPool();
        PriceModel model = build(state(List.of(
                new AuctionEvent.PlayerPurchased(1, T, "p1", "marco", 80),
                new AuctionEvent.PlayerPurchased(2, T, "d1", "me", 70))));

        assertThat(model.inflationForward()).isLessThan(1.0);
    }

    @Test
    void aSystematicallyOverpaidRoleGetsABiasAboveOne() {
        seedBalancedPool();
        // I portieri vanno al doppio del prior, i difensori al prior
        PriceModel model = build(state(List.of(
                new AuctionEvent.PlayerPurchased(1, T, "p1", "marco", 40),
                new AuctionEvent.PlayerPurchased(2, T, "d1", "me", 20),
                new AuctionEvent.PlayerPurchased(3, T, "d2", "me", 20))));

        assertThat(model.roleBias().get(Role.P)).isGreaterThan(model.roleBias().get(Role.D));
    }

    @Test
    void roleBiasIsOneWhenNothingHasBeenSoldYet() {
        seedBalancedPool();
        PriceModel model = build(state(List.of()));

        assertThat(model.roleBias().values()).allSatisfy(bias ->
                assertThat(bias).isCloseTo(1.0, org.assertj.core.api.Assertions.within(1e-9)));
    }

    @Test
    void expectedPriceIsNeverBelowOne() {
        add("scarso", Role.A, 1, 1);
        PriceModel model = build(state(List.of()));

        assertThat(model.expectedPrice(projections.getFirst())).isGreaterThanOrEqualTo(1);
    }

    @Test
    void rosterWorthySelectsTheTopPlayersPerRole() {
        seedBalancedPool();
        add("d5", Role.D, 1.0, 1);   // 5° difensore: fuori dai 4 roster-worthy

        assertThat(PriceModel.rosterWorthy(RULES, projections))
                .contains("d1", "d2", "d3", "d4")
                .doesNotContain("d5");
    }
}
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `mvn -q test -Dtest=PriceModelTest`
Expected: FAIL — `PriceModel` non esiste.

- [ ] **Step 3: Implementare `PriceModel`**

`src/main/java/com/fantaagent/domain/strategy/PriceModel.java`

```java
package com.fantaagent.domain.strategy;

import com.fantaagent.domain.auction.AuctionState;
import com.fantaagent.domain.auction.Holding;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.player.PlayerProjection;
import com.fantaagent.domain.player.Role;

import java.util.Collection;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.ToIntFunction;

/**
 * Prezzi attesi di mercato.
 *
 * <p>L'inflazione è forward-looking: confronta i crediti ancora in circolazione con il
 * valore dei giocatori ancora disponibili, così il motore sa che i prezzi saliranno
 * prima che salgano davvero.
 */
public record PriceModel(Map<String, Double> priors, double inflationForward, Map<Role, Double> roleBias) {

    /** Pseudo-conteggio dello smorzamento del bias di ruolo. */
    private static final double BIAS_K = 10.0;

    public PriceModel {
        priors = Map.copyOf(priors);
        roleBias = Map.copyOf(roleBias);
    }

    public int expectedPrice(PlayerProjection projection) {
        double prior = priors.getOrDefault(projection.playerId(), 1.0);
        double bias = roleBias.getOrDefault(projection.role(), 1.0);
        return Math.max(1, (int) Math.round(prior * inflationForward * bias));
    }

    /** I primi {@code partecipanti * slot(ruolo)} di ogni ruolo per punti attesi. */
    public static Set<String> rosterWorthy(LeagueRules rules, Collection<PlayerProjection> all) {
        Set<String> worthy = new HashSet<>();
        for (Role role : Role.values()) {
            all.stream()
                    .filter(p -> p.role() == role)
                    .sorted(Comparator.comparingDouble(PlayerProjection::basePoints).reversed())
                    .limit((long) rules.participants() * rules.slots(role))
                    .forEach(p -> worthy.add(p.playerId()));
        }
        return Set.copyOf(worthy);
    }

    public static PriceModel build(LeagueRules rules, AuctionState state,
                                   Collection<PlayerProjection> allProjections,
                                   ToIntFunction<String> listPriceOf) {
        Set<String> worthy = rosterWorthy(rules, allProjections);

        double listPriceSum = allProjections.stream()
                .filter(p -> worthy.contains(p.playerId()))
                .mapToInt(p -> listPriceOf.applyAsInt(p.playerId()))
                .sum();
        double leagueBudget = (double) rules.participants() * rules.budget();
        double scale = listPriceSum > 0 ? leagueBudget / listPriceSum : 1.0;

        Map<String, Double> priors = new HashMap<>();
        for (PlayerProjection p : allProjections) {
            priors.put(p.playerId(), listPriceOf.applyAsInt(p.playerId()) * scale);
        }

        Set<String> sold = state.soldPlayerIds();
        double remainingPriorValue = allProjections.stream()
                .filter(p -> worthy.contains(p.playerId()))
                .filter(p -> !sold.contains(p.playerId()))
                .mapToDouble(p -> priors.get(p.playerId()))
                .sum();
        double remainingCredits = state.squads().values().stream()
                .mapToInt(squad -> squad.budgetRemaining())
                .sum();
        double inflationForward = remainingPriorValue > 0
                ? remainingCredits / remainingPriorValue
                : 1.0;

        return new PriceModel(priors, inflationForward, computeRoleBias(state.holdings(), priors));
    }

    private static Map<Role, Double> computeRoleBias(List<Holding> holdings, Map<String, Double> priors) {
        double globalPaid = 0.0;
        double globalPrior = 0.0;
        Map<Role, double[]> perRole = new EnumMap<>(Role.class);
        for (Role role : Role.values()) {
            perRole.put(role, new double[3]); // pagato, prior, conteggio
        }
        for (Holding h : holdings) {
            double prior = priors.getOrDefault(h.playerId(), 1.0);
            globalPaid += h.price();
            globalPrior += prior;
            double[] acc = perRole.get(h.role());
            acc[0] += h.price();
            acc[1] += prior;
            acc[2] += 1;
        }
        double globalRatio = globalPrior > 0 ? globalPaid / globalPrior : 1.0;

        Map<Role, Double> bias = new EnumMap<>(Role.class);
        for (Role role : Role.values()) {
            double[] acc = perRole.get(role);
            double n = acc[2];
            double observed = acc[1] > 0 ? acc[0] / acc[1] : globalRatio;
            // smorzamento verso il rapporto globale finché i campioni di ruolo sono pochi
            double shrunk = (n * observed + BIAS_K * globalRatio) / (n + BIAS_K);
            bias.put(role, globalRatio > 0 ? shrunk / globalRatio : 1.0);
        }
        return bias;
    }
}
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `mvn -q test -Dtest=PriceModelTest`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/fantaagent/domain/strategy src/test/java/com/fantaagent/domain/strategy
git commit -m "feat: prezzi attesi con inflazione forward-looking e bias di ruolo"
```

---

### Task 15: Completamento greedy della rosa e raffinamento per scambi

**Files:**
- Create: `src/main/java/com/fantaagent/domain/strategy/RosterCompleter.java`
- Test: `src/test/java/com/fantaagent/domain/strategy/RosterCompleterTest.java`

**Interfaces:**
- Consumes: `Squad`, `PlayerProjection`, `PriceModel`, `ModifierCalculator`, `ReplacementLevels`.
- Produces:
  - `record Completion(List<PlayerProjection> picks, double totalPoints, int budgetLeft)`
  - `RosterCompleter(ModifierCalculator modifiers, ReplacementLevels replacement)` con
    `Completion complete(Squad squad, List<PlayerProjection> owned, Collection<PlayerProjection> available, PriceModel prices)`

Algoritmo, dalla spec §7.4: a ogni passo si sceglie il candidato ammissibile con il
miglior rapporto `(marginalPoints - replacement) / expectedPrice`; l'ammissibilità
impone che dopo l'acquisto resti almeno 1 credito per ciascuno slot ancora scoperto.
Segue una passata di local search che tenta scambi a parità di ruolo e budget.

- [ ] **Step 1: Scrivere il test**

`src/test/java/com/fantaagent/domain/strategy/RosterCompleterTest.java`

```java
package com.fantaagent.domain.strategy;

import com.fantaagent.domain.auction.Squad;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.ModifierTable;
import com.fantaagent.domain.league.ScoringRules;
import com.fantaagent.domain.player.PlayerProjection;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class RosterCompleterTest {

    private static final LeagueRules RULES = new LeagueRules(2, 100,
            Map.of(Role.P, 1, Role.D, 1, Role.C, 1, Role.A, 1),
            List.of(Role.P, Role.D, Role.C, Role.A));

    /** Modificatori disattivati: qui verifichiamo il greedy, non i modificatori. */
    private static final ModifierTable FLAT = new ModifierTable(1,
            List.of(new ModifierTable.Threshold(0.0, 0.0)));

    private static final ScoringRules SCORING = new ScoringRules(true,
            Map.of(Role.P, 3.0, Role.D, 4.0, Role.C, 3.5, Role.A, 3.0),
            1.0, 3.0, -3.0, 3.0, -0.5, -1.0, -1.0, 1.0, FLAT, FLAT);

    private static final ReplacementLevels REPLACEMENT = new ReplacementLevels(
            Map.of(Role.P, 0.0, Role.D, 0.0, Role.C, 0.0, Role.A, 0.0),
            Map.of(Role.P, 6.0, Role.D, 6.0, Role.C, 6.0, Role.A, 6.0));

    private final RosterCompleter completer =
            new RosterCompleter(new ModifierCalculator(SCORING, REPLACEMENT), REPLACEMENT);

    private final List<PlayerProjection> pool = new ArrayList<>();
    private final Map<String, Double> priors = new HashMap<>();

    private PlayerProjection add(String id, Role role, double points, double price) {
        PlayerProjection p = new PlayerProjection(id, role, 6.0, 0.0, 30.0, points, 30.0);
        pool.add(p);
        priors.put(id, price);
        return p;
    }

    private PriceModel prices() {
        Map<Role, Double> bias = new java.util.EnumMap<>(Role.class);
        for (Role role : Role.values()) {
            bias.put(role, 1.0);
        }
        return new PriceModel(priors, 1.0, bias);
    }

    private Squad emptySquad() {
        return new Squad("me", List.of(), RULES);
    }

    @Test
    void fillsEverySlotExactlyOnce() {
        add("p1", Role.P, 100, 10);
        add("d1", Role.D, 100, 10);
        add("c1", Role.C, 100, 10);
        add("a1", Role.A, 100, 10);

        RosterCompleter.Completion completion =
                completer.complete(emptySquad(), List.of(), pool, prices());

        assertThat(completion.picks()).hasSize(4);
        assertThat(completion.picks()).extracting(PlayerProjection::role)
                .containsExactlyInAnyOrder(Role.P, Role.D, Role.C, Role.A);
        assertThat(completion.budgetLeft()).isEqualTo(60);
    }

    @Test
    void prefersTheBestPointsPerCreditRatioWhenTheBudgetIsTight() {
        // Gli altri ruoli assorbono 90 crediti dei 100 disponibili: il rapporto
        // valore/prezzo conta solo quando il budget e' davvero vincolante.
        add("p1", Role.P, 1, 30);
        add("d1", Role.D, 1, 30);
        add("c1", Role.C, 1, 30);
        add("cheapStriker", Role.A, 90, 10);   // 9 punti per credito
        add("dearStriker", Role.A, 100, 50);   // 2 punti per credito, non finanziabile

        RosterCompleter.Completion completion =
                completer.complete(emptySquad(), List.of(), pool, prices());

        assertThat(completion.picks()).extracting(PlayerProjection::playerId)
                .contains("cheapStriker")
                .doesNotContain("dearStriker");
    }

    @Test
    void neverSpendsSoMuchThatASlotCannotBeFilled() {
        add("p1", Role.P, 500, 99);   // costoso e allettante: comprarlo lascerebbe 1 credito per 3 slot
        add("d1", Role.D, 10, 1);
        add("c1", Role.C, 10, 1);
        add("a1", Role.A, 10, 1);

        RosterCompleter.Completion completion =
                completer.complete(emptySquad(), List.of(), pool, prices());

        // La guardia di ammissibilita' esclude p1 a ogni passo: meglio tre slot coperti
        // che una rosa incompletabile. Il portiere resta scoperto e questo e' corretto.
        assertThat(completion.picks()).extracting(PlayerProjection::playerId)
                .containsExactlyInAnyOrder("d1", "c1", "a1");
        assertThat(completion.budgetLeft()).isGreaterThanOrEqualTo(0);
    }

    @Test
    void skipsRolesAlreadyCoveredByTheSquad() {
        add("p1", Role.P, 100, 10);
        add("p2", Role.P, 90, 10);
        add("d1", Role.D, 100, 10);
        add("c1", Role.C, 100, 10);
        add("a1", Role.A, 100, 10);

        Squad squad = emptySquad().with(
                new com.fantaagent.domain.auction.Holding(1, "p1", Role.P, "me", 10));
        PlayerProjection owned = pool.getFirst();

        RosterCompleter.Completion completion = completer.complete(
                squad, List.of(owned), pool.stream().filter(p -> !p.playerId().equals("p1")).toList(),
                prices());

        assertThat(completion.picks()).extracting(PlayerProjection::playerId)
                .doesNotContain("p2");
        assertThat(completion.picks()).hasSize(3);
    }

    @Test
    void totalPointsIncludeAlreadyOwnedPlayers() {
        add("p1", Role.P, 100, 10);
        add("d1", Role.D, 200, 10);
        add("c1", Role.C, 100, 10);
        add("a1", Role.A, 100, 10);

        RosterCompleter.Completion completion =
                completer.complete(emptySquad(), List.of(), pool, prices());

        assertThat(completion.totalPoints()).isEqualTo(500.0);
    }

    @Test
    void stopsCleanlyWhenThePoolCannotFillEveryRole() {
        add("p1", Role.P, 100, 10);   // manca ogni difensore, centrocampista e attaccante

        RosterCompleter.Completion completion =
                completer.complete(emptySquad(), List.of(), pool, prices());

        assertThat(completion.picks()).hasSize(1);
        assertThat(completion.totalPoints()).isEqualTo(100.0);
    }
}
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `mvn -q test -Dtest=RosterCompleterTest`
Expected: FAIL — `RosterCompleter` non esiste.

- [ ] **Step 3: Implementare `RosterCompleter`**

`src/main/java/com/fantaagent/domain/strategy/RosterCompleter.java`

```java
package com.fantaagent.domain.strategy;

import com.fantaagent.domain.auction.Squad;
import com.fantaagent.domain.player.PlayerProjection;
import com.fantaagent.domain.player.Role;

import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Completa la rosa con un greedy sul rapporto valore/prezzo, seguito da una passata di
 * local search.
 *
 * <p>Il greedy da solo può fissarsi su un blocco difensivo sub-ottimo, perché con i
 * modificatori il valore marginale dipende dall'ordine di inserimento. La local search
 * tenta scambi a parità di ruolo e recupera gran parte del divario. Il risultato resta
 * un'euristica: l'incertezza sui prezzi attesi è comunque maggiore dell'errore residuo.
 */
public final class RosterCompleter {

    private static final int LOCAL_SEARCH_PASSES = 3;

    public record Completion(List<PlayerProjection> picks, double totalPoints, int budgetLeft) {

        public Completion {
            picks = List.copyOf(picks);
        }
    }

    private final ModifierCalculator modifiers;
    private final ReplacementLevels replacement;

    public RosterCompleter(ModifierCalculator modifiers, ReplacementLevels replacement) {
        this.modifiers = modifiers;
        this.replacement = replacement;
    }

    public Completion complete(Squad squad, List<PlayerProjection> owned,
                               Collection<PlayerProjection> available, PriceModel prices) {
        List<PlayerProjection> roster = new ArrayList<>(owned);
        List<PlayerProjection> picks = new ArrayList<>();
        Set<String> taken = new HashSet<>();
        owned.forEach(p -> taken.add(p.playerId()));

        Map<Role, Integer> openSlots = new EnumMap<>(Role.class);
        for (Role role : Role.values()) {
            openSlots.put(role, squad.slotsRemaining(role));
        }
        int budget = squad.budgetRemaining();
        int slotsLeft = openSlots.values().stream().mapToInt(Integer::intValue).sum();

        while (slotsLeft > 0) {
            PlayerProjection best = null;
            double bestScore = Double.NEGATIVE_INFINITY;
            int bestCost = 0;

            for (PlayerProjection candidate : available) {
                if (taken.contains(candidate.playerId())) {
                    continue;
                }
                if (openSlots.get(candidate.role()) <= 0) {
                    continue;
                }
                int cost = Math.max(1, prices.expectedPrice(candidate));
                if (cost > budget - (slotsLeft - 1)) {
                    continue;
                }
                double gain = modifiers.marginalPoints(roster, candidate)
                        - replacement.points(candidate.role());
                double score = gain / cost;
                if (score > bestScore) {
                    bestScore = score;
                    best = candidate;
                    bestCost = cost;
                }
            }

            if (best == null) {
                break; // nessun candidato ammissibile per gli slot residui
            }
            roster.add(best);
            picks.add(best);
            taken.add(best.playerId());
            openSlots.merge(best.role(), -1, Integer::sum);
            budget -= bestCost;
            slotsLeft--;
        }

        budget = localSearch(roster, picks, available, prices, budget);

        return new Completion(picks, modifiers.squadPoints(roster), budget);
    }

    /**
     * Tenta di sostituire un giocatore scelto con uno non scelto dello stesso ruolo,
     * accettando lo scambio solo se aumenta i punti totali senza sforare il budget.
     */
    private int localSearch(List<PlayerProjection> roster, List<PlayerProjection> picks,
                            Collection<PlayerProjection> available, PriceModel prices, int budget) {
        Set<String> inRoster = new HashSet<>();
        roster.forEach(p -> inRoster.add(p.playerId()));

        for (int pass = 0; pass < LOCAL_SEARCH_PASSES; pass++) {
            boolean improved = false;
            for (int i = 0; i < picks.size(); i++) {
                PlayerProjection current = picks.get(i);
                int currentCost = Math.max(1, prices.expectedPrice(current));
                double currentPoints = modifiers.squadPoints(roster);

                for (PlayerProjection candidate : available) {
                    if (inRoster.contains(candidate.playerId())
                            || candidate.role() != current.role()) {
                        continue;
                    }
                    int candidateCost = Math.max(1, prices.expectedPrice(candidate));
                    if (candidateCost - currentCost > budget) {
                        continue;
                    }
                    List<PlayerProjection> swapped = new ArrayList<>(roster);
                    swapped.remove(current);
                    swapped.add(candidate);
                    if (modifiers.squadPoints(swapped) > currentPoints) {
                        roster.clear();
                        roster.addAll(swapped);
                        picks.set(i, candidate);
                        inRoster.remove(current.playerId());
                        inRoster.add(candidate.playerId());
                        budget -= (candidateCost - currentCost);
                        improved = true;
                        break;
                    }
                }
            }
            if (!improved) {
                break;
            }
        }
        return budget;
    }
}
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `mvn -q test -Dtest=RosterCompleterTest`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/fantaagent/domain/strategy src/test/java/com/fantaagent/domain/strategy
git commit -m "feat: completamento greedy della rosa con local search"
```

---

### Task 16: Confidenza e pressione di mercato

**Files:**
- Create: `src/main/java/com/fantaagent/domain/strategy/ConfidenceScore.java`
- Create: `src/main/java/com/fantaagent/domain/strategy/MarketPressure.java`
- Test: `src/test/java/com/fantaagent/domain/strategy/ConfidenceScoreTest.java`
- Test: `src/test/java/com/fantaagent/domain/strategy/MarketPressureTest.java`

**Interfaces:**
- Consumes: `AuctionState`, `Squad`, `Role`.
- Produces:
  - `record ConfidenceScore(double value, double dataFactor, double startingFactor, double marketFactor, double stabilityFactor)` con
    `static ConfidenceScore of(double data, double starting, double market, double stability)`,
    `int stars()`, e gli helper statici
    `static double dataFactor(double observedAppearances)`,
    `static double startingFactor(double startingProbability)`,
    `static double marketFactor(int salesInPhase)`,
    `static double stabilityFactor(int maxBid, int low, int high)`
  - `record MarketPressure(Map<Role,Integer> maxRivalBid, Map<Role,Integer> rivalsNeeding)` con
    `static MarketPressure from(AuctionState state)`, `int maxRivalBid(Role)`, `int rivalsNeeding(Role)`

La confidenza combina i quattro fattori con la **media geometrica**, che penalizza il
fattore peggiore invece di lasciarlo compensare dagli altri. Nella fase portieri
`marketFactor` è basso per costruzione: è il comportamento corretto e va mostrato.

- [ ] **Step 1: Scrivere i test**

`src/test/java/com/fantaagent/domain/strategy/ConfidenceScoreTest.java`

```java
package com.fantaagent.domain.strategy;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class ConfidenceScoreTest {

    @Test
    void combinesFactorsWithTheGeometricMean() {
        ConfidenceScore score = ConfidenceScore.of(1.0, 1.0, 1.0, 1.0);
        assertThat(score.value()).isCloseTo(1.0, within(1e-9));

        ConfidenceScore half = ConfidenceScore.of(0.5, 0.5, 0.5, 0.5);
        assertThat(half.value()).isCloseTo(0.5, within(1e-9));
    }

    @Test
    void oneWeakFactorDragsTheWholeScoreDown() {
        // media aritmetica sarebbe 0.7750; la geometrica punisce il fattore basso
        ConfidenceScore score = ConfidenceScore.of(1.0, 1.0, 0.1, 1.0);
        assertThat(score.value()).isLessThan(0.6);
    }

    @Test
    void neverReturnsZeroSoTheUiAlwaysHasSomethingToShow() {
        assertThat(ConfidenceScore.of(0.0, 0.0, 0.0, 0.0).value()).isGreaterThan(0.0);
    }

    @Test
    void mapsToFiveStarsForTheUi() {
        assertThat(ConfidenceScore.of(1.0, 1.0, 1.0, 1.0).stars()).isEqualTo(5);
        assertThat(ConfidenceScore.of(0.01, 0.01, 0.01, 0.01).stars()).isEqualTo(1);
    }

    @Test
    void dataFactorSaturatesAtAFullSeasonOfEvidence() {
        assertThat(ConfidenceScore.dataFactor(0)).isZero();
        assertThat(ConfidenceScore.dataFactor(25)).isEqualTo(1.0);
        assertThat(ConfidenceScore.dataFactor(38)).isEqualTo(1.0);
        assertThat(ConfidenceScore.dataFactor(12.5)).isCloseTo(0.5, within(1e-9));
    }

    @Test
    void marketFactorGrowsWithObservedSalesInThePhase() {
        assertThat(ConfidenceScore.marketFactor(0)).isZero();
        assertThat(ConfidenceScore.marketFactor(15)).isEqualTo(1.0);
        assertThat(ConfidenceScore.marketFactor(100)).isEqualTo(1.0);
    }

    @Test
    void stabilityFallsWhenPerturbingPricesMovesTheAnswer() {
        assertThat(ConfidenceScore.stabilityFactor(40, 40, 40)).isEqualTo(1.0);
        assertThat(ConfidenceScore.stabilityFactor(40, 30, 50)).isCloseTo(0.5, within(1e-9));
        assertThat(ConfidenceScore.stabilityFactor(40, 0, 100)).isZero();
    }
}
```

`src/test/java/com/fantaagent/domain/strategy/MarketPressureTest.java`

```java
package com.fantaagent.domain.strategy;

import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.auction.AuctionProjector;
import com.fantaagent.domain.auction.AuctionState;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Role;
import com.fantaagent.domain.player.RoleLookup;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class MarketPressureTest {

    private static final Instant T = Instant.parse("2026-09-05T20:00:00Z");

    private static final LeagueRules RULES = new LeagueRules(3, 100,
            Map.of(Role.P, 1, Role.D, 1, Role.C, 1, Role.A, 1),
            List.of(Role.P, Role.D, Role.C, Role.A));

    private static final List<Participant> PARTICIPANTS = List.of(
            new Participant("me", "Io", 'I', true),
            new Participant("marco", "Marco", 'M', false),
            new Participant("luca", "Luca", 'L', false));

    private static final Map<String, Role> ROLES = Map.of(
            "gk", Role.P, "def", Role.D, "def2", Role.D, "mid", Role.C, "fw", Role.A);

    private static final RoleLookup LOOKUP = ROLES::get;

    private AuctionState state(List<AuctionEvent> events) {
        return AuctionProjector.project(RULES, PARTICIPANTS, LOOKUP, events);
    }

    @Test
    void atTheStartEveryRivalCanBidUpToTheirBudgetMinusReservedSlots() {
        MarketPressure pressure = MarketPressure.from(state(List.of()));

        // 100 crediti, 4 slot: 100 - 3 = 97
        assertThat(pressure.maxRivalBid(Role.D)).isEqualTo(97);
        assertThat(pressure.rivalsNeeding(Role.D)).isEqualTo(2);
    }

    @Test
    void ignoresMyOwnBudget() {
        // Io ho speso quasi tutto; i rivali no. La pressione non deve cambiare.
        MarketPressure pressure = MarketPressure.from(state(List.of(
                new AuctionEvent.PlayerPurchased(1, T, "fw", "me", 97))));

        assertThat(pressure.maxRivalBid(Role.D)).isEqualTo(97);
    }

    @Test
    void excludesRivalsWhoAlreadyFilledTheRole() {
        MarketPressure pressure = MarketPressure.from(state(List.of(
                new AuctionEvent.PlayerPurchased(1, T, "def", "marco", 50))));

        // Marco ha il suo unico difensore: resta solo Luca in corsa
        assertThat(pressure.rivalsNeeding(Role.D)).isEqualTo(1);
        assertThat(pressure.maxRivalBid(Role.D)).isEqualTo(97);
    }

    @Test
    void reflectsHowMuchTheRichestRivalCanStillSpend() {
        MarketPressure pressure = MarketPressure.from(state(List.of(
                new AuctionEvent.PlayerPurchased(1, T, "gk", "marco", 60),
                new AuctionEvent.PlayerPurchased(2, T, "fw", "luca", 90))));

        // Marco: 40 crediti, 3 slot -> 38. Luca: 10 crediti, 3 slot -> 8.
        assertThat(pressure.maxRivalBid(Role.D)).isEqualTo(38);
    }

    @Test
    void isZeroWhenNoRivalStillNeedsTheRole() {
        // Entrambi i rivali hanno gia' il loro unico difensore: nessuna pressione residua.
        MarketPressure pressure = MarketPressure.from(state(List.of(
                new AuctionEvent.PlayerPurchased(1, T, "def", "marco", 10),
                new AuctionEvent.PlayerPurchased(2, T, "def2", "luca", 10))));

        assertThat(pressure.rivalsNeeding(Role.D)).isZero();
        assertThat(pressure.maxRivalBid(Role.D)).isZero();
    }
}
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `mvn -q test -Dtest='ConfidenceScoreTest,MarketPressureTest'`
Expected: FAIL — i tipi non esistono.

- [ ] **Step 3: Implementare `ConfidenceScore`**

`src/main/java/com/fantaagent/domain/strategy/ConfidenceScore.java`

```java
package com.fantaagent.domain.strategy;

/**
 * Confidenza della raccomandazione, come media geometrica di quattro fattori
 * indipendenti. La media geometrica è deliberata: un solo fattore debole deve abbassare
 * il risultato, non essere compensato dagli altri.
 */
public record ConfidenceScore(
        double value,
        double dataFactor,
        double startingFactor,
        double marketFactor,
        double stabilityFactor) {

    /** Presenze osservate oltre le quali i dati sono considerati sufficienti. */
    private static final double FULL_EVIDENCE_APPEARANCES = 25.0;

    /** Acquisti osservati nella fase oltre i quali il mercato è considerato calibrato. */
    private static final int FULL_MARKET_SAMPLES = 15;

    /** Nessun fattore scende sotto questa soglia: evita che la media collassi a zero. */
    private static final double FLOOR = 0.01;

    public static ConfidenceScore of(double data, double starting, double market, double stability) {
        double d = clamp(data);
        double s = clamp(starting);
        double m = clamp(market);
        double st = clamp(stability);
        double value = Math.pow(d * s * m * st, 0.25);
        return new ConfidenceScore(value, d, s, m, st);
    }

    /** 1..5, per la resa a pallini nella UI. */
    public int stars() {
        return Math.max(1, Math.min(5, (int) Math.ceil(value * 5)));
    }

    public static double dataFactor(double observedAppearances) {
        return Math.min(1.0, Math.max(0.0, observedAppearances / FULL_EVIDENCE_APPEARANCES));
    }

    public static double startingFactor(double startingProbability) {
        return Math.min(1.0, Math.max(0.0, startingProbability));
    }

    public static double marketFactor(int salesInPhase) {
        return Math.min(1.0, Math.max(0.0, (double) salesInPhase / FULL_MARKET_SAMPLES));
    }

    /** 1 quando perturbare i prezzi non muove il prezzo massimo, 0 quando lo stravolge. */
    public static double stabilityFactor(int maxBid, int low, int high) {
        int reference = Math.max(1, maxBid);
        double spread = (double) Math.abs(high - low) / reference;
        return Math.min(1.0, Math.max(0.0, 1.0 - spread / 2.0));
    }

    private static double clamp(double factor) {
        if (Double.isNaN(factor)) {
            return FLOOR;
        }
        return Math.min(1.0, Math.max(FLOOR, factor));
    }
}
```

- [ ] **Step 4: Implementare `MarketPressure`**

`src/main/java/com/fantaagent/domain/strategy/MarketPressure.java`

```java
package com.fantaagent.domain.strategy;

import com.fantaagent.domain.auction.AuctionState;
import com.fantaagent.domain.auction.Squad;
import com.fantaagent.domain.player.Role;

import java.util.EnumMap;
import java.util.Map;

/**
 * Quanto gli avversari possono ancora spingere su un ruolo.
 *
 * <p>La scarsità che conta non è quanti giocatori restano, ma quanti avversari hanno
 * ancora bisogno di quel ruolo e i crediti per prenderselo.
 */
public record MarketPressure(Map<Role, Integer> maxRivalBid, Map<Role, Integer> rivalsNeeding) {

    public MarketPressure {
        maxRivalBid = Map.copyOf(maxRivalBid);
        rivalsNeeding = Map.copyOf(rivalsNeeding);
    }

    public static MarketPressure from(AuctionState state) {
        Map<Role, Integer> maxBid = new EnumMap<>(Role.class);
        Map<Role, Integer> needing = new EnumMap<>(Role.class);

        for (Role role : Role.values()) {
            int best = 0;
            int count = 0;
            for (Map.Entry<String, Squad> entry : state.squads().entrySet()) {
                if (entry.getKey().equals(state.myParticipantId())) {
                    continue;
                }
                Squad squad = entry.getValue();
                if (squad.slotsRemaining(role) <= 0) {
                    continue;
                }
                count++;
                best = Math.max(best, squad.maxSpendableNow());
            }
            maxBid.put(role, best);
            needing.put(role, count);
        }
        return new MarketPressure(maxBid, needing);
    }

    public int maxRivalBid(Role role) {
        return maxRivalBid.getOrDefault(role, 0);
    }

    public int rivalsNeeding(Role role) {
        return rivalsNeeding.getOrDefault(role, 0);
    }
}
```

- [ ] **Step 5: Eseguire i test e verificare che passino**

Run: `mvn -q test -Dtest='ConfidenceScoreTest,MarketPressureTest'`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/main/java/com/fantaagent/domain/strategy src/test/java/com/fantaagent/domain/strategy
git commit -m "feat: confidenza a quattro fattori e pressione di mercato per ruolo"
```

---

### Task 17: Motore di valutazione e prezzo massimo

**Files:**
- Create: `src/main/java/com/fantaagent/domain/strategy/Driver.java`
- Create: `src/main/java/com/fantaagent/domain/strategy/PriceRecommendation.java`
- Create: `src/main/java/com/fantaagent/domain/strategy/ValuationContext.java`
- Create: `src/main/java/com/fantaagent/domain/strategy/ValuationEngine.java`
- Modify: `src/main/java/com/fantaagent/domain/strategy/PriceModel.java` (aggiungere `withInflation`)
- Test: `src/test/java/com/fantaagent/domain/strategy/ValuationEngineTest.java`

**Interfaces:**
- Consumes: `RosterCompleter`, `ModifierCalculator`, `PriceModel`, `MarketPressure`,
  `ConfidenceScore`, `ReplacementLevels`, `AuctionState`, `Squad`, `Holding`.
- Produces:
  - `record Driver(String label, double contribution, String explanation)`
  - `record PriceRecommendation(String playerId, int expectedPrice, int maxBid, int hardCap, int margin, String walkAwayReason, ConfidenceScore confidence, List<Driver> drivers)`
  - `record ValuationContext(AuctionState state, PlayerProjection target, List<PlayerProjection> ownedByMe, List<PlayerProjection> available, PriceModel prices, int salesInCurrentPhase)`
  - `ValuationEngine(RosterCompleter completer, ModifierCalculator modifiers, ReplacementLevels replacement)` con
    `PriceRecommendation evaluate(ValuationContext ctx)`
  - `PriceModel.withInflation(double factor)` -> `PriceModel`

Algoritmo, dalla spec §7.5. `surplus(prezzo)` è la differenza fra il valore della
migliore rosa completabile con il giocatore a quel prezzo e senza di lui; `maxBid` è il
prezzo intero più alto con surplus positivo, trovato per ricerca binaria su
`[1, hardCap]`. `hardCap` viene da `Squad.maxSpendableNow()` ed è imposto comunque.

- [ ] **Step 1: Scrivere il test**

`src/test/java/com/fantaagent/domain/strategy/ValuationEngineTest.java`

```java
package com.fantaagent.domain.strategy;

import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.auction.AuctionProjector;
import com.fantaagent.domain.auction.AuctionState;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.ModifierTable;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.league.ScoringRules;
import com.fantaagent.domain.player.PlayerProjection;
import com.fantaagent.domain.player.Role;
import com.fantaagent.domain.player.RoleLookup;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;

class ValuationEngineTest {

    private static final Instant T = Instant.parse("2026-09-05T20:00:00Z");

    private static final LeagueRules RULES = new LeagueRules(2, 100,
            Map.of(Role.P, 1, Role.D, 1, Role.C, 1, Role.A, 1),
            List.of(Role.P, Role.D, Role.C, Role.A));

    private static final List<Participant> PARTICIPANTS = List.of(
            new Participant("me", "Io", 'I', true),
            new Participant("marco", "Marco", 'M', false));

    private static final ModifierTable FLAT = new ModifierTable(1,
            List.of(new ModifierTable.Threshold(0.0, 0.0)));

    private static final ScoringRules SCORING = new ScoringRules(true,
            Map.of(Role.P, 3.0, Role.D, 4.0, Role.C, 3.5, Role.A, 3.0),
            1.0, 3.0, -3.0, 3.0, -0.5, -1.0, -1.0, 1.0, FLAT, FLAT);

    private static final ReplacementLevels REPLACEMENT = new ReplacementLevels(
            Map.of(Role.P, 0.0, Role.D, 0.0, Role.C, 0.0, Role.A, 0.0),
            Map.of(Role.P, 6.0, Role.D, 6.0, Role.C, 6.0, Role.A, 6.0));

    private final ModifierCalculator modifiers = new ModifierCalculator(SCORING, REPLACEMENT);
    private final ValuationEngine engine = new ValuationEngine(
            new RosterCompleter(modifiers, REPLACEMENT), modifiers, REPLACEMENT);

    private final List<PlayerProjection> pool = new ArrayList<>();
    private final Map<String, Double> priors = new HashMap<>();
    private final Map<String, Role> roles = new HashMap<>();

    private PlayerProjection add(String id, Role role, double points, double price) {
        PlayerProjection p = new PlayerProjection(id, role, 6.0, 0.0, 30.0, points, 30.0);
        pool.add(p);
        priors.put(id, price);
        roles.put(id, role);
        return p;
    }

    private PriceModel prices() {
        Map<Role, Double> bias = new EnumMap<>(Role.class);
        for (Role role : Role.values()) {
            bias.put(role, 1.0);
        }
        return new PriceModel(priors, 1.0, bias);
    }

    private AuctionState state(List<AuctionEvent> events) {
        return AuctionProjector.project(RULES, PARTICIPANTS, roles::get, events);
    }

    private ValuationContext context(PlayerProjection target, AuctionState state) {
        List<PlayerProjection> owned = state.mySquad().playerIds().stream()
                .map(id -> pool.stream().filter(p -> p.playerId().equals(id)).findFirst().orElseThrow())
                .toList();
        List<PlayerProjection> available = pool.stream()
                .filter(p -> !state.soldPlayerIds().contains(p.playerId()))
                .toList();
        return new ValuationContext(state, target, owned, available, prices(), 0);
    }

    private PlayerProjection p(String id) {
        return pool.stream().filter(x -> x.playerId().equals(id)).findFirst().orElseThrow();
    }

    /**
     * Ogni ruolo ha un'opzione economica e una costosa: senza questo gradiente il
     * surplus non degrada al crescere del prezzo e il prezzo massimo sarebbe deciso
     * dal solo vincolo di budget.
     */
    private void seedGradientRoles() {
        add("gk", Role.P, 100, 10);
        add("gkTop", Role.P, 200, 40);
        add("mid", Role.C, 100, 10);
        add("midTop", Role.C, 200, 40);
        add("fw", Role.A, 100, 10);
        add("fwTop", Role.A, 200, 40);
    }

    private void seedPool() {
        seedGradientRoles();
        add("bestDef", Role.D, 300, 20);
        add("okDef", Role.D, 280, 18);
    }

    @Test
    void neverRecommendsMoreThanTheHardCap() {
        seedPool();
        AuctionState state = state(List.of());
        PriceRecommendation rec = engine.evaluate(context(p("bestDef"), state));

        assertThat(rec.hardCap()).isEqualTo(state.mySquad().maxSpendableNow());
        assertThat(rec.maxBid()).isLessThanOrEqualTo(rec.hardCap());
    }

    @Test
    void aPlayerWithACloseAlternativeIsNotWorthMuchMoreThanThatAlternative() {
        seedPool();
        // bestDef vale 300, okDef 280 a 18: il vantaggio reale e' piccolo, e ogni
        // credito speso in piu' costringe a declassare portiere, centrocampo o attacco
        PriceRecommendation rec = engine.evaluate(context(p("bestDef"), state(List.of())));

        assertThat(rec.maxBid()).isLessThan(50);
        assertThat(rec.drivers()).anySatisfy(d ->
                assertThat(d.label()).containsIgnoringCase("alternativa"));
    }

    @Test
    void aPlayerWithNoRealAlternativeIsWorthMuchMore() {
        seedGradientRoles();
        PlayerProjection unique = add("uniqueDef", Role.D, 400, 20);
        add("poorDef", Role.D, 20, 1);   // unica alternativa: perde 380 punti

        PriceRecommendation scarce = engine.evaluate(context(unique, state(List.of())));

        // Stesso budget e stesso gradiente del test precedente: cambia solo quanto
        // costa rinunciare al giocatore. E' questo che il motore deve saper distinguere.
        assertThat(scarce.maxBid()).isGreaterThan(70);
    }

    @Test
    void refusesToBidWhenTheRoleIsAlreadyFull() {
        seedPool();
        AuctionState state = state(List.of(
                new AuctionEvent.PlayerPurchased(1, T, "bestDef", "me", 20)));

        PriceRecommendation rec = engine.evaluate(context(p("okDef"), state));

        assertThat(rec.maxBid()).isZero();
        assertThat(rec.walkAwayReason()).containsIgnoringCase("slot");
    }

    @Test
    void refusesToBidWhenTheBudgetIsExhausted() {
        seedPool();
        AuctionState state = state(List.of(
                new AuctionEvent.PlayerPurchased(1, T, "gk", "me", 97)));

        PriceRecommendation rec = engine.evaluate(context(p("bestDef"), state));

        assertThat(rec.hardCap()).isEqualTo(1);
        assertThat(rec.maxBid()).isLessThanOrEqualTo(1);
    }

    @Test
    void reportsTheMarginAgainstTheExpectedMarketPrice() {
        seedPool();
        PriceRecommendation rec = engine.evaluate(context(p("bestDef"), state(List.of())));

        assertThat(rec.expectedPrice()).isEqualTo(20);
        assertThat(rec.margin()).isEqualTo(rec.maxBid() - rec.expectedPrice());
    }

    @Test
    void alwaysExposesBetweenThreeAndFiveDrivers() {
        seedPool();
        PriceRecommendation rec = engine.evaluate(context(p("bestDef"), state(List.of())));

        assertThat(rec.drivers()).hasSizeBetween(3, 5);
        assertThat(rec.drivers()).allSatisfy(d -> {
            assertThat(d.label()).isNotBlank();
            assertThat(d.explanation()).isNotBlank();
        });
    }

    @Test
    void confidenceIsLowWhenNoSalesHaveBeenObserved() {
        seedPool();
        PriceRecommendation rec = engine.evaluate(context(p("bestDef"), state(List.of())));

        assertThat(rec.confidence().marketFactor()).isLessThan(0.2);
        assertThat(rec.confidence().stars()).isLessThanOrEqualTo(3);
    }

    @Test
    void goldenEndOfAuctionTwoSlotsAndFiveCredits() {
        // Scenario nominato dalla spec §12: budget quasi esaurito, due slot da coprire.
        seedPool();
        AuctionState state = state(List.of(
                new AuctionEvent.PlayerPurchased(1, T, "gk", "me", 50),
                new AuctionEvent.PlayerPurchased(2, T, "mid", "me", 45)));

        PriceRecommendation rec = engine.evaluate(context(p("bestDef"), state));

        // 5 crediti, 2 slot residui: si puo' spendere al massimo 4 su questo giocatore
        assertThat(state.mySquad().budgetRemaining()).isEqualTo(5);
        assertThat(state.mySquad().slotsRemaining()).isEqualTo(2);
        assertThat(rec.hardCap()).isEqualTo(4);
        assertThat(rec.maxBid()).isBetween(0, 4);
        assertThat(rec.margin()).isNegative();   // il mercato lo paga 20: va lasciato
    }

    @Test
    void propertyMaxBidNeverExceedsHardCapAcrossRandomStates() {
        Random random = new Random(20260905L);
        for (int run = 0; run < 200; run++) {
            pool.clear();
            priors.clear();
            roles.clear();
            add("gk", Role.P, 50 + random.nextInt(300), 1 + random.nextInt(40));
            add("mid", Role.C, 50 + random.nextInt(300), 1 + random.nextInt(40));
            add("fw", Role.A, 50 + random.nextInt(300), 1 + random.nextInt(40));
            PlayerProjection target = add("d1", Role.D, 50 + random.nextInt(400), 1 + random.nextInt(40));
            add("d2", Role.D, 50 + random.nextInt(400), 1 + random.nextInt(40));

            List<AuctionEvent> events = new ArrayList<>();
            if (random.nextBoolean()) {
                events.add(new AuctionEvent.PlayerPurchased(1, T, "gk", "me", 1 + random.nextInt(90)));
            }
            AuctionState state = state(events);

            PriceRecommendation rec = engine.evaluate(context(target, state));

            assertThat(rec.maxBid())
                    .as("run %d", run)
                    .isBetween(0, rec.hardCap());
        }
    }
}
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `mvn -q test -Dtest=ValuationEngineTest`
Expected: FAIL — i tipi non esistono.

- [ ] **Step 3: Creare i tipi di output**

`src/main/java/com/fantaagent/domain/strategy/Driver.java`

```java
package com.fantaagent.domain.strategy;

/**
 * Fattore che ha determinato la raccomandazione, con il suo contributo numerico.
 * I driver sono anche il materiale che la fase 7 passerà a Claude: il modello li
 * interpreta, non li ricalcola.
 */
public record Driver(String label, double contribution, String explanation) {
}
```

`src/main/java/com/fantaagent/domain/strategy/PriceRecommendation.java`

```java
package com.fantaagent.domain.strategy;

import java.util.List;

/**
 * @param expectedPrice quanto lo pagherà il mercato
 * @param maxBid        oltre questo prezzo la rosa peggiora
 * @param hardCap       vincolo di budget: non superabile in nessun caso
 * @param margin        maxBid - expectedPrice; negativo significa "lascialo andare"
 */
public record PriceRecommendation(
        String playerId,
        int expectedPrice,
        int maxBid,
        int hardCap,
        int margin,
        String walkAwayReason,
        ConfidenceScore confidence,
        List<Driver> drivers) {

    public PriceRecommendation {
        drivers = List.copyOf(drivers);
        if (maxBid > hardCap) {
            throw new IllegalArgumentException("maxBid " + maxBid + " exceeds hard cap " + hardCap);
        }
    }

    public boolean worthPursuing() {
        return margin >= 0 && maxBid > 0;
    }
}
```

`src/main/java/com/fantaagent/domain/strategy/ValuationContext.java`

```java
package com.fantaagent.domain.strategy;

import com.fantaagent.domain.auction.AuctionState;
import com.fantaagent.domain.player.PlayerProjection;

import java.util.List;

/**
 * Input completo e serializzabile del motore. Viene loggato insieme alla
 * raccomandazione: è ciò che permette di ricostruire, il giorno dopo, perché il motore
 * abbia detto quel numero.
 *
 * @param available giocatori ancora acquistabili, il giocatore in esame incluso
 */
public record ValuationContext(
        AuctionState state,
        PlayerProjection target,
        List<PlayerProjection> ownedByMe,
        List<PlayerProjection> available,
        PriceModel prices,
        int salesInCurrentPhase) {

    public ValuationContext {
        ownedByMe = List.copyOf(ownedByMe);
        available = List.copyOf(available);
    }
}
```

- [ ] **Step 4: Aggiungere `withInflation` a `PriceModel`**

Aggiungere il metodo dentro `src/main/java/com/fantaagent/domain/strategy/PriceModel.java`:

```java
    /** Copia del modello con l'inflazione perturbata: serve al fattore di stabilità. */
    public PriceModel withInflation(double factor) {
        return new PriceModel(priors, inflationForward * factor, roleBias);
    }
```

- [ ] **Step 5: Implementare `ValuationEngine`**

`src/main/java/com/fantaagent/domain/strategy/ValuationEngine.java`

```java
package com.fantaagent.domain.strategy;

import com.fantaagent.domain.auction.Holding;
import com.fantaagent.domain.auction.Squad;
import com.fantaagent.domain.player.PlayerProjection;
import com.fantaagent.domain.player.Role;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * Calcola il prezzo massimo come il prezzo oltre il quale acquistare il giocatore
 * smette di migliorare la migliore rosa ancora completabile.
 *
 * <p>{@code surplus(prezzo)} è monotono decrescente, quindi il prezzo massimo si trova
 * per ricerca binaria: circa otto completamenti invece di uno per ogni prezzo possibile.
 */
public final class ValuationEngine {

    /** Perturbazione dei prezzi usata per misurare la stabilità della soluzione. */
    private static final double STABILITY_PERTURBATION = 0.15;

    private final RosterCompleter completer;
    private final ModifierCalculator modifiers;
    private final ReplacementLevels replacement;

    public ValuationEngine(RosterCompleter completer, ModifierCalculator modifiers,
                           ReplacementLevels replacement) {
        this.completer = completer;
        this.modifiers = modifiers;
        this.replacement = replacement;
    }

    public PriceRecommendation evaluate(ValuationContext ctx) {
        Squad mySquad = ctx.state().mySquad();
        PlayerProjection target = ctx.target();
        int hardCap = mySquad.maxSpendableNow();
        int expectedPrice = ctx.prices().expectedPrice(target);

        if (!mySquad.hasRoom(target.role())) {
            return refusal(ctx, expectedPrice, hardCap,
                    "nessuno slot libero per il ruolo " + target.role());
        }
        if (hardCap < 1) {
            return refusal(ctx, expectedPrice, 0,
                    "budget esaurito: ogni slot residuo richiede almeno 1 credito");
        }

        int maxBid = maxBidFor(ctx, hardCap, ctx.prices());
        String walkAway = maxBid == 0
                ? "nessun vantaggio nemmeno a 1 credito rispetto alle alternative"
                : maxBid == hardCap
                        ? "oltre " + hardCap + " non potresti più coprire gli slot residui"
                        : "oltre " + maxBid + " il completamento della rosa perde più di quanto guadagni";

        int low = maxBidFor(ctx, hardCap, ctx.prices().withInflation(1 - STABILITY_PERTURBATION));
        int high = maxBidFor(ctx, hardCap, ctx.prices().withInflation(1 + STABILITY_PERTURBATION));

        ConfidenceScore confidence = ConfidenceScore.of(
                ConfidenceScore.dataFactor(target.observedAppearances()),
                ConfidenceScore.startingFactor(target.startingProbability()),
                ConfidenceScore.marketFactor(ctx.salesInCurrentPhase()),
                ConfidenceScore.stabilityFactor(maxBid, low, high));

        return new PriceRecommendation(target.playerId(), expectedPrice, maxBid, hardCap,
                maxBid - expectedPrice, walkAway, confidence, buildDrivers(ctx, maxBid, hardCap));
    }

    /** Prezzo intero più alto in [1, hardCap] con surplus positivo; 0 se non esiste. */
    private int maxBidFor(ValuationContext ctx, int hardCap, PriceModel prices) {
        double baseline = valueWithout(ctx, prices);
        if (surplus(ctx, prices, 1, baseline) <= 0) {
            return 0;
        }
        int low = 1;
        int high = hardCap;
        while (low < high) {
            int mid = low + (high - low + 1) / 2;
            if (surplus(ctx, prices, mid, baseline) > 0) {
                low = mid;
            } else {
                high = mid - 1;
            }
        }
        return low;
    }

    private double valueWithout(ValuationContext ctx, PriceModel prices) {
        return completer.complete(ctx.state().mySquad(), ctx.ownedByMe(),
                withoutTarget(ctx), prices).totalPoints();
    }

    private double surplus(ValuationContext ctx, PriceModel prices, int price, double baseline) {
        PlayerProjection target = ctx.target();
        Squad squadWith = ctx.state().mySquad().with(
                new Holding(-1L, target.playerId(), target.role(),
                        ctx.state().myParticipantId(), price));
        List<PlayerProjection> ownedWith = new ArrayList<>(ctx.ownedByMe());
        ownedWith.add(target);

        double valueWith = completer.complete(squadWith, ownedWith, withoutTarget(ctx), prices)
                .totalPoints();
        return valueWith - baseline;
    }

    private static List<PlayerProjection> withoutTarget(ValuationContext ctx) {
        return ctx.available().stream()
                .filter(p -> !p.playerId().equals(ctx.target().playerId()))
                .toList();
    }

    private PriceRecommendation refusal(ValuationContext ctx, int expectedPrice,
                                        int hardCap, String reason) {
        ConfidenceScore confidence = ConfidenceScore.of(
                ConfidenceScore.dataFactor(ctx.target().observedAppearances()),
                ConfidenceScore.startingFactor(ctx.target().startingProbability()),
                ConfidenceScore.marketFactor(ctx.salesInCurrentPhase()),
                1.0);
        return new PriceRecommendation(ctx.target().playerId(), expectedPrice, 0, hardCap,
                -expectedPrice, reason, confidence, buildDrivers(ctx, 0, hardCap));
    }

    private List<Driver> buildDrivers(ValuationContext ctx, int maxBid, int hardCap) {
        List<Driver> drivers = new ArrayList<>();
        PlayerProjection target = ctx.target();
        Squad mySquad = ctx.state().mySquad();

        double modifierDelta = modifiers.marginalPoints(ctx.ownedByMe(), target) - target.basePoints();
        drivers.add(new Driver("Modificatori", modifierDelta,
                modifierDelta > 0.5
                        ? String.format("alza il reparto: +%.1f punti stagionali oltre i suoi", modifierDelta)
                        : "nessun effetto rilevante sui modificatori con la rosa attuale"));

        int reserved = Math.max(0, mySquad.slotsRemaining() - 1);
        drivers.add(new Driver("Budget", hardCap,
                String.format("hardCap %d — restano %d crediti e %d slot da coprire",
                        hardCap, mySquad.budgetRemaining(), mySquad.slotsRemaining())));

        Optional<PlayerProjection> alternative = withoutTarget(ctx).stream()
                .filter(p -> p.role() == target.role())
                .max(Comparator.comparingDouble(PlayerProjection::basePoints));
        alternative.ifPresent(alt -> {
            double ratio = target.basePoints() > 0 ? alt.basePoints() / target.basePoints() : 0.0;
            drivers.add(new Driver("Alternativa", ctx.prices().expectedPrice(alt),
                    String.format("%s a ~%d crediti rende il %.0f%%",
                            alt.playerId(), ctx.prices().expectedPrice(alt), ratio * 100)));
        });

        MarketPressure pressure = MarketPressure.from(ctx.state());
        drivers.add(new Driver("Concorrenza", pressure.maxRivalBid(target.role()),
                String.format("%d avversari cercano ancora un %s, il più ricco può arrivare a %d",
                        pressure.rivalsNeeding(target.role()), target.role(),
                        pressure.maxRivalBid(target.role()))));

        drivers.add(new Driver("Inflazione", ctx.prices().inflationForward(),
                String.format("il mercato viaggia al %.0f%% dei valori teorici",
                        ctx.prices().inflationForward() * 100)));

        return drivers.size() > 5 ? drivers.subList(0, 5) : drivers;
    }
}
```

- [ ] **Step 6: Eseguire il test e verificare che passi**

Run: `mvn -q test -Dtest=ValuationEngineTest`
Expected: PASS

- [ ] **Step 7: Verificare il budget di latenza**

Aggiungere in coda a `ValuationEngineTest`:

```java
    @Test
    void staysWithinTheLatencyBudget() {
        seedPool();
        AuctionState state = state(List.of());
        ValuationContext ctx = context(p("bestDef"), state);

        engine.evaluate(ctx); // riscaldamento della JIT
        long start = System.nanoTime();
        for (int i = 0; i < 20; i++) {
            engine.evaluate(ctx);
        }
        long averageMillis = (System.nanoTime() - start) / 20 / 1_000_000;

        assertThat(averageMillis).isLessThan(80L);
    }
```

Run: `mvn -q test -Dtest=ValuationEngineTest`
Expected: PASS. Se fallisce con un pool realistico da 600 giocatori, ridurre i candidati
valutati a ogni passo del greedy ai migliori 40 per ruolo per punti attesi: è
un'ottimizzazione senza effetto sul risultato, perché i candidati oltre quella soglia non
vincono mai il confronto sul rapporto valore/prezzo.

- [ ] **Step 8: Commit**

```bash
git add src/main/java/com/fantaagent/domain/strategy src/test/java/com/fantaagent/domain/strategy
git commit -m "feat: motore di valutazione E2 con prezzo massimo per ricerca binaria"
```

---

# FASE 6 — Ricerca e interfaccia d'asta

### Task 18: Ricerca fuzzy con ranking per rilevanza

**Files:**
- Create: `src/main/java/com/fantaagent/domain/search/TextNormalizer.java`
- Create: `src/main/java/com/fantaagent/domain/search/PlayerSearch.java`
- Modify: `src/main/java/com/fantaagent/ingestion/NameResolver.java` (delegare a `TextNormalizer`)
- Test: `src/test/java/com/fantaagent/domain/search/PlayerSearchTest.java`

**Interfaces:**
- Consumes: `Player`, `Role`.
- Produces:
  - `TextNormalizer.normalize(String)` — minuscole, accenti e punteggiatura rimossi
  - `PlayerSearch(List<Player> players, ToDoubleFunction<String> relevanceOf)` con
    `List<Player> search(String query, Role phaseBoost, int limit)`

Il ranking pesa la qualità del match **e** la rilevanza del giocatore: digitando `th`
deve emergere Thuram, non un pari-match di metà classifica. I giocatori del ruolo in
asta hanno priorità.

- [ ] **Step 1: Scrivere il test**

`src/test/java/com/fantaagent/domain/search/PlayerSearchTest.java`

```java
package com.fantaagent.domain.search;

import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class PlayerSearchTest {

    private final List<Player> players = List.of(
            new Player("1", "Thuram M.", "Inter", Role.A, 35),
            new Player("2", "Thuram K.", "Juventus", Role.C, 12),
            new Player("3", "Bastoni", "Inter", Role.D, 20),
            new Player("4", "Dimarco", "Inter", Role.D, 22),
            new Player("5", "Gonzàlez N.", "Juventus", Role.C, 18),
            new Player("6", "Basto", "Lecce", Role.D, 1));

    private final Map<String, Double> relevance = Map.of(
            "1", 300.0, "2", 90.0, "3", 260.0, "4", 250.0, "5", 150.0, "6", 20.0);

    private final PlayerSearch search =
            new PlayerSearch(players, id -> relevance.getOrDefault(id, 0.0));

    @Test
    void normalizesAccentsAndPunctuation() {
        assertThat(TextNormalizer.normalize("Gonzàlez N.")).isEqualTo("gonzalez n");
        assertThat(TextNormalizer.normalize("  D'AMBROSIO ")).isEqualTo("dambrosio");
    }

    @Test
    void prefersTheMoreRelevantPlayerOnAnAmbiguousPrefix() {
        List<Player> results = search.search("th", null, 5);

        assertThat(results).isNotEmpty();
        assertThat(results.getFirst().id()).isEqualTo("1");
        assertThat(results).extracting(Player::id).contains("2");
    }

    @Test
    void anExactMatchOutranksALongerPrefixMatch() {
        List<Player> results = search.search("basto", null, 5);

        assertThat(results.getFirst().id()).isEqualTo("6");
    }

    @Test
    void toleratesTypos() {
        assertThat(search.search("bastony", null, 5))
                .extracting(Player::id).contains("3");
        assertThat(search.search("dimarko", null, 5))
                .extracting(Player::id).contains("4");
    }

    @Test
    void boostsPlayersOfTheRoleCurrentlyOnAuction() {
        List<Player> withoutBoost = search.search("th", null, 5);
        List<Player> withBoost = search.search("th", Role.C, 5);

        assertThat(withoutBoost.getFirst().id()).isEqualTo("1");
        assertThat(withBoost.getFirst().id()).isEqualTo("2");
    }

    @Test
    void respectsTheResultLimit() {
        assertThat(search.search("a", null, 2)).hasSizeLessThanOrEqualTo(2);
    }

    @Test
    void returnsNothingForABlankQuery() {
        assertThat(search.search("", null, 5)).isEmpty();
        assertThat(search.search("   ", null, 5)).isEmpty();
    }

    @Test
    void returnsNothingWhenNoPlayerMatches() {
        assertThat(search.search("zzzzzz", null, 5)).isEmpty();
    }
}
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `mvn -q test -Dtest=PlayerSearchTest`
Expected: FAIL — `TextNormalizer` e `PlayerSearch` non esistono.

- [ ] **Step 3: Creare `TextNormalizer` e far delegare `NameResolver`**

`src/main/java/com/fantaagent/domain/search/TextNormalizer.java`

```java
package com.fantaagent.domain.search;

import java.text.Normalizer;
import java.util.Locale;

public final class TextNormalizer {

    private TextNormalizer() {
    }

    public static String normalize(String raw) {
        if (raw == null) {
            return "";
        }
        String decomposed = Normalizer.normalize(raw, Normalizer.Form.NFD);
        return decomposed.replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ITALIAN)
                .replaceAll("[^a-z0-9 ]", "")
                .replaceAll("\\s+", " ")
                .trim();
    }

    /** Vero se le stringhe differiscono per al più una modifica di un carattere. */
    public static boolean editDistanceAtMostOne(String a, String b) {
        if (a.equals(b)) {
            return true;
        }
        int la = a.length();
        int lb = b.length();
        if (Math.abs(la - lb) > 1) {
            return false;
        }
        int i = 0;
        int j = 0;
        boolean usedEdit = false;
        while (i < la && j < lb) {
            if (a.charAt(i) == b.charAt(j)) {
                i++;
                j++;
                continue;
            }
            if (usedEdit) {
                return false;
            }
            usedEdit = true;
            if (la > lb) {
                i++;
            } else if (lb > la) {
                j++;
            } else {
                i++;
                j++;
            }
        }
        return true;
    }
}
```

In `src/main/java/com/fantaagent/ingestion/NameResolver.java` sostituire il corpo di
`normalize` con una delega, eliminando la duplicazione:

```java
    public static String normalize(String raw) {
        return com.fantaagent.domain.search.TextNormalizer.normalize(raw);
    }
```

Rimuovere da `NameResolver` gli import ora inutilizzati `java.text.Normalizer` e
`java.util.Locale`. Nota: `NameResolver` non fa matching approssimato — quello vive
solo qui, in `PlayerSearch`, dove l'utente legge il nome proposto prima di agire.

- [ ] **Step 4: Implementare `PlayerSearch`**

`src/main/java/com/fantaagent/domain/search/PlayerSearch.java`

```java
package com.fantaagent.domain.search;

import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.function.ToDoubleFunction;

/**
 * Ricerca per nome, tollerante ai refusi, con ranking che pesa la qualità del match e
 * la rilevanza del giocatore. Durante l'asta si digitano tre lettere e si guarda solo
 * il primo risultato: il ranking conta quanto il match.
 */
public final class PlayerSearch {

    private static final int SCORE_EXACT = 1000;
    private static final int SCORE_PREFIX = 800;
    private static final int SCORE_WORD_PREFIX = 700;
    private static final int SCORE_TYPO = 500;
    private static final int SCORE_CONTAINS = 400;
    private static final int PHASE_BOOST = 250;
    private static final double RELEVANCE_CAP = 200.0;
    private static final double RELEVANCE_DIVISOR = 3.0;

    private record Indexed(Player player, String normalizedName) {
    }

    private final List<Indexed> index;
    private final ToDoubleFunction<String> relevanceOf;

    public PlayerSearch(List<Player> players, ToDoubleFunction<String> relevanceOf) {
        this.index = players.stream()
                .map(p -> new Indexed(p, TextNormalizer.normalize(p.name())))
                .toList();
        this.relevanceOf = relevanceOf;
    }

    public List<Player> search(String query, Role phaseBoost, int limit) {
        String q = TextNormalizer.normalize(query);
        if (q.isBlank()) {
            return List.of();
        }
        record Scored(Player player, double score) {
        }
        List<Scored> scored = new ArrayList<>();
        for (Indexed indexed : index) {
            int matchScore = matchScore(q, indexed.normalizedName());
            if (matchScore == 0) {
                continue;
            }
            double relevance = Math.min(RELEVANCE_CAP,
                    relevanceOf.applyAsDouble(indexed.player().id()) / RELEVANCE_DIVISOR);
            double boost = phaseBoost != null && indexed.player().role() == phaseBoost
                    ? PHASE_BOOST : 0;
            scored.add(new Scored(indexed.player(), matchScore + relevance + boost));
        }
        return scored.stream()
                .sorted(Comparator.comparingDouble(Scored::score).reversed())
                .limit(limit)
                .map(Scored::player)
                .toList();
    }

    private static int matchScore(String query, String name) {
        if (name.equals(query)) {
            return SCORE_EXACT;
        }
        if (name.startsWith(query)) {
            return SCORE_PREFIX;
        }
        for (String token : name.split(" ")) {
            if (token.startsWith(query)) {
                return SCORE_WORD_PREFIX;
            }
        }
        for (String token : name.split(" ")) {
            if (TextNormalizer.editDistanceAtMostOne(query, token)) {
                return SCORE_TYPO;
            }
        }
        if (name.contains(query)) {
            return SCORE_CONTAINS;
        }
        return 0;
    }
}
```

- [ ] **Step 5: Eseguire tutti i test**

Run: `mvn -q test`
Expected: PASS — inclusi `NameResolverTest` e `ArchitectureTest`.

- [ ] **Step 6: Commit**

```bash
git add src/main/java/com/fantaagent src/test/java/com/fantaagent
git commit -m "feat: ricerca fuzzy con ranking per rilevanza e priorità di fase"
```

---

### Task 19: Grammatica del comando d'asta

**Files:**
- Create: `src/main/java/com/fantaagent/domain/search/CommandParser.java`
- Test: `src/test/java/com/fantaagent/domain/search/CommandParserTest.java`

**Interfaces:**
- Consumes: niente.
- Produces:
  - `record ParsedCommand(String term, OptionalInt price, Optional<Character> participantInitial)`
    con `boolean isPurchase()`
  - `static ParsedCommand CommandParser.parse(String raw)`

Grammatica: `<giocatore> [prezzo] [iniziale partecipante]`. Il ruolo non si digita mai:
è implicito nella fase. L'iniziale del partecipante è riconosciuta **solo se preceduta
da un prezzo**, altrimenti `thuram m` (che nel listone è un nome completo) verrebbe
interpretato come un acquisto.

- [ ] **Step 1: Scrivere il test**

`src/test/java/com/fantaagent/domain/search/CommandParserTest.java`

```java
package com.fantaagent.domain.search;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CommandParserTest {

    @Test
    void aBareTermIsJustASearch() {
        ParsedCommand parsed = CommandParser.parse("bast");

        assertThat(parsed.term()).isEqualTo("bast");
        assertThat(parsed.price()).isEmpty();
        assertThat(parsed.participantInitial()).isEmpty();
        assertThat(parsed.isPurchase()).isFalse();
    }

    @Test
    void aTrailingNumberIsAPurchaseByMe() {
        ParsedCommand parsed = CommandParser.parse("bast 47");

        assertThat(parsed.term()).isEqualTo("bast");
        assertThat(parsed.price()).hasValue(47);
        assertThat(parsed.participantInitial()).isEmpty();
        assertThat(parsed.isPurchase()).isTrue();
    }

    @Test
    void aTrailingLetterAfterAPriceIsTheBuyer() {
        ParsedCommand parsed = CommandParser.parse("bast 47 m");

        assertThat(parsed.term()).isEqualTo("bast");
        assertThat(parsed.price()).hasValue(47);
        assertThat(parsed.participantInitial()).hasValue('M');
    }

    @Test
    void multiWordNamesAreKeptTogether() {
        ParsedCommand parsed = CommandParser.parse("de rossi 12 l");

        assertThat(parsed.term()).isEqualTo("de rossi");
        assertThat(parsed.price()).hasValue(12);
        assertThat(parsed.participantInitial()).hasValue('L');
    }

    @Test
    void aTrailingLetterWithoutAPriceStaysPartOfTheName() {
        // "Thuram M." è un nome del listone, non un acquisto da parte di M.
        ParsedCommand parsed = CommandParser.parse("thuram m");

        assertThat(parsed.term()).isEqualTo("thuram m");
        assertThat(parsed.price()).isEmpty();
        assertThat(parsed.participantInitial()).isEmpty();
    }

    @Test
    void collapsesExtraWhitespace() {
        ParsedCommand parsed = CommandParser.parse("   bast    47   m  ");

        assertThat(parsed.term()).isEqualTo("bast");
        assertThat(parsed.price()).hasValue(47);
        assertThat(parsed.participantInitial()).hasValue('M');
    }

    @Test
    void anEmptyCommandParsesToAnEmptyTerm() {
        ParsedCommand parsed = CommandParser.parse("   ");

        assertThat(parsed.term()).isEmpty();
        assertThat(parsed.isPurchase()).isFalse();
    }

    @Test
    void rejectsANonPositivePriceByTreatingItAsPartOfTheName() {
        ParsedCommand parsed = CommandParser.parse("bast 0");

        assertThat(parsed.term()).isEqualTo("bast 0");
        assertThat(parsed.price()).isEmpty();
    }
}
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `mvn -q test -Dtest=CommandParserTest`
Expected: FAIL — `CommandParser` non esiste.

- [ ] **Step 3: Implementare `ParsedCommand` e `CommandParser`**

`src/main/java/com/fantaagent/domain/search/CommandParser.java`

```java
package com.fantaagent.domain.search;

import java.util.Optional;
import java.util.OptionalInt;

/**
 * Grammatica della barra unica: {@code <giocatore> [prezzo] [iniziale partecipante]}.
 *
 * <p>Il ruolo non compare mai: è implicito nella fase in corso. L'iniziale del
 * partecipante è riconosciuta solo dopo un prezzo, perché nel listone esistono nomi che
 * terminano con una lettera isolata ("Thuram M.").
 */
public final class CommandParser {

    private CommandParser() {
    }

    public static ParsedCommand parse(String raw) {
        String cleaned = raw == null ? "" : raw.trim().replaceAll("\\s+", " ");
        if (cleaned.isEmpty()) {
            return new ParsedCommand("", OptionalInt.empty(), Optional.empty());
        }
        String[] tokens = cleaned.split(" ");

        if (tokens.length >= 3
                && isSingleLetter(tokens[tokens.length - 1])
                && isPositiveInteger(tokens[tokens.length - 2])) {
            String term = join(tokens, tokens.length - 2);
            return new ParsedCommand(term,
                    OptionalInt.of(Integer.parseInt(tokens[tokens.length - 2])),
                    Optional.of(Character.toUpperCase(tokens[tokens.length - 1].charAt(0))));
        }
        if (tokens.length >= 2 && isPositiveInteger(tokens[tokens.length - 1])) {
            return new ParsedCommand(join(tokens, tokens.length - 1),
                    OptionalInt.of(Integer.parseInt(tokens[tokens.length - 1])),
                    Optional.empty());
        }
        return new ParsedCommand(cleaned, OptionalInt.empty(), Optional.empty());
    }

    private static String join(String[] tokens, int count) {
        return String.join(" ", java.util.Arrays.copyOfRange(tokens, 0, count));
    }

    private static boolean isSingleLetter(String token) {
        return token.length() == 1 && Character.isLetter(token.charAt(0));
    }

    private static boolean isPositiveInteger(String token) {
        if (token.isEmpty() || token.length() > 4) {
            return false;
        }
        for (int i = 0; i < token.length(); i++) {
            if (!Character.isDigit(token.charAt(i))) {
                return false;
            }
        }
        return Integer.parseInt(token) > 0;
    }
}
```

`src/main/java/com/fantaagent/domain/search/ParsedCommand.java`

```java
package com.fantaagent.domain.search;

import java.util.Optional;
import java.util.OptionalInt;

public record ParsedCommand(String term, OptionalInt price, Optional<Character> participantInitial) {

    public boolean isPurchase() {
        return price.isPresent() && !term.isBlank();
    }
}
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `mvn -q test -Dtest=CommandParserTest`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/fantaagent/domain/search src/test/java/com/fantaagent/domain/search
git commit -m "feat: grammatica del comando d'asta a barra unica"
```

---

### Task 20: Servizi applicativi

**Files:**
- Create: `src/main/java/com/fantaagent/application/service/ProjectionRegistry.java`
- Create: `src/main/java/com/fantaagent/application/service/AuctionService.java`
- Create: `src/main/java/com/fantaagent/application/service/PlayerAnalysisService.java`
- Create: `src/main/java/com/fantaagent/application/service/PlayerSearchService.java`
- Modify: `src/main/java/com/fantaagent/config/BeanConfig.java` (wiring dei servizi)
- Test: `src/test/java/com/fantaagent/application/service/AuctionServiceTest.java`

**Interfaces:**
- Consumes: `PlayerCatalog`, `AuctionEventStore`, `ValuationEngine`, `PriceModel`,
  `PlayerSearch`, `ProjectionCalculator`, `ReplacementLevels`.
- Produces:
  - `ProjectionRegistry.build(LeagueRules, ScoringRules, PlayerCatalog)` con
    `PlayerProjection of(String)`, `List<PlayerProjection> all()`, `ReplacementLevels replacement()`
  - `AuctionService` con `AuctionState state()`, `void recordPurchase(String playerId, String participantId, int price)`,
    `boolean undoLast()`, `void advancePhase()`, `int salesInCurrentPhase()`,
    `Optional<Participant> byInitial(char)`, `Participant me()`,
    `List<Participant> participants()`, `String playerName(Holding)`,
    `record ResumeSummary(int purchases, Role phase)` e `Optional<ResumeSummary> resumeSummary()`
  - `PlayerAnalysisService.analyze(String playerId)` -> `PriceRecommendation`
  - `PlayerSearchService.search(String query)` -> `List<Player>` e
    `PlayerSearchService.targets(int limit)` -> `List<PlayerSearchService.TargetRow>`
    dove `record TargetRow(Player player, PriceRecommendation recommendation)`

`recordPurchase` rifiuta solo ciò che è certamente un errore di digitazione — giocatore
sconosciuto o già venduto, partecipante sconosciuto, prezzo non positivo, prezzo
superiore al budget residuo, ruolo già completo. Non impone agli avversari il vincolo di
riserva sugli slot: se il nostro stato è leggermente disallineato, un acquisto reale non
deve essere rifiutato.

- [ ] **Step 1: Scrivere il test**

`src/test/java/com/fantaagent/application/service/AuctionServiceTest.java`

```java
package com.fantaagent.application.service;

import com.fantaagent.adapter.out.file.InMemoryPlayerCatalog;
import com.fantaagent.adapter.out.file.JsonlAuctionEventStore;
import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AuctionServiceTest {

    @TempDir
    Path tmp;

    private static final LeagueRules RULES = new LeagueRules(2, 100,
            Map.of(Role.P, 1, Role.D, 1, Role.C, 1, Role.A, 1),
            List.of(Role.P, Role.D, Role.C, Role.A));

    private static final List<Participant> PARTICIPANTS = List.of(
            new Participant("me", "Io", 'I', true),
            new Participant("marco", "Marco", 'M', false));

    private final PlayerCatalog catalog = new InMemoryPlayerCatalog(List.of(
            new Player("gk", "Portiere", "Inter", Role.P, 10),
            new Player("gk2", "Portiere2", "Roma", Role.P, 8),
            new Player("def", "Difensore", "Inter", Role.D, 20)), List.of());

    private AuctionService service;

    @BeforeEach
    void setUp() {
        service = new AuctionService(RULES, PARTICIPANTS, catalog,
                new JsonlAuctionEventStore(tmp.resolve("events.jsonl")));
    }

    @Test
    void startsInTheFirstPhaseWithFullBudgets() {
        assertThat(service.state().currentPhase()).isEqualTo(Role.P);
        assertThat(service.state().mySquad().budgetRemaining()).isEqualTo(100);
        assertThat(service.salesInCurrentPhase()).isZero();
    }

    @Test
    void recordsAPurchaseAndPersistsIt() {
        service.recordPurchase("gk", "marco", 30);

        assertThat(service.state().squadOf("marco").spent()).isEqualTo(30);

        AuctionService reloaded = new AuctionService(RULES, PARTICIPANTS, catalog,
                new JsonlAuctionEventStore(tmp.resolve("events.jsonl")));
        assertThat(reloaded.state().squadOf("marco").spent()).isEqualTo(30);
    }

    @Test
    void countsSalesInTheCurrentPhaseOnly() {
        service.recordPurchase("gk", "marco", 30);
        assertThat(service.salesInCurrentPhase()).isEqualTo(1);

        service.advancePhase();
        assertThat(service.state().currentPhase()).isEqualTo(Role.D);
        assertThat(service.salesInCurrentPhase()).isZero();
    }

    @Test
    void undoRemovesTheLastPurchase() {
        service.recordPurchase("gk", "marco", 30);
        service.recordPurchase("gk2", "me", 25);

        assertThat(service.undoLast()).isTrue();

        assertThat(service.state().mySquad().spent()).isZero();
        assertThat(service.state().squadOf("marco").spent()).isEqualTo(30);
        assertThat(service.state().soldPlayerIds()).containsExactly("gk");
    }

    @Test
    void undoOnAnEmptyLogReportsThatThereIsNothingToUndo() {
        assertThat(service.undoLast()).isFalse();
    }

    @Test
    void rejectsAnUnknownPlayer() {
        assertThatThrownBy(() -> service.recordPurchase("nessuno", "me", 10))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("sconosciuto");
    }

    @Test
    void rejectsAPlayerAlreadySold() {
        service.recordPurchase("gk", "marco", 30);

        assertThatThrownBy(() -> service.recordPurchase("gk", "me", 40))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("già");
    }

    @Test
    void rejectsAPriceAboveTheBuyersRemainingBudget() {
        assertThatThrownBy(() -> service.recordPurchase("gk", "me", 101))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("budget");
    }

    @Test
    void rejectsAPurchaseForAnAlreadyFullRole() {
        service.recordPurchase("gk", "me", 10);

        assertThatThrownBy(() -> service.recordPurchase("gk2", "me", 10))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("slot");
    }

    @Test
    void reportsNothingToResumeOnAFreshAuction() {
        assertThat(service.resumeSummary()).isEmpty();
    }

    @Test
    void reportsAnAuctionInProgressSoTheUiCanAskBeforeResuming() {
        service.recordPurchase("gk", "marco", 30);

        assertThat(service.resumeSummary()).hasValueSatisfying(summary -> {
            assertThat(summary.purchases()).isEqualTo(1);
            assertThat(summary.phase()).isEqualTo(Role.P);
        });
    }

    @Test
    void backsUpTheLogBeforeChangingPhase() {
        service.recordPurchase("gk", "marco", 30);

        service.advancePhase();

        assertThat(tmp.resolve("events-fine-P.jsonl.bak")).exists();
    }

    @Test
    void resolvesParticipantsByInitial() {
        assertThat(service.byInitial('m')).contains(PARTICIPANTS.get(1));
        assertThat(service.byInitial('Z')).isEmpty();
        assertThat(service.me().id()).isEqualTo("me");
    }
}
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `mvn -q test -Dtest=AuctionServiceTest`
Expected: FAIL — `AuctionService` non esiste.

- [ ] **Step 3: Implementare `ProjectionRegistry`**

`src/main/java/com/fantaagent/application/service/ProjectionRegistry.java`

```java
package com.fantaagent.application.service;

import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.ScoringRules;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.PlayerProjection;
import com.fantaagent.domain.player.ProjectionCalculator;
import com.fantaagent.domain.player.Role;
import com.fantaagent.domain.strategy.ReplacementLevels;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Proiezioni calcolate una volta all'avvio. Non dipendono dallo stato dell'asta: i
 * modificatori, che invece ne dipendono, sono applicati dal motore di valutazione.
 */
public class ProjectionRegistry {

    private final Map<String, PlayerProjection> byId;
    private final ReplacementLevels replacement;

    private ProjectionRegistry(Map<String, PlayerProjection> byId, ReplacementLevels replacement) {
        this.byId = byId;
        this.replacement = replacement;
    }

    public static ProjectionRegistry build(LeagueRules rules, ScoringRules scoring,
                                           PlayerCatalog catalog) {
        List<Player> players = catalog.all();
        Map<Role, Double> roleAverages =
                ProjectionCalculator.roleAverageRatings(players, catalog::statsOf);
        ProjectionCalculator calculator = new ProjectionCalculator(scoring);

        Map<String, PlayerProjection> byId = new LinkedHashMap<>();
        for (Player player : players) {
            byId.put(player.id(), calculator.project(player, catalog.statsOf(player.id()),
                    roleAverages.get(player.role())));
        }
        return new ProjectionRegistry(byId, ReplacementLevels.from(rules, byId.values()));
    }

    public PlayerProjection of(String playerId) {
        PlayerProjection projection = byId.get(playerId);
        if (projection == null) {
            throw new IllegalArgumentException("giocatore sconosciuto: " + playerId);
        }
        return projection;
    }

    public List<PlayerProjection> all() {
        return List.copyOf(byId.values());
    }

    public ReplacementLevels replacement() {
        return replacement;
    }
}
```

- [ ] **Step 4: Implementare `AuctionService`**

`src/main/java/com/fantaagent/application/service/AuctionService.java`

```java
package com.fantaagent.application.service;

import com.fantaagent.application.port.out.AuctionEventStore;
import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.auction.AuctionProjector;
import com.fantaagent.domain.auction.AuctionState;
import com.fantaagent.domain.auction.Holding;
import com.fantaagent.domain.auction.Squad;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Registrazione degli eventi d'asta.
 *
 * <p>Lo stato viene riproiettato dal log a ogni lettura: con qualche centinaio di eventi
 * costa microsecondi ed elimina ogni possibilità di divergenza fra cache e verità.
 */
public class AuctionService {

    private final LeagueRules rules;
    private final List<Participant> participants;
    private final PlayerCatalog catalog;
    private final AuctionEventStore store;

    public AuctionService(LeagueRules rules, List<Participant> participants,
                          PlayerCatalog catalog, AuctionEventStore store) {
        this.rules = rules;
        this.participants = List.copyOf(participants);
        this.catalog = catalog;
        this.store = store;
    }

    public AuctionState state() {
        return AuctionProjector.project(rules, participants, catalog, store.load());
    }

    public void recordPurchase(String playerId, String participantId, int price) {
        Player player = catalog.byId(playerId)
                .orElseThrow(() -> new IllegalArgumentException("giocatore sconosciuto: " + playerId));
        Participant buyer = participants.stream()
                .filter(p -> p.id().equals(participantId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException(
                        "partecipante sconosciuto: " + participantId));
        if (price < 1) {
            throw new IllegalArgumentException("il prezzo deve essere almeno 1");
        }

        AuctionState current = state();
        if (current.soldPlayerIds().contains(playerId)) {
            throw new IllegalArgumentException(player.name() + " è già stato acquistato");
        }
        Squad squad = current.squadOf(buyer.id());
        if (price > squad.budgetRemaining()) {
            throw new IllegalArgumentException(buyer.name() + " ha solo "
                    + squad.budgetRemaining() + " crediti di budget residuo");
        }
        if (!squad.hasRoom(player.role())) {
            throw new IllegalArgumentException(buyer.name()
                    + " ha già coperto tutti gli slot " + player.role());
        }

        store.append(new AuctionEvent.PlayerPurchased(
                store.nextSeq(), Instant.now(), playerId, buyer.id(), price));
    }

    /** @return false se non c'era nulla da annullare */
    public boolean undoLast() {
        List<AuctionEvent> events = store.load();
        Set<Long> revoked = new HashSet<>();
        for (AuctionEvent event : events) {
            if (event instanceof AuctionEvent.PurchaseRevoked r) {
                revoked.add(r.targetSeq());
            }
        }
        for (int i = events.size() - 1; i >= 0; i--) {
            if (events.get(i) instanceof AuctionEvent.PlayerPurchased purchased
                    && !revoked.contains(purchased.seq())) {
                store.append(new AuctionEvent.PurchaseRevoked(
                        store.nextSeq(), Instant.now(), purchased.seq()));
                return true;
            }
        }
        return false;
    }

    public void advancePhase() {
        Role current = state().currentPhase();
        rules.nextPhase(current).ifPresent(next -> {
            store.backup("fine-" + current.name());
            store.append(new AuctionEvent.PhaseAdvanced(store.nextSeq(), Instant.now(), next));
        });
    }

    /**
     * Asta gia' in corso trovata sul disco all'avvio.
     *
     * <p>La spec impone di non riprendere in silenzio: ripartire su uno stato sbagliato
     * sarebbe peggio che non ripartire. La UI mostra questo riepilogo finche' l'utente
     * non lo chiude.
     */
    public record ResumeSummary(int purchases, Role phase) {
    }

    public Optional<ResumeSummary> resumeSummary() {
        AuctionState current = state();
        if (current.holdings().isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(new ResumeSummary(current.holdings().size(), current.currentPhase()));
    }

    public int salesInCurrentPhase() {
        AuctionState current = state();
        return (int) current.holdings().stream()
                .filter(h -> h.role() == current.currentPhase())
                .count();
    }

    public Optional<Participant> byInitial(char initial) {
        char upper = Character.toUpperCase(initial);
        return participants.stream().filter(p -> p.initial() == upper).findFirst();
    }

    public Participant me() {
        return participants.stream()
                .filter(Participant::me)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("nessun partecipante marcato come me"));
    }

    public List<Participant> participants() {
        return participants;
    }

    /** Nome del giocatore per un holding, per la resa nel tabellone. */
    public String playerName(Holding holding) {
        return catalog.byId(holding.playerId()).map(Player::name).orElse(holding.playerId());
    }
}
```

- [ ] **Step 5: Implementare i servizi di analisi e ricerca**

`src/main/java/com/fantaagent/application/service/PlayerAnalysisService.java`

```java
package com.fantaagent.application.service;

import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.domain.auction.AuctionState;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.PlayerProjection;
import com.fantaagent.domain.strategy.PriceModel;
import com.fantaagent.domain.strategy.PriceRecommendation;
import com.fantaagent.domain.strategy.ValuationContext;
import com.fantaagent.domain.strategy.ValuationEngine;

import java.util.List;
import java.util.Set;

public class PlayerAnalysisService {

    private final LeagueRules rules;
    private final PlayerCatalog catalog;
    private final ProjectionRegistry projections;
    private final ValuationEngine engine;
    private final AuctionService auction;

    public PlayerAnalysisService(LeagueRules rules, PlayerCatalog catalog,
                                 ProjectionRegistry projections, ValuationEngine engine,
                                 AuctionService auction) {
        this.rules = rules;
        this.catalog = catalog;
        this.projections = projections;
        this.engine = engine;
        this.auction = auction;
    }

    public PriceRecommendation analyze(String playerId) {
        return engine.evaluate(context(playerId, auction.state()));
    }

    /** Riusa lo stato già proiettato: serve alla lista target, che valuta molti giocatori. */
    public PriceRecommendation analyze(String playerId, AuctionState state) {
        return engine.evaluate(context(playerId, state));
    }

    private ValuationContext context(String playerId, AuctionState state) {
        PlayerProjection target = projections.of(playerId);
        Set<String> sold = state.soldPlayerIds();

        List<PlayerProjection> owned = state.mySquad().playerIds().stream()
                .map(projections::of)
                .toList();
        List<PlayerProjection> available = projections.all().stream()
                .filter(p -> !sold.contains(p.playerId()))
                .toList();

        PriceModel prices = PriceModel.build(rules, state, projections.all(),
                id -> catalog.byId(id).map(Player::listPrice).orElse(1));

        return new ValuationContext(state, target, owned, available, prices,
                auction.salesInCurrentPhase());
    }
}
```

`src/main/java/com/fantaagent/application/service/PlayerSearchService.java`

```java
package com.fantaagent.application.service;

import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.domain.auction.AuctionState;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.search.PlayerSearch;
import com.fantaagent.domain.strategy.PriceRecommendation;

import java.util.Comparator;
import java.util.List;
import java.util.Set;

public class PlayerSearchService {

    private static final int SEARCH_LIMIT = 8;

    /**
     * Quanti candidati valutare per la lista target. Ogni valutazione costa qualche
     * decina di millisecondi: quindici righe restano sotto il quarto di secondo, che è
     * accettabile per un pannello aperto su richiesta.
     */
    private static final int TARGET_CANDIDATES = 15;

    public record TargetRow(Player player, PriceRecommendation recommendation) {

        public int margin() {
            return recommendation.margin();
        }
    }

    private final PlayerCatalog catalog;
    private final PlayerSearch search;
    private final AuctionService auction;
    private final PlayerAnalysisService analysis;
    private final ProjectionRegistry projections;

    public PlayerSearchService(PlayerCatalog catalog, ProjectionRegistry projections,
                               AuctionService auction, PlayerAnalysisService analysis) {
        this.catalog = catalog;
        this.projections = projections;
        this.auction = auction;
        this.analysis = analysis;
        this.search = new PlayerSearch(catalog.all(),
                id -> projections.of(id).basePoints());
    }

    public List<Player> search(String query) {
        AuctionState state = auction.state();
        Set<String> sold = state.soldPlayerIds();
        return search.search(query, state.currentPhase(), SEARCH_LIMIT * 2).stream()
                .filter(p -> !sold.contains(p.id()))
                .limit(SEARCH_LIMIT)
                .toList();
    }

    /** Migliori obiettivi della fase corrente, ordinati per margine decrescente. */
    public List<TargetRow> targets(int limit) {
        AuctionState state = auction.state();
        Set<String> sold = state.soldPlayerIds();

        return projections.all().stream()
                .filter(p -> p.role() == state.currentPhase())
                .filter(p -> !sold.contains(p.playerId()))
                .sorted(Comparator.comparingDouble(
                        com.fantaagent.domain.player.PlayerProjection::basePoints).reversed())
                .limit(TARGET_CANDIDATES)
                .map(p -> new TargetRow(
                        catalog.byId(p.playerId()).orElseThrow(),
                        analysis.analyze(p.playerId(), state)))
                .sorted(Comparator.comparingInt(TargetRow::margin).reversed())
                .limit(limit)
                .toList();
    }
}
```

- [ ] **Step 6: Wiring in `BeanConfig`**

Aggiungere a `src/main/java/com/fantaagent/config/BeanConfig.java`:

```java
    @Bean
    public com.fantaagent.application.service.ProjectionRegistry projectionRegistry(
            com.fantaagent.domain.league.LeagueRules rules,
            com.fantaagent.domain.league.ScoringRules scoring,
            com.fantaagent.application.port.out.PlayerCatalog catalog) {
        return com.fantaagent.application.service.ProjectionRegistry.build(rules, scoring, catalog);
    }

    @Bean
    public com.fantaagent.domain.strategy.ValuationEngine valuationEngine(
            com.fantaagent.domain.league.ScoringRules scoring,
            com.fantaagent.application.service.ProjectionRegistry projections) {
        var modifiers = new com.fantaagent.domain.strategy.ModifierCalculator(
                scoring, projections.replacement());
        var completer = new com.fantaagent.domain.strategy.RosterCompleter(
                modifiers, projections.replacement());
        return new com.fantaagent.domain.strategy.ValuationEngine(
                completer, modifiers, projections.replacement());
    }

    @Bean
    public com.fantaagent.application.service.AuctionService auctionService(
            com.fantaagent.domain.league.LeagueRules rules,
            java.util.List<com.fantaagent.domain.league.Participant> participants,
            com.fantaagent.application.port.out.PlayerCatalog catalog,
            com.fantaagent.application.port.out.AuctionEventStore store) {
        return new com.fantaagent.application.service.AuctionService(rules, participants, catalog, store);
    }

    @Bean
    public com.fantaagent.application.service.PlayerAnalysisService playerAnalysisService(
            com.fantaagent.domain.league.LeagueRules rules,
            com.fantaagent.application.port.out.PlayerCatalog catalog,
            com.fantaagent.application.service.ProjectionRegistry projections,
            com.fantaagent.domain.strategy.ValuationEngine engine,
            com.fantaagent.application.service.AuctionService auction) {
        return new com.fantaagent.application.service.PlayerAnalysisService(
                rules, catalog, projections, engine, auction);
    }

    @Bean
    public com.fantaagent.application.service.PlayerSearchService playerSearchService(
            com.fantaagent.application.port.out.PlayerCatalog catalog,
            com.fantaagent.application.service.ProjectionRegistry projections,
            com.fantaagent.application.service.AuctionService auction,
            com.fantaagent.application.service.PlayerAnalysisService analysis) {
        return new com.fantaagent.application.service.PlayerSearchService(
                catalog, projections, auction, analysis);
    }
```

- [ ] **Step 7: Eseguire tutti i test**

Run: `mvn -q test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/main/java/com/fantaagent src/test/java/com/fantaagent
git commit -m "feat: servizi applicativi di asta, analisi e ricerca"
```

---

### Task 21: Interfaccia d'asta da tastiera

**Files:**
- Create: `src/main/java/com/fantaagent/adapter/in/web/AuctionController.java`
- Create: `src/main/java/com/fantaagent/adapter/in/web/dto/ViewModels.java`
- Create: `src/main/resources/templates/index.html`
- Create: `src/main/resources/static/app.css`
- Create: `src/main/resources/static/app.js`
- Test: `src/test/java/com/fantaagent/adapter/in/web/AuctionControllerTest.java`

**Interfaces:**
- Consumes: `AuctionService`, `PlayerAnalysisService`, `PlayerSearchService`.
- Produces: pagina unica su `http://localhost:8080` con
  - `GET /` — pagina completa
  - `GET /fragments/main?q=` — pannello principale (risultati + scheda)
  - `POST /command` — barra unica: ricerca oppure registrazione acquisto
  - `POST /undo`, `POST /phase/next`
  - `GET /fragments/targets` — lista obiettivi della fase

- [ ] **Step 1: Scrivere il test**

`src/test/java/com/fantaagent/adapter/in/web/AuctionControllerTest.java`

```java
package com.fantaagent.adapter.in.web;

import com.fantaagent.application.service.AuctionService;
import com.fantaagent.application.service.PlayerAnalysisService;
import com.fantaagent.application.service.PlayerSearchService;
import com.fantaagent.domain.auction.AuctionProjector;
import com.fantaagent.domain.auction.AuctionState;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import com.fantaagent.domain.strategy.ConfidenceScore;
import com.fantaagent.domain.strategy.Driver;
import com.fantaagent.domain.strategy.PriceRecommendation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("dev")
class AuctionControllerTest {

    private static final LeagueRules RULES = new LeagueRules(2, 100,
            Map.of(Role.P, 1, Role.D, 1, Role.C, 1, Role.A, 1),
            List.of(Role.P, Role.D, Role.C, Role.A));

    private static final List<Participant> PARTICIPANTS = List.of(
            new Participant("me", "Io", 'I', true),
            new Participant("marco", "Marco", 'M', false));

    private static final Player BASTONI = new Player("d1", "Bastoni", "Inter", Role.D, 20);

    private static final PriceRecommendation RECOMMENDATION = new PriceRecommendation(
            "d1", 38, 47, 90, 9, "oltre 47 il completamento perde più di quanto guadagni",
            ConfidenceScore.of(0.9, 0.9, 0.6, 0.9),
            List.of(new Driver("Budget", 90, "hardCap 90"),
                    new Driver("Alternativa", 38, "Dimarco a ~38 rende il 94%"),
                    new Driver("Concorrenza", 47, "1 avversario cerca ancora un D")));

    @Autowired
    private WebApplicationContext context;

    @MockitoBean
    private AuctionService auctionService;

    @MockitoBean
    private PlayerAnalysisService analysisService;

    @MockitoBean
    private PlayerSearchService searchService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
        AuctionState state = AuctionProjector.project(RULES, PARTICIPANTS,
                id -> Role.D, List.of());
        when(auctionService.state()).thenReturn(state);
        when(auctionService.participants()).thenReturn(PARTICIPANTS);
        when(auctionService.me()).thenReturn(PARTICIPANTS.getFirst());
        when(auctionService.salesInCurrentPhase()).thenReturn(0);
        when(searchService.search(anyString())).thenReturn(List.of(BASTONI));
        when(analysisService.analyze("d1")).thenReturn(RECOMMENDATION);
    }

    @Test
    void servesTheAuctionPage() throws Exception {
        mockMvc.perform(get("/"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("FASE")));
    }

    @Test
    void searchingShowsTheTopResultWithItsNumbers() throws Exception {
        mockMvc.perform(get("/fragments/main").param("cmd", "bast"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("Bastoni")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("47")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("38")));
    }

    @Test
    void aCommandWithAPriceRecordsAPurchaseForMe() throws Exception {
        mockMvc.perform(post("/command").param("cmd", "bast 47"))
                .andExpect(status().isOk());

        verify(auctionService).recordPurchase("d1", "me", 47);
    }

    @Test
    void aCommandWithAnInitialRecordsAPurchaseForThatParticipant() throws Exception {
        when(auctionService.byInitial('M')).thenReturn(Optional.of(PARTICIPANTS.get(1)));

        mockMvc.perform(post("/command").param("cmd", "bast 47 m"))
                .andExpect(status().isOk());

        verify(auctionService).recordPurchase("d1", "marco", 47);
    }

    @Test
    void aCommandWithoutAPriceOnlySearches() throws Exception {
        mockMvc.perform(post("/command").param("cmd", "bast"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("Bastoni")));

        verify(auctionService, org.mockito.Mockito.never())
                .recordPurchase(anyString(), anyString(), anyInt());
    }

    @Test
    void aRejectedPurchaseIsShownAsAMessageNotAnError() throws Exception {
        org.mockito.Mockito.doThrow(new IllegalArgumentException("Bastoni è già stato acquistato"))
                .when(auctionService).recordPurchase(eq("d1"), anyString(), anyInt());

        mockMvc.perform(post("/command").param("cmd", "bast 47"))
                .andExpect(status().isOk())
                .andExpect(content().string(
                        org.hamcrest.Matchers.containsString("già stato acquistato")));
    }

    @Test
    void undoIsExposed() throws Exception {
        when(auctionService.undoLast()).thenReturn(true);

        mockMvc.perform(post("/undo")).andExpect(status().isOk());

        verify(auctionService).undoLast();
    }
}
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `mvn -q test -Dtest=AuctionControllerTest`
Expected: FAIL — nessun controller mappa quelle rotte.

- [ ] **Step 3: Creare i view model**

`src/main/java/com/fantaagent/adapter/in/web/dto/ViewModels.java`

```java
package com.fantaagent.adapter.in.web.dto;

import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.strategy.PriceRecommendation;

import java.util.List;

public final class ViewModels {

    private ViewModels() {
    }

    public record BoardRow(String name, char initial, int budget, String composition,
                           int slotsLeft, boolean me) {
    }

    public record StatusBar(String phase, int soldInPhase, int myBudget,
                            String myComposition, int mySlotsLeft) {
    }

    public record Analysis(Player player, PriceRecommendation recommendation) {

        public String verdict() {
            if (recommendation.maxBid() == 0) {
                return "LASCIA";
            }
            return recommendation.margin() >= 0 ? "PRENDI" : "LASCIA";
        }

        public String marginLabel() {
            int margin = recommendation.margin();
            return (margin >= 0 ? "+" : "") + margin;
        }
    }

    public record MainPanel(List<Player> results, Analysis analysis, String message) {
    }
}
```

- [ ] **Step 4: Implementare il controller**

`src/main/java/com/fantaagent/adapter/in/web/AuctionController.java`

```java
package com.fantaagent.adapter.in.web;

import com.fantaagent.adapter.in.web.dto.ViewModels;
import com.fantaagent.application.service.AuctionService;
import com.fantaagent.application.service.PlayerAnalysisService;
import com.fantaagent.application.service.PlayerSearchService;
import com.fantaagent.domain.auction.AuctionState;
import com.fantaagent.domain.auction.Squad;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import com.fantaagent.domain.search.CommandParser;
import com.fantaagent.domain.search.ParsedCommand;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Controller
public class AuctionController {

    private static final int TARGET_ROWS = 10;

    private final AuctionService auction;
    private final PlayerAnalysisService analysis;
    private final PlayerSearchService search;

    public AuctionController(AuctionService auction, PlayerAnalysisService analysis,
                             PlayerSearchService search) {
        this.auction = auction;
        this.analysis = analysis;
        this.search = search;
    }

    @GetMapping("/")
    public String index(Model model) {
        populateShell(model);
        model.addAttribute("panel", new ViewModels.MainPanel(List.of(), null, null));
        return "index";
    }

    @GetMapping("/fragments/main")
    public String main(@RequestParam(name = "cmd", defaultValue = "") String q, Model model) {
        populateShell(model);
        model.addAttribute("panel", searchPanel(q, null));
        return "index :: main";
    }

    @PostMapping("/command")
    public String command(@RequestParam(defaultValue = "") String cmd, Model model) {
        ParsedCommand parsed = CommandParser.parse(cmd);
        String message = null;

        if (parsed.isPurchase()) {
            List<Player> matches = search.search(parsed.term());
            if (matches.isEmpty()) {
                message = "nessun giocatore trovato per \"" + parsed.term() + "\"";
            } else {
                Player player = matches.getFirst();
                Optional<Participant> buyer = parsed.participantInitial().isPresent()
                        ? auction.byInitial(parsed.participantInitial().get())
                        : Optional.of(auction.me());
                if (buyer.isEmpty()) {
                    message = "nessun partecipante con iniziale "
                            + parsed.participantInitial().orElse('?');
                } else {
                    try {
                        auction.recordPurchase(player.id(), buyer.get().id(),
                                parsed.price().orElseThrow());
                        message = "✓ " + player.name() + " → " + buyer.get().name()
                                + " " + parsed.price().orElseThrow() + " · Ctrl+Z per annullare";
                    } catch (IllegalArgumentException e) {
                        message = "✗ " + e.getMessage();
                    }
                }
            }
        }

        populateShell(model);
        model.addAttribute("panel",
                searchPanel(parsed.isPurchase() ? "" : parsed.term(), message));
        return "index :: main";
    }

    @PostMapping("/undo")
    public String undo(Model model) {
        String message = auction.undoLast()
                ? "↩ ultimo acquisto annullato"
                : "niente da annullare";
        populateShell(model);
        model.addAttribute("panel", new ViewModels.MainPanel(List.of(), null, message));
        return "index :: main";
    }

    @PostMapping("/phase/next")
    public String nextPhase(Model model) {
        auction.advancePhase();
        populateShell(model);
        model.addAttribute("panel", new ViewModels.MainPanel(List.of(), null,
                "fase avanzata a " + auction.state().currentPhase()));
        return "index :: main";
    }

    @GetMapping("/fragments/targets")
    public String targets(Model model) {
        model.addAttribute("targets", search.targets(TARGET_ROWS));
        return "index :: targets";
    }

    private ViewModels.MainPanel searchPanel(String query, String message) {
        List<Player> results = query.isBlank() ? List.of() : search.search(query);
        ViewModels.Analysis analysisView = results.isEmpty()
                ? null
                : new ViewModels.Analysis(results.getFirst(),
                        analysis.analyze(results.getFirst().id()));
        return new ViewModels.MainPanel(results, analysisView, message);
    }

    private void populateShell(Model model) {
        AuctionState state = auction.state();
        Squad mine = state.mySquad();

        model.addAttribute("status", new ViewModels.StatusBar(
                state.currentPhase().name(), auction.salesInCurrentPhase(),
                mine.budgetRemaining(), composition(mine), mine.slotsRemaining()));

        List<ViewModels.BoardRow> board = new ArrayList<>();
        for (Participant participant : auction.participants()) {
            Squad squad = state.squadOf(participant.id());
            board.add(new ViewModels.BoardRow(participant.name(), participant.initial(),
                    squad.budgetRemaining(), composition(squad), squad.slotsRemaining(),
                    participant.me()));
        }
        model.addAttribute("board", board);
        auction.resumeSummary().ifPresent(summary -> model.addAttribute("resume", summary));
    }

    private static String composition(Squad squad) {
        StringBuilder sb = new StringBuilder();
        for (Role role : Role.values()) {
            sb.append(squad.count(role)).append(role.name()).append(' ');
        }
        return sb.toString().trim();
    }
}
```

- [ ] **Step 5: Creare la pagina**

`src/main/resources/templates/index.html`

```html
<!DOCTYPE html>
<html lang="it" xmlns:th="http://www.thymeleaf.org">
<head>
  <meta charset="UTF-8">
  <title>Asta</title>
  <link rel="stylesheet" th:href="@{/app.css}">
  <script src="https://unpkg.com/htmx.org@2.0.4"></script>
</head>
<body>

<header class="status">
  <div>FASE <b th:text="${status.phase}">P</b> ·
    <span th:text="${status.soldInPhase}">0</span> venduti</div>
  <div>TU <b th:text="${status.myBudget}">500</b> crediti ·
    <span th:text="${status.myComposition}">0P 0D 0C 0A</span> ·
    <span th:text="${status.mySlotsLeft}">25</span> slot</div>
  <form hx-post="/phase/next" hx-target="#main" hx-swap="outerHTML">
    <button type="submit">fase successiva →</button>
  </form>
</header>

<div class="resume" th:if="${resume}">
  Asta in corso: <b th:text="${resume.purchases}">47</b> acquisti,
  fase <b th:text="${resume.phase}">D</b> — ripreso dal log su disco.
</div>

<div class="layout">

  <section id="main" th:fragment="main">
    <form id="cmdForm" hx-post="/command" hx-target="#main" hx-swap="outerHTML">
      <input id="cmd" name="cmd" autocomplete="off" autofocus
             placeholder="giocatore  prezzo  iniziale"
             hx-get="/fragments/main" hx-trigger="keyup changed delay:120ms"
             hx-target="#main" hx-swap="outerHTML">
    </form>

    <p class="message" th:if="${panel.message}" th:text="${panel.message}"></p>

    <ul class="results" th:if="${!panel.results.isEmpty()}">
      <li th:each="p, it : ${panel.results}" th:classappend="${it.first} ? 'sel' : ''">
        <span th:text="${p.name}">Nome</span>
        <span class="dim" th:text="${p.role} + ' · ' + ${p.team}">D · Inter</span>
      </li>
    </ul>

    <article class="card" th:if="${panel.analysis}">
      <h2>
        <span th:text="${panel.analysis.player.name}">Nome</span>
        <span class="dim"
              th:text="${panel.analysis.player.role} + ' · ' + ${panel.analysis.player.team}"></span>
      </h2>

      <div class="numbers">
        <div><label>MERCATO</label>
          <b th:text="${panel.analysis.recommendation.expectedPrice}">38</b></div>
        <div><label>MAX BID</label>
          <b class="big" th:text="${panel.analysis.recommendation.maxBid}">47</b>
          <span class="margin" th:text="${panel.analysis.marginLabel}">+9</span></div>
        <div><label>VERDETTO</label>
          <b th:text="${panel.analysis.verdict}">PRENDI</b></div>
        <div><label>CONFIDENZA</label>
          <b th:text="${panel.analysis.recommendation.confidence.stars} + '/5'">3/5</b></div>
      </div>

      <ul class="drivers">
        <li th:each="d : ${panel.analysis.recommendation.drivers}">
          <b th:text="${d.label}">Budget</b>
          <span th:text="${d.explanation}">…</span>
        </li>
      </ul>

      <p class="walkaway" th:text="${panel.analysis.recommendation.walkAwayReason}"></p>
    </article>
  </section>

  <aside class="board">
    <h3>TABELLONE</h3>
    <table>
      <tr th:each="row : ${board}" th:classappend="${row.me} ? 'me' : ''">
        <td th:text="${row.name}">Marco</td>
        <td th:text="${row.budget}">289</td>
        <td th:text="${row.composition}">1P 3D 0C 0A</td>
        <td th:text="${row.slotsLeft} + ' sl'">21 sl</td>
      </tr>
    </table>

    <div id="targets" th:fragment="targets">
      <h3 th:if="${targets}">TARGET</h3>
      <table th:if="${targets}">
        <tr th:each="t : ${targets}">
          <td th:text="${t.player.name}">Bastoni</td>
          <td th:text="${t.recommendation.expectedPrice}">38</td>
          <td th:text="${t.recommendation.maxBid}">47</td>
          <td th:text="${t.margin}"
              th:classappend="${t.margin} >= 0 ? 'pos' : 'neg'">+9</td>
        </tr>
      </table>
    </div>
  </aside>

</div>

<form id="undoForm" hx-post="/undo" hx-target="#main" hx-swap="outerHTML" hidden></form>
<script th:src="@{/app.js}"></script>
</body>
</html>
```

> Nota su HTMX: il CDN `unpkg` è usato qui perché la pagina gira in locale con rete
> disponibile. Se preferisci un'app completamente offline, scarica `htmx.min.js` in
> `src/main/resources/static/` e sostituisci l'URL con `th:src="@{/htmx.min.js}"`.

- [ ] **Step 6: Creare stile e tastiera**

`src/main/resources/static/app.css`

```css
:root { --bg:#111; --fg:#eee; --dim:#888; --pos:#4ade80; --neg:#f87171; --line:#333; }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--fg);
       font:16px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
.status { display:flex; gap:2rem; align-items:center; padding:.75rem 1rem;
          border-bottom:1px solid var(--line); }
.status b { color:#fff; }
.layout { display:grid; grid-template-columns:1fr 22rem; gap:1rem; padding:1rem; }
#cmd { width:100%; padding:.75rem; font:inherit; font-size:1.25rem;
       background:#000; color:var(--fg); border:1px solid var(--line); }
.message { padding:.5rem .75rem; background:#1c1c1c; border-left:3px solid var(--pos); }
.resume { padding:.5rem 1rem; background:#2a2410; border-bottom:1px solid var(--line); }
.results { list-style:none; padding:0; margin:.5rem 0; }
.results li { padding:.25rem .5rem; }
.results li.sel { background:#1e293b; }
.dim { color:var(--dim); }
.card { border:1px solid var(--line); padding:1rem; margin-top:1rem; }
.numbers { display:grid; grid-template-columns:repeat(4,1fr); gap:1rem; margin:1rem 0; }
.numbers label { display:block; font-size:.7rem; color:var(--dim); letter-spacing:.08em; }
.numbers b { font-size:1.5rem; }
.numbers b.big { font-size:2.5rem; }
.margin { color:var(--pos); margin-left:.4rem; }
.drivers { list-style:none; padding:0; }
.drivers li { padding:.2rem 0; border-top:1px solid var(--line); }
.drivers b { display:inline-block; min-width:8rem; color:var(--dim); }
.walkaway { color:var(--dim); font-style:italic; }
.board table { width:100%; border-collapse:collapse; font-size:.85rem; }
.board td { padding:.2rem .3rem; border-bottom:1px solid var(--line); }
.board tr.me td { color:#fff; font-weight:bold; }
.pos { color:var(--pos); } .neg { color:var(--neg); }
```

`src/main/resources/static/app.js`

```js
// Tastiera: la barra deve essere sempre raggiungibile senza toccare il mouse.
document.addEventListener('keydown', (e) => {
  const cmd = document.getElementById('cmd');

  if (e.key === 'Escape' || (e.key === '/' && document.activeElement !== cmd)) {
    e.preventDefault();
    if (cmd) { cmd.focus(); cmd.select(); }
    return;
  }

  if (e.ctrlKey && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    htmx.trigger('#undoForm', 'submit');
    return;
  }

  if (e.ctrlKey && e.key.toLowerCase() === 'l') {
    e.preventDefault();
    htmx.ajax('GET', '/fragments/targets', { target: '#targets', swap: 'outerHTML' });
  }
});

// Dopo ogni scambio HTMX il focus torna alla barra, pronta per il comando successivo.
document.body.addEventListener('htmx:afterSwap', () => {
  const cmd = document.getElementById('cmd');
  if (cmd) { cmd.focus(); }
});
```

- [ ] **Step 7: Eseguire tutti i test**

Run: `mvn -q test`
Expected: PASS

- [ ] **Step 8: Prova manuale**

```bash
./run.sh
```

Verificare a mano, con il listone reale in `data/reference/`:
1. digitando `bast` compaiono i risultati e la scheda del primo in meno di un secondo;
2. `bast 47 m` seguito da Invio registra l'acquisto e mostra la conferma;
3. `Ctrl+Z` annulla; `Ctrl+L` apre la lista target; `/` riporta il fuoco alla barra;
4. riavviando l'applicazione lo stato dell'asta è intatto.

- [ ] **Step 9: Commit**

```bash
git add src/main/java/com/fantaagent/adapter src/main/resources src/test/java/com/fantaagent/adapter
git commit -m "feat: interfaccia d'asta da tastiera con barra unica e tabellone"
```

---

## Fine delle fasi 1-6

A questo punto l'applicazione è utilizzabile in un'asta reale **senza Claude**: importa i
dati, calcola le proiezioni, mantiene lo stato in modo durevole, produce il prezzo
massimo con la sua motivazione e si guida da tastiera.

Le fasi 7-9 (integrazione Claude, rifinitura della UI, hardening e prova generale)
saranno oggetto di un piano separato, come concordato.
