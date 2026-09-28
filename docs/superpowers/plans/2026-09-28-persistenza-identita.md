# Persistenza e identità — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** FantaAgent diventa un portale multi-utente: account con email e password, leghe persistenti con inviti, aste dentro la lega con i membri come posti, registro eventi su Postgres append-only, consigli privati per ogni partecipante, importazione delle aste su file.

**Architecture:** Postgres (Flyway) sostituisce i file. `AuctionRuntime`, con la sua unica «asta selezionata», esce dal percorso dell'API e resta solo per `/legacy`, attivo nel profilo `legacy`. Al suo posto c'è `AuctionRegistry`, che per ogni richiesta costruisce un `AuctionView`: l'asta dell'URL, i posti con `me` calcolato dall'utente autenticato, una `ValuationChain` in cache per asta, e i servizi esistenti (`AuctionService`, `PlayerAnalysisService`, `PlayerSearchService`) istanziati su quello scope. Il dominio non cambia, tranne una tolleranza nel proiettore. Spring Security con sessione in Postgres, CSRF col cookie, 404 per chi non è membro, 403 per chi non è amministratore.

**Tech Stack:** Java 25, Spring Boot 3.5.6, Spring Security 6.5, Spring Session JDBC, Flyway, PostgreSQL 17, `JdbcClient`, Postgres incorporato di zonky per test e avvio locale, JUnit 5 + AssertJ + MockMvc + spring-security-test; React 19 + TypeScript + Vite, TanStack Query, React Router 7, Tailwind v4, vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-28-persistenza-identita-design.md`

## Global Constraints

- `/legacy` è abbandonato: **nessuna modifica** di comportamento a `adapter/in/web/**`, ai template e ai loro test. Unici cambiamenti ammessi: aggiungere `@Profile("legacy")` alle classi di `adapter/in/web` (Task 15) e `"legacy"` in `@ActiveProfiles` dei loro test. `AuctionRuntime` e `adapter/out/file` restano, compilano, non si estendono.
- Il dominio (`com.fantaagent.domain..`) cambia in un punto solo: `AuctionProjector` tollera l'assenza di `me` (Task 11). Niente altro.
- **Il flag `me` di `Participant` resta, ma non si salva più:** lo calcola `AuctionRegistry` per ogni richiesta (`me = posto dell'utente autenticato`), come dice la specifica (§4.3). Motore e proiettore non cambiano.
- **Il `seatId` non arriva mai dalla richiesta.** Nessun endpoint accetta un parametro che scelga il posto per cui valutare.
- Identificativi: UUID ovunque. Nel registro `participantId` è `userId.toString()`.
- Tutto ciò che cambia fra locale e remoto si legge da variabili d'ambiente: `FANTAAGENT_DB_URL`, `FANTAAGENT_DB_USER`, `FANTAAGENT_DB_PASSWORD`, `FANTAAGENT_PUBLIC_URL`, `FANTAAGENT_COOKIE_SECURE`, `SPRING_MAIL_HOST`/`PORT`/`USERNAME`/`PASSWORD`, `FANTAAGENT_MAIL_FROM`. Il deploy è il passo successivo a questo piano.
- Nessun test tocca `res/` o `data/` del progetto in scrittura. I test di persistenza usano un database fresco sul Postgres incorporato condiviso (`SharedPostgres`).
- Testi dell'interfaccia per clienti finali: mai «server», «file», percorsi, «configurazione». Lessico: «banco», «banditore». Gli errori si mostrano solo con `userMessage(error, fallback)`; ogni slug nuovo scritto per l'utente va aggiunto a `USER_FACING_PROBLEMS` in `frontend/src/api/client.ts`.
- Codice nell'idioma del progetto: commenti in italiano che spiegano il perché, nomi dei test Java in italiano camelCase, `role="alert"` unico per schermata, bersagli 44×44 (`min-h-11`), classi Tailwind dei componenti esistenti (`panel`, `border-line-strong`, `bg-accent text-on-accent`, `text-destructive`).
- Ogni guardia nuova (autorizzazione, append-only, 404 ai non membri, niente consigli altrui) va vista fallire con una mutazione deliberata prima del commit: annotare la mutazione nel resoconto del task, non nel codice.
- Messaggi di commit in italiano; ogni commit termina con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Comandi: Java `mvn -q test` (singolo: `mvn -q test -Dtest=NomeTest`); frontend da `frontend/`: `npx vitest run <file>`, `npm test`, `npm run lint`, `npm run build`.

### Problemi (slug, stato, testo per l'utente)

Ogni slug è l'ultimo segmento di `https://fantaagent.local/problems/<slug>`. Quelli con testo vanno in `USER_FACING_PROBLEMS`.

| Slug | Stato | Testo per l'utente |
|---|---|---|
| `unauthenticated` | 401 | — (il client porta all'accesso) |
| `forbidden` | 403 | — |
| `invalid-account` | 422 | per campo, in `errors` |
| `email-taken` | 409 | «Esiste già un account con questo indirizzo.» |
| `bad-credentials` | 401 | «Email o password non corretti.» |
| `too-many-attempts` | 429 | «Troppi tentativi di accesso. Riprova fra N secondi.» |
| `invalid-token` | 400 | «Il link non è valido o è scaduto.» |
| `service-unavailable` | 503 | «Il servizio non risponde in questo momento. Riprova fra poco.» |
| `unknown-league` | 404 | — |
| `invalid-league` | 422 | per campo, in `errors` |
| `admin-only` | 403 | «Solo l'amministratore della lega può farlo.» |
| `initial-taken` | 409 | «L'iniziale X è già di un altro membro: scegline un'altra.» |
| `invite-unavailable` | 410 | «Questo invito è scaduto o è stato ritirato: chiedine uno nuovo a chi ti ha invitato.» |
| `admin-cannot-leave` | 409 | «L'amministratore non può lasciare la lega.» |
| `not-enough-members` | 409 | «Servono almeno 2 membri nella lega per creare un'asta.» |
| `unknown-auction` | 404 | — |
| `no-seat` | 403 | «Non hai un posto in quest'asta: i consigli non sono disponibili.» |
| `seats-locked` | 409 | «L'asta è iniziata: chi partecipa, i nomi delle squadre e le iniziali non si cambiano più. Si può cambiare solo il turno di chiamata.» |
| `concurrent-write` | 409 | «Qualcun altro ha scritto nello stesso istante: riprova.» |
| `invalid-import` | 422 | per campo, in `errors` |
| `import-mismatch` | 409 | «Le rose ricostruite non coincidono con quelle dell'asta originale: l'importazione è stata annullata.» |

---

## File map

**Backend — nuovi**
- `src/main/resources/db/migration/V1__schema.sql` — utenti, token, leghe, membri, inviti, aste, posti, registro con trigger append-only.
- `src/main/resources/db/migration/V2__sessioni.sql` — tabelle di Spring Session JDBC.
- `src/main/resources/security/common-passwords.txt` — 10 000 password più comuni.
- `application/port/out/`: `AuctionEventStores`, `ConcurrentAppendException`, `DuplicateRequestException`, `Transactions`, `UserAccount`, `UserRepository`, `EmailTakenException`, `PasswordHasher`, `Mailer`, `UserToken`, `UserTokenRepository`, `League`, `LeagueMember`, `MemberRole`, `LeagueRepository`, `InitialTakenException`, `Invite`, `InviteRepository`, `AuctionRecord`, `Seat`, `AuctionRepository`, `ImportedAuction`, `ImportedAuctionReader`.
- `application/service/account/`: `AccountService`, `PasswordPolicy`, `InvalidAccountDataException`, `InvalidTokenException`, `LoginThrottle`, `TooManyAttemptsException`, `Tokens`.
- `application/service/league/`: `LeagueService`, `LeagueAccess`, `NotLeagueMemberException`, `AdminOnlyException`, `InvalidLeagueDataException`, `InviteService`, `InvitePreview`, `CreatedInvite`, `InviteUnavailableException`, `AdminCannotLeaveException`.
- `application/service/auction/`: `AuctionRegistry`, `AuctionView`, `AuctionWriteLock`, `AuctionNotFoundException`, `NoSeatException`, `LeagueAuctionService`, `AuctionCard`, `SeatRequest`, `SeatsLockedException`, `NotEnoughMembersException`, `LogSummary`.
- `application/service/importing/`: `AuctionImportService`, `ImportPreview`, `ImportCheck`, `InvalidImportException`, `ImportMismatchException`.
- `adapter/out/jdbc/`: `JdbcAuctionEventStore`, `JdbcAuctionEventStores`, `JdbcUserRepository`, `JdbcUserTokenRepository`, `JdbcLeagueRepository`, `JdbcInviteRepository`, `JdbcAuctionRepository`, `SpringTransactions`, `Columns`.
- `adapter/out/importing/FileImportReader.java`.
- `adapter/out/security/SpringPasswordHasher.java`; `adapter/out/mail/LogMailer.java`, `SmtpMailer.java`.
- `adapter/in/security/`: `AppUserPrincipal`, `AppUserDetailsService`, `SpaCsrfTokenRequestHandler`, `ProblemResponses`.
- `adapter/in/api/auth/`: `AuthApi`, `AuthDtos`.
- `adapter/in/api/ApiAccess.java`.
- `adapter/in/api/league/`: `LeagueApi`, `LeagueSettingsApi`, `InviteApi`, `LeagueDtos`, `LeagueAuctionsApi`.
- `adapter/in/api/importing/ImportApi.java`.
- `config/`: `SecurityConfig`, `PersistenceConfig`, `AccountConfig`, `LegacyConfig`.

**Backend — test di supporto**
- `src/test/java/com/fantaagent/testsupport/`: `SharedPostgres`, `PersistentPostgres`, `EmbeddedPostgresConfig`, `TestRows`, `MutableClock`, `CapturingMailer`, `ApiFixture`, `Fixtures`, `PortalWorld`, `AuctionApiFixture`, `OldAuctionFiles`.
- `src/test/resources/config/application.properties`, `src/test/resources/config/application-local.properties`.

**Backend — modificati**
- `pom.xml` — dipendenze.
- `src/main/resources/application.yml` — datasource, sessione, cookie, posta, URL pubblico.
- `domain/auction/AuctionProjector.java` — `me` facoltativo.
- `application/service/AuctionService.java` — scritture ripetute su conflitto, idempotenza dal vincolo, `correctPurchase`, `version`.
- `adapter/in/api/*Api.java`, `board/*.java`, `dto/StateDtos.java`, `ApiExceptionHandler.java` — accesso da `ApiAccess`, problemi nuovi.
- `config/BeanConfig.java` — i bean di `AuctionRuntime` & co. si spostano in `LegacyConfig`.
- `adapter/in/web/*.java` — solo `@Profile("legacy")`.
- `adapter/in/spa/SpaRoutesController.java` — rotte nuove, con parametri.
- `run.sh`, `README.md`, `.gitignore`.

**Backend — rimossi**
- `adapter/in/api/LeagueGuard.java`, `AuctionGuard.java`, `AuctionsApi.java`, `SettingsApi.java` e i loro test (sostituiti da `ApiAccess`, `LeagueAuctionsApi`, `LeagueSettingsApi`).

**Frontend — nuovi**
- `src/api/auth.ts`, `src/api/leagues.ts`.
- `src/routes/LoginRoute.tsx`, `RegisterRoute.tsx`, `ForgotPasswordRoute.tsx`, `ResetPasswordRoute.tsx`, `VerifyEmailRoute.tsx`, `ProfileRoute.tsx`, `LeaguesRoute.tsx`, `LeagueRoute.tsx`, `InviteRoute.tsx`, `AuctionSettingsRoute.tsx`, `ImportRoute.tsx`, `RequireAuth.tsx`, `WithAuctionContext.tsx`.
- `src/domain/AuthForm.tsx`, `InitialField.tsx`, `CorrectPurchaseDialog.tsx`.

**Frontend — modificati**
- `src/api/client.ts`, `QueryProvider.tsx`, `hooks.ts`, `types.ts`, `main.tsx`, `router.tsx`, `AppShell.tsx`.
- `src/routes/AuctionRoute.tsx`, `ProjectionRoute.tsx`; `SettingsRoute.tsx` diventa `LeagueRulesRoute.tsx`.
- `src/domain/RosterGrid.tsx`, `bidChannel.ts`, `RenameAuctionDialog.tsx`, `DeleteAuctionDialog.tsx`.

**Frontend — rimossi**
- `src/routes/HomeRoute.tsx` e il suo test (sostituiti da `LeaguesRoute`); `AuctionRow`, `AuctionRowMenu`, `ParticipantsFieldset` e i componenti rimasti senza utilizzatori (Task 18).

---

## Parte A — Database e registro

Alla fine della Parte A il registro di un'asta vive su Postgres, append-only per vincolo. L'applicazione si comporta ancora come oggi.

### Task 1: Postgres, Flyway e lo schema

**Files:**
- Modify: `pom.xml`
- Modify: `src/main/resources/application.yml`
- Modify: `.gitignore`
- Create: `src/main/resources/db/migration/V1__schema.sql`
- Create: `src/test/java/com/fantaagent/testsupport/SharedPostgres.java`
- Create: `src/test/java/com/fantaagent/testsupport/PersistentPostgres.java`
- Create: `src/test/java/com/fantaagent/testsupport/EmbeddedPostgresConfig.java`
- Create: `src/test/java/com/fantaagent/testsupport/TestRows.java`
- Create: `src/test/resources/config/application.properties`
- Create: `src/test/resources/config/application-local.properties`
- Test: `src/test/java/com/fantaagent/adapter/out/jdbc/SchemaTest.java`

**Interfaces:**
- Produces: `SharedPostgres.freshDatabase(): DataSource` (database vuoto, nome unico), `SharedPostgres.migratedDatabase(): DataSource` (con Flyway applicato); `TestRows.user(JdbcClient, String email): UUID`, `TestRows.league(JdbcClient, UUID adminId): UUID`, `TestRows.auction(JdbcClient, UUID leagueId, UUID adminId): UUID`; proprietà `fantaagent.db.embedded` = `per-context` | `persistent`, `fantaagent.db.embedded-dir`.

Perché un Postgres incorporato e non Testcontainers: su questa macchina Docker non è in esecuzione, e un test che non parte senza un demone è un test che non si esegue. `io.zonky.test:embedded-postgres` scarica i binari veri di Postgres come dipendenza Maven: è lo stesso motore della produzione, senza container. Sta solo nel classpath dei test; `run.sh` lo usa passando da `useTestClasspath` (Task 21), quindi il jar di produzione non lo contiene.

- [ ] **Step 1: Dipendenze**

In `pom.xml`, dentro `<dependencies>`:

```xml
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-jdbc</artifactId>
    </dependency>
    <dependency>
      <groupId>org.flywaydb</groupId>
      <artifactId>flyway-core</artifactId>
    </dependency>
    <dependency>
      <groupId>org.flywaydb</groupId>
      <artifactId>flyway-database-postgresql</artifactId>
    </dependency>
    <dependency>
      <groupId>org.postgresql</groupId>
      <artifactId>postgresql</artifactId>
      <scope>runtime</scope>
    </dependency>
    <dependency>
      <groupId>io.zonky.test</groupId>
      <artifactId>embedded-postgres</artifactId>
      <version>2.1.0</version>
      <scope>test</scope>
    </dependency>
```

e dentro `<dependencyManagement><dependencies>` (crearlo se manca, dopo `<dependencies>`):

```xml
      <dependency>
        <groupId>io.zonky.test.postgres</groupId>
        <artifactId>embedded-postgres-binaries-bom</artifactId>
        <version>17.2.0</version>
        <type>pom</type>
        <scope>import</scope>
      </dependency>
```

Run: `mvn -q dependency:resolve -DincludeArtifactIds=embedded-postgres,embedded-postgres-binaries-darwin-arm64v8`
Expected: nessun errore. Se la versione `17.2.0` del BOM non esiste su Maven Central, usare la più recente `17.x.0` elencata su `https://repo1.maven.org/maven2/io/zonky/test/postgres/embedded-postgres-binaries-bom/` e annotarla nel resoconto.

- [ ] **Step 2: Configurazione**

In `src/main/resources/application.yml`, sotto `spring:` (accanto a `application:` e `thymeleaf:`):

```yaml
  # Il database arriva dall'ambiente. In locale e nei test lo fornisce il Postgres
  # incorporato (EmbeddedPostgresConfig, solo nel classpath dei test): se qui l'URL
  # resta vuoto e nessun bean DataSource e' stato dichiarato, l'avvio fallisce
  # subito — che e' quello che deve succedere in produzione senza database.
  datasource:
    url: ${FANTAAGENT_DB_URL:}
    username: ${FANTAAGENT_DB_USER:}
    password: ${FANTAAGENT_DB_PASSWORD:}
  flyway:
    locations: classpath:db/migration
```

In `.gitignore` aggiungere:

```
# Postgres incorporato dell'avvio locale
data/pg/
```

`src/test/resources/config/application.properties` (la cartella `config/` del classpath ha precedenza su `application.yml`: vale per ogni `@SpringBootTest` senza toccarne nessuno):

```properties
# Ogni contesto Spring dei test ha il suo database, sullo stesso Postgres incorporato.
fantaagent.db.embedded=per-context
```

`src/test/resources/config/application-local.properties`:

```properties
# ./run.sh: un Postgres incorporato che conserva i dati fra un avvio e l'altro.
fantaagent.db.embedded=persistent
fantaagent.db.embedded-dir=data/pg
```

- [ ] **Step 3: Scrivere il test che fallisce**

`src/test/java/com/fantaagent/adapter/out/jdbc/SchemaTest.java`:

```java
package com.fantaagent.adapter.out.jdbc;

import com.fantaagent.testsupport.SharedPostgres;
import com.fantaagent.testsupport.TestRows;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Le garanzie che lo schema da' da solo, a prescindere dal codice che lo usa: il
 * registro non si riscrive, non si svuota, non accetta due eventi con lo stesso
 * numero ne' due volte la stessa richiesta.
 */
class SchemaTest {

    private JdbcClient jdbc;
    private UUID admin;
    private UUID auction;

    @BeforeEach
    void setUp() {
        jdbc = JdbcClient.create(SharedPostgres.migratedDatabase());
        admin = TestRows.user(jdbc, "admin@example.com");
        UUID league = TestRows.league(jdbc, admin);
        auction = TestRows.auction(jdbc, league, admin);
    }

    private int insertEvent(long seq, String requestId) {
        return jdbc.sql("""
                        INSERT INTO auction_event (auction_id, seq, at, type, payload, request_id, actor_id)
                        VALUES (:a, :seq, :at, 'PhaseAdvanced', CAST('{}' AS jsonb), :r, :actor)
                        """)
                .param("a", auction).param("seq", seq).param("at", Timestamp.from(Instant.now()))
                .param("r", requestId).param("actor", admin)
                .update();
    }

    @Test
    void unEventoScrittoNonSiAggiorna() {
        insertEvent(1, null);
        assertThatThrownBy(() -> jdbc.sql("UPDATE auction_event SET type = 'X'").update())
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("append-only");
    }

    @Test
    void unEventoScrittoNonSiCancella() {
        insertEvent(1, null);
        assertThatThrownBy(() -> jdbc.sql("DELETE FROM auction_event").update())
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("append-only");
    }

    @Test
    void ilRegistroNonSiSvuota() {
        insertEvent(1, null);
        assertThatThrownBy(() -> jdbc.sql("TRUNCATE auction_event CASCADE").update())
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("append-only");
    }

    @Test
    void dueEventiNonHannoLoStessoNumero() {
        insertEvent(1, null);
        assertThatThrownBy(() -> insertEvent(1, null)).isInstanceOf(DuplicateKeyException.class);
    }

    @Test
    void laStessaRichiestaNonSiScriveDueVolte() {
        insertEvent(1, "r-1");
        assertThatThrownBy(() -> insertEvent(2, "r-1"))
                .isInstanceOf(DuplicateKeyException.class)
                .hasMessageContaining("auction_event_request_key");
    }

    @Test
    void piuEventiSenzaRichiestaConvivono() {
        insertEvent(1, null);
        insertEvent(2, null);
        assertThat(jdbc.sql("SELECT count(*) FROM auction_event").query(Integer.class).single())
                .isEqualTo(2);
    }

    @Test
    void lEmailNonDistingueMaiuscole() {
        assertThatThrownBy(() -> TestRows.user(jdbc, "ADMIN@example.com"))
                .isInstanceOf(DuplicateKeyException.class);
    }
}
```

- [ ] **Step 4: Scrivere il supporto dei test**

`src/test/java/com/fantaagent/testsupport/SharedPostgres.java`:

```java
package com.fantaagent.testsupport;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.flywaydb.core.Flyway;

import javax.sql.DataSource;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Un solo Postgres incorporato per tutta la JVM dei test, e un database nuovo per chi
 * lo chiede.
 *
 * <p>Un processo per contesto Spring sarebbe il modo piu' semplice, ma i test web
 * hanno contesti diversi l'uno dall'altro (ogni combinazione di {@code @MockitoBean}
 * ne crea uno) e la cache di Spring li tiene vivi tutti: decine di Postgres accesi.
 * Un database per chiamata da' lo stesso isolamento con un processo solo.
 */
public final class SharedPostgres {

    private static final AtomicInteger COUNTER = new AtomicInteger();
    private static EmbeddedPostgres server;

    private SharedPostgres() {
    }

    private static synchronized EmbeddedPostgres server() {
        if (server == null) {
            try {
                server = EmbeddedPostgres.start();
            } catch (IOException e) {
                throw new UncheckedIOException("Postgres incorporato non avviato", e);
            }
            EmbeddedPostgres started = server;
            Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                try {
                    started.close();
                } catch (IOException ignored) {
                    // la JVM sta finendo: non c'e' nessuno a cui dirlo
                }
            }));
        }
        return server;
    }

    /** Un database vuoto, dal nome mai usato prima in questa JVM. */
    public static DataSource freshDatabase() {
        String name = "t" + ProcessHandle.current().pid() + "_" + COUNTER.incrementAndGet();
        try (Connection c = server().getPostgresDatabase().getConnection();
             Statement s = c.createStatement()) {
            s.execute("CREATE DATABASE " + name);
        } catch (SQLException e) {
            throw new IllegalStateException("database di prova non creato: " + name, e);
        }
        return server().getDatabase("postgres", name);
    }

    /** Un database vuoto con tutte le migrazioni applicate: per i test senza Spring. */
    public static DataSource migratedDatabase() {
        DataSource ds = freshDatabase();
        Flyway.configure().dataSource(ds).locations("classpath:db/migration").load().migrate();
        return ds;
    }
}
```

`src/test/java/com/fantaagent/testsupport/PersistentPostgres.java`:

```java
package com.fantaagent.testsupport;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;

import javax.sql.DataSource;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * Il Postgres di {@code ./run.sh}: stessa libreria dei test, ma con i dati in una
 * cartella che sopravvive al riavvio, e su una porta fissa per poterci guardare
 * dentro con un client qualunque.
 */
public final class PersistentPostgres {

    static final int PORT = 54329;
    static final String DATABASE = "fantaagent";

    private PersistentPostgres() {
    }

    public static DataSource start(Path dataDir) {
        try {
            Files.createDirectories(dataDir);
            EmbeddedPostgres pg = EmbeddedPostgres.builder()
                    .setDataDirectory(dataDir)
                    .setCleanDataDirectory(false)
                    .setPort(PORT)
                    .start();
            Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                try {
                    pg.close();
                } catch (IOException ignored) {
                    // in chiusura
                }
            }));
            try (Connection c = pg.getPostgresDatabase().getConnection();
                 Statement s = c.createStatement()) {
                var rs = s.executeQuery("SELECT 1 FROM pg_database WHERE datname = '" + DATABASE + "'");
                if (!rs.next()) {
                    s.execute("CREATE DATABASE " + DATABASE);
                }
            }
            return pg.getDatabase("postgres", DATABASE);
        } catch (IOException e) {
            throw new UncheckedIOException("Postgres locale non avviato in " + dataDir, e);
        } catch (SQLException e) {
            throw new IllegalStateException("database locale non creato", e);
        }
    }
}
```

`src/test/java/com/fantaagent/testsupport/EmbeddedPostgresConfig.java`:

```java
package com.fantaagent.testsupport;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.sql.DataSource;
import java.nio.file.Path;

/**
 * Il DataSource quando non c'e' un database vero: nei test e con {@code ./run.sh}.
 *
 * <p>Vive nel classpath dei test apposta: il jar di produzione non contiene ne' questa
 * classe ne' i binari di Postgres. La scansione dei componenti la trova perche' sta
 * sotto {@code com.fantaagent}; la condizione la accende solo dove una delle due
 * proprieta' di {@code src/test/resources/config} lo chiede.
 */
@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(name = "fantaagent.db.embedded")
public class EmbeddedPostgresConfig {

    @Bean
    DataSource dataSource(@Value("${fantaagent.db.embedded}") String mode,
                          @Value("${fantaagent.db.embedded-dir:data/pg}") String dir) {
        return switch (mode) {
            case "per-context" -> SharedPostgres.freshDatabase();
            case "persistent" -> PersistentPostgres.start(Path.of(dir));
            default -> throw new IllegalStateException(
                    "fantaagent.db.embedded non riconosciuto: " + mode);
        };
    }
}
```

`src/test/java/com/fantaagent/testsupport/TestRows.java`:

```java
package com.fantaagent.testsupport;

import org.springframework.jdbc.core.simple.JdbcClient;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

/**
 * Righe minime per soddisfare le chiavi esterne nei test degli adattatori, scritte in
 * SQL invece che con i repository: un test del registro non deve dipendere dal codice
 * che crea utenti e leghe.
 */
public final class TestRows {

    static final String RULES = """
            {"budget":500,"slots":{"P":3,"D":8,"C":8,"A":6}}""";

    private TestRows() {
    }

    public static UUID user(JdbcClient jdbc, String email) {
        UUID id = UUID.randomUUID();
        jdbc.sql("""
                        INSERT INTO app_user (id, email, password_hash, display_name, created_at)
                        VALUES (:id, :email, 'x', :name, :at)
                        """)
                .param("id", id).param("email", email).param("name", email.split("@")[0])
                .param("at", Timestamp.from(Instant.now()))
                .update();
        return id;
    }

    public static UUID league(JdbcClient jdbc, UUID adminId) {
        UUID id = UUID.randomUUID();
        jdbc.sql("""
                        INSERT INTO league (id, name, created_by, created_at, rules, scoring, bidder)
                        VALUES (:id, 'Lega di prova', :admin, :at, CAST(:rules AS jsonb),
                                CAST('{}' AS jsonb), CAST('{"bidTimerSeconds":5,"beepEnabled":true}' AS jsonb))
                        """)
                .param("id", id).param("admin", adminId).param("at", Timestamp.from(Instant.now()))
                .param("rules", RULES)
                .update();
        return id;
    }

    public static UUID auction(JdbcClient jdbc, UUID leagueId, UUID adminId) {
        UUID id = UUID.randomUUID();
        jdbc.sql("""
                        INSERT INTO auction (id, league_id, name, created_by, created_at, rules, scoring, bidder)
                        VALUES (:id, :league, 'Asta di prova', :admin, :at, CAST(:rules AS jsonb),
                                CAST('{}' AS jsonb), CAST('{"bidTimerSeconds":5,"beepEnabled":true}' AS jsonb))
                        """)
                .param("id", id).param("league", leagueId).param("admin", adminId)
                .param("at", Timestamp.from(Instant.now())).param("rules", RULES)
                .update();
        return id;
    }
}
```

- [ ] **Step 5: Eseguire il test e vederlo fallire**

Run: `mvn -q test -Dtest=SchemaTest`
Expected: FAIL — Flyway non trova migrazioni, `relation "app_user" does not exist`.

- [ ] **Step 6: Scrivere lo schema**

`src/main/resources/db/migration/V1__schema.sql`:

```sql
-- Schema del portale: utenti, leghe, aste e il loro registro.
-- Le migrazioni non si riscrivono mai dopo essere state applicate: ogni modifica e'
-- un file nuovo con il numero successivo.

CREATE TABLE app_user (
    id                uuid PRIMARY KEY,
    email             text        NOT NULL,
    password_hash     text        NOT NULL,
    display_name      text        NOT NULL,
    email_verified_at timestamptz,
    created_at        timestamptz NOT NULL
);
-- Unica senza distinzione di maiuscole: Mario@x.it e mario@x.it sono la stessa persona.
CREATE UNIQUE INDEX app_user_email_key ON app_user (lower(email));

CREATE TABLE user_token (
    id         uuid PRIMARY KEY,
    user_id    uuid        NOT NULL REFERENCES app_user (id),
    purpose    text        NOT NULL CHECK (purpose IN ('VERIFY_EMAIL', 'RESET_PASSWORD')),
    -- Solo l'hash: chi legge il database non puo' usare un link che non ha ricevuto.
    token_hash text        NOT NULL UNIQUE,
    created_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    used_at    timestamptz
);

CREATE TABLE league (
    id         uuid PRIMARY KEY,
    name       text        NOT NULL CHECK (length(trim(name)) > 0),
    created_by uuid        NOT NULL REFERENCES app_user (id),
    created_at timestamptz NOT NULL,
    -- I valori predefiniti delle aste future. Un'asta li COPIA quando nasce.
    rules      jsonb       NOT NULL,
    scoring    jsonb       NOT NULL,
    bidder     jsonb       NOT NULL
);

CREATE TABLE league_member (
    league_id uuid        NOT NULL REFERENCES league (id),
    user_id   uuid        NOT NULL REFERENCES app_user (id),
    role      text        NOT NULL CHECK (role IN ('ADMIN', 'MEMBER')),
    team_name text        NOT NULL CHECK (length(trim(team_name)) > 0),
    initial   char(1)     NOT NULL,
    joined_at timestamptz NOT NULL,
    PRIMARY KEY (league_id, user_id),
    CONSTRAINT league_member_initial_key UNIQUE (league_id, initial)
);

CREATE TABLE league_invite (
    id         uuid PRIMARY KEY,
    league_id  uuid        NOT NULL REFERENCES league (id),
    token_hash text        NOT NULL UNIQUE,
    created_by uuid        NOT NULL REFERENCES app_user (id),
    created_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz
);

CREATE TABLE auction (
    id         uuid PRIMARY KEY,
    league_id  uuid        NOT NULL REFERENCES league (id),
    name       text        NOT NULL CHECK (length(trim(name)) > 0),
    created_by uuid        NOT NULL REFERENCES app_user (id),
    created_at timestamptz NOT NULL,
    -- Cancellare un'asta la nasconde: registro e posti restano.
    deleted_at timestamptz,
    -- Fotografati dalla lega alla creazione, e da li' fissi.
    rules      jsonb       NOT NULL,
    scoring    jsonb       NOT NULL,
    bidder     jsonb       NOT NULL
);
CREATE INDEX auction_league_idx ON auction (league_id);

CREATE TABLE auction_seat (
    auction_id uuid    NOT NULL REFERENCES auction (id),
    user_id    uuid    NOT NULL REFERENCES app_user (id),
    team_name  text    NOT NULL CHECK (length(trim(team_name)) > 0),
    initial    char(1) NOT NULL,
    -- Il turno di chiamata. Differibile: riordinare scambia posizioni dentro una sola
    -- transazione, e il controllo va fatto alla fine, non riga per riga.
    position   int     NOT NULL,
    PRIMARY KEY (auction_id, user_id),
    CONSTRAINT auction_seat_initial_key UNIQUE (auction_id, initial),
    CONSTRAINT auction_seat_position_key UNIQUE (auction_id, position) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE auction_event (
    auction_id uuid        NOT NULL REFERENCES auction (id),
    seq        bigint      NOT NULL CHECK (seq >= 1),
    at         timestamptz NOT NULL,
    type       text        NOT NULL,
    payload    jsonb       NOT NULL,
    request_id text,
    actor_id   uuid        NOT NULL REFERENCES app_user (id),
    -- Due scritture concorrenti che calcolano lo stesso seq non passano entrambe.
    CONSTRAINT auction_event_pkey PRIMARY KEY (auction_id, seq),
    -- L'idempotenza degli acquisti: piu' righe con request_id NULL convivono.
    CONSTRAINT auction_event_request_key UNIQUE (auction_id, request_id)
);

-- Il registro e' append-only per costruzione, non per disciplina del codice:
-- correggere o annullare sono eventi nuovi che ne referenziano uno vecchio.
CREATE FUNCTION auction_event_append_only() RETURNS trigger
    LANGUAGE plpgsql AS
$$
BEGIN
    RAISE EXCEPTION 'auction_event e'' append-only: % non ammesso', TG_OP;
END
$$;

CREATE TRIGGER auction_event_no_update_delete
    BEFORE UPDATE OR DELETE ON auction_event
    FOR EACH ROW EXECUTE FUNCTION auction_event_append_only();

CREATE TRIGGER auction_event_no_truncate
    BEFORE TRUNCATE ON auction_event
    FOR EACH STATEMENT EXECUTE FUNCTION auction_event_append_only();
```

La specifica chiede anche che il ruolo dell'applicazione non abbia i permessi di `UPDATE`, `DELETE`, `TRUNCATE`. Quella separazione dipende dai ruoli del database remoto, che non esistono ancora: si fa nel deploy (Task 21 la mette nell'elenco). Il trigger vale per qualunque ruolo, proprietario compreso.

- [ ] **Step 7: Eseguire il test e vederlo passare**

Run: `mvn -q test -Dtest=SchemaTest`
Expected: PASS, 7 test.

- [ ] **Step 8: Mutazione**

Commentare temporaneamente il trigger `auction_event_no_truncate` in `V1__schema.sql`, rieseguire `mvn -q test -Dtest=SchemaTest`: `ilRegistroNonSiSvuota` deve fallire. Ripristinare.

- [ ] **Step 9: L'intera suite**

Run: `mvn -q test`
Expected: PASS. Ogni `@SpringBootTest` ora avvia Flyway su un database suo: se un test fallisce per il DataSource, verificare che `src/test/resources/config/application.properties` sia nel classpath (`target/test-classes/config/`).

- [ ] **Step 10: Commit**

```bash
git add pom.xml .gitignore src/main/resources/application.yml src/main/resources/db src/test/java/com/fantaagent/testsupport src/test/resources src/test/java/com/fantaagent/adapter/out/jdbc/SchemaTest.java
git commit -m "Postgres e Flyway: lo schema del portale, col registro append-only per vincolo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Il registro su tabella

**Files:**
- Create: `src/main/java/com/fantaagent/application/port/out/AuctionEventStores.java`
- Create: `src/main/java/com/fantaagent/application/port/out/ConcurrentAppendException.java`
- Create: `src/main/java/com/fantaagent/application/port/out/DuplicateRequestException.java`
- Create: `src/main/java/com/fantaagent/adapter/out/jdbc/JdbcAuctionEventStore.java`
- Create: `src/main/java/com/fantaagent/adapter/out/jdbc/JdbcAuctionEventStores.java`
- Test: `src/test/java/com/fantaagent/adapter/out/jdbc/JdbcAuctionEventStoreTest.java`

**Interfaces:**
- Consumes: `TestRows`, `SharedPostgres` (Task 1); `EventDto` (esistente, `adapter/out/file/event`).
- Produces:
  - `interface AuctionEventStores { AuctionEventStore open(UUID auctionId, UUID actorId); }`
  - `class ConcurrentAppendException extends RuntimeException` — `ConcurrentAppendException(long seq, Throwable cause)`, `long seq()`.
  - `class DuplicateRequestException extends RuntimeException` — `DuplicateRequestException(String requestId)`, `String requestId()`.
  - `JdbcAuctionEventStore(JdbcClient jdbc, ObjectMapper json, UUID auctionId, UUID actorId)`.
  - `JdbcAuctionEventStores(JdbcClient jdbc, ObjectMapper json) implements AuctionEventStores`.

`EventDto` resta dov'è e si riusa come payload: il file va in pensione, il formato dell'evento no. L'import del Task 19 confronta i due registri proprio perché hanno la stessa forma.

- [ ] **Step 1: Scrivere il test che fallisce**

`src/test/java/com/fantaagent/adapter/out/jdbc/JdbcAuctionEventStoreTest.java`:

```java
package com.fantaagent.adapter.out.jdbc;

import com.fantaagent.application.port.out.ConcurrentAppendException;
import com.fantaagent.application.port.out.DuplicateRequestException;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.player.Role;
import com.fantaagent.testsupport.SharedPostgres;
import com.fantaagent.testsupport.TestRows;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JdbcAuctionEventStoreTest {

    private static final ObjectMapper JSON = JsonMapper.builder().addModule(new JavaTimeModule()).build();
    // Postgres conserva i microsecondi: un Instant coi nanosecondi non tornerebbe uguale.
    private static final Instant AT = Instant.parse("2026-09-28T20:15:30.123456Z");

    private JdbcClient jdbc;
    private UUID admin;
    private UUID auction;
    private JdbcAuctionEventStore store;

    @BeforeEach
    void setUp() {
        jdbc = JdbcClient.create(SharedPostgres.migratedDatabase());
        admin = TestRows.user(jdbc, "admin@example.com");
        auction = TestRows.auction(jdbc, TestRows.league(jdbc, admin), admin);
        store = new JdbcAuctionEventStore(jdbc, JSON, auction, admin);
    }

    @Test
    void ogniTipoDiEventoTornaIdentico() {
        store.append(new AuctionEvent.AuctionStarted(1, AT, "Asta"));
        store.append(new AuctionEvent.AuctionRenamed(2, AT, "Asta nuova"));
        store.append(new AuctionEvent.PhaseAdvanced(3, AT, Role.D));
        store.append(new AuctionEvent.PlayerPurchased(4, AT, "p1", "u1", 12, "r-1"));
        store.append(new AuctionEvent.PurchaseCorrected(5, AT, 4, "u2", 15));
        store.append(new AuctionEvent.PurchaseRevoked(6, AT, 4));

        assertThat(store.load()).containsExactly(
                new AuctionEvent.AuctionStarted(1, AT, "Asta"),
                new AuctionEvent.AuctionRenamed(2, AT, "Asta nuova"),
                new AuctionEvent.PhaseAdvanced(3, AT, Role.D),
                new AuctionEvent.PlayerPurchased(4, AT, "p1", "u1", 12, "r-1"),
                new AuctionEvent.PurchaseCorrected(5, AT, 4, "u2", 15),
                new AuctionEvent.PurchaseRevoked(6, AT, 4));
    }

    @Test
    void ilProssimoNumeroSegueLUltimo() {
        assertThat(store.nextSeq()).isEqualTo(1);
        store.appendWithNextSeq(seq -> new AuctionEvent.AuctionStarted(seq, AT, null));
        assertThat(store.nextSeq()).isEqualTo(2);
    }

    @Test
    void ogniAstaHaLaSuaNumerazione() {
        UUID other = TestRows.auction(jdbc, TestRows.league(jdbc, admin), admin);
        JdbcAuctionEventStore otherStore = new JdbcAuctionEventStore(jdbc, JSON, other, admin);
        store.append(new AuctionEvent.AuctionStarted(1, AT, "A"));
        otherStore.append(new AuctionEvent.AuctionStarted(1, AT, "B"));

        assertThat(store.load()).containsExactly(new AuctionEvent.AuctionStarted(1, AT, "A"));
        assertThat(otherStore.load()).containsExactly(new AuctionEvent.AuctionStarted(1, AT, "B"));
    }

    @Test
    void unNumeroGiaPresoEUnConflittoNonUnaSovrascrittura() {
        store.append(new AuctionEvent.AuctionStarted(1, AT, "A"));
        assertThatThrownBy(() -> store.append(new AuctionEvent.PhaseAdvanced(1, AT, Role.D)))
                .isInstanceOf(ConcurrentAppendException.class)
                .extracting(e -> ((ConcurrentAppendException) e).seq()).isEqualTo(1L);
        assertThat(store.load()).containsExactly(new AuctionEvent.AuctionStarted(1, AT, "A"));
    }

    @Test
    void unaRichiestaRipetutaESegnalataComeTale() {
        store.append(new AuctionEvent.PlayerPurchased(1, AT, "p1", "u1", 12, "r-1"));
        assertThatThrownBy(() -> store.append(
                new AuctionEvent.PlayerPurchased(2, AT, "p2", "u1", 3, "r-1")))
                .isInstanceOf(DuplicateRequestException.class)
                .extracting(e -> ((DuplicateRequestException) e).requestId()).isEqualTo("r-1");
    }

    @Test
    void chiScriveRestaSullaRiga() {
        store.append(new AuctionEvent.AuctionStarted(1, AT, "A"));
        assertThat(jdbc.sql("SELECT actor_id FROM auction_event").query(UUID.class).single())
                .isEqualTo(admin);
    }

    @Test
    void laDataSiConservaAlMicrosecondo() {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        store.append(new AuctionEvent.AuctionStarted(1, now, "A"));
        assertThat(store.load().getFirst().at()).isEqualTo(now);
    }
}
```

- [ ] **Step 2: Eseguire il test e vederlo fallire**

Run: `mvn -q test -Dtest=JdbcAuctionEventStoreTest`
Expected: FAIL di compilazione, `JdbcAuctionEventStore` non esiste.

- [ ] **Step 3: Scrivere le porte**

`src/main/java/com/fantaagent/application/port/out/AuctionEventStores.java`:

```java
package com.fantaagent.application.port.out;

import java.util.UUID;

/**
 * Apre il registro di un'asta per chi sta facendo la richiesta.
 *
 * <p>Uno store per richiesta, non uno per asta: {@code actorId} e' chi firma ogni
 * evento che quello store scrive, e cambia da una richiesta all'altra. Aprirlo costa
 * niente — non legge nulla finche' non glielo si chiede.
 */
public interface AuctionEventStores {

    AuctionEventStore open(UUID auctionId, UUID actorId);
}
```

`src/main/java/com/fantaagent/application/port/out/ConcurrentAppendException.java`:

```java
package com.fantaagent.application.port.out;

/**
 * Il numero di sequenza calcolato e' stato preso da un'altra scrittura arrivata
 * prima. Non e' un errore di chi scrive: e' il segnale di rileggere il registro e
 * rifare i controlli, perche' il comando potrebbe non essere piu' valido.
 */
public class ConcurrentAppendException extends RuntimeException {

    private final long seq;

    public ConcurrentAppendException(long seq, Throwable cause) {
        super("il numero " + seq + " e' gia' stato scritto da un'altra richiesta", cause);
        this.seq = seq;
    }

    public long seq() {
        return seq;
    }
}
```

`src/main/java/com/fantaagent/application/port/out/DuplicateRequestException.java`:

```java
package com.fantaagent.application.port.out;

/** La richiesta con questa chiave di idempotenza e' gia' nel registro. */
public class DuplicateRequestException extends RuntimeException {

    private final String requestId;

    public DuplicateRequestException(String requestId) {
        super("richiesta gia' registrata: " + requestId);
        this.requestId = requestId;
    }

    public String requestId() {
        return requestId;
    }
}
```

- [ ] **Step 4: Scrivere l'adattatore**

`src/main/java/com/fantaagent/adapter/out/jdbc/JdbcAuctionEventStore.java`:

```java
package com.fantaagent.adapter.out.jdbc;

import com.fantaagent.adapter.out.file.event.EventDto;
import com.fantaagent.application.port.out.AuctionEventStore;
import com.fantaagent.application.port.out.ConcurrentAppendException;
import com.fantaagent.application.port.out.DuplicateRequestException;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.sql.Timestamp;
import java.util.List;
import java.util.UUID;

/**
 * Il registro di un'asta su {@code auction_event}.
 *
 * <p>Il lock di {@code JsonlAuctionEventStore} qui non serve e non basterebbe: con
 * piu' richieste, e domani piu' istanze, l'unico arbitro comune e' il database. Due
 * scritture che calcolano lo stesso seq arrivano entrambe alla INSERT; la chiave
 * primaria ne lascia passare una e l'altra diventa {@link ConcurrentAppendException}.
 * Chi scrive decide cosa farne — {@code AuctionService} rilegge e rivalida.
 *
 * <p>Nessuna transazione qui dentro: una INSERT sola e' gia' atomica, e una
 * transazione aperta intorno a un conflitto resterebbe inutilizzabile per il
 * tentativo successivo.
 */
public class JdbcAuctionEventStore implements AuctionEventStore {

    static final String REQUEST_KEY = "auction_event_request_key";

    private final JdbcClient jdbc;
    private final ObjectMapper json;
    private final UUID auctionId;
    private final UUID actorId;

    public JdbcAuctionEventStore(JdbcClient jdbc, ObjectMapper json, UUID auctionId, UUID actorId) {
        this.jdbc = jdbc;
        this.json = json;
        this.auctionId = auctionId;
        this.actorId = actorId;
    }

    @Override
    public void append(AuctionEvent event) {
        EventDto dto = EventDto.from(event);
        try {
            jdbc.sql("""
                            INSERT INTO auction_event (auction_id, seq, at, type, payload, request_id, actor_id)
                            VALUES (:auction, :seq, :at, :type, CAST(:payload AS jsonb), :request, :actor)
                            """)
                    .param("auction", auctionId)
                    .param("seq", event.seq())
                    .param("at", Timestamp.from(event.at()))
                    .param("type", dto.type())
                    .param("payload", write(dto))
                    .param("request", dto.requestId())
                    .param("actor", actorId)
                    .update();
        } catch (DuplicateKeyException e) {
            // Il nome del vincolo e' nel messaggio di Postgres: e' l'unico modo di
            // distinguere "numero gia' preso" da "richiesta gia' vista" senza
            // dipendere dalle classi del driver.
            if (String.valueOf(e.getMessage()).contains(REQUEST_KEY)) {
                throw new DuplicateRequestException(dto.requestId());
            }
            throw new ConcurrentAppendException(event.seq(), e);
        }
    }

    @Override
    public List<AuctionEvent> load() {
        return jdbc.sql("SELECT payload FROM auction_event WHERE auction_id = :auction ORDER BY seq")
                .param("auction", auctionId)
                .query(String.class)
                .list()
                .stream()
                .map(this::read)
                .map(EventDto::toDomain)
                .toList();
    }

    @Override
    public long nextSeq() {
        return jdbc.sql("SELECT coalesce(max(seq), 0) + 1 FROM auction_event WHERE auction_id = :auction")
                .param("auction", auctionId)
                .query(Long.class)
                .single();
    }

    /**
     * Le copie di sicurezza per fase erano la rete del file. Qui la rete e' il backup
     * del database: una copia per ogni cambio di fase, dentro lo stesso database,
     * non proteggerebbe da nulla che il registro append-only non copra gia'.
     */
    @Override
    public void backup(String label) {
    }

    private String write(EventDto dto) {
        try {
            return json.writeValueAsString(dto);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("evento non serializzabile: " + dto.type(), e);
        }
    }

    private EventDto read(String payload) {
        try {
            return json.readValue(payload, EventDto.class);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("evento illeggibile nel registro " + auctionId, e);
        }
    }
}
```

`src/main/java/com/fantaagent/adapter/out/jdbc/JdbcAuctionEventStores.java`:

```java
package com.fantaagent.adapter.out.jdbc;

import com.fantaagent.application.port.out.AuctionEventStore;
import com.fantaagent.application.port.out.AuctionEventStores;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.util.UUID;

public class JdbcAuctionEventStores implements AuctionEventStores {

    private final JdbcClient jdbc;
    private final ObjectMapper json;

    public JdbcAuctionEventStores(JdbcClient jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    @Override
    public AuctionEventStore open(UUID auctionId, UUID actorId) {
        return new JdbcAuctionEventStore(jdbc, json, auctionId, actorId);
    }
}
```

- [ ] **Step 5: Eseguire il test e vederlo passare**

Run: `mvn -q test -Dtest=JdbcAuctionEventStoreTest`
Expected: PASS, 7 test. Se `ogniTipoDiEventoTornaIdentico` fallisce su `at`, controllare che `JavaTimeModule` sia registrato sul mapper del test.

- [ ] **Step 6: Mutazione**

Invertire temporaneamente il ramo del `catch` (lanciare sempre `ConcurrentAppendException`): `unaRichiestaRipetutaESegnalataComeTale` deve fallire. Ripristinare.

- [ ] **Step 7: Commit**

```bash
git add src/main/java/com/fantaagent/application/port/out/AuctionEventStores.java src/main/java/com/fantaagent/application/port/out/ConcurrentAppendException.java src/main/java/com/fantaagent/application/port/out/DuplicateRequestException.java src/main/java/com/fantaagent/adapter/out/jdbc src/test/java/com/fantaagent/adapter/out/jdbc/JdbcAuctionEventStoreTest.java
git commit -m "Il registro d'asta su tabella: numero preso e richiesta ripetuta come segnali distinti

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Parte B — Account

Alla fine della Parte B ci si registra, si entra, si esce, si verifica l'indirizzo e si recupera la password, dal browser. Le schermate d'asta di oggi funzionano per chi ha fatto l'accesso; la lega è ancora quella unica (`default`).

### Task 3: Il servizio degli account

**Files:**
- Modify: `pom.xml`, `src/main/resources/application.yml`
- Create: `src/main/resources/security/common-passwords.txt`
- Create: `application/port/out/UserAccount.java`, `UserRepository.java`, `EmailTakenException.java`, `PasswordHasher.java`, `Mailer.java`, `UserToken.java`, `UserTokenRepository.java`
- Create: `application/service/account/AccountService.java`, `PasswordPolicy.java`, `InvalidAccountDataException.java`, `InvalidTokenException.java`, `Tokens.java`
- Create: `adapter/out/jdbc/Columns.java`, `JdbcUserRepository.java`, `JdbcUserTokenRepository.java`
- Create: `adapter/out/security/SpringPasswordHasher.java`
- Create: `adapter/out/mail/LogMailer.java`, `SmtpMailer.java`
- Create: `config/AccountConfig.java`
- Create: `src/test/java/com/fantaagent/testsupport/MutableClock.java`, `CapturingMailer.java`
- Test: `src/test/java/com/fantaagent/application/service/account/AccountServiceTest.java`, `PasswordPolicyTest.java`

(Tutti i percorsi Java sotto `src/main/java/com/fantaagent/`.)

**Interfaces:**
- Produces:
  - `record UserAccount(UUID id, String email, String passwordHash, String displayName, Instant emailVerifiedAt, Instant createdAt)` con `boolean emailVerified()`.
  - `interface UserRepository { void insert(UserAccount u); Optional<UserAccount> byEmail(String email); Optional<UserAccount> byId(UUID id); void updatePassword(UUID id, String hash); void markVerified(UUID id, Instant at); void updateDisplayName(UUID id, String name); }` — `insert` lancia `EmailTakenException`.
  - `interface PasswordHasher { String hash(String raw); boolean matches(String raw, String hash); }`
  - `interface Mailer { void send(String to, String subject, String body); }`
  - `record UserToken(UUID id, UUID userId, Purpose purpose, String tokenHash, Instant createdAt, Instant expiresAt, Instant usedAt)` con `enum Purpose { VERIFY_EMAIL, RESET_PASSWORD }`.
  - `interface UserTokenRepository { void insert(UserToken t); Optional<UserToken> byHash(String hash); boolean markUsed(UUID id, Instant at); }` — `markUsed` torna false se era già usato.
  - `AccountService(UserRepository, UserTokenRepository, PasswordHasher, PasswordPolicy, Mailer, Clock, String publicUrl)` con `UserAccount register(String email, String password, String displayName)`, `UserAccount byId(UUID)`, `UserAccount rename(UUID, String)`, `void resendVerification(UUID)`, `void verifyEmail(String token)`, `void requestPasswordReset(String email)`, `UUID resetPassword(String token, String newPassword)`.
  - `InvalidAccountDataException(Map<String, List<String>> errors)` con `errors()`; `InvalidTokenException()`; `EmailTakenException(String email)`.
  - `Columns.ts(Instant): Timestamp`, `Columns.instant(Timestamp): Instant` (null-safe), `Columns.json(ObjectMapper, Object): String`, `Columns.fromJson(ObjectMapper, String, Class<T>): T`.
  - `SpringPasswordHasher.argon2Default(): PasswordEncoder`.
  - `testsupport.MutableClock(Instant start)` con `advance(Duration)`; `testsupport.CapturingMailer` con `List<Sent> sent()` e `String lastToken()`.

- [ ] **Step 1: Dipendenze e configurazione**

In `pom.xml`:

```xml
    <dependency>
      <groupId>org.springframework.security</groupId>
      <artifactId>spring-security-crypto</artifactId>
    </dependency>
    <dependency>
      <!-- Argon2 in Spring Security passa da Bouncy Castle. -->
      <groupId>org.bouncycastle</groupId>
      <artifactId>bcprov-jdk18on</artifactId>
      <version>1.80</version>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-mail</artifactId>
    </dependency>
```

In `application.yml`, sotto la chiave `fantaagent:` già presente (accanto a `data-dir`):

```yaml
  # L'indirizzo da cui si apre l'app: serve a comporre i link delle email.
  public-url: ${FANTAAGENT_PUBLIC_URL:http://localhost:5173}
  mail-from: ${FANTAAGENT_MAIL_FROM:FantaAgent <noreply@localhost>}
```

Senza `spring.mail.host` l'app non manda email vere: le scrive nel log (vedi `AccountConfig`).

Lista delle password comuni:

```bash
curl -fsSL -o src/main/resources/security/common-passwords.txt \
  https://raw.githubusercontent.com/danielmiessler/SecLists/master/Passwords/Common-Credentials/10k-most-common.txt
wc -l src/main/resources/security/common-passwords.txt
```

Expected: circa 10 000 righe.

- [ ] **Step 2: Il supporto dei test**

`src/test/java/com/fantaagent/testsupport/MutableClock.java`:

```java
package com.fantaagent.testsupport;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

/** Un orologio che va avanti solo quando il test lo chiede: scadenze senza attese. */
public final class MutableClock extends Clock {

    private Instant now;

    public MutableClock(Instant start) {
        this.now = start;
    }

    public void advance(Duration by) {
        now = now.plus(by);
    }

    @Override
    public ZoneId getZone() {
        return ZoneOffset.UTC;
    }

    @Override
    public Clock withZone(ZoneId zone) {
        return this;
    }

    @Override
    public Instant instant() {
        return now;
    }
}
```

`src/test/java/com/fantaagent/testsupport/CapturingMailer.java`:

```java
package com.fantaagent.testsupport;

import com.fantaagent.application.port.out.Mailer;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Le email che l'app avrebbe mandato, per leggerne i link. */
public final class CapturingMailer implements Mailer {

    public record Sent(String to, String subject, String body) {
    }

    private static final Pattern TOKEN = Pattern.compile("token=([A-Za-z0-9_-]+)");

    private final List<Sent> sent = new ArrayList<>();

    @Override
    public synchronized void send(String to, String subject, String body) {
        sent.add(new Sent(to, subject, body));
    }

    public synchronized List<Sent> sent() {
        return List.copyOf(sent);
    }

    /** Il token dell'ultimo link spedito. */
    public synchronized String lastToken() {
        Matcher m = TOKEN.matcher(sent.getLast().body());
        if (!m.find()) {
            throw new AssertionError("nessun link con token nell'ultima email");
        }
        return m.group(1);
    }
}
```

- [ ] **Step 3: Scrivere i test che falliscono**

`src/test/java/com/fantaagent/application/service/account/PasswordPolicyTest.java`:

```java
package com.fantaagent.application.service.account;

import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class PasswordPolicyTest {

    private final PasswordPolicy policy = new PasswordPolicy(Set.of("qwertyuiop"));

    @Test
    void dieciCaratteriBastanoSenzaRegoleDiComposizione() {
        assertThat(policy.problems("tuttominuscolo")).isEmpty();
    }

    @Test
    void troppoCorta() {
        assertThat(policy.problems("corta")).containsExactly("La password deve avere almeno 10 caratteri.");
    }

    @Test
    void troppoComuneAncheConLeMaiuscole() {
        assertThat(policy.problems("QwertyUiop"))
                .containsExactly("Questa password è fra le più usate: scegline un'altra.");
    }

    @Test
    void laListaVeraSiCaricaDalClasspath() {
        assertThat(PasswordPolicy.fromClasspath().problems("1234567890")).isNotEmpty();
    }
}
```

`src/test/java/com/fantaagent/application/service/account/AccountServiceTest.java`:

```java
package com.fantaagent.application.service.account;

import com.fantaagent.adapter.out.jdbc.JdbcUserRepository;
import com.fantaagent.adapter.out.jdbc.JdbcUserTokenRepository;
import com.fantaagent.adapter.out.security.SpringPasswordHasher;
import com.fantaagent.application.port.out.EmailTakenException;
import com.fantaagent.application.port.out.UserAccount;
import com.fantaagent.testsupport.CapturingMailer;
import com.fantaagent.testsupport.MutableClock;
import com.fantaagent.testsupport.SharedPostgres;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.time.Duration;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AccountServiceTest {

    private static final String GOOD = "una password lunga";

    private MutableClock clock;
    private CapturingMailer mailer;
    private SpringPasswordHasher hasher;
    private AccountService accounts;

    @BeforeEach
    void setUp() {
        JdbcClient jdbc = JdbcClient.create(SharedPostgres.migratedDatabase());
        clock = new MutableClock(Instant.parse("2026-09-28T20:00:00Z"));
        mailer = new CapturingMailer();
        hasher = new SpringPasswordHasher(SpringPasswordHasher.argon2Default());
        accounts = new AccountService(new JdbcUserRepository(jdbc), new JdbcUserTokenRepository(jdbc),
                hasher, new PasswordPolicy(Set.of("qwertyuiop")), mailer, clock, "https://fanta.example");
    }

    @Test
    void registrareSalvaLaccountEMandaLaVerifica() {
        UserAccount user = accounts.register(" anna@example.com ", GOOD, " Anna ");

        assertThat(user.email()).isEqualTo("anna@example.com");
        assertThat(user.displayName()).isEqualTo("Anna");
        assertThat(user.emailVerified()).isFalse();
        assertThat(hasher.matches(GOOD, user.passwordHash())).isTrue();
        assertThat(user.passwordHash()).startsWith("{argon2}");
        assertThat(mailer.sent()).singleElement().satisfies(m -> {
            assertThat(m.to()).isEqualTo("anna@example.com");
            assertThat(m.body()).contains("https://fanta.example/verifica-email?token=");
        });
    }

    @Test
    void laccountEUsabileSubitoELaVerificaArrivaDopo() {
        UserAccount user = accounts.register("anna@example.com", GOOD, "Anna");
        accounts.verifyEmail(mailer.lastToken());
        assertThat(accounts.byId(user.id()).emailVerified()).isTrue();
    }

    @Test
    void lEmailEGiaUsataSenzaDistinguereLeMaiuscole() {
        accounts.register("anna@example.com", GOOD, "Anna");
        assertThatThrownBy(() -> accounts.register("ANNA@example.com", GOOD, "Anna"))
                .isInstanceOf(EmailTakenException.class);
    }

    @Test
    void iDatiNonValidiSonoDettiCampoPerCampo() {
        assertThatThrownBy(() -> accounts.register("non-una-email", "corta", " "))
                .isInstanceOfSatisfying(InvalidAccountDataException.class, e ->
                        assertThat(e.errors()).containsOnlyKeys("email", "password", "displayName"));
    }

    @Test
    void ilLinkDiVerificaValeUnaVoltaSola() {
        accounts.register("anna@example.com", GOOD, "Anna");
        String token = mailer.lastToken();
        accounts.verifyEmail(token);
        assertThatThrownBy(() -> accounts.verifyEmail(token)).isInstanceOf(InvalidTokenException.class);
    }

    @Test
    void ilLinkDiVerificaScadeDopoSetteGiorni() {
        accounts.register("anna@example.com", GOOD, "Anna");
        clock.advance(Duration.ofDays(7).plusSeconds(1));
        assertThatThrownBy(() -> accounts.verifyEmail(mailer.lastToken()))
                .isInstanceOf(InvalidTokenException.class);
    }

    @Test
    void senzaEmailVerificataIlRecuperoNonMandaNiente() {
        accounts.register("anna@example.com", GOOD, "Anna");
        accounts.requestPasswordReset("anna@example.com");
        assertThat(mailer.sent()).hasSize(1);
    }

    @Test
    void perUnEmailSconosciutaIlRecuperoTaceSenzaErrori() {
        accounts.requestPasswordReset("nessuno@example.com");
        assertThat(mailer.sent()).isEmpty();
    }

    @Test
    void ilRecuperoCambiaLaPassword() {
        UserAccount user = accounts.register("anna@example.com", GOOD, "Anna");
        accounts.verifyEmail(mailer.lastToken());
        accounts.requestPasswordReset("Anna@Example.com");
        assertThat(mailer.sent().getLast().body()).contains("https://fanta.example/nuova-password?token=");

        UUID changed = accounts.resetPassword(mailer.lastToken(), "un'altra password lunga");

        assertThat(changed).isEqualTo(user.id());
        assertThat(hasher.matches("un'altra password lunga", accounts.byId(user.id()).passwordHash())).isTrue();
    }

    @Test
    void unaPasswordDeboleNonBruciaIlLink() {
        accounts.register("anna@example.com", GOOD, "Anna");
        accounts.verifyEmail(mailer.lastToken());
        accounts.requestPasswordReset("anna@example.com");
        String token = mailer.lastToken();

        assertThatThrownBy(() -> accounts.resetPassword(token, "corta"))
                .isInstanceOf(InvalidAccountDataException.class);
        accounts.resetPassword(token, "adesso va bene");
    }

    @Test
    void ilLinkDiRecuperoValeUnOra() {
        accounts.register("anna@example.com", GOOD, "Anna");
        accounts.verifyEmail(mailer.lastToken());
        accounts.requestPasswordReset("anna@example.com");
        clock.advance(Duration.ofMinutes(61));
        assertThatThrownBy(() -> accounts.resetPassword(mailer.lastToken(), "adesso va bene"))
                .isInstanceOf(InvalidTokenException.class);
    }

    @Test
    void unLinkDiVerificaNonServeARecuperareLaPassword() {
        accounts.register("anna@example.com", GOOD, "Anna");
        assertThatThrownBy(() -> accounts.resetPassword(mailer.lastToken(), "adesso va bene"))
                .isInstanceOf(InvalidTokenException.class);
    }
}
```


- [ ] **Step 4: Eseguire i test e vederli fallire**

Run: `mvn -q test -Dtest='PasswordPolicyTest,AccountServiceTest'`
Expected: FAIL di compilazione.

- [ ] **Step 5: Le porte**

`application/port/out/UserAccount.java`:

```java
package com.fantaagent.application.port.out;

import java.time.Instant;
import java.util.UUID;

/** Una persona registrata. {@code passwordHash} non esce mai dal backend. */
public record UserAccount(UUID id, String email, String passwordHash, String displayName,
                          Instant emailVerifiedAt, Instant createdAt) {

    public boolean emailVerified() {
        return emailVerifiedAt != null;
    }
}
```

`application/port/out/UserRepository.java`:

```java
package com.fantaagent.application.port.out;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository {

    /** @throws EmailTakenException se l'indirizzo e' gia' usato, senza distinguere maiuscole */
    void insert(UserAccount user);

    /** Senza distinguere maiuscole. */
    Optional<UserAccount> byEmail(String email);

    Optional<UserAccount> byId(UUID id);

    void updatePassword(UUID id, String passwordHash);

    void markVerified(UUID id, Instant at);

    void updateDisplayName(UUID id, String displayName);
}
```

`application/port/out/EmailTakenException.java`:

```java
package com.fantaagent.application.port.out;

public class EmailTakenException extends RuntimeException {

    public EmailTakenException(String email) {
        super("Esiste già un account con questo indirizzo.");
    }
}
```

`application/port/out/PasswordHasher.java`:

```java
package com.fantaagent.application.port.out;

/** L'algoritmo delle password sta fuori dall'applicazione: qui solo cosa serve. */
public interface PasswordHasher {

    String hash(String raw);

    boolean matches(String raw, String hash);
}
```

`application/port/out/Mailer.java`:

```java
package com.fantaagent.application.port.out;

public interface Mailer {

    void send(String to, String subject, String body);
}
```

`application/port/out/UserToken.java`:

```java
package com.fantaagent.application.port.out;

import java.time.Instant;
import java.util.UUID;

/** Un link a uso singolo mandato per email. Del token si conserva solo l'hash. */
public record UserToken(UUID id, UUID userId, Purpose purpose, String tokenHash,
                        Instant createdAt, Instant expiresAt, Instant usedAt) {

    public enum Purpose { VERIFY_EMAIL, RESET_PASSWORD }
}
```

`application/port/out/UserTokenRepository.java`:

```java
package com.fantaagent.application.port.out;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface UserTokenRepository {

    void insert(UserToken token);

    Optional<UserToken> byHash(String tokenHash);

    /**
     * Segna il token come usato, solo se non lo era gia'.
     *
     * @return false se un'altra richiesta l'ha usato prima: due clic sullo stesso
     *         link non devono valere due volte
     */
    boolean markUsed(UUID id, Instant at);
}
```

- [ ] **Step 6: Il servizio**

`application/service/account/InvalidAccountDataException.java`:

```java
package com.fantaagent.application.service.account;

import java.util.List;
import java.util.Map;

/** Dati di registrazione non validi, per campo: il modulo mostra ogni frase accanto al suo. */
public class InvalidAccountDataException extends RuntimeException {

    private final Map<String, List<String>> errors;

    public InvalidAccountDataException(Map<String, List<String>> errors) {
        super("dati dell'account non validi: " + errors.keySet());
        this.errors = Map.copyOf(errors);
    }

    public Map<String, List<String>> errors() {
        return errors;
    }
}
```

`application/service/account/InvalidTokenException.java`:

```java
package com.fantaagent.application.service.account;

/**
 * Link sconosciuto, scaduto, gia' usato o di un altro tipo: per chi l'ha aperto la
 * differenza non cambia cosa fare, e dirla aiuterebbe solo chi prova link a caso.
 */
public class InvalidTokenException extends RuntimeException {

    public InvalidTokenException() {
        super("Il link non è valido o è scaduto.");
    }
}
```

`application/service/account/Tokens.java`:

```java
package com.fantaagent.application.service.account;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

/** Token per i link: 256 bit casuali, e l'hash che il database conserva al loro posto. */
public final class Tokens {

    private static final SecureRandom RANDOM = new SecureRandom();

    private Tokens() {
    }

    public static String generate() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /**
     * SHA-256 e non Argon2: il token ha gia' 256 bit di entropia, non c'e' un
     * dizionario da rallentare. Serve solo che il database non contenga il link.
     */
    public static String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 non disponibile", e);
        }
    }
}
```

`application/service/account/PasswordPolicy.java`:

```java
package com.fantaagent.application.service.account;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Lunghezza e lista nera, nient'altro. Le regole di composizione (una maiuscola, un
 * simbolo) spingono verso "Password1!" e non rendono niente piu' difficile da
 * indovinare; una frase lunga di sole minuscole e' molto meglio.
 */
public class PasswordPolicy {

    public static final int MIN_LENGTH = 10;
    public static final int MAX_LENGTH = 128;
    static final String LIST = "/security/common-passwords.txt";

    private final Set<String> common;

    public PasswordPolicy(Set<String> common) {
        this.common = common.stream().map(p -> p.toLowerCase(Locale.ROOT)).collect(Collectors.toUnmodifiableSet());
    }

    public static PasswordPolicy fromClasspath() {
        try (InputStream in = PasswordPolicy.class.getResourceAsStream(LIST)) {
            if (in == null) {
                throw new IllegalStateException("lista delle password comuni assente: " + LIST);
            }
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
                return new PasswordPolicy(reader.lines().map(String::trim)
                        .filter(line -> !line.isEmpty()).collect(Collectors.toSet()));
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** Le frasi da mostrare accanto al campo; vuota se la password va bene. */
    public List<String> problems(String password) {
        if (password == null || password.length() < MIN_LENGTH) {
            return List.of("La password deve avere almeno " + MIN_LENGTH + " caratteri.");
        }
        if (password.length() > MAX_LENGTH) {
            return List.of("La password non può superare " + MAX_LENGTH + " caratteri.");
        }
        if (common.contains(password.toLowerCase(Locale.ROOT))) {
            return List.of("Questa password è fra le più usate: scegline un'altra.");
        }
        return List.of();
    }
}
```

`application/service/account/AccountService.java`:

```java
package com.fantaagent.application.service.account;

import com.fantaagent.application.port.out.Mailer;
import com.fantaagent.application.port.out.PasswordHasher;
import com.fantaagent.application.port.out.UserAccount;
import com.fantaagent.application.port.out.UserRepository;
import com.fantaagent.application.port.out.UserToken;
import com.fantaagent.application.port.out.UserTokenRepository;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.UUID;

/**
 * Registrazione, verifica dell'indirizzo, recupero della password.
 *
 * <p><b>L'account e' usabile subito.</b> La verifica non blocca niente: la sera
 * dell'asta nessuno deve restare fuori perche' l'email e' finita nello spam. Serve
 * per recuperare la password — un link di recupero mandato a un indirizzo mai
 * confermato potrebbe finire a chiunque l'abbia scritto.
 */
public class AccountService {

    static final Duration VERIFY_TTL = Duration.ofDays(7);
    static final Duration RESET_TTL = Duration.ofHours(1);
    static final int MAX_NAME = 40;
    static final int MAX_EMAIL = 254;

    private final UserRepository users;
    private final UserTokenRepository tokens;
    private final PasswordHasher hasher;
    private final PasswordPolicy policy;
    private final Mailer mailer;
    private final Clock clock;
    private final String publicUrl;

    public AccountService(UserRepository users, UserTokenRepository tokens, PasswordHasher hasher,
                          PasswordPolicy policy, Mailer mailer, Clock clock, String publicUrl) {
        this.users = users;
        this.tokens = tokens;
        this.hasher = hasher;
        this.policy = policy;
        this.mailer = mailer;
        this.clock = clock;
        this.publicUrl = publicUrl.endsWith("/") ? publicUrl.substring(0, publicUrl.length() - 1) : publicUrl;
    }

    public UserAccount register(String email, String password, String displayName) {
        String cleanEmail = email == null ? "" : email.trim();
        String cleanName = displayName == null ? "" : displayName.trim();
        Map<String, List<String>> errors = new LinkedHashMap<>();
        if (!looksLikeEmail(cleanEmail)) {
            add(errors, "email", "Scrivi un indirizzo email valido.");
        }
        nameProblems(cleanName).forEach(p -> add(errors, "displayName", p));
        policy.problems(password).forEach(p -> add(errors, "password", p));
        if (!errors.isEmpty()) {
            throw new InvalidAccountDataException(errors);
        }
        UserAccount user = new UserAccount(UUID.randomUUID(), cleanEmail, hasher.hash(password),
                cleanName, null, clock.instant());
        users.insert(user);
        sendVerification(user);
        return user;
    }

    /** @throws NoSuchElementException se l'utente non esiste piu' */
    public UserAccount byId(UUID id) {
        return users.byId(id).orElseThrow();
    }

    public UserAccount rename(UUID id, String displayName) {
        String clean = displayName == null ? "" : displayName.trim();
        List<String> problems = nameProblems(clean);
        if (!problems.isEmpty()) {
            throw new InvalidAccountDataException(Map.of("displayName", problems));
        }
        users.updateDisplayName(id, clean);
        return byId(id);
    }

    public void resendVerification(UUID userId) {
        users.byId(userId).filter(u -> !u.emailVerified()).ifPresent(this::sendVerification);
    }

    public void verifyEmail(String token) {
        UserToken used = consume(token, UserToken.Purpose.VERIFY_EMAIL);
        users.markVerified(used.userId(), clock.instant());
    }

    /**
     * Stessa risposta che l'indirizzo esista o no, e che sia verificato o no: la
     * schermata non deve diventare un modo per sapere chi e' iscritto.
     */
    public void requestPasswordReset(String email) {
        users.byEmail(email == null ? "" : email.trim())
                .filter(UserAccount::emailVerified)
                .ifPresent(user -> {
                    String token = issue(user.id(), UserToken.Purpose.RESET_PASSWORD, RESET_TTL);
                    mailer.send(user.email(), "Nuova password per FantaAgent",
                            "Ciao " + user.displayName() + ",\n\n"
                            + "per scegliere una nuova password apri questo link:\n"
                            + publicUrl + "/nuova-password?token=" + token + "\n\n"
                            + "Il link vale un'ora. Se non l'hai chiesto tu, ignora questo messaggio:"
                            + " la tua password resta quella di prima.\n");
                });
    }

    /**
     * La password nuova si controlla PRIMA di usare il link: una password troppo corta
     * non deve bruciare un link che vale un'ora.
     *
     * @return l'utente la cui password e' cambiata, per chiuderne le sessioni
     */
    public UUID resetPassword(String token, String newPassword) {
        List<String> problems = policy.problems(newPassword);
        if (!problems.isEmpty()) {
            throw new InvalidAccountDataException(Map.of("password", problems));
        }
        UserToken used = consume(token, UserToken.Purpose.RESET_PASSWORD);
        users.updatePassword(used.userId(), hasher.hash(newPassword));
        return used.userId();
    }

    private void sendVerification(UserAccount user) {
        String token = issue(user.id(), UserToken.Purpose.VERIFY_EMAIL, VERIFY_TTL);
        mailer.send(user.email(), "Conferma il tuo indirizzo su FantaAgent",
                "Ciao " + user.displayName() + ",\n\n"
                + "per confermare il tuo indirizzo apri questo link:\n"
                + publicUrl + "/verifica-email?token=" + token + "\n\n"
                + "Il link vale 7 giorni. Se non ti sei registrato tu, ignora questo messaggio.\n");
    }

    private String issue(UUID userId, UserToken.Purpose purpose, Duration ttl) {
        String token = Tokens.generate();
        Instant now = clock.instant();
        tokens.insert(new UserToken(UUID.randomUUID(), userId, purpose, Tokens.hash(token),
                now, now.plus(ttl), null));
        return token;
    }

    private UserToken consume(String token, UserToken.Purpose purpose) {
        Instant now = clock.instant();
        UserToken found = tokens.byHash(Tokens.hash(token == null ? "" : token))
                .filter(t -> t.purpose() == purpose)
                .filter(t -> t.usedAt() == null)
                .filter(t -> t.expiresAt().isAfter(now))
                .orElseThrow(InvalidTokenException::new);
        if (!tokens.markUsed(found.id(), now)) {
            throw new InvalidTokenException();
        }
        return found;
    }

    private static List<String> nameProblems(String name) {
        if (name.isEmpty()) {
            return List.of("Scrivi il tuo nome.");
        }
        if (name.length() > MAX_NAME) {
            return List.of("Il nome non può superare " + MAX_NAME + " caratteri.");
        }
        return List.of();
    }

    static boolean looksLikeEmail(String s) {
        return s.length() <= MAX_EMAIL && s.matches("[^@\\s]+@[^@\\s]+\\.[^@\\s]+");
    }

    private static void add(Map<String, List<String>> errors, String key, String message) {
        errors.computeIfAbsent(key, k -> new ArrayList<>()).add(message);
    }
}
```

- [ ] **Step 7: Gli adattatori**

`adapter/out/jdbc/Columns.java`:

```java
package com.fantaagent.adapter.out.jdbc;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.sql.Timestamp;
import java.time.Instant;

/** Conversioni ripetute da ogni repository: date nullable e colonne jsonb. */
final class Columns {

    private Columns() {
    }

    /** pgjdbc non accetta un Instant come parametro: passa da Timestamp. */
    static Timestamp ts(Instant instant) {
        return instant == null ? null : Timestamp.from(instant);
    }

    static Instant instant(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toInstant();
    }

    static String json(ObjectMapper mapper, Object value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("valore non serializzabile: " + value.getClass(), e);
        }
    }

    static <T> T fromJson(ObjectMapper mapper, String json, Class<T> type) {
        try {
            return mapper.readValue(json, type);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("colonna jsonb illeggibile come " + type.getSimpleName(), e);
        }
    }
}
```

`adapter/out/jdbc/JdbcUserRepository.java`:

```java
package com.fantaagent.adapter.out.jdbc;

import com.fantaagent.application.port.out.EmailTakenException;
import com.fantaagent.application.port.out.UserAccount;
import com.fantaagent.application.port.out.UserRepository;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static com.fantaagent.adapter.out.jdbc.Columns.instant;
import static com.fantaagent.adapter.out.jdbc.Columns.ts;

public class JdbcUserRepository implements UserRepository {

    private static final String COLUMNS =
            "id, email, password_hash, display_name, email_verified_at, created_at";

    private final JdbcClient jdbc;

    public JdbcUserRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void insert(UserAccount user) {
        try {
            jdbc.sql("INSERT INTO app_user (" + COLUMNS + ") VALUES (:id, :email, :hash, :name, :verified, :created)")
                    .param("id", user.id()).param("email", user.email())
                    .param("hash", user.passwordHash()).param("name", user.displayName())
                    .param("verified", ts(user.emailVerifiedAt())).param("created", ts(user.createdAt()))
                    .update();
        } catch (DuplicateKeyException e) {
            throw new EmailTakenException(user.email());
        }
    }

    @Override
    public Optional<UserAccount> byEmail(String email) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM app_user WHERE lower(email) = lower(:email)")
                .param("email", email).query(JdbcUserRepository::map).optional();
    }

    @Override
    public Optional<UserAccount> byId(UUID id) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM app_user WHERE id = :id")
                .param("id", id).query(JdbcUserRepository::map).optional();
    }

    @Override
    public void updatePassword(UUID id, String passwordHash) {
        jdbc.sql("UPDATE app_user SET password_hash = :hash WHERE id = :id")
                .param("hash", passwordHash).param("id", id).update();
    }

    @Override
    public void markVerified(UUID id, Instant at) {
        jdbc.sql("UPDATE app_user SET email_verified_at = coalesce(email_verified_at, :at) WHERE id = :id")
                .param("at", ts(at)).param("id", id).update();
    }

    @Override
    public void updateDisplayName(UUID id, String displayName) {
        jdbc.sql("UPDATE app_user SET display_name = :name WHERE id = :id")
                .param("name", displayName).param("id", id).update();
    }

    private static UserAccount map(ResultSet rs, int row) throws SQLException {
        return new UserAccount(rs.getObject("id", UUID.class), rs.getString("email"),
                rs.getString("password_hash"), rs.getString("display_name"),
                instant(rs.getTimestamp("email_verified_at")), instant(rs.getTimestamp("created_at")));
    }
}
```

`adapter/out/jdbc/JdbcUserTokenRepository.java`:

```java
package com.fantaagent.adapter.out.jdbc;

import com.fantaagent.application.port.out.UserToken;
import com.fantaagent.application.port.out.UserTokenRepository;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static com.fantaagent.adapter.out.jdbc.Columns.instant;
import static com.fantaagent.adapter.out.jdbc.Columns.ts;

public class JdbcUserTokenRepository implements UserTokenRepository {

    private final JdbcClient jdbc;

    public JdbcUserTokenRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void insert(UserToken t) {
        jdbc.sql("""
                        INSERT INTO user_token (id, user_id, purpose, token_hash, created_at, expires_at, used_at)
                        VALUES (:id, :user, :purpose, :hash, :created, :expires, :used)
                        """)
                .param("id", t.id()).param("user", t.userId()).param("purpose", t.purpose().name())
                .param("hash", t.tokenHash()).param("created", ts(t.createdAt()))
                .param("expires", ts(t.expiresAt())).param("used", ts(t.usedAt()))
                .update();
    }

    @Override
    public Optional<UserToken> byHash(String tokenHash) {
        return jdbc.sql("""
                        SELECT id, user_id, purpose, token_hash, created_at, expires_at, used_at
                        FROM user_token WHERE token_hash = :hash
                        """)
                .param("hash", tokenHash).query(JdbcUserTokenRepository::map).optional();
    }

    @Override
    public boolean markUsed(UUID id, Instant at) {
        return jdbc.sql("UPDATE user_token SET used_at = :at WHERE id = :id AND used_at IS NULL")
                .param("at", ts(at)).param("id", id).update() == 1;
    }

    private static UserToken map(ResultSet rs, int row) throws SQLException {
        return new UserToken(rs.getObject("id", UUID.class), rs.getObject("user_id", UUID.class),
                UserToken.Purpose.valueOf(rs.getString("purpose")), rs.getString("token_hash"),
                instant(rs.getTimestamp("created_at")), instant(rs.getTimestamp("expires_at")),
                instant(rs.getTimestamp("used_at")));
    }
}
```

`adapter/out/security/SpringPasswordHasher.java`:

```java
package com.fantaagent.adapter.out.security;

import com.fantaagent.application.port.out.PasswordHasher;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.DelegatingPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Map;

public class SpringPasswordHasher implements PasswordHasher {

    private final PasswordEncoder encoder;

    public SpringPasswordHasher(PasswordEncoder encoder) {
        this.encoder = encoder;
    }

    /**
     * Argon2id per gli hash nuovi, col prefisso {@code {argon2}} davanti: il giorno in
     * cui l'algoritmo cambia, gli hash vecchi restano leggibili dal loro prefisso e
     * nessuno deve reimpostare la password.
     */
    public static PasswordEncoder argon2Default() {
        Map<String, PasswordEncoder> encoders = Map.of(
                "argon2", Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8(),
                "bcrypt", new BCryptPasswordEncoder());
        return new DelegatingPasswordEncoder("argon2", encoders);
    }

    @Override
    public String hash(String raw) {
        return encoder.encode(raw);
    }

    @Override
    public boolean matches(String raw, String hash) {
        return encoder.matches(raw, hash);
    }
}
```

`adapter/out/mail/LogMailer.java`:

```java
package com.fantaagent.adapter.out.mail;

import com.fantaagent.application.port.out.Mailer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * In locale non c'e' un server di posta: il messaggio va nel log, link compreso, e da
 * li' lo si apre a mano. In produzione c'e' {@link SmtpMailer}.
 */
public class LogMailer implements Mailer {

    private static final Logger LOG = LoggerFactory.getLogger(LogMailer.class);

    @Override
    public void send(String to, String subject, String body) {
        LOG.info("email per {} — {}\n{}", to, subject, body);
    }
}
```

`adapter/out/mail/SmtpMailer.java`:

```java
package com.fantaagent.adapter.out.mail;

import com.fantaagent.application.port.out.Mailer;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

public class SmtpMailer implements Mailer {

    private final JavaMailSender sender;
    private final String from;

    public SmtpMailer(JavaMailSender sender, String from) {
        this.sender = sender;
        this.from = from;
    }

    @Override
    public void send(String to, String subject, String body) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(to);
        message.setSubject(subject);
        message.setText(body);
        sender.send(message);
    }
}
```

`config/AccountConfig.java`:

```java
package com.fantaagent.config;

import com.fantaagent.adapter.out.jdbc.JdbcUserRepository;
import com.fantaagent.adapter.out.jdbc.JdbcUserTokenRepository;
import com.fantaagent.adapter.out.mail.LogMailer;
import com.fantaagent.adapter.out.mail.SmtpMailer;
import com.fantaagent.adapter.out.security.SpringPasswordHasher;
import com.fantaagent.application.port.out.Mailer;
import com.fantaagent.application.port.out.PasswordHasher;
import com.fantaagent.application.port.out.UserRepository;
import com.fantaagent.application.port.out.UserTokenRepository;
import com.fantaagent.application.service.account.AccountService;
import com.fantaagent.application.service.account.PasswordPolicy;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Clock;

@Configuration
public class AccountConfig {

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return SpringPasswordHasher.argon2Default();
    }

    @Bean
    public PasswordHasher passwordHasher(PasswordEncoder encoder) {
        return new SpringPasswordHasher(encoder);
    }

    @Bean
    public UserRepository userRepository(JdbcClient jdbc) {
        return new JdbcUserRepository(jdbc);
    }

    @Bean
    public UserTokenRepository userTokenRepository(JdbcClient jdbc) {
        return new JdbcUserTokenRepository(jdbc);
    }

    /**
     * SMTP solo se l'ambiente ne indica uno: {@code JavaMailSender} esiste solo con
     * {@code spring.mail.host}, e senza di lui le email vanno nel log.
     */
    @Bean
    public Mailer mailer(ObjectProvider<JavaMailSender> sender,
                         @Value("${spring.mail.host:}") String host,
                         @Value("${fantaagent.mail-from}") String from) {
        return host.isBlank() ? new LogMailer() : new SmtpMailer(sender.getObject(), from);
    }

    @Bean
    public AccountService accountService(UserRepository users, UserTokenRepository tokens,
                                         PasswordHasher hasher, Mailer mailer, Clock clock,
                                         @Value("${fantaagent.public-url}") String publicUrl) {
        return new AccountService(users, tokens, hasher, PasswordPolicy.fromClasspath(), mailer,
                clock, publicUrl);
    }
}
```

- [ ] **Step 8: Eseguire i test e vederli passare**

Run: `mvn -q test -Dtest='PasswordPolicyTest,AccountServiceTest'`
Expected: PASS.

- [ ] **Step 9: Mutazione**

In `AccountService.consume` togliere temporaneamente il filtro `t.usedAt() == null` **e** far tornare sempre `true` a `markUsed`: `ilLinkDiVerificaValeUnaVoltaSola` deve fallire. Ripristinare.

- [ ] **Step 10: L'intera suite e commit**

Run: `mvn -q test` — Expected: PASS.

```bash
git add pom.xml src/main/resources src/main/java/com/fantaagent/application/port/out src/main/java/com/fantaagent/application/service/account src/main/java/com/fantaagent/adapter/out src/main/java/com/fantaagent/config/AccountConfig.java src/test/java/com/fantaagent/testsupport src/test/java/com/fantaagent/application/service/account
git commit -m "Account: registrazione, verifica dell'indirizzo e recupero della password

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Spring Security, sessioni e API di accesso

**Files:**
- Modify: `pom.xml`, `src/main/resources/application.yml`
- Create: `src/main/resources/db/migration/V2__sessioni.sql`
- Create: `adapter/in/security/AppUserPrincipal.java`, `AppUserDetailsService.java`, `SpaCsrfTokenRequestHandler.java`, `ProblemResponses.java`
- Create: `config/SecurityConfig.java`
- Create: `adapter/in/api/auth/AuthApi.java`, `AuthDtos.java`
- Modify: `adapter/in/api/ApiExceptionHandler.java`
- Create: `src/test/java/com/fantaagent/testsupport/ApiFixture.java`
- Test: `src/test/java/com/fantaagent/adapter/in/api/auth/AuthApiTest.java`, `src/test/java/com/fantaagent/adapter/in/api/ApiExceptionHandlerUnavailableTest.java`

**Interfaces:**
- Consumes: `AccountService` (Task 3).
- Produces:
  - `record AppUserPrincipal(UUID id, String email, String displayName, String passwordHash) implements UserDetails` — `getUsername()` è `id.toString()`, così il nome del principal (e l'indice delle sessioni) non cambia se cambia l'email.
  - Rotte: `GET /api/auth/csrf` (204), `POST /api/auth/register` (201 `Me`), `POST /api/auth/login` (200 `Me`), `POST /api/auth/logout` (204), `POST /api/auth/verify` (204), `POST /api/auth/password/forgot` (204), `POST /api/auth/password/reset` (204), `GET /api/me` (200 `Me`), `PATCH /api/me` (200 `Me`), `POST /api/me/verification` (204).
  - `AuthDtos.Me(String id, String email, String displayName, boolean emailVerified)`.
  - `ApiFixture.mvc(WebApplicationContext): MockMvc` (sessione JDBC + sicurezza), `ApiFixture.register(MockMvc, String email, String name): Cookie`, `ApiFixture.login(MockMvc, String email): Cookie`, `ApiFixture.uniqueEmail(String name): String`, `ApiFixture.session(MvcResult): Cookie`, `ApiFixture.PASSWORD`.
  - Problemi: `unauthenticated` 401, `forbidden` 403, `invalid-account` 422 (`errors`), `email-taken` 409, `bad-credentials` 401, `invalid-token` 400, `service-unavailable` 503.

Perché una sessione e non un token: la SPA è servita dallo stesso dominio dell'API. Un cookie `HttpOnly` non è leggibile da JavaScript, il logout cancella davvero la sessione, e con la sessione in Postgres un riavvio o una seconda istanza non buttano fuori nessuno.

- [ ] **Step 1: Dipendenze, configurazione, schema delle sessioni**

In `pom.xml`:

```xml
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-security</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.session</groupId>
      <artifactId>spring-session-jdbc</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.security</groupId>
      <artifactId>spring-security-test</artifactId>
      <scope>test</scope>
    </dependency>
```

In `application.yml`, sotto `spring:`:

```yaml
  session:
    jdbc:
      # Lo schema lo crea Flyway (V2__sessioni.sql), non Spring Session all'avvio.
      initialize-schema: never
```

e al livello radice, dentro `server:` (accanto a `port`):

```yaml
  servlet:
    session:
      # Due settimane: chi entra la settimana prima dell'asta non deve rientrare la sera.
      timeout: 14d
      cookie:
        http-only: true
        same-site: lax
        # In locale si lavora in http; in produzione va a true.
        secure: ${FANTAAGENT_COOKIE_SECURE:false}
```

`src/main/resources/db/migration/V2__sessioni.sql` — la copia di `org/springframework/session/jdbc/schema-postgresql.sql`. Ricavarla dal jar e confrontarla con questa:

```bash
unzip -p "$(find ~/.m2/repository/org/springframework/session/spring-session-jdbc -name 'spring-session-jdbc-*.jar' | sort | tail -1)" org/springframework/session/jdbc/schema-postgresql.sql
```

```sql
-- Tabelle di Spring Session JDBC, dallo schema PostgreSQL della libreria.
CREATE TABLE SPRING_SESSION (
    PRIMARY_ID            CHAR(36) NOT NULL,
    SESSION_ID            CHAR(36) NOT NULL,
    CREATION_TIME         BIGINT   NOT NULL,
    LAST_ACCESS_TIME      BIGINT   NOT NULL,
    MAX_INACTIVE_INTERVAL INT      NOT NULL,
    EXPIRY_TIME           BIGINT   NOT NULL,
    PRINCIPAL_NAME        VARCHAR(100),
    CONSTRAINT SPRING_SESSION_PK PRIMARY KEY (PRIMARY_ID)
);

CREATE UNIQUE INDEX SPRING_SESSION_IX1 ON SPRING_SESSION (SESSION_ID);
CREATE INDEX SPRING_SESSION_IX2 ON SPRING_SESSION (EXPIRY_TIME);
CREATE INDEX SPRING_SESSION_IX3 ON SPRING_SESSION (PRINCIPAL_NAME);

CREATE TABLE SPRING_SESSION_ATTRIBUTES (
    SESSION_PRIMARY_ID CHAR(36)     NOT NULL,
    ATTRIBUTE_NAME     VARCHAR(200) NOT NULL,
    ATTRIBUTE_BYTES    BYTEA        NOT NULL,
    CONSTRAINT SPRING_SESSION_ATTRIBUTES_PK PRIMARY KEY (SESSION_PRIMARY_ID, ATTRIBUTE_NAME),
    CONSTRAINT SPRING_SESSION_ATTRIBUTES_FK FOREIGN KEY (SESSION_PRIMARY_ID)
        REFERENCES SPRING_SESSION (PRIMARY_ID) ON DELETE CASCADE
);
```

Se il file del jar differisce, vale quello del jar.

- [ ] **Step 2: Il supporto dei test web**

`src/test/java/com/fantaagent/testsupport/ApiFixture.java`:

```java
package com.fantaagent.testsupport;

import jakarta.servlet.http.Cookie;
import org.springframework.http.MediaType;
import org.springframework.session.web.http.SessionRepositoryFilter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * MockMvc come lo vede il browser: il filtro delle sessioni JDBC PRIMA della catena di
 * sicurezza, e la sessione portata dal cookie SESSION da una richiesta all'altra.
 *
 * <p>Senza {@link SessionRepositoryFilter}, MockMvc userebbe le sue sessioni in
 * memoria e un test sulla chiusura delle sessioni passerebbe senza aver chiuso niente.
 */
public final class ApiFixture {

    public static final String PASSWORD = "una password lunga";

    private ApiFixture() {
    }

    public static MockMvc mvc(WebApplicationContext context) {
        return MockMvcBuilders.webAppContextSetup(context)
                .addFilters(context.getBean(SessionRepositoryFilter.class))
                .apply(springSecurity())
                .build();
    }

    public static Cookie register(MockMvc mvc, String email, String name) throws Exception {
        MvcResult result = mvc.perform(post("/api/auth/register").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"%s","displayName":"%s"}""".formatted(email, PASSWORD, name)))
                .andExpect(status().isCreated())
                .andReturn();
        return session(result);
    }

    public static Cookie login(MockMvc mvc, String email) throws Exception {
        MvcResult result = mvc.perform(post("/api/auth/login").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"%s"}""".formatted(email, PASSWORD)))
                .andExpect(status().isOk())
                .andReturn();
        return session(result);
    }

    /** Un'email mai usata: il database e' condiviso da tutti i test dello stesso contesto. */
    public static String uniqueEmail(String name) {
        return name + "+" + java.util.UUID.randomUUID() + "@example.com";
    }

    public static Cookie session(MvcResult result) {
        Cookie cookie = result.getResponse().getCookie("SESSION");
        if (cookie == null) {
            throw new AssertionError("nessun cookie SESSION nella risposta");
        }
        return cookie;
    }
}
```

- [ ] **Step 3: Scrivere il test che fallisce**

`src/test/java/com/fantaagent/adapter/in/api/auth/AuthApiTest.java`:

```java
package com.fantaagent.adapter.in.api.auth;

import com.fantaagent.application.port.out.Mailer;
import com.fantaagent.testsupport.ApiFixture;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.web.context.WebApplicationContext;

import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("dev")
class AuthApiTest {

    private static final String PROBLEMS = "https://fantaagent.local/problems/";

    @Autowired
    private WebApplicationContext context;

    @MockitoBean
    private Mailer mailer;

    private MockMvc mvc;
    private String email;

    /**
     * Il contesto Spring, e con lui il database e il contatore dei tentativi, e'
     * condiviso fra i test della classe: ognuno usa un'email sua, e chi sbaglia la
     * password lo fa da un indirizzo suo.
     */
    @BeforeEach
    void setUp() {
        mvc = ApiFixture.mvc(context);
        email = "anna+" + UUID.randomUUID() + "@example.com";
    }

    static RequestPostProcessor from(String address) {
        return request -> {
            request.setRemoteAddr(address);
            return request;
        };
    }

    private String lastToken() {
        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(mailer, atLeastOnce()).send(anyString(), anyString(), body.capture());
        Matcher m = Pattern.compile("token=([A-Za-z0-9_-]+)").matcher(body.getValue());
        if (!m.find()) {
            throw new AssertionError("nessun token nell'email");
        }
        return m.group(1);
    }

    @Test
    void registrarsiApreGiaLaSessione() throws Exception {
        Cookie session = ApiFixture.register(mvc, email, "Anna");
        mvc.perform(get("/api/me").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.displayName").value("Anna"))
                .andExpect(jsonPath("$.emailVerified").value(false))
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
    }

    @Test
    void senzaAccessoLApiRisponde401ConUnProblema() throws Exception {
        mvc.perform(get("/api/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "unauthenticated"));
        mvc.perform(get("/api/leagues/default/auctions/corrente/state"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void laPasswordSbagliataEUnProblemaDetto() throws Exception {
        ApiFixture.register(mvc, email, "Anna");
        mvc.perform(post("/api/auth/login").with(csrf()).with(from("10.0.0.1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"sbagliata!!\"}".formatted(email)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "bad-credentials"))
                .andExpect(jsonPath("$.detail").value("Email o password non corretti."));
    }

    @Test
    void unaScritturaSenzaTokenCsrfERifiutata() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"a@b.it\",\"password\":\"x\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "forbidden"));
    }

    @Test
    void ilTokenCsrfArrivaComeCookieLeggibile() throws Exception {
        mvc.perform(get("/api/auth/csrf"))
                .andExpect(status().isNoContent())
                .andExpect(result -> {
                    Cookie xsrf = result.getResponse().getCookie("XSRF-TOKEN");
                    if (xsrf == null || xsrf.isHttpOnly()) {
                        throw new AssertionError("serve un cookie XSRF-TOKEN leggibile dal client");
                    }
                });
    }

    @Test
    void registrazioneConDatiSbagliatiDiceIlCampo() throws Exception {
        mvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"no\",\"password\":\"corta\",\"displayName\":\"\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "invalid-account"))
                .andExpect(jsonPath("$.errors.email").isArray())
                .andExpect(jsonPath("$.errors.password").isArray())
                .andExpect(jsonPath("$.errors.displayName").isArray());
    }

    @Test
    void unaSecondaRegistrazioneConLaStessaEmailEUnConflitto() throws Exception {
        ApiFixture.register(mvc, email, "Anna");
        mvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"%s\",\"displayName\":\"Anna\"}"
                                .formatted(email.toUpperCase(), ApiFixture.PASSWORD)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "email-taken"));
    }

    @Test
    void uscireChiudeLaSessione() throws Exception {
        Cookie session = ApiFixture.register(mvc, email, "Anna");
        mvc.perform(post("/api/auth/logout").with(csrf()).cookie(session))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/me").cookie(session)).andExpect(status().isUnauthorized());
    }

    @Test
    void laNuovaPasswordChiudeLeSessioniAperte() throws Exception {
        Cookie session = ApiFixture.register(mvc, email, "Anna");
        mvc.perform(post("/api/auth/verify").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"%s\"}".formatted(lastToken())))
                .andExpect(status().isNoContent());
        mvc.perform(post("/api/auth/password/forgot").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\"}".formatted(email)))
                .andExpect(status().isNoContent());
        mvc.perform(post("/api/auth/password/reset").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"%s\",\"password\":\"un'altra password lunga\"}".formatted(lastToken())))
                .andExpect(status().isNoContent());

        mvc.perform(get("/api/me").cookie(session)).andExpect(status().isUnauthorized());
    }

    @Test
    void unLinkNonValidoEDettoCosi() throws Exception {
        mvc.perform(post("/api/auth/verify").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"inventato\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "invalid-token"));
    }

    @Test
    void ilNomeSiCambiaDalProfilo() throws Exception {
        Cookie session = ApiFixture.register(mvc, email, "Anna");
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch("/api/me")
                        .with(csrf()).cookie(session).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"Anna B.\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Anna B."));
    }

    @Test
    void laSaluteDellAppRestaPubblica() throws Exception {
        mvc.perform(get("/actuator/health")).andExpect(status().isOk());
    }
}
```


- [ ] **Step 4: Eseguire il test e vederlo fallire**

Run: `mvn -q test -Dtest=AuthApiTest`
Expected: FAIL — senza `SecurityConfig` la sicurezza predefinita di Spring Boot risponde con la pagina di login e nessuna rotta `/api/auth` esiste.

- [ ] **Step 5: Il principal e il suo caricamento**

`adapter/in/security/AppUserPrincipal.java`:

```java
package com.fantaagent.adapter.in.security;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Chi ha fatto l'accesso. Il nome e' l'id, non l'email: e' la chiave con cui Spring
 * Session indicizza le sessioni, e deve restare la stessa anche se un giorno l'email
 * cambia.
 *
 * <p>Nessun ruolo globale: essere amministratore e' una proprieta' della lega, non
 * della persona, e la decide {@code LeagueService} lega per lega.
 */
public record AppUserPrincipal(UUID id, String email, String displayName, String passwordHash)
        implements UserDetails {

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of();
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return id.toString();
    }
}
```

`adapter/in/security/AppUserDetailsService.java`:

```java
package com.fantaagent.adapter.in.security;

import com.fantaagent.application.port.out.UserRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

/** Si entra con l'email; dentro la sessione si resta con l'id. */
public class AppUserDetailsService implements UserDetailsService {

    private final UserRepository users;

    public AppUserDetailsService(UserRepository users) {
        this.users = users;
    }

    @Override
    public UserDetails loadUserByUsername(String email) {
        return users.byEmail(email)
                .map(u -> new AppUserPrincipal(u.id(), u.email(), u.displayName(), u.passwordHash()))
                .orElseThrow(() -> new UsernameNotFoundException("nessun account"));
    }
}
```

- [ ] **Step 6: CSRF e risposte di errore della sicurezza**

`adapter/in/security/SpaCsrfTokenRequestHandler.java` (la forma che la documentazione di Spring Security dà per le SPA):

```java
package com.fantaagent.adapter.in.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.csrf.CsrfTokenRequestHandler;
import org.springframework.security.web.csrf.XorCsrfTokenRequestAttributeHandler;
import org.springframework.util.StringUtils;

import java.util.function.Supplier;

/**
 * Il client legge il token dal cookie {@code XSRF-TOKEN} e lo rimanda nell'header
 * {@code X-XSRF-TOKEN} cosi' com'e': nell'header si accetta il valore semplice, nei
 * parametri di un modulo quello mascherato. {@code csrfToken.get()} forza la
 * scrittura del cookie a ogni richiesta, anche su un 401: la prima pagina che il
 * client apre e' spesso quella d'accesso, e deve poter gia' mandare un POST.
 */
public final class SpaCsrfTokenRequestHandler implements CsrfTokenRequestHandler {

    private final CsrfTokenRequestHandler plain = new CsrfTokenRequestAttributeHandler();
    private final CsrfTokenRequestHandler xor = new XorCsrfTokenRequestAttributeHandler();

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
                       Supplier<CsrfToken> csrfToken) {
        xor.handle(request, response, csrfToken);
        csrfToken.get();
    }

    @Override
    public String resolveCsrfTokenValue(HttpServletRequest request, CsrfToken csrfToken) {
        String header = request.getHeader(csrfToken.getHeaderName());
        return (StringUtils.hasText(header) ? plain : xor).resolveCsrfTokenValue(request, csrfToken);
    }
}
```

`adapter/in/security/ProblemResponses.java`:

```java
package com.fantaagent.adapter.in.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;

import java.io.IOException;
import java.net.URI;

/**
 * Gli errori della catena di sicurezza nella stessa forma di quelli dei controller:
 * il client ha un solo punto in cui legge gli errori, e lo decide dal {@code type}.
 * Senza, un 401 arriverebbe vuoto e un 403 come pagina HTML.
 */
public final class ProblemResponses implements AuthenticationEntryPoint, AccessDeniedHandler {

    static final String TYPE_BASE = "https://fantaagent.local/problems/";

    private final ObjectMapper json;

    public ProblemResponses(ObjectMapper json) {
        this.json = json;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
                         AuthenticationException e) throws IOException {
        write(response, HttpStatus.UNAUTHORIZED, "unauthenticated", "Serve l'accesso.");
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
                       AccessDeniedException e) throws IOException {
        write(response, HttpStatus.FORBIDDEN, "forbidden", "Operazione non permessa.");
    }

    private void write(HttpServletResponse response, HttpStatus status, String slug, String detail)
            throws IOException {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setType(URI.create(TYPE_BASE + slug));
        response.setStatus(status.value());
        response.setContentType("application/problem+json");
        json.writeValue(response.getOutputStream(), problem);
    }
}
```

- [ ] **Step 7: La configurazione**

`config/SecurityConfig.java`:

```java
package com.fantaagent.config;

import com.fantaagent.adapter.in.security.AppUserDetailsService;
import com.fantaagent.adapter.in.security.ProblemResponses;
import com.fantaagent.adapter.in.security.SpaCsrfTokenRequestHandler;
import com.fantaagent.application.port.out.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;

/**
 * Chi puo' chiamare cosa, a grana grossa: pubbliche le rotte per entrare e la lettura
 * di un invito, autenticato il resto di {@code /api}, libera la SPA (e' una pagina
 * statica: i dati li protegge l'API). Membro e amministratore si decidono piu' in
 * la', per lega, da {@code ApiAccess}.
 */
@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, ObjectMapper json,
                                           SecurityContextRepository contexts) throws Exception {
        ProblemResponses problems = new ProblemResponses(json);
        http
                .csrf(csrf -> csrf
                        .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                        .csrfTokenRequestHandler(new SpaCsrfTokenRequestHandler()))
                .securityContext(sc -> sc.securityContextRepository(contexts))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.GET, "/api/auth/csrf").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/register", "/api/auth/login",
                                "/api/auth/verify", "/api/auth/password/forgot",
                                "/api/auth/password/reset").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/invites/*").permitAll()
                        .requestMatchers("/api/**").authenticated()
                        .requestMatchers("/actuator/health").permitAll()
                        .requestMatchers("/actuator/**").denyAll()
                        .anyRequest().permitAll())
                .exceptionHandling(e -> e
                        .authenticationEntryPoint(problems)
                        .accessDeniedHandler(problems))
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .requestCache(AbstractHttpConfigurer::disable);
        return http.build();
    }

    @Bean
    public SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    public AppUserDetailsService appUserDetailsService(UserRepository users) {
        return new AppUserDetailsService(users);
    }

    @Bean
    public AuthenticationManager authenticationManager(AppUserDetailsService users,
                                                       PasswordEncoder encoder) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(users);
        provider.setPasswordEncoder(encoder);
        return new ProviderManager(provider);
    }
}
```

- [ ] **Step 8: L'API**

`adapter/in/api/auth/AuthDtos.java`:

```java
package com.fantaagent.adapter.in.api.auth;

import com.fantaagent.application.port.out.UserAccount;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record RegisterRequest(String email, String password, String displayName) {
    }

    public record LoginRequest(String email, String password) {
    }

    public record TokenRequest(String token) {
    }

    public record ForgotRequest(String email) {
    }

    public record ResetRequest(String token, String password) {
    }

    public record RenameRequest(String displayName) {
    }

    /** Chi sono io. Niente hash, niente date: solo cio' che una schermata mostra. */
    public record Me(String id, String email, String displayName, boolean emailVerified) {

        public static Me of(UserAccount u) {
            return new Me(u.id().toString(), u.email(), u.displayName(), u.emailVerified());
        }
    }
}
```

`adapter/in/api/auth/AuthApi.java`:

```java
package com.fantaagent.adapter.in.api.auth;

import com.fantaagent.adapter.in.security.AppUserPrincipal;
import com.fantaagent.application.port.out.UserAccount;
import com.fantaagent.application.service.account.AccountService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.Session;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api")
public class AuthApi {

    private final AccountService accounts;
    private final AuthenticationManager authentication;
    private final SecurityContextRepository contexts;
    private final FindByIndexNameSessionRepository<? extends Session> sessions;

    public AuthApi(AccountService accounts, AuthenticationManager authentication,
                   SecurityContextRepository contexts,
                   FindByIndexNameSessionRepository<? extends Session> sessions) {
        this.accounts = accounts;
        this.authentication = authentication;
        this.contexts = contexts;
        this.sessions = sessions;
    }

    /** Non fa nulla: esiste perche' la risposta porta il cookie XSRF-TOKEN. */
    @GetMapping("/auth/csrf")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void csrf() {
    }

    @PostMapping("/auth/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthDtos.Me register(@RequestBody AuthDtos.RegisterRequest body,
                                HttpServletRequest request, HttpServletResponse response) {
        UserAccount user = accounts.register(body.email(), body.password(), body.displayName());
        signIn(user.email(), body.password(), request, response);
        return AuthDtos.Me.of(user);
    }

    @PostMapping("/auth/login")
    public AuthDtos.Me login(@RequestBody AuthDtos.LoginRequest body,
                             HttpServletRequest request, HttpServletResponse response) {
        AppUserPrincipal principal = signIn(body.email(), body.password(), request, response);
        return AuthDtos.Me.of(accounts.byId(principal.id()));
    }

    @PostMapping("/auth/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(HttpServletRequest request, HttpServletResponse response) {
        new SecurityContextLogoutHandler().logout(request, response,
                SecurityContextHolder.getContext().getAuthentication());
    }

    @PostMapping("/auth/verify")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void verify(@RequestBody AuthDtos.TokenRequest body) {
        accounts.verifyEmail(body.token());
    }

    @PostMapping("/auth/password/forgot")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void forgot(@RequestBody AuthDtos.ForgotRequest body) {
        accounts.requestPasswordReset(body.email());
    }

    /**
     * Cambiare password chiude tutte le sessioni di quell'utente, compresa questa: se
     * la password e' cambiata perche' qualcuno la conosceva, quel qualcuno deve uscire.
     */
    @PostMapping("/auth/password/reset")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reset(@RequestBody AuthDtos.ResetRequest body) {
        UUID userId = accounts.resetPassword(body.token(), body.password());
        sessions.findByPrincipalName(userId.toString()).keySet().forEach(sessions::deleteById);
    }

    @GetMapping("/me")
    public AuthDtos.Me me(@AuthenticationPrincipal AppUserPrincipal me) {
        return AuthDtos.Me.of(accounts.byId(me.id()));
    }

    @PatchMapping("/me")
    public AuthDtos.Me rename(@AuthenticationPrincipal AppUserPrincipal me,
                              @RequestBody AuthDtos.RenameRequest body) {
        return AuthDtos.Me.of(accounts.rename(me.id(), body.displayName()));
    }

    @PostMapping("/me/verification")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resendVerification(@AuthenticationPrincipal AppUserPrincipal me) {
        accounts.resendVerification(me.id());
    }

    /**
     * L'accesso fatto a mano invece che dal filtro di login: la SPA manda JSON, non un
     * modulo. Un id di sessione nuovo a ogni accesso, perche' uno fissato prima da
     * qualcun altro non diventi una sessione autenticata.
     */
    private AppUserPrincipal signIn(String email, String password,
                                    HttpServletRequest request, HttpServletResponse response) {
        Authentication auth = authentication.authenticate(UsernamePasswordAuthenticationToken
                .unauthenticated(email == null ? "" : email.trim(), password == null ? "" : password));
        request.getSession(true);
        request.changeSessionId();
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(auth);
        SecurityContextHolder.setContext(context);
        contexts.saveContext(context, request, response);
        return (AppUserPrincipal) auth.getPrincipal();
    }
}
```

- [ ] **Step 9: I problemi nuovi**

In `adapter/in/api/ApiExceptionHandler.java`, prima dell'handler `unexpected` (quello su `Exception`, che altrimenti inghiottirebbe tutto come 500):

```java
    @ExceptionHandler(InvalidAccountDataException.class)
    ProblemDetail invalidAccount(InvalidAccountDataException e) {
        ProblemDetail problem = problem(HttpStatus.UNPROCESSABLE_ENTITY, "invalid-account",
                "Alcuni dati non sono validi.");
        problem.setProperty("errors", e.errors());
        return problem;
    }

    @ExceptionHandler(EmailTakenException.class)
    ProblemDetail emailTaken(EmailTakenException e) {
        return problem(HttpStatus.CONFLICT, "email-taken", e.getMessage());
    }

    /**
     * Email sconosciuta e password sbagliata danno la stessa risposta: dirle diverse
     * servirebbe solo a chi prova indirizzi per sapere chi e' iscritto.
     */
    @ExceptionHandler(AuthenticationException.class)
    ProblemDetail badCredentials(AuthenticationException e) {
        return problem(HttpStatus.UNAUTHORIZED, "bad-credentials", "Email o password non corretti.");
    }

    @ExceptionHandler(InvalidTokenException.class)
    ProblemDetail invalidToken(InvalidTokenException e) {
        return problem(HttpStatus.BAD_REQUEST, "invalid-token", e.getMessage());
    }

    /**
     * Il database non risponde: niente e' stato scritto, perche' ogni comando e' una
     * transazione o una INSERT sola. Lo si dice come un'attesa, non come un guasto.
     */
    @ExceptionHandler(DataAccessResourceFailureException.class)
    ProblemDetail unavailable(DataAccessResourceFailureException e) {
        logger.error("database non raggiungibile", e);
        return problem(HttpStatus.SERVICE_UNAVAILABLE, "service-unavailable",
                "Il servizio non risponde in questo momento. Riprova fra poco.");
    }
```

(`CannotGetJdbcConnectionException`, quella che Spring solleva quando non ottiene una connessione, è una sottoclasse di `DataAccessResourceFailureException`.) Un test diretto sull'handler, in `src/test/java/com/fantaagent/adapter/in/api/ApiExceptionHandlerUnavailableTest.java`:

```java
package com.fantaagent.adapter.in.api;

import org.junit.jupiter.api.Test;
import org.springframework.http.ProblemDetail;
import org.springframework.jdbc.CannotGetJdbcConnectionException;

import static org.assertj.core.api.Assertions.assertThat;

class ApiExceptionHandlerUnavailableTest {

    @Test
    void senzaDatabaseSiRisponde503() {
        ProblemDetail p = new ApiExceptionHandler().unavailable(new CannotGetJdbcConnectionException("giu'"));
        assertThat(p.getStatus()).isEqualTo(503);
        assertThat(p.getType().toString()).endsWith("/service-unavailable");
    }
}
```

con gli import `com.fantaagent.application.port.out.EmailTakenException`, `com.fantaagent.application.service.account.InvalidAccountDataException`, `com.fantaagent.application.service.account.InvalidTokenException`, `org.springframework.security.core.AuthenticationException`, `org.springframework.dao.DataAccessResourceFailureException`.

- [ ] **Step 10: Eseguire il test e vederlo passare**

Run: `mvn -q test -Dtest='AuthApiTest,ApiExceptionHandlerUnavailableTest'`
Expected: PASS.

- [ ] **Step 11: Mutazione**

In `SecurityConfig` cambiare temporaneamente `.requestMatchers("/api/**").authenticated()` in `.permitAll()`: `senzaAccessoLApiRisponde401ConUnProblema` deve fallire. Ripristinare. Poi togliere temporaneamente la riga `sessions.findByPrincipalName(...)` da `reset`: `laNuovaPasswordChiudeLeSessioniAperte` deve fallire. Ripristinare.

- [ ] **Step 12: L'intera suite**

Run: `mvn -q test`
Expected: PASS. I test esistenti di `adapter/in/api` costruiscono MockMvc senza `springSecurity()` e non vedono la catena di sicurezza: restano verdi finché i Task 13 e 14 non li riscrivono. `SpaRoutesControllerTest` invece usa `@AutoConfigureMockMvc`, che la catena la applica: le rotte della SPA restano libere (`anyRequest().permitAll()`), ma un suo caso che chiede una rotta sotto `/api` ora riceve 401. Se succede, quel caso va autenticato con `@WithMockUser` di spring-security-test — cambia chi chiede, non cosa si verifica.

- [ ] **Step 13: Commit**

```bash
git add pom.xml src/main/resources src/main/java/com/fantaagent/adapter/in/security src/main/java/com/fantaagent/adapter/in/api src/main/java/com/fantaagent/config/SecurityConfig.java src/test/java/com/fantaagent/testsupport/ApiFixture.java src/test/java/com/fantaagent/adapter/in/api/auth
git commit -m "Accesso: sessione in Postgres, CSRF col cookie, 401 e 403 come problemi

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Troppi tentativi di accesso

**Files:**
- Create: `application/service/account/LoginThrottle.java`, `TooManyAttemptsException.java`
- Modify: `adapter/in/api/auth/AuthApi.java`, `adapter/in/api/ApiExceptionHandler.java`, `config/AccountConfig.java`
- Test: `src/test/java/com/fantaagent/application/service/account/LoginThrottleTest.java`, e un caso in `AuthApiTest`

**Interfaces:**
- Produces: `LoginThrottle(Clock)` con `void check(String email, String address)`, `void failed(String email, String address)`, `void succeeded(String email)`; `TooManyAttemptsException(Duration wait)` con `Duration waitFor()`. Problema `too-many-attempts` 429 con header `Retry-After`.

Cinque errori liberi per email e per indirizzo, poi un'attesa che raddoppia a ogni errore (1 s, 2 s, 4 s…) fino a un massimo di 15 minuti. Un accesso riuscito azzera il contatore dell'email; quello dell'indirizzo no, perché da un indirizzo si possono provare molte email. In memoria: con più istanze ognuna conta per sé, e il limite diventa più largo, non sparisce. Se servirà più stretto, si sposterà su una tabella.

- [ ] **Step 1: Scrivere il test che fallisce**

`src/test/java/com/fantaagent/application/service/account/LoginThrottleTest.java`:

```java
package com.fantaagent.application.service.account;

import com.fantaagent.testsupport.MutableClock;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LoginThrottleTest {

    private final MutableClock clock = new MutableClock(Instant.parse("2026-09-28T20:00:00Z"));
    private final LoginThrottle throttle = new LoginThrottle(clock);

    private void fail(int times, String email, String address) {
        for (int i = 0; i < times; i++) {
            throttle.failed(email, address);
        }
    }

    @Test
    void cinqueErroriSonoLiberi() {
        fail(4, "anna@example.com", "1.1.1.1");
        assertThatCode(() -> throttle.check("anna@example.com", "1.1.1.1")).doesNotThrowAnyException();
    }

    @Test
    void dalQuintoErroreSiAspetta() {
        fail(5, "anna@example.com", "1.1.1.1");
        assertThatThrownBy(() -> throttle.check("anna@example.com", "2.2.2.2"))
                .isInstanceOfSatisfying(TooManyAttemptsException.class,
                        e -> org.assertj.core.api.Assertions.assertThat(e.waitFor()).isEqualTo(Duration.ofSeconds(1)));
    }

    @Test
    void lAttesaRaddoppia() {
        fail(7, "anna@example.com", "1.1.1.1");
        assertThatThrownBy(() -> throttle.check("anna@example.com", "1.1.1.1"))
                .isInstanceOfSatisfying(TooManyAttemptsException.class,
                        e -> org.assertj.core.api.Assertions.assertThat(e.waitFor()).isEqualTo(Duration.ofSeconds(4)));
    }

    @Test
    void lAttesaNonSuperaQuindiciMinuti() {
        fail(40, "anna@example.com", "1.1.1.1");
        assertThatThrownBy(() -> throttle.check("anna@example.com", "1.1.1.1"))
                .isInstanceOfSatisfying(TooManyAttemptsException.class,
                        e -> org.assertj.core.api.Assertions.assertThat(e.waitFor()).isEqualTo(Duration.ofMinutes(15)));
    }

    @Test
    void passataLAttesaSiRiprova() {
        fail(5, "anna@example.com", "1.1.1.1");
        clock.advance(Duration.ofSeconds(2));
        assertThatCode(() -> throttle.check("anna@example.com", "1.1.1.1")).doesNotThrowAnyException();
    }

    @Test
    void unIndirizzoCheProvaMolteEmailSiFerma() {
        for (int i = 0; i < 5; i++) {
            throttle.failed("utente" + i + "@example.com", "9.9.9.9");
        }
        assertThatThrownBy(() -> throttle.check("altro@example.com", "9.9.9.9"))
                .isInstanceOf(TooManyAttemptsException.class);
    }

    @Test
    void unAccessoRiuscitoAzzeraLEmailNonLIndirizzo() {
        fail(5, "anna@example.com", "1.1.1.1");
        clock.advance(Duration.ofSeconds(2));
        throttle.succeeded("ANNA@example.com");
        assertThatCode(() -> throttle.check("anna@example.com", "3.3.3.3")).doesNotThrowAnyException();
        assertThatThrownBy(() -> {
            throttle.failed("x@example.com", "1.1.1.1");
            throttle.check("y@example.com", "1.1.1.1");
        }).isInstanceOf(TooManyAttemptsException.class);
    }
}
```

In `AuthApiTest` aggiungere:

```java
    @Test
    void troppiTentativiRispondono429() throws Exception {
        ApiFixture.register(mvc, email, "Anna");
        for (int i = 0; i < 5; i++) {
            mvc.perform(post("/api/auth/login").with(csrf()).with(from("10.0.0.2"))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\":\"%s\",\"password\":\"sbagliata!!\"}".formatted(email)))
                    .andExpect(status().isUnauthorized());
        }
        // Anche con la password giusta e da un altro indirizzo: l'attesa vale per l'email.
        mvc.perform(post("/api/auth/login").with(csrf()).with(from("10.0.0.3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"%s\"}".formatted(email, ApiFixture.PASSWORD)))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "too-many-attempts"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header().exists("Retry-After"));
    }
```

- [ ] **Step 2: Eseguire i test e vederli fallire**

Run: `mvn -q test -Dtest='LoginThrottleTest,AuthApiTest'`
Expected: FAIL di compilazione.

- [ ] **Step 3: Scrivere l'implementazione**

`application/service/account/TooManyAttemptsException.java`:

```java
package com.fantaagent.application.service.account;

import java.time.Duration;

public class TooManyAttemptsException extends RuntimeException {

    private final Duration waitFor;

    public TooManyAttemptsException(Duration waitFor) {
        super("Troppi tentativi di accesso. Riprova fra " + Math.max(1, waitFor.toSeconds()) + " secondi.");
        this.waitFor = waitFor;
    }

    public Duration waitFor() {
        return waitFor;
    }
}
```

`application/service/account/LoginThrottle.java`:

```java
package com.fantaagent.application.service.account;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Rallenta chi indovina password. Due contatori per tentativo — l'email e
 * l'indirizzo — perche' si indovina in due modi: molte password per una persona, o
 * una password per molte persone.
 */
public class LoginThrottle {

    static final int FREE_FAILURES = 5;
    static final Duration MAX_WAIT = Duration.ofMinutes(15);
    /** Oltre questa soglia si fa pulizia delle voci scadute, per non crescere senza limite. */
    static final int PRUNE_ABOVE = 10_000;

    private record Entry(int failures, Instant lockedUntil) {
    }

    private final Map<String, Entry> entries = new ConcurrentHashMap<>();
    private final Clock clock;

    public LoginThrottle(Clock clock) {
        this.clock = clock;
    }

    /** @throws TooManyAttemptsException se l'email o l'indirizzo devono ancora aspettare */
    public void check(String email, String address) {
        Instant now = clock.instant();
        for (String key : keys(email, address)) {
            Entry entry = entries.get(key);
            if (entry != null && entry.lockedUntil() != null && now.isBefore(entry.lockedUntil())) {
                throw new TooManyAttemptsException(Duration.between(now, entry.lockedUntil()));
            }
        }
    }

    public void failed(String email, String address) {
        Instant now = clock.instant();
        if (entries.size() > PRUNE_ABOVE) {
            entries.values().removeIf(e -> e.lockedUntil() == null || e.lockedUntil().isBefore(now));
        }
        for (String key : keys(email, address)) {
            entries.merge(key, new Entry(1, lockFor(1, now)),
                    (old, one) -> new Entry(old.failures() + 1, lockFor(old.failures() + 1, now)));
        }
    }

    public void succeeded(String email) {
        entries.remove(emailKey(email));
    }

    private static Instant lockFor(int failures, Instant now) {
        if (failures < FREE_FAILURES) {
            return null;
        }
        int exponent = Math.min(failures - FREE_FAILURES, 20);
        Duration wait = Duration.ofSeconds(1L << exponent);
        return now.plus(wait.compareTo(MAX_WAIT) > 0 ? MAX_WAIT : wait);
    }

    private static String[] keys(String email, String address) {
        return new String[]{emailKey(email), "ip:" + address};
    }

    private static String emailKey(String email) {
        return "email:" + (email == null ? "" : email.trim().toLowerCase(Locale.ROOT));
    }
}
```

In `config/AccountConfig.java`:

```java
    @Bean
    public LoginThrottle loginThrottle(Clock clock) {
        return new LoginThrottle(clock);
    }
```

In `AuthApi`: aggiungere il campo e il parametro di costruttore `LoginThrottle throttle`, e riscrivere `login`:

```java
    @PostMapping("/auth/login")
    public AuthDtos.Me login(@RequestBody AuthDtos.LoginRequest body,
                             HttpServletRequest request, HttpServletResponse response) {
        String address = request.getRemoteAddr();
        throttle.check(body.email(), address);
        AppUserPrincipal principal;
        try {
            principal = signIn(body.email(), body.password(), request, response);
        } catch (AuthenticationException e) {
            throttle.failed(body.email(), address);
            throw e;
        }
        throttle.succeeded(body.email());
        return AuthDtos.Me.of(accounts.byId(principal.id()));
    }
```

(import `org.springframework.security.core.AuthenticationException`, `com.fantaagent.application.service.account.LoginThrottle`). `request.getRemoteAddr()` dietro un proxy è l'indirizzo del proxy: nel deploy va impostato `server.forward-headers-strategy=native` (Task 21 lo mette nell'elenco).

In `ApiExceptionHandler`, prima di `unexpected`:

```java
    @ExceptionHandler(TooManyAttemptsException.class)
    ResponseEntity<ProblemDetail> tooManyAttempts(TooManyAttemptsException e) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header(HttpHeaders.RETRY_AFTER, String.valueOf(Math.max(1, e.waitFor().toSeconds())))
                .body(problem(HttpStatus.TOO_MANY_REQUESTS, "too-many-attempts", e.getMessage()));
    }
```

- [ ] **Step 4: Eseguire i test e vederli passare**

Run: `mvn -q test -Dtest='LoginThrottleTest,AuthApiTest'`
Expected: PASS.

- [ ] **Step 5: Mutazione**

In `LoginThrottle.keys` togliere temporaneamente la chiave dell'indirizzo: `unIndirizzoCheProvaMolteEmailSiFerma` deve fallire. Ripristinare.

- [ ] **Step 6: Commit**

```bash
git add src/main/java/com/fantaagent/application/service/account src/main/java/com/fantaagent/adapter/in/api src/main/java/com/fantaagent/config/AccountConfig.java src/test/java/com/fantaagent/application/service/account src/test/java/com/fantaagent/adapter/in/api/auth
git commit -m "Accesso: dopo cinque errori l'attesa raddoppia, per email e per indirizzo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Accesso e registrazione nel browser

**Files:**
- Modify: `frontend/src/api/client.ts`, `frontend/src/api/QueryProvider.tsx`, `frontend/src/setupTests.ts`, `frontend/src/router.tsx`, `frontend/src/AppShell.tsx`, `frontend/src/AppShell.test.tsx`
- Create: `frontend/src/api/auth.ts`
- Create: `frontend/src/domain/AuthForm.tsx`
- Create: `frontend/src/routes/RequireAuth.tsx`, `LoginRoute.tsx`, `RegisterRoute.tsx`, `ForgotPasswordRoute.tsx`, `ResetPasswordRoute.tsx`, `VerifyEmailRoute.tsx`, `ProfileRoute.tsx`
- Modify: `src/main/java/com/fantaagent/adapter/in/spa/SpaRoutesController.java`
- Test: `frontend/src/api/client.test.ts` (casi nuovi), `frontend/src/routes/LoginRoute.test.tsx`, `RegisterRoute.test.tsx`, `RequireAuth.test.tsx`, `VerifyEmailRoute.test.tsx`; `SpaRoutesControllerTest` (esistente, deve restare verde)

**Interfaces:**
- Consumes: le rotte `/api/auth/*` e `/api/me` del Task 4.
- Produces:
  - `client.ts`: `api<T>(path: string, options?: { method?: string; body?: unknown }): Promise<T>` (percorso assoluto), `fieldErrors(error: unknown): Record<string, string[]>`; ogni scrittura porta `X-XSRF-TOKEN`.
  - `auth.ts`: `type Me = { id; email; displayName; emailVerified }`, `ME_KEY`, `useMe()`, `useLogin()`, `useRegister()`, `useLogout()`, `useForgotPassword()`, `useResetPassword()`, `useVerifyEmail()`, `useResendVerification()`, `useRenameMe()`.
  - `AuthForm.tsx`: `AuthLayout({ title, children })`, `TextField({ id, label, type, autoComplete, value, onChange, errors, hint })`, `safeAfter(value: string | null): string`.
  - `RequireAuth({ children })`.
  - Rotte: `/accedi`, `/registrati`, `/password-dimenticata`, `/nuova-password`, `/verifica-email`, `/profilo`.

Il ritorno dopo l'accesso viaggia come `?dopo=/percorso`. `safeAfter` accetta solo percorsi interni (iniziano con una sola `/`): un `dopo=//altro-sito.it` riporterebbe l'utente fuori dall'app subito dopo avergli fatto scrivere la password.

- [ ] **Step 1: Il token CSRF nei test**

In `frontend/src/setupTests.ts`, in fondo:

```ts
// Il cookie che il backend scrive a ogni risposta: con questo le scritture dei test
// non devono prima chiederlo, e le chiamate a fetch che i test contano restano quelle.
document.cookie = 'XSRF-TOKEN=token-di-prova; path=/';
```

- [ ] **Step 2: Scrivere i test che falliscono**

In `frontend/src/api/client.test.ts`, dentro `describe('client API', ...)`, importando anche `api` e `fieldErrors`:

```ts
  it('manda il token CSRF nelle scritture e non nelle letture', async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    vi.stubGlobal('fetch', fetchMock);

    await api('/api/auth/logout', { method: 'POST' });
    await api('/api/me').catch(() => {});

    const [, postInit] = fetchMock.mock.calls[0];
    expect(postInit.headers['X-XSRF-TOKEN']).toBe('token-di-prova');
    const [, getInit] = fetchMock.mock.calls[1];
    expect(getInit.headers['X-XSRF-TOKEN']).toBeUndefined();
  });

  it('senza cookie chiede il token prima di scrivere', async () => {
    document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/auth/csrf') {
        document.cookie = 'XSRF-TOKEN=appena-arrivato; path=/';
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    await api('/api/auth/login', { method: 'POST', body: { email: 'a', password: 'b' } });

    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/csrf');
    expect(fetchMock.mock.calls[1][1].headers['X-XSRF-TOKEN']).toBe('appena-arrivato');
    document.cookie = 'XSRF-TOKEN=token-di-prova; path=/';
  });

  it('legge gli errori per campo di un problema', () => {
    const error = new ProblemError('https://fantaagent.local/problems/invalid-account', 'x', 422,
      { errors: { email: ['Scrivi un indirizzo email valido.'] } });
    expect(fieldErrors(error)).toEqual({ email: ['Scrivi un indirizzo email valido.'] });
    expect(fieldErrors(new Error('altro'))).toEqual({});
  });
```

`frontend/src/routes/LoginRoute.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryProvider } from '../api/QueryProvider';
import { LoginRoute } from './LoginRoute';

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/accedi', element: <LoginRoute /> },
      { path: '/leghe', element: <p>le mie leghe</p> },
      { path: '/', element: <p>inizio</p> },
    ],
    { initialEntries: [path] },
  );
  render(<QueryProvider><RouterProvider router={router} /></QueryProvider>);
  return router;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' },
  });
}

describe('LoginRoute', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('dopo l\'accesso torna dove si voleva andare', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      json({ id: 'u1', email: 'anna@example.com', displayName: 'Anna', emailVerified: true }),
    ));
    const router = renderAt('/accedi?dopo=%2Fleghe');

    await userEvent.type(screen.getByLabelText('Email'), 'anna@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'una password lunga');
    await userEvent.click(screen.getByRole('button', { name: 'Accedi' }));

    expect(await screen.findByText('le mie leghe')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/leghe');
  });

  it('non segue un ritorno verso un altro sito', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      json({ id: 'u1', email: 'a@b.it', displayName: 'A', emailVerified: true }),
    ));
    const router = renderAt('/accedi?dopo=%2F%2Faltro-sito.it');

    await userEvent.type(screen.getByLabelText('Email'), 'a@b.it');
    await userEvent.type(screen.getByLabelText('Password'), 'una password lunga');
    await userEvent.click(screen.getByRole('button', { name: 'Accedi' }));

    expect(await screen.findByText('inizio')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('dice che email o password non vanno', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({
      type: 'https://fantaagent.local/problems/bad-credentials',
      detail: 'Email o password non corretti.',
    }, 401)));
    renderAt('/accedi');

    await userEvent.type(screen.getByLabelText('Email'), 'a@b.it');
    await userEvent.type(screen.getByLabelText('Password'), 'sbagliata');
    await userEvent.click(screen.getByRole('button', { name: 'Accedi' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email o password non corretti.');
  });
});
```

`frontend/src/routes/RegisterRoute.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryProvider } from '../api/QueryProvider';
import { RegisterRoute } from './RegisterRoute';

describe('RegisterRoute', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('mostra gli errori accanto al campo a cui appartengono', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      type: 'https://fantaagent.local/problems/invalid-account',
      detail: 'Alcuni dati non sono validi.',
      errors: { password: ['La password deve avere almeno 10 caratteri.'] },
    }), { status: 422, headers: { 'content-type': 'application/problem+json' } })));
    render(<QueryProvider><MemoryRouter><RegisterRoute /></MemoryRouter></QueryProvider>);

    await userEvent.type(screen.getByLabelText('Il tuo nome'), 'Anna');
    await userEvent.type(screen.getByLabelText('Email'), 'anna@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'corta');
    await userEvent.click(screen.getByRole('button', { name: 'Crea l\'account' }));

    const password = screen.getByLabelText('Password');
    const described = await screen.findByText('La password deve avere almeno 10 caratteri.');
    expect(password.getAttribute('aria-describedby')).toContain(described.closest('ul')!.id);
    expect(password).toHaveAttribute('aria-invalid', 'true');
  });
});
```

`frontend/src/routes/RequireAuth.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryProvider } from '../api/QueryProvider';
import { RequireAuth } from './RequireAuth';

describe('RequireAuth', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('senza accesso porta alla pagina di accesso e ricorda da dove', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      type: 'https://fantaagent.local/problems/unauthenticated', detail: 'Serve l\'accesso.',
    }), { status: 401, headers: { 'content-type': 'application/problem+json' } })));
    const router = createMemoryRouter([
      { path: '/leghe/:id', element: <RequireAuth><p>segreto</p></RequireAuth> },
      { path: '/accedi', element: <p>pagina di accesso</p> },
    ], { initialEntries: ['/leghe/abc?x=1'] });
    render(<QueryProvider><RouterProvider router={router} /></QueryProvider>);

    expect(await screen.findByText('pagina di accesso')).toBeInTheDocument();
    expect(screen.queryByText('segreto')).not.toBeInTheDocument();
    expect(router.state.location.search).toBe('?dopo=%2Fleghe%2Fabc%3Fx%3D1');
  });

  it('con l\'accesso mostra la pagina', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'u1', email: 'a@b.it', displayName: 'A', emailVerified: true,
    }), { status: 200, headers: { 'content-type': 'application/json' } })));
    const router = createMemoryRouter([
      { path: '/', element: <RequireAuth><p>segreto</p></RequireAuth> },
    ]);
    render(<QueryProvider><RouterProvider router={router} /></QueryProvider>);

    expect(await screen.findByText('segreto')).toBeInTheDocument();
  });
});
```

`frontend/src/routes/VerifyEmailRoute.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryProvider } from '../api/QueryProvider';
import { VerifyEmailRoute } from './VerifyEmailRoute';

describe('VerifyEmailRoute', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('conferma una volta sola, anche col doppio effetto di StrictMode', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    render(
      <StrictMode>
        <QueryProvider>
          <MemoryRouter initialEntries={['/verifica-email?token=abc']}>
            <VerifyEmailRoute />
          </MemoryRouter>
        </QueryProvider>
      </StrictMode>,
    );

    expect(await screen.findByText('Indirizzo confermato.')).toBeInTheDocument();
    const verifyCalls = fetchMock.mock.calls.filter(([url]) => url === '/api/auth/verify');
    expect(verifyCalls).toHaveLength(1);
    expect(JSON.parse(verifyCalls[0][1].body)).toEqual({ token: 'abc' });
  });

  it('dice quando il link non vale piu\'', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      type: 'https://fantaagent.local/problems/invalid-token', detail: 'Il link non è valido o è scaduto.',
    }), { status: 400, headers: { 'content-type': 'application/problem+json' } })));
    render(
      <QueryProvider>
        <MemoryRouter initialEntries={['/verifica-email?token=vecchio']}>
          <VerifyEmailRoute />
        </MemoryRouter>
      </QueryProvider>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Il link non è valido o è scaduto.');
  });
});
```

`VerifyEmailRoute` legge `?token` con `useSearchParams`: nel test il `MemoryRouter` porta la query.

- [ ] **Step 3: Eseguire i test e vederli fallire**

Run (da `frontend/`): `npx vitest run src/api/client.test.ts src/routes/LoginRoute.test.tsx src/routes/RegisterRoute.test.tsx src/routes/RequireAuth.test.tsx src/routes/VerifyEmailRoute.test.tsx`
Expected: FAIL — moduli inesistenti, `api` e `fieldErrors` non esportati.

- [ ] **Step 4: Il client**

In `frontend/src/api/client.ts`:

1. In `USER_FACING_PROBLEMS` aggiungere tutti gli slug con testo della tabella dei Global Constraints: `'email-taken'`, `'bad-credentials'`, `'too-many-attempts'`, `'invalid-token'`, `'service-unavailable'`, `'admin-only'`, `'initial-taken'`, `'invite-unavailable'`, `'admin-cannot-leave'`, `'not-enough-members'`, `'no-seat'`, `'seats-locked'`, `'concurrent-write'`, `'import-mismatch'`. Gli slug con errori per campo (`invalid-account`, `invalid-league`, `invalid-import`) no: il loro `detail` è generico e i testi stanno in `errors`.

2. Sostituire `request` con:

```ts
/**
 * Il token CSRF: il backend lo scrive nel cookie XSRF-TOKEN, leggibile apposta, e
 * pretende di ritrovarlo nell'header di ogni scrittura. Un sito estraneo puo' far
 * partire una richiesta verso di noi col cookie di sessione, ma non puo' leggere
 * questo cookie per copiarlo nell'header.
 */
function readCsrfCookie(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
  return match && match[1] ? decodeURIComponent(match[1]) : null;
}

async function csrfHeader(method: string): Promise<Record<string, string>> {
  if (method === 'GET' || method === 'HEAD') return {};
  let token = readCsrfCookie();
  if (!token) {
    // La prima scrittura di una pagina aperta a freddo (l'accesso, per esempio):
    // nessuna risposta ha ancora portato il cookie, e lo si chiede apposta.
    await fetch('/api/auth/csrf', { headers: { accept: 'application/json' } });
    token = readCsrfCookie();
  }
  return token ? { 'X-XSRF-TOKEN': token } : {};
}

async function request<T>(resolvedUrl: string, init: RequestInit): Promise<T | null> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = { ...(init.headers as Record<string, string> | undefined), ...(await csrfHeader(method)) };
  const response = await fetch(resolvedUrl, { ...init, headers });
  if (!response.ok) {
    throw await toProblem(response);
  }
  if (response.status === 204) {
    return null;
  }
  return (await response.json()) as T;
}
```

3. In fondo al file:

```ts
/**
 * Una chiamata a un percorso assoluto dell'API, per le rotte che non stanno sotto una
 * lega o un'asta del {@link context}: accesso, profilo, elenco delle leghe, inviti.
 */
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const method = options.method ?? 'GET';
  const init: RequestInit = options.body === undefined
    ? { method, headers: { accept: 'application/json' } }
    : {
        method,
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(options.body),
      };
  return (await request<T>(path, init)) as T;
}

/** Gli errori per campo di un problema 422, o nessuno. */
export function fieldErrors(error: unknown): Record<string, string[]> {
  if (error instanceof ProblemError && error.body && typeof error.body === 'object'
      && 'errors' in error.body) {
    return ((error.body as { errors?: Record<string, string[]> }).errors) ?? {};
  }
  return {};
}
```

- [ ] **Step 5: Le sessioni scadute**

In `frontend/src/api/QueryProvider.tsx`, costruire il `QueryClient` con due cache che reagiscono al 401:

```tsx
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { ProblemError } from './client';

/** Le pagine dove un 401 e' la normalita', non una sessione scaduta. */
const PUBLIC_PATHS = ['/accedi', '/registrati', '/password-dimenticata', '/nuova-password',
  '/verifica-email', '/invito/'];

/**
 * Sessione scaduta a meta' serata: si va all'accesso e poi si torna esattamente dove
 * si era. La domanda {@code me} e' esclusa perche' la gestisce {@code RequireAuth},
 * che fa lo stesso senza ricaricare la pagina.
 */
function onUnauthenticated(error: unknown, queryKey?: readonly unknown[]) {
  if (!(error instanceof ProblemError) || error.slug !== 'unauthenticated') return;
  if (queryKey && queryKey[0] === 'me') return;
  const { pathname, search } = window.location;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return;
  window.location.assign(`/accedi?dopo=${encodeURIComponent(pathname + search)}`);
}
```

e nel `useState` passare a `new QueryClient({...})`, accanto a `defaultOptions`:

```tsx
        queryCache: new QueryCache({ onError: (error, query) => onUnauthenticated(error, query.queryKey) }),
        mutationCache: new MutationCache({ onError: (error) => onUnauthenticated(error) }),
```

- [ ] **Step 6: Gli hook**

`frontend/src/api/auth.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export interface Me {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
}

export const ME_KEY = ['me'] as const;

/** Chi ha fatto l'accesso. Non si riaggiorna da sola: cambia solo con un gesto dell'utente. */
export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: () => api<Me>('/api/me'),
    retry: false,
    refetchInterval: false,
    staleTime: 60_000,
  });
}

/**
 * Dopo un accesso o una registrazione i dati in cache si buttano: le risposte di
 * prima appartenevano a nessuno (o a un altro utente sullo stesso browser). Solo le
 * query, non {@code clear()}: quello toglierebbe anche questa mutazione, e con lei
 * il callback che porta alla pagina successiva.
 */
function useSignIn(path: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, string>) => api<Me>(path, { method: 'POST', body }),
    onSuccess: (me) => {
      client.removeQueries();
      client.setQueryData(ME_KEY, me);
    },
  });
}

export function useLogin() {
  return useSignIn('/api/auth/login');
}

export function useRegister() {
  return useSignIn('/api/auth/register');
}

export function useLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api<null>('/api/auth/logout', { method: 'POST' }),
    onSuccess: () => client.removeQueries(),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => api<null>('/api/auth/password/forgot', { method: 'POST', body: { email } }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (body: { token: string; password: string }) =>
      api<null>('/api/auth/password/reset', { method: 'POST', body }),
  });
}

export function useVerifyEmail() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => api<null>('/api/auth/verify', { method: 'POST', body: { token } }),
    onSuccess: () => client.invalidateQueries({ queryKey: ME_KEY }),
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: () => api<null>('/api/me/verification', { method: 'POST' }),
  });
}

export function useRenameMe() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (displayName: string) => api<Me>('/api/me', { method: 'PATCH', body: { displayName } }),
    onSuccess: (me) => client.setQueryData(ME_KEY, me),
  });
}
```

- [ ] **Step 7: I componenti comuni**

`frontend/src/domain/AuthForm.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Wordmark } from './Wordmark';
import { FieldErrors } from './FieldErrors';

/**
 * Il ritorno dopo l'accesso, solo se e' un percorso di questa app. "//altro.it" e'
 * un indirizzo assoluto per il browser: lo si scarta, e si torna all'inizio.
 */
export function safeAfter(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

/** La pagina delle schermate d'ingresso: un pannello solo, al centro, col marchio sopra. */
export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main role="main" className="relative z-10 flex min-h-dvh items-center justify-center p-4">
      <div className="panel w-[min(28rem,100%)] rounded-2xl p-6">
        <Wordmark size="md" />
        <h1 className="w-exp mt-4 text-xl font-semibold">{title}</h1>
        <div className="mt-4">{children}</div>
      </div>
    </main>
  );
}

export function TextField({
  id, label, type = 'text', autoComplete, value, onChange, errors = [], hint,
}: {
  id: string;
  label: string;
  type?: 'text' | 'email' | 'password';
  autoComplete?: string;
  value: string;
  onChange: (value: string) => void;
  errors?: string[];
  hint?: string;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorsId = errors.length > 0 ? `${id}-errors` : undefined;
  const describedBy = [hintId, errorsId].filter(Boolean).join(' ') || undefined;
  return (
    <div className="mt-4 first:mt-0">
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={errors.length > 0 ? 'true' : undefined}
        aria-describedby={describedBy}
        className="mt-2 min-h-11 w-full rounded-xl border border-line-strong bg-surface px-4 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      />
      {hint ? <p id={hintId} className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
      <FieldErrors id={`${id}-errors`} errors={errors} />
    </div>
  );
}

export const PRIMARY_BUTTON =
  'mt-6 min-h-11 w-full rounded-full bg-accent px-5 font-semibold text-on-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground';

export const TEXT_LINK =
  'font-medium underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent';
```

`frontend/src/routes/RequireAuth.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useMe } from '../api/auth';
import { ProblemError, userMessage } from '../api/client';

/**
 * Le pagine dietro l'accesso. Senza sessione si va all'accesso, portandosi dietro
 * l'indirizzo: un link d'asta aperto dal telefono deve riportare a quell'asta, non
 * all'inizio.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const me = useMe();
  const location = useLocation();

  if (me.isPending) {
    return <p className="p-6 text-sm text-muted-foreground">Un attimo…</p>;
  }
  if (me.isError) {
    if (me.error instanceof ProblemError && me.error.status === 401) {
      const back = encodeURIComponent(location.pathname + location.search);
      return <Navigate to={`/accedi?dopo=${back}`} replace />;
    }
    return (
      <p role="alert" className="panel m-6 rounded-xl p-4 text-sm font-medium text-destructive">
        {userMessage(me.error, 'Non riesco a caricare il tuo profilo. Riprova fra poco.')}
      </p>
    );
  }
  return <>{children}</>;
}
```

- [ ] **Step 8: Le schermate**

`frontend/src/routes/LoginRoute.tsx`:

```tsx
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLogin } from '../api/auth';
import { userMessage } from '../api/client';
import { AuthLayout, PRIMARY_BUTTON, TEXT_LINK, TextField, safeAfter } from '../domain/AuthForm';

export function LoginRoute() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const after = safeAfter(params.get('dopo'));
  const registerHref = after === '/' ? '/registrati' : `/registrati?dopo=${encodeURIComponent(after)}`;

  return (
    <AuthLayout title="Accedi">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          login.mutate({ email, password }, { onSuccess: () => navigate(after, { replace: true }) });
        }}
      >
        <TextField id="login-email" label="Email" type="email" autoComplete="email"
          value={email} onChange={setEmail} />
        <TextField id="login-password" label="Password" type="password" autoComplete="current-password"
          value={password} onChange={setPassword} />
        {login.isError ? (
          <p role="alert" className="mt-4 text-sm font-medium text-destructive">
            {userMessage(login.error, 'Accesso non riuscito. Riprova fra poco.')}
          </p>
        ) : null}
        <button type="submit" disabled={login.isPending} className={PRIMARY_BUTTON}>
          {login.isPending ? 'Entro…' : 'Accedi'}
        </button>
      </form>
      <p className="mt-4 text-sm">
        <Link to="/password-dimenticata" className={TEXT_LINK}>Password dimenticata?</Link>
      </p>
      <p className="mt-2 text-sm">
        Non hai un account? <Link to={registerHref} className={TEXT_LINK}>Registrati</Link>
      </p>
    </AuthLayout>
  );
}
```

`frontend/src/routes/RegisterRoute.tsx`:

```tsx
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useRegister } from '../api/auth';
import { fieldErrors, userMessage } from '../api/client';
import { AuthLayout, PRIMARY_BUTTON, TEXT_LINK, TextField, safeAfter } from '../domain/AuthForm';

export function RegisterRoute() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const register = useRegister();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const after = safeAfter(params.get('dopo'));
  const errors = fieldErrors(register.error);
  const hasFieldErrors = Object.keys(errors).length > 0;
  const loginHref = after === '/' ? '/accedi' : `/accedi?dopo=${encodeURIComponent(after)}`;

  return (
    <AuthLayout title="Crea il tuo account">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          register.mutate({ displayName, email, password },
            { onSuccess: () => navigate(after, { replace: true }) });
        }}
      >
        <TextField id="register-name" label="Il tuo nome" autoComplete="name"
          value={displayName} onChange={setDisplayName} errors={errors.displayName} />
        <TextField id="register-email" label="Email" type="email" autoComplete="email"
          value={email} onChange={setEmail} errors={errors.email}
          hint="Ti scriviamo per confermarla: serve se un giorno dimentichi la password." />
        <TextField id="register-password" label="Password" type="password" autoComplete="new-password"
          value={password} onChange={setPassword} errors={errors.password}
          hint="Almeno 10 caratteri. Una frase lunga va benissimo." />
        {register.isError ? (
          <p role="alert" className="mt-4 text-sm font-medium text-destructive">
            {hasFieldErrors
              ? 'Controlla i campi segnati.'
              : userMessage(register.error, 'Registrazione non riuscita. Riprova fra poco.')}
          </p>
        ) : null}
        <button type="submit" disabled={register.isPending} className={PRIMARY_BUTTON}>
          {register.isPending ? 'Creo l\'account…' : 'Crea l\'account'}
        </button>
      </form>
      <p className="mt-4 text-sm">
        Hai già un account? <Link to={loginHref} className={TEXT_LINK}>Accedi</Link>
      </p>
    </AuthLayout>
  );
}
```

`frontend/src/routes/ForgotPasswordRoute.tsx`:

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForgotPassword } from '../api/auth';
import { userMessage } from '../api/client';
import { AuthLayout, PRIMARY_BUTTON, TEXT_LINK, TextField } from '../domain/AuthForm';

/**
 * La conferma e' la stessa che l'indirizzo sia iscritto o no: questa pagina non deve
 * diventare un modo per scoprire chi usa FantaAgent.
 */
export function ForgotPasswordRoute() {
  const forgot = useForgotPassword();
  const [email, setEmail] = useState('');

  return (
    <AuthLayout title="Password dimenticata">
      {forgot.isSuccess ? (
        <p role="status" className="text-sm">
          Se l'indirizzo è registrato e confermato, ti abbiamo scritto un link per scegliere
          una nuova password. Vale un'ora: controlla anche lo spam.
        </p>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); forgot.mutate(email); }}>
          <TextField id="forgot-email" label="Email" type="email" autoComplete="email"
            value={email} onChange={setEmail} />
          {forgot.isError ? (
            <p role="alert" className="mt-4 text-sm font-medium text-destructive">
              {userMessage(forgot.error, 'Richiesta non riuscita. Riprova fra poco.')}
            </p>
          ) : null}
          <button type="submit" disabled={forgot.isPending} className={PRIMARY_BUTTON}>
            {forgot.isPending ? 'Invio…' : 'Mandami il link'}
          </button>
        </form>
      )}
      <p className="mt-4 text-sm"><Link to="/accedi" className={TEXT_LINK}>Torna all'accesso</Link></p>
    </AuthLayout>
  );
}
```

`frontend/src/routes/ResetPasswordRoute.tsx`:

```tsx
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useResetPassword } from '../api/auth';
import { fieldErrors, userMessage } from '../api/client';
import { AuthLayout, PRIMARY_BUTTON, TEXT_LINK, TextField } from '../domain/AuthForm';

export function ResetPasswordRoute() {
  const [params] = useSearchParams();
  const reset = useResetPassword();
  const [password, setPassword] = useState('');
  const token = params.get('token') ?? '';
  const errors = fieldErrors(reset.error);

  return (
    <AuthLayout title="Nuova password">
      {reset.isSuccess ? (
        <p role="status" className="text-sm">
          Password cambiata. Per sicurezza sei uscito da tutti i dispositivi:{' '}
          <Link to="/accedi" className={TEXT_LINK}>accedi</Link> con la nuova password.
        </p>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); reset.mutate({ token, password }); }}>
          <TextField id="reset-password" label="Nuova password" type="password"
            autoComplete="new-password" value={password} onChange={setPassword}
            errors={errors.password} hint="Almeno 10 caratteri. Una frase lunga va benissimo." />
          {reset.isError && !errors.password ? (
            <p role="alert" className="mt-4 text-sm font-medium text-destructive">
              {userMessage(reset.error, 'Non sono riuscito a cambiare la password. Riprova fra poco.')}
            </p>
          ) : null}
          <button type="submit" disabled={reset.isPending || !token} className={PRIMARY_BUTTON}>
            {reset.isPending ? 'Salvo…' : 'Salva la nuova password'}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
```

`frontend/src/routes/VerifyEmailRoute.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useVerifyEmail } from '../api/auth';
import { userMessage } from '../api/client';
import { AuthLayout, TEXT_LINK } from '../domain/AuthForm';

/**
 * Si apre dal link dell'email e conferma da sola. Il ref impedisce il secondo invio
 * che StrictMode provoca rieseguendo l'effetto: il link vale una volta, e il secondo
 * tentativo risponderebbe "non valido" sopra a un "confermato" appena mostrato.
 */
export function VerifyEmailRoute() {
  const [params] = useSearchParams();
  const verify = useVerifyEmail();
  const sent = useRef(false);
  const token = params.get('token') ?? '';

  useEffect(() => {
    if (sent.current || !token) return;
    sent.current = true;
    verify.mutate(token);
  }, [token, verify]);

  return (
    <AuthLayout title="Conferma dell'indirizzo">
      {verify.isSuccess ? <p role="status" className="text-sm">Indirizzo confermato.</p> : null}
      {verify.isError || !token ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {token ? userMessage(verify.error, 'Conferma non riuscita. Riprova fra poco.')
            : 'Il link non è valido o è scaduto.'}
        </p>
      ) : null}
      {verify.isPending ? <p className="text-sm">Confermo…</p> : null}
      <p className="mt-4 text-sm"><Link to="/" className={TEXT_LINK}>Vai alle tue leghe</Link></p>
    </AuthLayout>
  );
}
```

`frontend/src/routes/ProfileRoute.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../AppShell';
import { useLogout, useMe, useRenameMe, useResendVerification } from '../api/auth';
import { fieldErrors, userMessage } from '../api/client';
import { PRIMARY_BUTTON, TextField } from '../domain/AuthForm';

export function ProfileRoute() {
  const me = useMe();
  const rename = useRenameMe();
  const resend = useResendVerification();
  const logout = useLogout();
  const navigate = useNavigate();
  const [name, setName] = useState<string | null>(null);
  if (!me.data) return null;
  const current = name ?? me.data.displayName;
  const errors = fieldErrors(rename.error);

  return (
    <AppShell chrome="top">
      <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-2">
        <section aria-labelledby="profile-name" className="panel rounded-2xl p-6">
          <h1 id="profile-name" className="w-exp text-lg font-semibold">Il tuo profilo</h1>
          <form className="mt-4" onSubmit={(e) => { e.preventDefault(); rename.mutate(current); }}>
            <TextField id="profile-display-name" label="Il tuo nome" autoComplete="name"
              value={current} onChange={setName} errors={errors.displayName} />
            <button type="submit" disabled={rename.isPending || current === me.data.displayName}
              className={PRIMARY_BUTTON}>
              {rename.isPending ? 'Salvo…' : 'Salva il nome'}
            </button>
          </form>
        </section>
        <section aria-labelledby="profile-access" className="panel rounded-2xl p-6">
          <h2 id="profile-access" className="w-exp text-lg font-semibold">Accesso</h2>
          <p className="mt-4 text-sm">{me.data.email}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {me.data.emailVerified ? 'Indirizzo confermato.' : 'Indirizzo non ancora confermato.'}
          </p>
          {!me.data.emailVerified ? (
            <button type="button" disabled={resend.isPending || resend.isSuccess}
              onClick={() => resend.mutate()}
              className="mt-4 min-h-11 rounded-full border border-line-strong px-5 font-medium disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
              {resend.isSuccess ? 'Email inviata' : 'Mandami di nuovo la conferma'}
            </button>
          ) : null}
          <button type="button" disabled={logout.isPending}
            onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/accedi', { replace: true }) })}
            className="mt-6 flex min-h-11 w-full items-center justify-center rounded-full border border-line-strong px-5 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
            Esci
          </button>
          {rename.isError && !errors.displayName ? (
            <p role="alert" className="mt-4 text-sm font-medium text-destructive">
              {userMessage(rename.error, 'Non sono riuscito a salvare. Riprova fra poco.')}
            </p>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 9: Il link al profilo e le rotte**

In `frontend/src/AppShell.tsx`, con `chrome === 'top'`, aggiungere dopo lo slot di stato un collegamento al profilo col nome di chi ha fatto l'accesso. Importare `useMe` da `./api/auth` e, dentro il componente, `const me = useMe();`:

```tsx
        {chrome === 'top' && me.data ? (
          <Link
            to="/profilo"
            aria-current={useLocation().pathname === '/profilo' ? 'page' : undefined}
            className="flex min-h-11 items-center rounded-full border border-line-strong px-4 font-medium hover:bg-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent sm:order-last"
          >
            {me.data.displayName}
          </Link>
        ) : null}
```

(`useLocation` è già chiamato in cima al componente: riusarne il valore invece di chiamarlo di nuovo.) In `AppShell.test.tsx`, `withRouter` avvolge anche in `QueryProvider`, e ogni test che non guarda il profilo stubba `fetch` con un 401 (`vi.stubGlobal` in un `beforeEach`, `vi.unstubAllGlobals` in un `afterEach`). Aggiungere il caso:

```tsx
  it('mostra il nome di chi ha fatto l\'accesso, verso il profilo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'u1', email: 'a@b.it', displayName: 'Anna', emailVerified: true,
    }), { status: 200, headers: { 'content-type': 'application/json' } })));
    render(withRouter(<AppShell chrome="top"><p>x</p></AppShell>));
    expect(await screen.findByRole('link', { name: 'Anna' })).toHaveAttribute('href', '/profilo');
  });
```

In `frontend/src/router.tsx`, avvolgere in `RequireAuth` ogni rotta esistente tranne `/riepilogo` (che è un `Navigate`) e aggiungere le nuove:

```tsx
export const routeDefinitions = [
  { path: '/', element: <RequireAuth><HomeRoute /></RequireAuth> },
  { path: '/asta', element: <RequireAuth><AuctionRoute /></RequireAuth> },
  { path: '/proiezione', element: <RequireAuth><ProjectionRoute /></RequireAuth> },
  { path: '/impostazioni', element: <RequireAuth><SettingsRoute /></RequireAuth> },
  { path: '/profilo', element: <RequireAuth><ProfileRoute /></RequireAuth> },
  // Le pagine d'ingresso: pubbliche, senza la barra delle altre.
  { path: '/accedi', element: <LoginRoute /> },
  { path: '/registrati', element: <RegisterRoute /> },
  { path: '/password-dimenticata', element: <ForgotPasswordRoute /> },
  { path: '/nuova-password', element: <ResetPasswordRoute /> },
  { path: '/verifica-email', element: <VerifyEmailRoute /> },
  { path: '/riepilogo', element: <Navigate to="/asta" replace /> },
];
```

(mantenere i commenti esistenti sopra `/riepilogo`).

In `SpaRoutesController.java` aggiungere le costanti e metterle sia in `ROUTES` sia in `@GetMapping`:

```java
    static final String PROFILO = "/profilo";
    static final String ACCEDI = "/accedi";
    static final String REGISTRATI = "/registrati";
    static final String PASSWORD_DIMENTICATA = "/password-dimenticata";
    static final String NUOVA_PASSWORD = "/nuova-password";
    static final String VERIFICA_EMAIL = "/verifica-email";
```

- [ ] **Step 10: Eseguire i test e vederli passare**

Run (da `frontend/`): `npm test && npm run lint && npm run build`
Expected: PASS. Poi dalla radice: `mvn -q test -Dtest=SpaRoutesControllerTest` — PASS.

- [ ] **Step 11: Mutazione**

In `safeAfter` togliere `&& !value.startsWith('//')`: `non segue un ritorno verso un altro sito` deve fallire. Ripristinare.

- [ ] **Step 12: Verifica visiva**

Con `npm run dev` e Playwright con `page.route('**/api/**', ...)` — qui il filtro `**/api/leagues/**` della memoria non basta, perché le rotte sono `/api/auth` e `/api/me`: usare una funzione che risponde solo agli URL la cui `pathname` inizia con `/api/` e lascia passare il resto, così i moduli di Vite sotto `src/api/` non vengono intercettati. Screenshot a 1280×800 e 390×844 di `/accedi`, `/registrati` con errori di campo, `/profilo`. Il pannello deve stare al centro senza vuoti sbilanciati; nessun testo menziona server o file.

- [ ] **Step 13: Commit**

```bash
git add frontend/src src/main/java/com/fantaagent/adapter/in/spa
git commit -m "Accesso, registrazione, recupero della password e profilo nel browser

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Parte C — Leghe e inviti

Alla fine della Parte C si crea una lega, se ne diventa amministratori, si genera un link d'invito, e chi lo apre entra nella lega scegliendo nome della squadra e iniziale. Le aste sono ancora quelle di oggi, sulla lega `default`.

### Task 7: Leghe e membri

**Files:**
- Create: `application/port/out/League.java`, `LeagueMember.java`, `MemberRole.java`, `LeagueRepository.java`, `InitialTakenException.java`, `Transactions.java`
- Create: `application/service/league/LeagueService.java`, `LeagueAccess.java`, `NotLeagueMemberException.java`, `AdminOnlyException.java`, `InvalidLeagueDataException.java`
- Create: `adapter/out/jdbc/JdbcLeagueRepository.java`, `SpringTransactions.java`
- Create: `adapter/in/api/ApiAccess.java`
- Create: `adapter/in/api/league/LeagueApi.java`, `LeagueSettingsApi.java`, `LeagueDtos.java`
- Modify: `adapter/in/api/dto/SettingsDtos.java`, `adapter/in/api/SettingsApi.java` (usa le conversioni spostate), `adapter/in/api/ApiExceptionHandler.java`
- Create: `config/PersistenceConfig.java`
- Create: `src/test/java/com/fantaagent/testsupport/Fixtures.java`
- Test: `src/test/java/com/fantaagent/application/service/league/LeagueServiceTest.java`, `src/test/java/com/fantaagent/adapter/in/api/league/LeagueApiTest.java`

**Interfaces:**
- Consumes: `AuctionTemplate` (esistente: `rules()`, `scoring()`, `bidder()`), `AppUserPrincipal`, `ApiFixture`.
- Produces:
  - `record League(UUID id, String name, UUID createdBy, Instant createdAt, LeagueRulesSettings rules, ScoringSettings scoring, AuctionSettings bidder)` con `withName(String)`, `withDefaults(LeagueRulesSettings, ScoringSettings, AuctionSettings)`.
  - `enum MemberRole { ADMIN, MEMBER }`.
  - `record LeagueMember(UUID leagueId, UUID userId, MemberRole role, String teamName, char initial, Instant joinedAt, String displayName)` — `displayName` viene dall'account, ignorato in scrittura.
  - `interface LeagueRepository { void insert(League); Optional<League> byId(UUID); void update(League); void insertMember(LeagueMember); Optional<LeagueMember> member(UUID leagueId, UUID userId); List<LeagueMember> members(UUID leagueId); List<LeagueMember> membershipsOf(UUID userId); void deleteMember(UUID leagueId, UUID userId); }`
  - `InitialTakenException(char initial)`.
  - `interface Transactions { <T> T inTransaction(Supplier<T> work); default void run(Runnable work) }`.
  - `LeagueService(LeagueRepository, AuctionTemplate, Transactions, Clock)` con `LeagueAccess create(UUID userId, String name, String teamName, String initial)`, `List<LeagueAccess> mine(UUID userId)`, `LeagueAccess access(UUID leagueId, UUID userId)`, `League rename(LeagueAccess, String)`, `League updateDefaults(LeagueAccess, LeagueRulesSettings, ScoringSettings, AuctionSettings)`, `List<LeagueMember> members(LeagueAccess)`, `static Map<String, List<String>> memberProblems(String teamName, String initial)`, `static char initialOf(String)`.
  - `record LeagueAccess(League league, LeagueMember me)` con `isAdmin()`, `requireAdmin()`, `userId()`, `leagueId()`.
  - `ApiAccess.league(String leagueId, AppUserPrincipal me): LeagueAccess`, `ApiAccess.admin(String leagueId, AppUserPrincipal me): LeagueAccess`, `static UUID parseOr404(String raw, Supplier<RuntimeException> notFound)`.
  - Rotte: `GET /api/leagues`, `POST /api/leagues`, `GET /api/leagues/{leagueId}`, `PATCH /api/leagues/{leagueId}`, `GET /api/leagues/{leagueId}/members`, `GET /api/leagues/{leagueId}/rules`, `PUT /api/leagues/{leagueId}/rules`.
  - DTO in `LeagueDtos`: `LeagueCard(String id, String name, boolean admin, String teamName, String initial)`, `MemberView(String userId, String displayName, String teamName, String initial, MemberRole role, boolean me)`, `LeagueDetail(String id, String name, boolean admin, List<MemberView> members)`, `CreateLeagueRequest(String name, String teamName, String initial)`, `RenameRequest(String name)`, `LeagueRulesResponse(SettingsDtos.BidderSettings bidder, SettingsDtos.ScoringSection scoring, SettingsDtos.RulesSection rules, boolean canEdit)`, `SaveLeagueRulesRequest(SettingsDtos.BidderSettings bidder, SettingsDtos.ScoringSection scoring, SettingsDtos.RulesSection rules)`.
  - `SettingsDtos.ScoringSection.of(ScoringSettings)`, `SettingsDtos.ScoringSection#toSettings()`, `SettingsDtos.RulesSection.rolesOf(Map<Role, Integer>)`.
  - Problemi: `unknown-league` 404 (anche per un id non UUID), `admin-only` 403, `invalid-league` 422 con `errors`, `initial-taken` 409.
  - `testsupport.Fixtures.scoring(): ScoringSettings`, `Fixtures.template(): AuctionTemplate` (500 crediti, P3 D8 C8 A6, banditore predefinito).

Le regole della lega stanno su `/rules`, non su `/settings`: quella rotta appartiene ancora a `SettingsApi`, che serve le schermate d'asta di oggi fino al Task 15.

- [ ] **Step 0: Un modello pubblico per i test**

`src/test/java/com/fantaagent/testsupport/Fixtures.java`:

```java
package com.fantaagent.testsupport;

import com.fantaagent.application.port.out.AuctionTemplate;
import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.LeagueRulesSettings;
import com.fantaagent.config.ScoringSettings;
import com.fantaagent.domain.league.ModifierTable;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.league.ScoringRules;
import com.fantaagent.domain.player.Role;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * I valori con cui nascono leghe e aste nei test fuori da {@code application.service}:
 * gli stessi numeri di {@code AuctionRuntimeTest}, rosa da 25 come quella vera.
 */
public final class Fixtures {

    private Fixtures() {
    }

    public static ScoringSettings scoring() {
        Map<Role, Double> bonus = new EnumMap<>(Role.class);
        for (Role role : Role.values()) {
            bonus.put(role, 3.0);
        }
        return ScoringSettings.from(new ScoringRules(true, bonus, 1.0, 3.0, -3.0, 3.0, -0.5, -1.0, -1.0, 1.0,
                new ModifierTable(3, List.of(new ModifierTable.Threshold(0.0, 0.0))),
                new ModifierTable(0, List.of(new ModifierTable.Threshold(0.0, 0.0))), 0.55), true);
    }

    public static AuctionTemplate template() {
        LeagueRulesSettings rules = new LeagueRulesSettings(500,
                Map.of(Role.P, 3, Role.D, 8, Role.C, 8, Role.A, 6));
        ScoringSettings scoring = scoring();
        return new AuctionTemplate() {
            @Override public LeagueRulesSettings rules() { return rules; }
            @Override public List<Participant> participants() { return List.of(); }
            @Override public ScoringSettings scoring() { return scoring; }
            @Override public AuctionSettings bidder() { return AuctionSettings.DEFAULTS; }
            @Override public ScoringRules scoringRules(ScoringSettings settings) {
                return settings.toScoringRules(0.55);
            }
        };
    }
}
```

- [ ] **Step 1: Scrivere i test che falliscono**

`src/test/java/com/fantaagent/application/service/league/LeagueServiceTest.java`:

```java
package com.fantaagent.application.service.league;

import com.fantaagent.adapter.out.jdbc.JdbcLeagueRepository;
import com.fantaagent.adapter.out.jdbc.SpringTransactions;
import com.fantaagent.application.port.out.InitialTakenException;
import com.fantaagent.application.port.out.LeagueMember;
import com.fantaagent.application.port.out.MemberRole;
import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.LeagueRulesSettings;
import com.fantaagent.testsupport.Fixtures;
import com.fantaagent.testsupport.MutableClock;
import com.fantaagent.testsupport.SharedPostgres;
import com.fantaagent.testsupport.TestRows;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import static com.fantaagent.domain.player.Role.A;
import static com.fantaagent.domain.player.Role.C;
import static com.fantaagent.domain.player.Role.D;
import static com.fantaagent.domain.player.Role.P;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LeagueServiceTest {

    private static final ObjectMapper JSON = JsonMapper.builder().addModule(new JavaTimeModule()).build();

    private JdbcClient jdbc;
    private JdbcLeagueRepository repository;
    private LeagueService leagues;
    private UUID anna;
    private UUID bruno;

    @BeforeEach
    void setUp() {
        DataSource ds = SharedPostgres.migratedDatabase();
        jdbc = JdbcClient.create(ds);
        repository = new JdbcLeagueRepository(jdbc, JSON);
        leagues = new LeagueService(repository, Fixtures.template(),
                new SpringTransactions(new TransactionTemplate(new DataSourceTransactionManager(ds))),
                new MutableClock(Instant.parse("2026-09-28T20:00:00Z")));
        anna = TestRows.user(jdbc, "anna@example.com");
        bruno = TestRows.user(jdbc, "bruno@example.com");
    }

    @Test
    void chiCreaLaLegaNeEAmministratore() {
        LeagueAccess access = leagues.create(anna, " Lega del Bar ", " Anna FC ", "a");

        assertThat(access.league().name()).isEqualTo("Lega del Bar");
        assertThat(access.isAdmin()).isTrue();
        assertThat(access.me().teamName()).isEqualTo("Anna FC");
        assertThat(access.me().initial()).isEqualTo('A');
        assertThat(access.me().displayName()).isEqualTo("anna");
    }

    @Test
    void laLegaParteDaiValoriDelModello() {
        LeagueAccess access = leagues.create(anna, "Lega", "Anna FC", "A");
        assertThat(access.league().rules()).isEqualTo(Fixtures.template().rules());
    }

    @Test
    void chiNonEMembroNonVedeLaLega() {
        UUID league = leagues.create(anna, "Lega", "Anna FC", "A").leagueId();
        assertThatThrownBy(() -> leagues.access(league, bruno)).isInstanceOf(NotLeagueMemberException.class);
        assertThatThrownBy(() -> leagues.access(UUID.randomUUID(), anna)).isInstanceOf(NotLeagueMemberException.class);
    }

    @Test
    void unMembroNonAmministratoreNonCambiaLaLega() {
        LeagueAccess admin = leagues.create(anna, "Lega", "Anna FC", "A");
        repository.insertMember(new LeagueMember(admin.leagueId(), bruno, MemberRole.MEMBER, "Bruno FC",
                'B', Instant.now(), null));
        LeagueAccess member = leagues.access(admin.leagueId(), bruno);

        assertThatThrownBy(() -> leagues.rename(member, "Altro nome")).isInstanceOf(AdminOnlyException.class);
    }

    @Test
    void dueInizialiUgualiNonConvivono() {
        LeagueAccess admin = leagues.create(anna, "Lega", "Anna FC", "A");
        assertThatThrownBy(() -> repository.insertMember(new LeagueMember(admin.leagueId(), bruno,
                MemberRole.MEMBER, "Bruno FC", 'A', Instant.now(), null)))
                .isInstanceOf(InitialTakenException.class);
    }

    @Test
    void leRegoleDellaLegaSiRileggonoIdentiche() {
        LeagueAccess admin = leagues.create(anna, "Lega", "Anna FC", "A");
        LeagueRulesSettings rules = new LeagueRulesSettings(300, Map.of(P, 2, D, 6, C, 6, A, 4));
        leagues.updateDefaults(admin, rules, admin.league().scoring(), new AuctionSettings(9, false));

        LeagueAccess reread = leagues.access(admin.leagueId(), anna);
        assertThat(reread.league().rules()).isEqualTo(rules);
        assertThat(reread.league().scoring()).isEqualTo(admin.league().scoring());
        assertThat(reread.league().bidder()).isEqualTo(new AuctionSettings(9, false));
    }

    @Test
    void leMieLeghe() {
        leagues.create(anna, "Zeta", "Anna FC", "A");
        leagues.create(anna, "Alfa", "Anna FC", "A");
        leagues.create(bruno, "Di Bruno", "Bruno FC", "B");

        assertThat(leagues.mine(anna)).extracting(a -> a.league().name()).containsExactly("Alfa", "Zeta");
    }

    @Test
    void datiNonValidiPerCampo() {
        assertThatThrownBy(() -> leagues.create(anna, " ", "", "7"))
                .isInstanceOfSatisfying(InvalidLeagueDataException.class, e ->
                        assertThat(e.errors()).containsOnlyKeys("name", "teamName", "initial"));
    }
}
```

`Fixtures` è nuovo (Step 0 qui sotto): `TestAuctionTemplate` esiste già, ma è package-private in `application.service` e vuole un punteggio dal costruttore.

`src/test/java/com/fantaagent/adapter/in/api/league/LeagueApiTest.java`:

```java
package com.fantaagent.adapter.in.api.league;

import com.fantaagent.testsupport.ApiFixture;
import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.context.WebApplicationContext;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("dev")
class LeagueApiTest {

    static final String PROBLEMS = "https://fantaagent.local/problems/";

    @Autowired
    private WebApplicationContext context;

    private MockMvc mvc;
    private Cookie anna;
    private Cookie bruno;

    @BeforeEach
    void setUp() throws Exception {
        mvc = ApiFixture.mvc(context);
        anna = ApiFixture.register(mvc, ApiFixture.uniqueEmail("anna"), "Anna");
        bruno = ApiFixture.register(mvc, ApiFixture.uniqueEmail("bruno"), "Bruno");
    }

    String createLeague(Cookie who) throws Exception {
        String body = mvc.perform(post("/api/leagues").with(csrf()).cookie(who)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Lega del Bar\",\"teamName\":\"Anna FC\",\"initial\":\"A\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    @Test
    void creareUnaLegaERitrovarlaFraLeMie() throws Exception {
        String id = createLeague(anna);
        mvc.perform(get("/api/leagues").cookie(anna))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(id))
                .andExpect(jsonPath("$[0].admin").value(true))
                .andExpect(jsonPath("$[0].teamName").value("Anna FC"));
        mvc.perform(get("/api/leagues/" + id).cookie(anna))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.members[0].displayName").value("Anna"))
                .andExpect(jsonPath("$.members[0].me").value(true));
    }

    @Test
    void chiNonEMembroRiceve404NonUn403() throws Exception {
        String id = createLeague(anna);
        mvc.perform(get("/api/leagues/" + id).cookie(bruno))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "unknown-league"));
        mvc.perform(get("/api/leagues/" + id + "/rules").cookie(bruno))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/leagues/non-un-uuid").cookie(bruno))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "unknown-league"));
    }

    @Test
    void leRegoleSiLeggonoESiSalvano() throws Exception {
        String id = createLeague(anna);
        String rules = mvc.perform(get("/api/leagues/" + id + "/rules").cookie(anna))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canEdit").value(true))
                .andReturn().getResponse().getContentAsString();
        String scoring = new com.fasterxml.jackson.databind.ObjectMapper()
                .readTree(rules).get("scoring").toString();

        mvc.perform(put("/api/leagues/" + id + "/rules").with(csrf()).cookie(anna)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"bidder":{"bidTimerSeconds":8,"beepEnabled":false},
                                 "scoring":%s,
                                 "rules":{"budget":300,"slots":{"P":2,"D":6,"C":6,"A":4}}}""".formatted(scoring)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rules.budget").value(300))
                .andExpect(jsonPath("$.bidder.bidTimerSeconds").value(8));
    }

    @Test
    void regoleNonValideSonoDetteCampoPerCampo() throws Exception {
        String id = createLeague(anna);
        String rules = mvc.perform(get("/api/leagues/" + id + "/rules").cookie(anna))
                .andReturn().getResponse().getContentAsString();
        String scoring = new com.fasterxml.jackson.databind.ObjectMapper()
                .readTree(rules).get("scoring").toString();

        mvc.perform(put("/api/leagues/" + id + "/rules").with(csrf()).cookie(anna)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"bidder":{"bidTimerSeconds":0,"beepEnabled":false},
                                 "scoring":%s,
                                 "rules":{"budget":0,"slots":{"P":2,"D":6,"C":6,"A":4}}}""".formatted(scoring)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "invalid-settings"))
                .andExpect(jsonPath("$.errors.budget").exists());
    }

    @Test
    void datiDellaLegaNonValidi() throws Exception {
        mvc.perform(post("/api/leagues").with(csrf()).cookie(anna).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\",\"teamName\":\"Anna FC\",\"initial\":\"7\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "invalid-league"))
                .andExpect(jsonPath("$.errors.name").isArray())
                .andExpect(jsonPath("$.errors.initial").isArray());
    }

    @Test
    void rinominareELAmministratore() throws Exception {
        String id = createLeague(anna);
        mvc.perform(patch("/api/leagues/" + id).with(csrf()).cookie(anna)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Nuovo nome\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Nuovo nome"));
    }
}
```

La chiave `budget` è quella che `LeagueRulesValidator.validateByField` produce oggi. Il caso "un membro non amministratore riceve 403" sta nel Task 8, quando un secondo membro può entrare con un invito.

- [ ] **Step 2: Eseguire i test e vederli fallire**

Run: `mvn -q test -Dtest='LeagueServiceTest,LeagueApiTest'`
Expected: FAIL di compilazione.

- [ ] **Step 3: Le porte**

`application/port/out/League.java`:

```java
package com.fantaagent.application.port.out;

import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.LeagueRulesSettings;
import com.fantaagent.config.ScoringSettings;

import java.time.Instant;
import java.util.UUID;

/**
 * Un gruppo di persone che fa aste insieme, anno dopo anno. Regole, punteggio e
 * preferenze del banditore sono i valori PREDEFINITI delle aste future: ogni asta li
 * copia quando nasce, e cambiarli qui non tocca quelle gia' create.
 */
public record League(UUID id, String name, UUID createdBy, Instant createdAt,
                     LeagueRulesSettings rules, ScoringSettings scoring, AuctionSettings bidder) {

    public League withName(String newName) {
        return new League(id, newName, createdBy, createdAt, rules, scoring, bidder);
    }

    public League withDefaults(LeagueRulesSettings newRules, ScoringSettings newScoring,
                               AuctionSettings newBidder) {
        return new League(id, name, createdBy, createdAt, newRules, newScoring, newBidder);
    }
}
```

`application/port/out/MemberRole.java`:

```java
package com.fantaagent.application.port.out;

public enum MemberRole { ADMIN, MEMBER }
```

`application/port/out/LeagueMember.java`:

```java
package com.fantaagent.application.port.out;

import java.time.Instant;
import java.util.UUID;

/**
 * Una persona in una lega, con la squadra con cui gioca. {@code displayName} e' il
 * nome dell'account, letto insieme alla riga: non si scrive da qui.
 */
public record LeagueMember(UUID leagueId, UUID userId, MemberRole role, String teamName,
                           char initial, Instant joinedAt, String displayName) {
}
```

`application/port/out/LeagueRepository.java`:

```java
package com.fantaagent.application.port.out;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LeagueRepository {

    void insert(League league);

    Optional<League> byId(UUID id);

    /** Nome, regole, punteggio, preferenze del banditore. */
    void update(League league);

    /** @throws InitialTakenException se l'iniziale e' gia' di un altro membro */
    void insertMember(LeagueMember member);

    Optional<LeagueMember> member(UUID leagueId, UUID userId);

    /** In ordine d'ingresso nella lega. */
    List<LeagueMember> members(UUID leagueId);

    List<LeagueMember> membershipsOf(UUID userId);

    void deleteMember(UUID leagueId, UUID userId);
}
```

`application/port/out/InitialTakenException.java`:

```java
package com.fantaagent.application.port.out;

public class InitialTakenException extends RuntimeException {

    public InitialTakenException(char initial) {
        super("L'iniziale " + initial + " è già di un altro membro: scegline un'altra.");
    }
}
```

`application/port/out/Transactions.java`:

```java
package com.fantaagent.application.port.out;

import java.util.function.Supplier;

/**
 * Piu' scritture che valgono tutte o nessuna. Una porta invece di
 * {@code @Transactional}: i servizi sono classi semplici costruite in
 * {@code config}, senza proxy, e il confine della transazione si vede nel codice.
 */
public interface Transactions {

    <T> T inTransaction(Supplier<T> work);

    default void run(Runnable work) {
        inTransaction(() -> {
            work.run();
            return null;
        });
    }
}
```

- [ ] **Step 4: Il servizio**

`application/service/league/NotLeagueMemberException.java`:

```java
package com.fantaagent.application.service.league;

import java.util.UUID;

/**
 * Lega inesistente e lega di cui non si e' membri sono la stessa risposta: un
 * identificativo non deve dire a chi non ne fa parte che la lega esiste.
 */
public class NotLeagueMemberException extends RuntimeException {

    public NotLeagueMemberException(UUID leagueId) {
        super("nessuna lega " + leagueId + " per questo utente");
    }
}
```

`application/service/league/AdminOnlyException.java`:

```java
package com.fantaagent.application.service.league;

public class AdminOnlyException extends RuntimeException {

    public AdminOnlyException() {
        super("Solo l'amministratore della lega può farlo.");
    }
}
```

`application/service/league/InvalidLeagueDataException.java`:

```java
package com.fantaagent.application.service.league;

import java.util.List;
import java.util.Map;

public class InvalidLeagueDataException extends RuntimeException {

    private final Map<String, List<String>> errors;

    public InvalidLeagueDataException(Map<String, List<String>> errors) {
        super("dati della lega non validi: " + errors.keySet());
        this.errors = Map.copyOf(errors);
    }

    public Map<String, List<String>> errors() {
        return errors;
    }
}
```

`application/service/league/LeagueAccess.java`:

```java
package com.fantaagent.application.service.league;

import com.fantaagent.application.port.out.League;
import com.fantaagent.application.port.out.LeagueMember;
import com.fantaagent.application.port.out.MemberRole;

import java.util.UUID;

/**
 * La prova che chi chiede e' membro della lega, con il suo ruolo. Si ottiene solo da
 * {@link LeagueService#access}: un servizio che la riceve come argomento non deve
 * ricontrollare niente, e uno che non la riceve non puo' toccare la lega.
 */
public record LeagueAccess(League league, LeagueMember me) {

    public boolean isAdmin() {
        return me.role() == MemberRole.ADMIN;
    }

    public LeagueAccess requireAdmin() {
        if (!isAdmin()) {
            throw new AdminOnlyException();
        }
        return this;
    }

    public UUID userId() {
        return me.userId();
    }

    public UUID leagueId() {
        return league.id();
    }
}
```

`application/service/league/LeagueService.java`:

```java
package com.fantaagent.application.service.league;

import com.fantaagent.application.port.out.AuctionTemplate;
import com.fantaagent.application.port.out.League;
import com.fantaagent.application.port.out.LeagueMember;
import com.fantaagent.application.port.out.LeagueRepository;
import com.fantaagent.application.port.out.MemberRole;
import com.fantaagent.application.port.out.Transactions;
import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.LeagueRulesSettings;
import com.fantaagent.config.ScoringSettings;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

public class LeagueService {

    static final int MAX_LEAGUE_NAME = 60;
    static final int MAX_TEAM_NAME = 40;

    private final LeagueRepository leagues;
    private final AuctionTemplate template;
    private final Transactions tx;
    private final Clock clock;

    public LeagueService(LeagueRepository leagues, AuctionTemplate template, Transactions tx, Clock clock) {
        this.leagues = leagues;
        this.template = template;
        this.tx = tx;
        this.clock = clock;
    }

    /**
     * La lega nasce coi valori del modello — gli stessi da cui partivano le aste locali
     * — e con chi la crea come amministratore e primo membro. Le due righe insieme o
     * nessuna: una lega senza amministratore non la potrebbe gestire nessuno.
     */
    public LeagueAccess create(UUID userId, String name, String teamName, String initial) {
        String cleanName = name == null ? "" : name.trim();
        Map<String, List<String>> errors = new LinkedHashMap<>();
        if (cleanName.isEmpty()) {
            add(errors, "name", "Dai un nome alla lega.");
        } else if (cleanName.length() > MAX_LEAGUE_NAME) {
            add(errors, "name", "Il nome della lega non può superare " + MAX_LEAGUE_NAME + " caratteri.");
        }
        errors.putAll(memberProblems(teamName, initial));
        if (!errors.isEmpty()) {
            throw new InvalidLeagueDataException(errors);
        }
        Instant now = clock.instant();
        League league = new League(UUID.randomUUID(), cleanName, userId, now,
                template.rules(), template.scoring(), template.bidder());
        LeagueMember admin = new LeagueMember(league.id(), userId, MemberRole.ADMIN,
                teamName.trim(), initialOf(initial), now, null);
        tx.run(() -> {
            leagues.insert(league);
            leagues.insertMember(admin);
        });
        return access(league.id(), userId);
    }

    public List<LeagueAccess> mine(UUID userId) {
        List<LeagueAccess> mine = new ArrayList<>();
        for (LeagueMember membership : leagues.membershipsOf(userId)) {
            leagues.byId(membership.leagueId())
                    .ifPresent(league -> mine.add(new LeagueAccess(league, membership)));
        }
        mine.sort(Comparator.comparing(a -> a.league().name().toLowerCase(Locale.ROOT)));
        return List.copyOf(mine);
    }

    /** @throws NotLeagueMemberException se la lega non esiste o l'utente non ne fa parte */
    public LeagueAccess access(UUID leagueId, UUID userId) {
        League league = leagues.byId(leagueId).orElseThrow(() -> new NotLeagueMemberException(leagueId));
        LeagueMember me = leagues.member(leagueId, userId)
                .orElseThrow(() -> new NotLeagueMemberException(leagueId));
        return new LeagueAccess(league, me);
    }

    public League rename(LeagueAccess access, String name) {
        access.requireAdmin();
        String clean = name == null ? "" : name.trim();
        if (clean.isEmpty() || clean.length() > MAX_LEAGUE_NAME) {
            throw new InvalidLeagueDataException(Map.of("name", List.of(clean.isEmpty()
                    ? "Dai un nome alla lega."
                    : "Il nome della lega non può superare " + MAX_LEAGUE_NAME + " caratteri.")));
        }
        League renamed = access.league().withName(clean);
        leagues.update(renamed);
        return renamed;
    }

    /** Valori gia' validati da chi chiama: i validatori per campo stanno in {@code config}. */
    public League updateDefaults(LeagueAccess access, LeagueRulesSettings rules,
                                 ScoringSettings scoring, AuctionSettings bidder) {
        access.requireAdmin();
        League updated = access.league().withDefaults(rules, scoring, bidder);
        leagues.update(updated);
        return updated;
    }

    public List<LeagueMember> members(LeagueAccess access) {
        return leagues.members(access.leagueId());
    }

    /** Nome della squadra e iniziale: gli stessi controlli per chi crea e per chi entra. */
    public static Map<String, List<String>> memberProblems(String teamName, String initial) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        String team = teamName == null ? "" : teamName.trim();
        if (team.isEmpty()) {
            add(errors, "teamName", "Scrivi il nome della tua squadra.");
        } else if (team.length() > MAX_TEAM_NAME) {
            add(errors, "teamName", "Il nome della squadra non può superare " + MAX_TEAM_NAME + " caratteri.");
        }
        String letter = initial == null ? "" : initial.trim();
        if (letter.length() != 1 || !Character.isLetter(letter.charAt(0))) {
            add(errors, "initial", "L'iniziale deve essere una lettera.");
        }
        return errors;
    }

    public static char initialOf(String initial) {
        return Character.toUpperCase(initial.trim().charAt(0));
    }

    private static void add(Map<String, List<String>> errors, String key, String message) {
        errors.computeIfAbsent(key, k -> new ArrayList<>()).add(message);
    }
}
```

- [ ] **Step 5: Gli adattatori in uscita**

`adapter/out/jdbc/SpringTransactions.java`:

```java
package com.fantaagent.adapter.out.jdbc;

import com.fantaagent.application.port.out.Transactions;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.function.Supplier;

public class SpringTransactions implements Transactions {

    private final TransactionTemplate template;

    public SpringTransactions(TransactionTemplate template) {
        this.template = template;
    }

    @Override
    public <T> T inTransaction(Supplier<T> work) {
        return template.execute(status -> work.get());
    }
}
```

`adapter/out/jdbc/JdbcLeagueRepository.java`:

```java
package com.fantaagent.adapter.out.jdbc;

import com.fantaagent.application.port.out.InitialTakenException;
import com.fantaagent.application.port.out.League;
import com.fantaagent.application.port.out.LeagueMember;
import com.fantaagent.application.port.out.LeagueRepository;
import com.fantaagent.application.port.out.MemberRole;
import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.LeagueRulesSettings;
import com.fantaagent.config.ScoringSettings;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static com.fantaagent.adapter.out.jdbc.Columns.fromJson;
import static com.fantaagent.adapter.out.jdbc.Columns.instant;
import static com.fantaagent.adapter.out.jdbc.Columns.json;
import static com.fantaagent.adapter.out.jdbc.Columns.ts;

public class JdbcLeagueRepository implements LeagueRepository {

    private static final String MEMBER_SELECT = """
            SELECT m.league_id, m.user_id, m.role, m.team_name, m.initial, m.joined_at, u.display_name
            FROM league_member m JOIN app_user u ON u.id = m.user_id
            """;

    private final JdbcClient jdbc;
    private final ObjectMapper mapper;

    public JdbcLeagueRepository(JdbcClient jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    @Override
    public void insert(League l) {
        jdbc.sql("""
                        INSERT INTO league (id, name, created_by, created_at, rules, scoring, bidder)
                        VALUES (:id, :name, :by, :at, CAST(:rules AS jsonb), CAST(:scoring AS jsonb),
                                CAST(:bidder AS jsonb))
                        """)
                .param("id", l.id()).param("name", l.name()).param("by", l.createdBy())
                .param("at", ts(l.createdAt())).param("rules", json(mapper, l.rules()))
                .param("scoring", json(mapper, l.scoring())).param("bidder", json(mapper, l.bidder()))
                .update();
    }

    @Override
    public Optional<League> byId(UUID id) {
        return jdbc.sql("SELECT id, name, created_by, created_at, rules, scoring, bidder FROM league WHERE id = :id")
                .param("id", id).query(this::mapLeague).optional();
    }

    @Override
    public void update(League l) {
        jdbc.sql("""
                        UPDATE league SET name = :name, rules = CAST(:rules AS jsonb),
                               scoring = CAST(:scoring AS jsonb), bidder = CAST(:bidder AS jsonb)
                        WHERE id = :id
                        """)
                .param("id", l.id()).param("name", l.name()).param("rules", json(mapper, l.rules()))
                .param("scoring", json(mapper, l.scoring())).param("bidder", json(mapper, l.bidder()))
                .update();
    }

    @Override
    public void insertMember(LeagueMember m) {
        try {
            jdbc.sql("""
                            INSERT INTO league_member (league_id, user_id, role, team_name, initial, joined_at)
                            VALUES (:league, :user, :role, :team, :initial, :at)
                            """)
                    .param("league", m.leagueId()).param("user", m.userId()).param("role", m.role().name())
                    .param("team", m.teamName()).param("initial", String.valueOf(m.initial()))
                    .param("at", ts(m.joinedAt()))
                    .update();
        } catch (DuplicateKeyException e) {
            if (String.valueOf(e.getMessage()).contains("league_member_initial_key")) {
                throw new InitialTakenException(m.initial());
            }
            throw e;
        }
    }

    @Override
    public Optional<LeagueMember> member(UUID leagueId, UUID userId) {
        return jdbc.sql(MEMBER_SELECT + " WHERE m.league_id = :league AND m.user_id = :user")
                .param("league", leagueId).param("user", userId)
                .query(JdbcLeagueRepository::mapMember).optional();
    }

    @Override
    public List<LeagueMember> members(UUID leagueId) {
        return jdbc.sql(MEMBER_SELECT + " WHERE m.league_id = :league ORDER BY m.joined_at, u.display_name")
                .param("league", leagueId).query(JdbcLeagueRepository::mapMember).list();
    }

    @Override
    public List<LeagueMember> membershipsOf(UUID userId) {
        return jdbc.sql(MEMBER_SELECT + " WHERE m.user_id = :user")
                .param("user", userId).query(JdbcLeagueRepository::mapMember).list();
    }

    @Override
    public void deleteMember(UUID leagueId, UUID userId) {
        jdbc.sql("DELETE FROM league_member WHERE league_id = :league AND user_id = :user")
                .param("league", leagueId).param("user", userId).update();
    }

    private League mapLeague(ResultSet rs, int row) throws SQLException {
        return new League(rs.getObject("id", UUID.class), rs.getString("name"),
                rs.getObject("created_by", UUID.class), instant(rs.getTimestamp("created_at")),
                fromJson(mapper, rs.getString("rules"), LeagueRulesSettings.class),
                fromJson(mapper, rs.getString("scoring"), ScoringSettings.class),
                fromJson(mapper, rs.getString("bidder"), AuctionSettings.class));
    }

    private static LeagueMember mapMember(ResultSet rs, int row) throws SQLException {
        return new LeagueMember(rs.getObject("league_id", UUID.class), rs.getObject("user_id", UUID.class),
                MemberRole.valueOf(rs.getString("role")), rs.getString("team_name"),
                rs.getString("initial").charAt(0), instant(rs.getTimestamp("joined_at")),
                rs.getString("display_name"));
    }
}
```

Se la lettura di `ScoringSettings` da JSON fallisce (Jackson serializza anche eventuali metodi `isX()`/`getX()` del record come proprietà in più, che poi non sa rileggere), aggiungere `@JsonIgnoreProperties(ignoreUnknown = true)` **all'ObjectMapper usato dai repository**, non ai record di `config`: in `PersistenceConfig` si passa `objectMapper.copy().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)`. `leRegoleDellaLegaSiRileggonoIdentiche` è il test che lo verifica.

- [ ] **Step 6: Le conversioni delle impostazioni**

In `adapter/in/api/dto/SettingsDtos.java`, spostare qui le conversioni che oggi sono metodi privati di `SettingsApi` (`sectionOf`, `settingsOf`, `rolesOf`), così che anche `LeagueSettingsApi` le usi:

```java
    public record ScoringSection(boolean defenceModifierEnabled, int defendersCounted,
                                 List<ScoringStep> thresholds, Map<Role, Double> goalBonus,
                                 double assist, double penaltyScored, double penaltyMissed,
                                 double penaltySaved, double yellowCard, double redCard,
                                 double goalConceded, double cleanSheet, boolean confirmed) {

        public static ScoringSection of(ScoringSettings s) {
            return new ScoringSection(s.defenceModifierEnabled(), s.defendersCounted(),
                    s.thresholds().stream().map(t -> new ScoringStep(t.minAverage(), t.bonus())).toList(),
                    s.goalBonus(), s.assist(), s.penaltyScored(), s.penaltyMissed(),
                    s.penaltySaved(), s.yellowCard(), s.redCard(), s.goalConceded(),
                    s.cleanSheet(), s.confirmed());
        }

        public ScoringSettings toSettings() {
            return new ScoringSettings(defenceModifierEnabled, defendersCounted,
                    thresholds.stream().map(t -> new ScoringSettings.Step(t.minAverage(), t.bonus())).toList(),
                    goalBonus, assist, penaltyScored, penaltyMissed, penaltySaved, yellowCard, redCard,
                    goalConceded, cleanSheet, confirmed);
        }
    }
```

e in `RulesSection`:

```java
    public record RulesSection(int budget, Map<Role, Integer> slots) {

        /** Una mappa assente o con un ruolo mancante diventa un ruolo a zero, che il validatore nomina. */
        public static Map<Role, Integer> rolesOf(Map<Role, Integer> slots) {
            Map<Role, Integer> out = new EnumMap<>(Role.class);
            for (Role role : Role.values()) {
                out.put(role, slots == null ? 0 : slots.getOrDefault(role, 0));
            }
            return out;
        }
    }
```

(import `com.fantaagent.config.ScoringSettings`, `java.util.EnumMap`). In `SettingsApi` sostituire le chiamate: `sectionOf(x)` → `SettingsDtos.ScoringSection.of(x)`, `settingsOf(body.scoring())` → `body.scoring().toSettings()`, `rolesOf(...)` → `SettingsDtos.RulesSection.rolesOf(...)`, e cancellare i tre metodi privati. Nessun altro cambiamento a `SettingsApi`.

- [ ] **Step 7: Accesso dall'API, controller, problemi**

`adapter/in/api/ApiAccess.java`:

```java
package com.fantaagent.adapter.in.api;

import com.fantaagent.adapter.in.security.AppUserPrincipal;
import com.fantaagent.application.service.league.LeagueAccess;
import com.fantaagent.application.service.league.LeagueService;
import com.fantaagent.application.service.league.NotLeagueMemberException;
import org.springframework.stereotype.Component;

import java.util.UUID;
import java.util.function.Supplier;

/**
 * Da un segmento dell'URL e da chi ha fatto l'accesso, cio' che un controller puo'
 * toccare. Ogni endpoint sotto una lega passa da qui per primo: e' il punto in cui
 * "chi sei" diventa "cosa puoi vedere", e non ce n'e' un secondo.
 */
@Component
public class ApiAccess {

    private final LeagueService leagues;

    public ApiAccess(LeagueService leagues) {
        this.leagues = leagues;
    }

    public LeagueAccess league(String leagueId, AppUserPrincipal me) {
        return leagues.access(parseOr404(leagueId, () -> new NotLeagueMemberException(null)), me.id());
    }

    public LeagueAccess admin(String leagueId, AppUserPrincipal me) {
        return league(leagueId, me).requireAdmin();
    }

    /** Un id che non e' nemmeno un UUID e' un indirizzo che non porta da nessuna parte: 404. */
    public static UUID parseOr404(String raw, Supplier<RuntimeException> notFound) {
        try {
            return UUID.fromString(raw);
        } catch (IllegalArgumentException e) {
            throw notFound.get();
        }
    }
}
```

`adapter/in/api/league/LeagueDtos.java`:

```java
package com.fantaagent.adapter.in.api.league;

import com.fantaagent.adapter.in.api.dto.SettingsDtos;
import com.fantaagent.application.port.out.LeagueMember;
import com.fantaagent.application.port.out.MemberRole;
import com.fantaagent.application.service.league.LeagueAccess;

import java.util.List;
import java.util.UUID;

public final class LeagueDtos {

    private LeagueDtos() {
    }

    public record CreateLeagueRequest(String name, String teamName, String initial) {
    }

    public record RenameRequest(String name) {
    }

    public record LeagueCard(String id, String name, boolean admin, String teamName, String initial) {

        public static LeagueCard of(LeagueAccess a) {
            return new LeagueCard(a.leagueId().toString(), a.league().name(), a.isAdmin(),
                    a.me().teamName(), String.valueOf(a.me().initial()));
        }
    }

    public record MemberView(String userId, String displayName, String teamName, String initial,
                             MemberRole role, boolean me) {

        public static MemberView of(LeagueMember m, UUID viewer) {
            return new MemberView(m.userId().toString(), m.displayName(), m.teamName(),
                    String.valueOf(m.initial()), m.role(), m.userId().equals(viewer));
        }
    }

    public record LeagueDetail(String id, String name, boolean admin, List<MemberView> members) {

        public static LeagueDetail of(LeagueAccess a, List<LeagueMember> members) {
            return new LeagueDetail(a.leagueId().toString(), a.league().name(), a.isAdmin(),
                    members.stream().map(m -> MemberView.of(m, a.userId())).toList());
        }
    }

    public record LeagueRulesResponse(SettingsDtos.BidderSettings bidder,
                                      SettingsDtos.ScoringSection scoring,
                                      SettingsDtos.RulesSection rules,
                                      boolean canEdit) {
    }

    public record SaveLeagueRulesRequest(SettingsDtos.BidderSettings bidder,
                                         SettingsDtos.ScoringSection scoring,
                                         SettingsDtos.RulesSection rules) {
    }
}
```

`adapter/in/api/league/LeagueApi.java`:

```java
package com.fantaagent.adapter.in.api.league;

import com.fantaagent.adapter.in.api.ApiAccess;
import com.fantaagent.adapter.in.security.AppUserPrincipal;
import com.fantaagent.application.service.league.LeagueAccess;
import com.fantaagent.application.service.league.LeagueService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/leagues")
public class LeagueApi {

    private final ApiAccess access;
    private final LeagueService leagues;

    public LeagueApi(ApiAccess access, LeagueService leagues) {
        this.access = access;
        this.leagues = leagues;
    }

    @GetMapping
    public List<LeagueDtos.LeagueCard> mine(@AuthenticationPrincipal AppUserPrincipal me) {
        return leagues.mine(me.id()).stream().map(LeagueDtos.LeagueCard::of).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public LeagueDtos.LeagueDetail create(@AuthenticationPrincipal AppUserPrincipal me,
                                          @RequestBody LeagueDtos.CreateLeagueRequest body) {
        LeagueAccess created = leagues.create(me.id(), body.name(), body.teamName(), body.initial());
        return LeagueDtos.LeagueDetail.of(created, leagues.members(created));
    }

    @GetMapping("/{leagueId}")
    public LeagueDtos.LeagueDetail read(@AuthenticationPrincipal AppUserPrincipal me,
                                        @PathVariable String leagueId) {
        LeagueAccess league = access.league(leagueId, me);
        return LeagueDtos.LeagueDetail.of(league, leagues.members(league));
    }

    @PatchMapping("/{leagueId}")
    public LeagueDtos.LeagueDetail rename(@AuthenticationPrincipal AppUserPrincipal me,
                                          @PathVariable String leagueId,
                                          @RequestBody LeagueDtos.RenameRequest body) {
        LeagueAccess league = access.admin(leagueId, me);
        leagues.rename(league, body.name());
        LeagueAccess reread = access.league(leagueId, me);
        return LeagueDtos.LeagueDetail.of(reread, leagues.members(reread));
    }

    @GetMapping("/{leagueId}/members")
    public List<LeagueDtos.MemberView> members(@AuthenticationPrincipal AppUserPrincipal me,
                                               @PathVariable String leagueId) {
        LeagueAccess league = access.league(leagueId, me);
        return leagues.members(league).stream()
                .map(m -> LeagueDtos.MemberView.of(m, me.id())).toList();
    }
}
```

`adapter/in/api/league/LeagueSettingsApi.java`:

```java
package com.fantaagent.adapter.in.api.league;

import com.fantaagent.adapter.in.api.ApiAccess;
import com.fantaagent.adapter.in.api.InvalidSettingsException;
import com.fantaagent.adapter.in.api.dto.SettingsDtos;
import com.fantaagent.adapter.in.security.AppUserPrincipal;
import com.fantaagent.application.port.out.League;
import com.fantaagent.application.service.league.LeagueAccess;
import com.fantaagent.application.service.league.LeagueService;
import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.AuctionSettingsValidator;
import com.fantaagent.config.LeagueRulesSettings;
import com.fantaagent.config.LeagueRulesValidator;
import com.fantaagent.config.ScoringSettings;
import com.fantaagent.config.ScoringSettingsValidator;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Le regole con cui nasceranno le prossime aste della lega. Si leggono da membri, si
 * cambiano da amministratori; le aste gia' create hanno le loro, fotografate alla
 * nascita, e da qui non si toccano.
 */
@RestController
@RequestMapping("/api/leagues/{leagueId}/rules")
public class LeagueSettingsApi {

    private final ApiAccess access;
    private final LeagueService leagues;

    public LeagueSettingsApi(ApiAccess access, LeagueService leagues) {
        this.access = access;
        this.leagues = leagues;
    }

    @GetMapping
    public LeagueDtos.LeagueRulesResponse read(@AuthenticationPrincipal AppUserPrincipal me,
                                               @PathVariable String leagueId) {
        LeagueAccess league = access.league(leagueId, me);
        return response(league.league(), league.isAdmin());
    }

    @PutMapping
    public LeagueDtos.LeagueRulesResponse save(@AuthenticationPrincipal AppUserPrincipal me,
                                               @PathVariable String leagueId,
                                               @RequestBody LeagueDtos.SaveLeagueRulesRequest body) {
        LeagueAccess league = access.admin(leagueId, me);
        Map<String, List<String>> errors = new LinkedHashMap<>();
        if (body.bidder() == null) {
            add(errors, "bidder", "Le preferenze del banditore sono obbligatorie.");
        }
        if (body.scoring() == null) {
            add(errors, "scoring", "Le impostazioni del punteggio sono obbligatorie.");
        }
        if (body.rules() == null) {
            add(errors, "rules", "Le regole della lega sono obbligatorie.");
        }
        if (!errors.isEmpty()) {
            throw new InvalidSettingsException(errors);
        }
        AuctionSettings bidder = new AuctionSettings(body.bidder().bidTimerSeconds(), body.bidder().beepEnabled());
        ScoringSettings scoring = body.scoring().toSettings();
        LeagueRulesSettings rules = new LeagueRulesSettings(body.rules().budget(),
                SettingsDtos.RulesSection.rolesOf(body.rules().slots()));
        merge(errors, AuctionSettingsValidator.validateByField(bidder));
        merge(errors, ScoringSettingsValidator.validateByField(scoring));
        // Il numero di squadre non e' della lega: e' quanti membri partecipano a
        // ciascuna asta. Qui si passa il minimo perche' il validatore non lo contesti.
        merge(errors, LeagueRulesValidator.validateByField(rules, LeagueRulesValidator.MIN_PARTICIPANTS));
        if (!errors.isEmpty()) {
            throw new InvalidSettingsException(errors);
        }
        return response(leagues.updateDefaults(league, rules, scoring, bidder), true);
    }

    private static LeagueDtos.LeagueRulesResponse response(League league, boolean canEdit) {
        return new LeagueDtos.LeagueRulesResponse(
                new SettingsDtos.BidderSettings(league.bidder().bidTimerSeconds(), league.bidder().beepEnabled()),
                SettingsDtos.ScoringSection.of(league.scoring()),
                new SettingsDtos.RulesSection(league.rules().budget(), league.rules().slots()),
                canEdit);
    }

    private static void add(Map<String, List<String>> errors, String key, String message) {
        errors.computeIfAbsent(key, k -> new ArrayList<>()).add(message);
    }

    private static void merge(Map<String, List<String>> errors, Map<String, List<String>> more) {
        more.forEach((k, v) -> errors.computeIfAbsent(k, x -> new ArrayList<>()).addAll(v));
    }
}
```

`config/PersistenceConfig.java`:

```java
package com.fantaagent.config;

import com.fantaagent.adapter.out.jdbc.JdbcAuctionEventStores;
import com.fantaagent.adapter.out.jdbc.JdbcLeagueRepository;
import com.fantaagent.adapter.out.jdbc.SpringTransactions;
import com.fantaagent.application.port.out.AuctionEventStores;
import com.fantaagent.application.port.out.LeagueRepository;
import com.fantaagent.application.port.out.Transactions;
import com.fantaagent.application.service.league.LeagueService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;

@Configuration
public class PersistenceConfig {

    @Bean
    public Transactions transactions(TransactionTemplate template) {
        return new SpringTransactions(template);
    }

    @Bean
    public AuctionEventStores auctionEventStores(JdbcClient jdbc, ObjectMapper json) {
        return new JdbcAuctionEventStores(jdbc, json);
    }

    @Bean
    public LeagueRepository leagueRepository(JdbcClient jdbc, ObjectMapper json) {
        return new JdbcLeagueRepository(jdbc, json);
    }

    @Bean
    public LeagueService leagueService(LeagueRepository leagues, ConfigAuctionTemplate template,
                                       Transactions tx, Clock clock) {
        return new LeagueService(leagues, template, tx, clock);
    }
}
```

In `ApiExceptionHandler`, prima di `unexpected`:

```java
    @ExceptionHandler(NotLeagueMemberException.class)
    ProblemDetail notMember(NotLeagueMemberException e) {
        return problem(HttpStatus.NOT_FOUND, "unknown-league", "Lega non trovata.");
    }

    @ExceptionHandler(AdminOnlyException.class)
    ProblemDetail adminOnly(AdminOnlyException e) {
        return problem(HttpStatus.FORBIDDEN, "admin-only", e.getMessage());
    }

    @ExceptionHandler(InvalidLeagueDataException.class)
    ProblemDetail invalidLeague(InvalidLeagueDataException e) {
        ProblemDetail problem = problem(HttpStatus.UNPROCESSABLE_ENTITY, "invalid-league",
                "Alcuni dati non sono validi.");
        problem.setProperty("errors", e.errors());
        return problem;
    }

    @ExceptionHandler(InitialTakenException.class)
    ProblemDetail initialTaken(InitialTakenException e) {
        return problem(HttpStatus.CONFLICT, "initial-taken", e.getMessage());
    }
```

- [ ] **Step 8: Eseguire i test e vederli passare**

Run: `mvn -q test -Dtest='LeagueServiceTest,LeagueApiTest'`
Expected: PASS.

- [ ] **Step 9: Mutazione**

In `LeagueService.access` sostituire temporaneamente il controllo del membro con un `LeagueMember` finto costruito dall'utente che chiede: `chiNonEMembroRiceve404NonUn403` e `chiNonEMembroNonVedeLaLega` devono fallire. Ripristinare.

- [ ] **Step 10: L'intera suite e commit**

Run: `mvn -q test` — PASS.

```bash
git add src/main/java src/test/java
git commit -m "Leghe: chi crea e' amministratore, chi non e' membro riceve 404

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Inviti

**Files:**
- Create: `application/port/out/Invite.java`, `InviteRepository.java`
- Create: `application/service/league/InviteService.java`, `InvitePreview.java`, `CreatedInvite.java`, `InviteUnavailableException.java`
- Create: `adapter/out/jdbc/JdbcInviteRepository.java`
- Create: `adapter/in/api/league/InviteApi.java`
- Modify: `adapter/in/api/league/LeagueDtos.java`, `adapter/in/api/ApiExceptionHandler.java`, `config/PersistenceConfig.java`
- Test: `src/test/java/com/fantaagent/application/service/league/InviteServiceTest.java`, `src/test/java/com/fantaagent/adapter/in/api/league/InviteApiTest.java`

**Interfaces:**
- Consumes: `LeagueService.memberProblems`, `LeagueService.initialOf`, `LeagueAccess`, `Tokens`, `UserRepository`.
- Produces:
  - `record Invite(UUID id, UUID leagueId, String tokenHash, UUID createdBy, Instant createdAt, Instant expiresAt, Instant revokedAt)` con `boolean usableAt(Instant)`.
  - `interface InviteRepository { void insert(Invite); Optional<Invite> byHash(String); List<Invite> byLeague(UUID leagueId); boolean revoke(UUID leagueId, UUID inviteId, Instant at); }`
  - `InviteService(InviteRepository, LeagueRepository, UserRepository, Clock, String publicUrl)` con `CreatedInvite create(LeagueAccess)`, `List<Invite> active(LeagueAccess)`, `void revoke(LeagueAccess, UUID inviteId)`, `InvitePreview preview(String token, UUID viewerOrNull)`, `UUID accept(String token, UUID userId, String teamName, String initial)` (torna il `leagueId`).
  - `record InvitePreview(UUID leagueId, String leagueName, String invitedBy, boolean alreadyMember, List<String> takenInitials)`; `record CreatedInvite(Invite invite, String link)`; `InviteUnavailableException()` → 410 `invite-unavailable`.
  - Rotte: `POST /api/leagues/{leagueId}/invites` (201 `{id, link, expiresAt}`), `GET /api/leagues/{leagueId}/invites`, `DELETE /api/leagues/{leagueId}/invites/{inviteId}` (204), `GET /api/invites/{token}` (pubblica), `POST /api/invites/{token}/accept` (201 `LeagueCard`).
  - DTO: `InviteView(String id, Instant createdAt, Instant expiresAt)`, `CreatedInviteView(String id, String link, Instant expiresAt)`, `InvitePreviewView(String leagueId, String leagueName, String invitedBy, boolean alreadyMember, List<String> takenInitials)`, `AcceptInviteRequest(String teamName, String initial)`.

Il link si vede una volta sola, alla creazione: il database ne conserva l'hash. Un amministratore che l'ha perso ne crea uno nuovo, e ritira il vecchio se teme che sia finito nelle mani sbagliate.

- [ ] **Step 1: Scrivere i test che falliscono**

`src/test/java/com/fantaagent/application/service/league/InviteServiceTest.java`:

```java
package com.fantaagent.application.service.league;

import com.fantaagent.adapter.out.jdbc.JdbcInviteRepository;
import com.fantaagent.adapter.out.jdbc.JdbcLeagueRepository;
import com.fantaagent.adapter.out.jdbc.JdbcUserRepository;
import com.fantaagent.adapter.out.jdbc.SpringTransactions;
import com.fantaagent.application.port.out.InitialTakenException;
import com.fantaagent.testsupport.Fixtures;
import com.fantaagent.testsupport.MutableClock;
import com.fantaagent.testsupport.SharedPostgres;
import com.fantaagent.testsupport.TestRows;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class InviteServiceTest {

    private static final ObjectMapper JSON = JsonMapper.builder().addModule(new JavaTimeModule()).build();

    private MutableClock clock;
    private LeagueService leagues;
    private InviteService invites;
    private LeagueAccess admin;
    private UUID bruno;

    @BeforeEach
    void setUp() {
        DataSource ds = SharedPostgres.migratedDatabase();
        JdbcClient jdbc = JdbcClient.create(ds);
        clock = new MutableClock(Instant.parse("2026-09-28T20:00:00Z"));
        JdbcLeagueRepository leagueRepository = new JdbcLeagueRepository(jdbc, JSON);
        leagues = new LeagueService(leagueRepository, Fixtures.template(),
                new SpringTransactions(new TransactionTemplate(new DataSourceTransactionManager(ds))), clock);
        invites = new InviteService(new JdbcInviteRepository(jdbc), leagueRepository,
                new JdbcUserRepository(jdbc), clock, "https://fanta.example");
        admin = leagues.create(TestRows.user(jdbc, "anna@example.com"), "Lega del Bar", "Anna FC", "A");
        bruno = TestRows.user(jdbc, "bruno@example.com");
    }

    private static String tokenOf(CreatedInvite created) {
        return created.link().substring(created.link().lastIndexOf('/') + 1);
    }

    @Test
    void ilLinkPortaAllInvito() {
        CreatedInvite created = invites.create(admin);
        assertThat(created.link()).startsWith("https://fanta.example/invito/");
        assertThat(created.invite().expiresAt()).isEqualTo(clock.instant().plus(Duration.ofDays(14)));
    }

    @Test
    void chiApreIlLinkVedeLaLegaEChiInvita() {
        InvitePreview preview = invites.preview(tokenOf(invites.create(admin)), null);
        assertThat(preview.leagueName()).isEqualTo("Lega del Bar");
        assertThat(preview.invitedBy()).isEqualTo("anna");
        assertThat(preview.alreadyMember()).isFalse();
        assertThat(preview.takenInitials()).containsExactly("A");
    }

    @Test
    void accettareFaEntrareNellaLega() {
        String token = tokenOf(invites.create(admin));
        UUID leagueId = invites.accept(token, bruno, "Bruno FC", "b");

        LeagueAccess access = leagues.access(leagueId, bruno);
        assertThat(access.isAdmin()).isFalse();
        assertThat(access.me().initial()).isEqualTo('B');
    }

    @Test
    void ilLinkSiRiusaFinoAllaScadenza() {
        String token = tokenOf(invites.create(admin));
        invites.accept(token, bruno, "Bruno FC", "B");
        clock.advance(Duration.ofDays(13));
        assertThat(invites.preview(token, null).leagueName()).isEqualTo("Lega del Bar");
        clock.advance(Duration.ofDays(2));
        assertThatThrownBy(() -> invites.preview(token, null)).isInstanceOf(InviteUnavailableException.class);
    }

    @Test
    void unInvitoRitiratoNonVale() {
        CreatedInvite created = invites.create(admin);
        invites.revoke(admin, created.invite().id());
        assertThatThrownBy(() -> invites.accept(tokenOf(created), bruno, "Bruno FC", "B"))
                .isInstanceOf(InviteUnavailableException.class);
        assertThat(invites.active(admin)).isEmpty();
    }

    @Test
    void chiEGiaMembroRestaComEra() {
        String token = tokenOf(invites.create(admin));
        UUID leagueId = invites.accept(token, admin.userId(), "Altro nome", "Z");
        assertThat(leagues.access(leagueId, admin.userId()).me().teamName()).isEqualTo("Anna FC");
        assertThat(invites.preview(token, admin.userId()).alreadyMember()).isTrue();
    }

    @Test
    void lInizialeGiaPresaNonSiPrende() {
        String token = tokenOf(invites.create(admin));
        assertThatThrownBy(() -> invites.accept(token, bruno, "Bruno FC", "A"))
                .isInstanceOf(InitialTakenException.class);
    }

    @Test
    void soloLAmministratoreInvita() {
        String token = tokenOf(invites.create(admin));
        UUID leagueId = invites.accept(token, bruno, "Bruno FC", "B");
        LeagueAccess member = leagues.access(leagueId, bruno);
        assertThatThrownBy(() -> invites.create(member)).isInstanceOf(AdminOnlyException.class);
    }

    @Test
    void unTokenInventatoNonVale() {
        assertThatThrownBy(() -> invites.preview("inventato", null)).isInstanceOf(InviteUnavailableException.class);
    }
}
```

`src/test/java/com/fantaagent/adapter/in/api/league/InviteApiTest.java`:

```java
package com.fantaagent.adapter.in.api.league;

import com.fantaagent.testsupport.ApiFixture;
import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.context.WebApplicationContext;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("dev")
class InviteApiTest {

    static final String PROBLEMS = "https://fantaagent.local/problems/";

    @Autowired
    private WebApplicationContext context;

    private MockMvc mvc;
    private Cookie anna;
    private Cookie bruno;
    private String leagueId;

    @BeforeEach
    void setUp() throws Exception {
        mvc = ApiFixture.mvc(context);
        anna = ApiFixture.register(mvc, ApiFixture.uniqueEmail("anna"), "Anna");
        bruno = ApiFixture.register(mvc, ApiFixture.uniqueEmail("bruno"), "Bruno");
        String body = mvc.perform(post("/api/leagues").with(csrf()).cookie(anna)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Lega del Bar\",\"teamName\":\"Anna FC\",\"initial\":\"A\"}"))
                .andReturn().getResponse().getContentAsString();
        leagueId = JsonPath.read(body, "$.id");
    }

    private String createInvite() throws Exception {
        String body = mvc.perform(post("/api/leagues/" + leagueId + "/invites").with(csrf()).cookie(anna))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String link = JsonPath.read(body, "$.link");
        return link.substring(link.lastIndexOf('/') + 1);
    }

    @Test
    void lInvitoSiLeggeSenzaAccesso() throws Exception {
        String token = createInvite();
        mvc.perform(get("/api/invites/" + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.leagueName").value("Lega del Bar"))
                .andExpect(jsonPath("$.invitedBy").value("Anna"))
                .andExpect(jsonPath("$.alreadyMember").value(false));
    }

    @Test
    void accettareServeLAccessoEFaEntrare() throws Exception {
        String token = createInvite();
        mvc.perform(post("/api/invites/" + token + "/accept").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"teamName\":\"Bruno FC\",\"initial\":\"B\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/invites/" + token + "/accept").with(csrf()).cookie(bruno)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"teamName\":\"Bruno FC\",\"initial\":\"B\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(leagueId))
                .andExpect(jsonPath("$.admin").value(false));
        mvc.perform(get("/api/leagues/" + leagueId).cookie(bruno)).andExpect(status().isOk());
    }

    @Test
    void unMembroNonAmministratoreRiceve403() throws Exception {
        String token = createInvite();
        mvc.perform(post("/api/invites/" + token + "/accept").with(csrf()).cookie(bruno)
                .contentType(MediaType.APPLICATION_JSON).content("{\"teamName\":\"Bruno FC\",\"initial\":\"B\"}"));

        mvc.perform(post("/api/leagues/" + leagueId + "/invites").with(csrf()).cookie(bruno))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "admin-only"));
        mvc.perform(patch("/api/leagues/" + leagueId).with(csrf()).cookie(bruno)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Mia\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/leagues/" + leagueId + "/invites").cookie(bruno))
                .andExpect(status().isForbidden());
    }

    @Test
    void unInvitoRitiratoRisponde410() throws Exception {
        String body = mvc.perform(post("/api/leagues/" + leagueId + "/invites").with(csrf()).cookie(anna))
                .andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(body, "$.id");
        String link = JsonPath.read(body, "$.link");
        mvc.perform(delete("/api/leagues/" + leagueId + "/invites/" + id).with(csrf()).cookie(anna))
                .andExpect(status().isNoContent());

        mvc.perform(get("/api/invites/" + link.substring(link.lastIndexOf('/') + 1)))
                .andExpect(status().isGone())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "invite-unavailable"));
    }

    @Test
    void lElencoDegliInvitiNonMostraIlLink() throws Exception {
        createInvite();
        mvc.perform(get("/api/leagues/" + leagueId + "/invites").cookie(anna))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").exists())
                .andExpect(jsonPath("$[0].link").doesNotExist());
    }
}
```

- [ ] **Step 2: Eseguire i test e vederli fallire**

Run: `mvn -q test -Dtest='InviteServiceTest,InviteApiTest'`
Expected: FAIL di compilazione.

- [ ] **Step 3: Porte, servizio, adattatore**

`application/port/out/Invite.java`:

```java
package com.fantaagent.application.port.out;

import java.time.Instant;
import java.util.UUID;

public record Invite(UUID id, UUID leagueId, String tokenHash, UUID createdBy, Instant createdAt,
                     Instant expiresAt, Instant revokedAt) {

    public boolean usableAt(Instant now) {
        return revokedAt == null && expiresAt.isAfter(now);
    }
}
```

`application/port/out/InviteRepository.java`:

```java
package com.fantaagent.application.port.out;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface InviteRepository {

    void insert(Invite invite);

    Optional<Invite> byHash(String tokenHash);

    /** Dal piu' recente. */
    List<Invite> byLeague(UUID leagueId);

    /** @return false se l'invito non e' di quella lega o era gia' ritirato */
    boolean revoke(UUID leagueId, UUID inviteId, Instant at);
}
```

`application/service/league/InviteUnavailableException.java`:

```java
package com.fantaagent.application.service.league;

/** Invito sconosciuto, scaduto o ritirato: per chi l'ha aperto, la cosa da fare e' la stessa. */
public class InviteUnavailableException extends RuntimeException {

    public InviteUnavailableException() {
        super("Questo invito è scaduto o è stato ritirato: chiedine uno nuovo a chi ti ha invitato.");
    }
}
```

`application/service/league/InvitePreview.java`:

```java
package com.fantaagent.application.service.league;

import java.util.List;
import java.util.UUID;

/**
 * Cio' che vede chi apre un invito, anche senza account. {@code takenInitials} serve
 * al modulo per non proporre un'iniziale gia' presa: e' l'unico dato dei membri che
 * esce, e senza nomi.
 */
public record InvitePreview(UUID leagueId, String leagueName, String invitedBy,
                            boolean alreadyMember, List<String> takenInitials) {
}
```

`application/service/league/CreatedInvite.java`:

```java
package com.fantaagent.application.service.league;

import com.fantaagent.application.port.out.Invite;

/** Il link esiste solo qui, nella risposta alla creazione: dopo, resta l'hash. */
public record CreatedInvite(Invite invite, String link) {
}
```

`application/service/league/InviteService.java`:

```java
package com.fantaagent.application.service.league;

import com.fantaagent.application.port.out.Invite;
import com.fantaagent.application.port.out.InviteRepository;
import com.fantaagent.application.port.out.League;
import com.fantaagent.application.port.out.LeagueMember;
import com.fantaagent.application.port.out.LeagueRepository;
import com.fantaagent.application.port.out.MemberRole;
import com.fantaagent.application.port.out.UserAccount;
import com.fantaagent.application.port.out.UserRepository;
import com.fantaagent.application.service.account.Tokens;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Il link d'invito: riutilizzabile finche' non scade o non viene ritirato, cosi' che
 * l'amministratore lo mandi una volta nel gruppo e basti per tutti.
 */
public class InviteService {

    static final Duration TTL = Duration.ofDays(14);

    private final InviteRepository invites;
    private final LeagueRepository leagues;
    private final UserRepository users;
    private final Clock clock;
    private final String publicUrl;

    public InviteService(InviteRepository invites, LeagueRepository leagues, UserRepository users,
                         Clock clock, String publicUrl) {
        this.invites = invites;
        this.leagues = leagues;
        this.users = users;
        this.clock = clock;
        this.publicUrl = publicUrl.endsWith("/") ? publicUrl.substring(0, publicUrl.length() - 1) : publicUrl;
    }

    public CreatedInvite create(LeagueAccess access) {
        access.requireAdmin();
        String token = Tokens.generate();
        Instant now = clock.instant();
        Invite invite = new Invite(UUID.randomUUID(), access.leagueId(), Tokens.hash(token),
                access.userId(), now, now.plus(TTL), null);
        invites.insert(invite);
        return new CreatedInvite(invite, publicUrl + "/invito/" + token);
    }

    public List<Invite> active(LeagueAccess access) {
        access.requireAdmin();
        Instant now = clock.instant();
        return invites.byLeague(access.leagueId()).stream().filter(i -> i.usableAt(now)).toList();
    }

    /** Ritirare un invito gia' ritirato, o di un'altra lega, non fa niente e non e' un errore. */
    public void revoke(LeagueAccess access, UUID inviteId) {
        access.requireAdmin();
        invites.revoke(access.leagueId(), inviteId, clock.instant());
    }

    /** @param viewer chi apre il link, o null se non ha fatto l'accesso */
    public InvitePreview preview(String token, UUID viewer) {
        Invite invite = usable(token);
        League league = leagues.byId(invite.leagueId()).orElseThrow(InviteUnavailableException::new);
        String invitedBy = users.byId(invite.createdBy()).map(UserAccount::displayName).orElse("");
        List<LeagueMember> members = leagues.members(league.id());
        boolean member = viewer != null && members.stream().anyMatch(m -> m.userId().equals(viewer));
        return new InvitePreview(league.id(), league.name(), invitedBy, member,
                members.stream().map(m -> String.valueOf(m.initial())).toList());
    }

    /**
     * Chi e' gia' membro resta com'era: aprire di nuovo il link del gruppo non deve
     * cambiare la squadra di nessuno.
     *
     * @return la lega in cui si e' entrati
     */
    public UUID accept(String token, UUID userId, String teamName, String initial) {
        Invite invite = usable(token);
        if (leagues.member(invite.leagueId(), userId).isPresent()) {
            return invite.leagueId();
        }
        Map<String, List<String>> problems = LeagueService.memberProblems(teamName, initial);
        if (!problems.isEmpty()) {
            throw new InvalidLeagueDataException(problems);
        }
        leagues.insertMember(new LeagueMember(invite.leagueId(), userId, MemberRole.MEMBER,
                teamName.trim(), LeagueService.initialOf(initial), clock.instant(), null));
        return invite.leagueId();
    }

    private Invite usable(String token) {
        Instant now = clock.instant();
        return invites.byHash(Tokens.hash(token == null ? "" : token))
                .filter(i -> i.usableAt(now))
                .orElseThrow(InviteUnavailableException::new);
    }
}
```

`adapter/out/jdbc/JdbcInviteRepository.java`:

```java
package com.fantaagent.adapter.out.jdbc;

import com.fantaagent.application.port.out.Invite;
import com.fantaagent.application.port.out.InviteRepository;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static com.fantaagent.adapter.out.jdbc.Columns.instant;
import static com.fantaagent.adapter.out.jdbc.Columns.ts;

public class JdbcInviteRepository implements InviteRepository {

    private static final String COLUMNS =
            "id, league_id, token_hash, created_by, created_at, expires_at, revoked_at";

    private final JdbcClient jdbc;

    public JdbcInviteRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void insert(Invite i) {
        jdbc.sql("INSERT INTO league_invite (" + COLUMNS + ") VALUES (:id, :league, :hash, :by, :at, :exp, :rev)")
                .param("id", i.id()).param("league", i.leagueId()).param("hash", i.tokenHash())
                .param("by", i.createdBy()).param("at", ts(i.createdAt())).param("exp", ts(i.expiresAt()))
                .param("rev", ts(i.revokedAt()))
                .update();
    }

    @Override
    public Optional<Invite> byHash(String tokenHash) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM league_invite WHERE token_hash = :hash")
                .param("hash", tokenHash).query(JdbcInviteRepository::map).optional();
    }

    @Override
    public List<Invite> byLeague(UUID leagueId) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM league_invite WHERE league_id = :league ORDER BY created_at DESC")
                .param("league", leagueId).query(JdbcInviteRepository::map).list();
    }

    @Override
    public boolean revoke(UUID leagueId, UUID inviteId, Instant at) {
        return jdbc.sql("""
                        UPDATE league_invite SET revoked_at = :at
                        WHERE id = :id AND league_id = :league AND revoked_at IS NULL
                        """)
                .param("at", ts(at)).param("id", inviteId).param("league", leagueId).update() == 1;
    }

    private static Invite map(ResultSet rs, int row) throws SQLException {
        return new Invite(rs.getObject("id", UUID.class), rs.getObject("league_id", UUID.class),
                rs.getString("token_hash"), rs.getObject("created_by", UUID.class),
                instant(rs.getTimestamp("created_at")), instant(rs.getTimestamp("expires_at")),
                instant(rs.getTimestamp("revoked_at")));
    }
}
```

- [ ] **Step 4: API e configurazione**

In `LeagueDtos` aggiungere:

```java
    public record InviteView(String id, java.time.Instant createdAt, java.time.Instant expiresAt) {

        public static InviteView of(com.fantaagent.application.port.out.Invite i) {
            return new InviteView(i.id().toString(), i.createdAt(), i.expiresAt());
        }
    }

    public record CreatedInviteView(String id, String link, java.time.Instant expiresAt) {
    }

    public record InvitePreviewView(String leagueId, String leagueName, String invitedBy,
                                    boolean alreadyMember, List<String> takenInitials) {
    }

    public record AcceptInviteRequest(String teamName, String initial) {
    }
```

`adapter/in/api/league/InviteApi.java`:

```java
package com.fantaagent.adapter.in.api.league;

import com.fantaagent.adapter.in.api.ApiAccess;
import com.fantaagent.adapter.in.security.AppUserPrincipal;
import com.fantaagent.application.service.league.CreatedInvite;
import com.fantaagent.application.service.league.InvitePreview;
import com.fantaagent.application.service.league.InviteService;
import com.fantaagent.application.service.league.LeagueService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
public class InviteApi {

    private final ApiAccess access;
    private final InviteService invites;
    private final LeagueService leagues;

    public InviteApi(ApiAccess access, InviteService invites, LeagueService leagues) {
        this.access = access;
        this.invites = invites;
        this.leagues = leagues;
    }

    @PostMapping("/api/leagues/{leagueId}/invites")
    @ResponseStatus(HttpStatus.CREATED)
    public LeagueDtos.CreatedInviteView create(@AuthenticationPrincipal AppUserPrincipal me,
                                               @PathVariable String leagueId) {
        CreatedInvite created = invites.create(access.league(leagueId, me));
        return new LeagueDtos.CreatedInviteView(created.invite().id().toString(), created.link(),
                created.invite().expiresAt());
    }

    @GetMapping("/api/leagues/{leagueId}/invites")
    public List<LeagueDtos.InviteView> active(@AuthenticationPrincipal AppUserPrincipal me,
                                              @PathVariable String leagueId) {
        return invites.active(access.league(leagueId, me)).stream().map(LeagueDtos.InviteView::of).toList();
    }

    @DeleteMapping("/api/leagues/{leagueId}/invites/{inviteId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revoke(@AuthenticationPrincipal AppUserPrincipal me, @PathVariable String leagueId,
                       @PathVariable String inviteId) {
        var league = access.league(leagueId, me);
        UUID id;
        try {
            id = UUID.fromString(inviteId);
        } catch (IllegalArgumentException e) {
            return;
        }
        invites.revoke(league, id);
    }

    /** Pubblica: chi apre il link di solito non ha ancora un account. */
    @GetMapping("/api/invites/{token}")
    public LeagueDtos.InvitePreviewView preview(@AuthenticationPrincipal AppUserPrincipal me,
                                                @PathVariable String token) {
        InvitePreview p = invites.preview(token, me == null ? null : me.id());
        return new LeagueDtos.InvitePreviewView(p.leagueId().toString(), p.leagueName(), p.invitedBy(),
                p.alreadyMember(), p.takenInitials());
    }

    @PostMapping("/api/invites/{token}/accept")
    @ResponseStatus(HttpStatus.CREATED)
    public LeagueDtos.LeagueCard accept(@AuthenticationPrincipal AppUserPrincipal me,
                                        @PathVariable String token,
                                        @RequestBody LeagueDtos.AcceptInviteRequest body) {
        UUID leagueId = invites.accept(token, me.id(), body.teamName(), body.initial());
        return LeagueDtos.LeagueCard.of(leagues.access(leagueId, me.id()));
    }
}
```

Per un anonimo `@AuthenticationPrincipal` vale `null`: il principal è la stringa `anonymousUser`, di tipo diverso, e Spring lo scarta invece di lanciare.

In `PersistenceConfig`:

```java
    @Bean
    public InviteRepository inviteRepository(JdbcClient jdbc) {
        return new JdbcInviteRepository(jdbc);
    }

    @Bean
    public InviteService inviteService(InviteRepository invites, LeagueRepository leagues,
                                       UserRepository users, Clock clock,
                                       @Value("${fantaagent.public-url}") String publicUrl) {
        return new InviteService(invites, leagues, users, clock, publicUrl);
    }
```

In `ApiExceptionHandler`, prima di `unexpected`:

```java
    @ExceptionHandler(InviteUnavailableException.class)
    ProblemDetail inviteUnavailable(InviteUnavailableException e) {
        return problem(HttpStatus.GONE, "invite-unavailable", e.getMessage());
    }
```

- [ ] **Step 5: Eseguire i test e vederli passare**

Run: `mvn -q test -Dtest='InviteServiceTest,InviteApiTest'`
Expected: PASS.

- [ ] **Step 6: Mutazione**

In `InviteService.usable` togliere il filtro `usableAt`: `unInvitoRitiratoNonVale` e `unInvitoRitiratoRisponde410` devono fallire. Ripristinare.

- [ ] **Step 7: Commit**

```bash
git add src/main/java src/test/java
git commit -m "Inviti: un link per il gruppo, valido due settimane, ritirabile

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Leghe e inviti nel browser

**Files:**
- Create: `frontend/src/api/leagues.ts`
- Modify: `frontend/src/api/types.ts`
- Create: `frontend/src/routes/LeaguesRoute.tsx`, `LeagueRoute.tsx`, `InviteRoute.tsx`
- Create: `frontend/src/domain/InitialField.tsx`
- Modify: `frontend/src/router.tsx`, `src/main/java/com/fantaagent/adapter/in/spa/SpaRoutesController.java`, `src/test/java/com/fantaagent/adapter/in/spa/SpaRoutesControllerTest.java`
- Test: `frontend/src/routes/LeaguesRoute.test.tsx`, `LeagueRoute.test.tsx`, `InviteRoute.test.tsx`

**Interfaces:**
- Consumes: rotte dei Task 7 e 8; `api`, `fieldErrors`, `userMessage` (Task 6); `useMe`, `RequireAuth`, `AuthLayout`, `TextField`, `PRIMARY_BUTTON`, `TEXT_LINK`.
- Produces:
  - `types.ts`: `LeagueCard { id; name; admin; teamName; initial }`, `MemberView { userId; displayName; teamName; initial; role: 'ADMIN' | 'MEMBER'; me }`, `LeagueDetail { id; name; admin; members: MemberView[] }`, `InviteView { id; createdAt; expiresAt }`, `CreatedInvite { id; link; expiresAt }`, `InvitePreview { leagueId; leagueName; invitedBy; alreadyMember; takenInitials: string[] }`.
  - `leagues.ts`: `LEAGUE_KEYS`, `useLeagues()`, `useCreateLeague()`, `useLeague(id)`, `useRenameLeague(id)`, `useInvites(id, enabled)`, `useCreateInvite(id)`, `useRevokeInvite(id)`, `useInvitePreview(token)`, `useAcceptInvite(token)`.
  - `InitialField({ id, value, onChange, taken, errors })`.
  - Rotte: `/leghe`, `/leghe/:leagueId`, `/invito/:token` (pubblica).

La home `/` resta quella di oggi fino al Task 17: le aste vivono ancora sul runtime locale. `/leghe` è l'ingresso nuovo; il Task 17 lo sposta sulla radice.

- [ ] **Step 1: Scrivere i test che falliscono**

`frontend/src/routes/LeaguesRoute.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryProvider } from '../api/QueryProvider';
import { LeaguesRoute } from './LeaguesRoute';

const ME = { id: 'u1', email: 'a@b.it', displayName: 'Anna', emailVerified: true };

function respond(routes: Record<string, () => Response>) {
  return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const key = `${(init?.method ?? 'GET').toUpperCase()} ${url}`;
    const handler = routes[key];
    if (!handler) throw new Error(`chiamata inattesa: ${key}`);
    return Promise.resolve(handler());
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function renderLeagues() {
  const router = createMemoryRouter([
    { path: '/leghe', element: <LeaguesRoute /> },
    { path: '/leghe/:leagueId', element: <p>pagina della lega</p> },
  ], { initialEntries: ['/leghe'] });
  render(<QueryProvider><RouterProvider router={router} /></QueryProvider>);
  return router;
}

describe('LeaguesRoute', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('elenca le leghe con la propria squadra', async () => {
    vi.stubGlobal('fetch', respond({
      'GET /api/me': () => json(ME),
      'GET /api/leagues': () => json([
        { id: 'l1', name: 'Lega del Bar', admin: true, teamName: 'Anna FC', initial: 'A' },
      ]),
    }));
    renderLeagues();

    const link = await screen.findByRole('link', { name: /Lega del Bar/ });
    expect(link).toHaveAttribute('href', '/leghe/l1');
    expect(link).toHaveTextContent('Anna FC');
    expect(link).toHaveTextContent('Amministratore');
  });

  it('crea una lega e ci entra', async () => {
    vi.stubGlobal('fetch', respond({
      'GET /api/me': () => json(ME),
      'GET /api/leagues': () => json([]),
      'POST /api/leagues': () => json({ id: 'l9', name: 'Nuova', admin: true, members: [] }, 201),
    }));
    const router = renderLeagues();

    await userEvent.type(await screen.findByLabelText('Nome della lega'), 'Nuova');
    await userEvent.type(screen.getByLabelText('La tua squadra'), 'Anna FC');
    await userEvent.type(screen.getByLabelText('La tua iniziale'), 'a');
    await userEvent.click(screen.getByRole('button', { name: 'Crea la lega' }));

    expect(await screen.findByText('pagina della lega')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/leghe/l9');
  });
});
```

`frontend/src/routes/LeagueRoute.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryProvider } from '../api/QueryProvider';
import { LeagueRoute } from './LeagueRoute';

const ME = { id: 'u1', email: 'a@b.it', displayName: 'Anna', emailVerified: true };
const MEMBERS = [
  { userId: 'u1', displayName: 'Anna', teamName: 'Anna FC', initial: 'A', role: 'ADMIN', me: true },
  { userId: 'u2', displayName: 'Bruno', teamName: 'Bruno FC', initial: 'B', role: 'MEMBER', me: false },
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function stub(admin: boolean, extra: Record<string, () => Response> = {}) {
  const routes: Record<string, () => Response> = {
    'GET /api/me': () => json(ME),
    'GET /api/leagues/l1': () => json({ id: 'l1', name: 'Lega del Bar', admin, members: MEMBERS }),
    'GET /api/leagues/l1/invites': () => json([]),
    ...extra,
  };
  const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const key = `${(init?.method ?? 'GET').toUpperCase()} ${url}`;
    if (!routes[key]) throw new Error(`chiamata inattesa: ${key}`);
    return Promise.resolve(routes[key]());
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderLeague() {
  const router = createMemoryRouter([{ path: '/leghe/:leagueId', element: <LeagueRoute /> }],
    { initialEntries: ['/leghe/l1'] });
  render(<QueryProvider><RouterProvider router={router} /></QueryProvider>);
}

describe('LeagueRoute', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('mostra i membri con la loro squadra', async () => {
    stub(false);
    renderLeague();
    const members = await screen.findByRole('list', { name: 'Membri' });
    expect(within(members).getByText('Bruno FC')).toBeInTheDocument();
    expect(within(members).getByText('Anna FC')).toBeInTheDocument();
  });

  it('chi non e\' amministratore non vede gli inviti', async () => {
    const fetchMock = stub(false);
    renderLeague();
    await screen.findByRole('list', { name: 'Membri' });
    expect(screen.queryByRole('button', { name: 'Crea un link d\'invito' })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/leagues/l1/invites')).toBe(false);
  });

  it('l\'amministratore crea un link e lo vede una volta', async () => {
    stub(true, {
      'POST /api/leagues/l1/invites': () => json({
        id: 'i1', link: 'https://fanta.example/invito/abc', expiresAt: '2026-10-12T20:00:00Z',
      }, 201),
    });
    renderLeague();

    await userEvent.click(await screen.findByRole('button', { name: 'Crea un link d\'invito' }));

    expect(await screen.findByRole('textbox', { name: 'Link d\'invito' }))
      .toHaveValue('https://fanta.example/invito/abc');
  });
});
```

`frontend/src/routes/InviteRoute.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryProvider } from '../api/QueryProvider';
import { InviteRoute } from './InviteRoute';

const PREVIEW = { leagueId: 'l1', leagueName: 'Lega del Bar', invitedBy: 'Anna',
  alreadyMember: false, takenInitials: ['A'] };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' },
  });
}

function stub(routes: Record<string, () => Response>) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const key = `${(init?.method ?? 'GET').toUpperCase()} ${url}`;
    if (!routes[key]) throw new Error(`chiamata inattesa: ${key}`);
    return Promise.resolve(routes[key]());
  }));
}

const UNAUTH = () => json({ type: 'https://fantaagent.local/problems/unauthenticated', detail: 'x' }, 401);

function renderInvite() {
  const router = createMemoryRouter([
    { path: '/invito/:token', element: <InviteRoute /> },
    { path: '/leghe/:leagueId', element: <p>pagina della lega</p> },
  ], { initialEntries: ['/invito/abc'] });
  render(<QueryProvider><RouterProvider router={router} /></QueryProvider>);
  return router;
}

describe('InviteRoute', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('senza account porta a registrarsi e poi torna qui', async () => {
    stub({ 'GET /api/invites/abc': () => json(PREVIEW), 'GET /api/me': UNAUTH });
    renderInvite();

    expect(await screen.findByText(/Anna ti invita in/)).toHaveTextContent('Lega del Bar');
    expect(screen.getByRole('link', { name: 'Registrati' }))
      .toHaveAttribute('href', '/registrati?dopo=%2Finvito%2Fabc');
    expect(screen.getByRole('link', { name: 'Accedi' }))
      .toHaveAttribute('href', '/accedi?dopo=%2Finvito%2Fabc');
  });

  it('con l\'accesso si sceglie la squadra e si entra', async () => {
    stub({
      'GET /api/invites/abc': () => json(PREVIEW),
      'GET /api/me': () => json({ id: 'u2', email: 'b@c.it', displayName: 'Bruno', emailVerified: true }),
      'POST /api/invites/abc/accept': () => json(
        { id: 'l1', name: 'Lega del Bar', admin: false, teamName: 'Bruno FC', initial: 'B' }, 201),
    });
    const router = renderInvite();

    await userEvent.type(await screen.findByLabelText('La tua squadra'), 'Bruno FC');
    await userEvent.type(screen.getByLabelText('La tua iniziale'), 'b');
    await userEvent.click(screen.getByRole('button', { name: 'Entra nella lega' }));

    expect(await screen.findByText('pagina della lega')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/leghe/l1');
  });

  it('un invito scaduto lo dice', async () => {
    stub({
      'GET /api/invites/abc': () => json({
        type: 'https://fantaagent.local/problems/invite-unavailable',
        detail: 'Questo invito è scaduto o è stato ritirato: chiedine uno nuovo a chi ti ha invitato.',
      }, 410),
      'GET /api/me': UNAUTH,
    });
    renderInvite();

    expect(await screen.findByRole('alert')).toHaveTextContent('Questo invito è scaduto');
  });

  it('un\'iniziale gia\' presa si vede prima di inviare', async () => {
    stub({
      'GET /api/invites/abc': () => json(PREVIEW),
      'GET /api/me': () => json({ id: 'u2', email: 'b@c.it', displayName: 'Bruno', emailVerified: true }),
    });
    renderInvite();

    await userEvent.type(await screen.findByLabelText('La tua iniziale'), 'a');
    expect(screen.getByText('La A è già di un altro membro.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entra nella lega' })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Eseguire i test e vederli fallire**

Run (da `frontend/`): `npx vitest run src/routes/LeaguesRoute.test.tsx src/routes/LeagueRoute.test.tsx src/routes/InviteRoute.test.tsx`
Expected: FAIL — moduli inesistenti.

- [ ] **Step 3: Tipi e hook**

In `frontend/src/api/types.ts`, in fondo:

```ts
/** Una lega fra le mie. Specchio di {@code LeagueDtos.LeagueCard}. */
export interface LeagueCard {
  id: string;
  name: string;
  admin: boolean;
  teamName: string;
  initial: string;
}

export interface MemberView {
  userId: string;
  displayName: string;
  teamName: string;
  initial: string;
  role: 'ADMIN' | 'MEMBER';
  me: boolean;
}

export interface LeagueDetail {
  id: string;
  name: string;
  admin: boolean;
  members: MemberView[];
}

export interface InviteView {
  id: string;
  createdAt: string;
  expiresAt: string;
}

/** Il link si vede solo qui, nella risposta alla creazione. */
export interface CreatedInvite {
  id: string;
  link: string;
  expiresAt: string;
}

export interface InvitePreview {
  leagueId: string;
  leagueName: string;
  invitedBy: string;
  alreadyMember: boolean;
  takenInitials: string[];
}
```

`frontend/src/api/leagues.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type {
  CreatedInvite, InvitePreview, InviteView, LeagueCard, LeagueDetail,
} from './types';

const path = (id: string) => `/api/leagues/${encodeURIComponent(id)}`;

export const LEAGUE_KEYS = {
  all: ['leagues'] as const,
  one: (id: string) => ['leagues', id] as const,
  invites: (id: string) => ['leagues', id, 'invites'] as const,
  invite: (token: string) => ['invite', token] as const,
};

/** Le leghe cambiano quando qualcuno entra o ne crea una: niente interrogazioni periodiche. */
const STILL = { refetchInterval: false as const };

export function useLeagues() {
  return useQuery({ queryKey: LEAGUE_KEYS.all, queryFn: () => api<LeagueCard[]>('/api/leagues'), ...STILL });
}

export function useCreateLeague() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; teamName: string; initial: string }) =>
      api<LeagueDetail>('/api/leagues', { method: 'POST', body }),
    onSuccess: () => client.invalidateQueries({ queryKey: LEAGUE_KEYS.all }),
  });
}

export function useLeague(id: string) {
  return useQuery({ queryKey: LEAGUE_KEYS.one(id), queryFn: () => api<LeagueDetail>(path(id)), ...STILL });
}

export function useRenameLeague(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api<LeagueDetail>(path(id), { method: 'PATCH', body: { name } }),
    onSuccess: (league) => {
      client.setQueryData(LEAGUE_KEYS.one(id), league);
      client.invalidateQueries({ queryKey: LEAGUE_KEYS.all });
    },
  });
}

export function useInvites(id: string, enabled: boolean) {
  return useQuery({
    queryKey: LEAGUE_KEYS.invites(id),
    queryFn: () => api<InviteView[]>(`${path(id)}/invites`),
    enabled,
    ...STILL,
  });
}

export function useCreateInvite(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api<CreatedInvite>(`${path(id)}/invites`, { method: 'POST' }),
    onSuccess: () => client.invalidateQueries({ queryKey: LEAGUE_KEYS.invites(id) }),
  });
}

export function useRevokeInvite(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) =>
      api<null>(`${path(id)}/invites/${encodeURIComponent(inviteId)}`, { method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries({ queryKey: LEAGUE_KEYS.invites(id) }),
  });
}

export function useInvitePreview(token: string) {
  return useQuery({
    queryKey: LEAGUE_KEYS.invite(token),
    queryFn: () => api<InvitePreview>(`/api/invites/${encodeURIComponent(token)}`),
    retry: false,
    ...STILL,
  });
}

export function useAcceptInvite(token: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { teamName: string; initial: string }) =>
      api<LeagueCard>(`/api/invites/${encodeURIComponent(token)}/accept`, { method: 'POST', body }),
    onSuccess: () => client.invalidateQueries({ queryKey: LEAGUE_KEYS.all }),
  });
}
```

- [ ] **Step 4: Le schermate**

`frontend/src/domain/InitialField.tsx`:

```tsx
import { FieldErrors } from './FieldErrors';

/**
 * L'iniziale: una lettera, maiuscola, unica nella lega. Il controllo di unicita' si
 * fa gia' qui con le iniziali note, cosi' che il pulsante resti spento invece di
 * mandare una richiesta che tornerebbe indietro; il server lo rifa' comunque.
 */
export function InitialField({
  id, value, onChange, taken = [], errors = [],
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  taken?: string[];
  errors?: string[];
}) {
  const upper = value.toUpperCase();
  const clash = upper !== '' && taken.includes(upper) ? [`La ${upper} è già di un altro membro.`] : [];
  const all = [...clash, ...errors];
  return (
    <div className="mt-4">
      <label htmlFor={id} className="block text-sm font-medium">La tua iniziale</label>
      <input
        id={id}
        value={upper}
        maxLength={1}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value.slice(-1))}
        aria-invalid={all.length > 0 ? 'true' : undefined}
        aria-describedby={`${id}-hint${all.length > 0 ? ` ${id}-errors` : ''}`}
        className="mt-2 min-h-11 w-16 rounded-xl border border-line-strong bg-surface px-4 text-center text-base font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      />
      <p id={`${id}-hint`} className="mt-1 text-sm text-muted-foreground">
        La lettera con cui il banditore ti chiama.
      </p>
      <FieldErrors id={`${id}-errors`} errors={all} />
    </div>
  );
}

export function initialTaken(value: string, taken: string[]): boolean {
  return value !== '' && taken.includes(value.toUpperCase());
}
```

`frontend/src/routes/LeaguesRoute.tsx`:

```tsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppShell } from '../AppShell';
import { fieldErrors, userMessage } from '../api/client';
import { useCreateLeague, useLeagues } from '../api/leagues';
import { PRIMARY_BUTTON, TextField } from '../domain/AuthForm';
import { InitialField } from '../domain/InitialField';

export function LeaguesRoute() {
  const leagues = useLeagues();
  const create = useCreateLeague();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [initial, setInitial] = useState('');
  const errors = fieldErrors(create.error);

  return (
    <AppShell chrome="top">
      <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="leagues-title" className="panel rounded-2xl p-6">
          <h1 id="leagues-title" className="w-exp text-lg font-semibold">Le mie leghe</h1>
          {leagues.isError ? (
            <p role="alert" className="mt-4 text-sm font-medium text-destructive">
              {userMessage(leagues.error, 'Non riesco a caricare le tue leghe. Riprova fra poco.')}
            </p>
          ) : null}
          {leagues.data && leagues.data.length === 0 ? (
            <p className="mt-4 text-sm">
              Non fai ancora parte di nessuna lega. Creane una qui accanto, oppure apri il link
              d'invito che ti hanno mandato.
            </p>
          ) : null}
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {leagues.data?.map((league) => (
              <li key={league.id}>
                <Link
                  to={`/leghe/${league.id}`}
                  className="flex min-h-20 flex-col justify-center rounded-xl border border-line-strong px-4 py-3 hover:bg-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <span className="font-semibold">{league.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {league.teamName} · {league.initial}
                    {league.admin ? ' · Amministratore' : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="create-league-title" className="panel rounded-2xl p-6">
          <h2 id="create-league-title" className="w-exp text-lg font-semibold">Nuova lega</h2>
          <form
            className="mt-4"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate({ name, teamName, initial },
                { onSuccess: (league) => navigate(`/leghe/${league.id}`) });
            }}
          >
            <TextField id="league-name" label="Nome della lega" value={name} onChange={setName}
              errors={errors.name} />
            <TextField id="league-team" label="La tua squadra" value={teamName} onChange={setTeamName}
              errors={errors.teamName} />
            <InitialField id="league-initial" value={initial} onChange={setInitial}
              errors={errors.initial} />
            {create.isError && Object.keys(errors).length === 0 ? (
              <p role="alert" className="mt-4 text-sm font-medium text-destructive">
                {userMessage(create.error, 'Non sono riuscito a creare la lega. Riprova fra poco.')}
              </p>
            ) : null}
            <button type="submit" disabled={create.isPending} className={PRIMARY_BUTTON}>
              {create.isPending ? 'Creo…' : 'Crea la lega'}
            </button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
```

`frontend/src/routes/LeagueRoute.tsx`:

```tsx
import { useParams } from 'react-router-dom';
import { AppShell } from '../AppShell';
import { userMessage } from '../api/client';
import { useCreateInvite, useInvites, useLeague, useRevokeInvite } from '../api/leagues';

const DATE = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long' });

const SECONDARY_BUTTON =
  'min-h-11 rounded-full border border-line-strong px-4 font-medium hover:bg-line disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent';

export function LeagueRoute() {
  const { leagueId = '' } = useParams();
  const league = useLeague(leagueId);
  const admin = league.data?.admin ?? false;

  if (league.isError) {
    return (
      <AppShell chrome="top">
        <p role="alert" className="panel mx-auto max-w-xl rounded-xl p-4 text-sm font-medium text-destructive">
          {userMessage(league.error, 'Questa lega non esiste, o non ne fai parte.')}
        </p>
      </AppShell>
    );
  }
  if (!league.data) return <AppShell chrome="top"><p className="text-sm">Un attimo…</p></AppShell>;

  return (
    <AppShell chrome="top">
      <h1 className="w-exp mx-auto mb-4 max-w-5xl text-2xl font-semibold">{league.data.name}</h1>
      <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-2">
        <section aria-labelledby="members-title" className="panel rounded-2xl p-6">
          <h2 id="members-title" className="w-exp text-lg font-semibold">Membri</h2>
          <ul aria-label="Membri" className="mt-4 divide-y divide-line">
            {league.data.members.map((m) => (
              <li key={m.userId} className="flex min-h-11 items-center gap-3 py-2">
                <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-accent font-semibold text-on-accent">
                  {m.initial}
                </span>
                <span className="flex flex-col">
                  <span className="font-medium">{m.teamName}</span>
                  <span className="text-sm text-muted-foreground">
                    {m.displayName}{m.role === 'ADMIN' ? ' · Amministratore' : ''}{m.me ? ' · Tu' : ''}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
        {admin ? <InvitesPanel leagueId={leagueId} /> : null}
      </div>
    </AppShell>
  );
}

/**
 * Il link si vede una volta, subito dopo averlo creato: il server ne conserva solo
 * un'impronta. Chi l'ha perso ne crea un altro, e ritira il vecchio se teme che sia
 * finito a chi non doveva.
 */
function InvitesPanel({ leagueId }: { leagueId: string }) {
  const invites = useInvites(leagueId, true);
  const create = useCreateInvite(leagueId);
  const revoke = useRevokeInvite(leagueId);
  const link = create.data?.link;

  return (
    <section aria-labelledby="invites-title" className="panel rounded-2xl p-6">
      <h2 id="invites-title" className="w-exp text-lg font-semibold">Inviti</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Un link solo per tutto il gruppo: vale due settimane, chiunque lo apra può entrare.
      </p>
      <button type="button" disabled={create.isPending} onClick={() => create.mutate()}
        className={`mt-4 ${SECONDARY_BUTTON}`}>
        Crea un link d'invito
      </button>
      {link ? (
        <div className="mt-4">
          <label htmlFor="invite-link" className="block text-sm font-medium">Link d'invito</label>
          <div className="mt-2 flex gap-2">
            <input id="invite-link" readOnly value={link} onFocus={(e) => e.target.select()}
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-line-strong bg-surface px-4 text-sm" />
            <button type="button" className={SECONDARY_BUTTON}
              onClick={() => { void navigator.clipboard?.writeText(link); }}>
              Copia
            </button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Copialo adesso: dopo non si potrà rivedere.
          </p>
        </div>
      ) : null}
      {create.isError || revoke.isError ? (
        <p role="alert" className="mt-4 text-sm font-medium text-destructive">
          {userMessage(create.error ?? revoke.error, 'Operazione non riuscita. Riprova fra poco.')}
        </p>
      ) : null}
      {invites.data && invites.data.length > 0 ? (
        <>
          <h3 className="mt-6 text-sm font-semibold">Link attivi</h3>
          <ul className="mt-2 divide-y divide-line">
            {invites.data.map((invite) => (
              <li key={invite.id} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm">
                <span>Creato il {DATE.format(new Date(invite.createdAt))}, vale fino al {DATE.format(new Date(invite.expiresAt))}</span>
                <button type="button" className={SECONDARY_BUTTON} disabled={revoke.isPending}
                  onClick={() => revoke.mutate(invite.id)}>
                  Ritira
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
```

`frontend/src/routes/InviteRoute.tsx`:

```tsx
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMe } from '../api/auth';
import { fieldErrors, userMessage } from '../api/client';
import { useAcceptInvite, useInvitePreview } from '../api/leagues';
import { AuthLayout, PRIMARY_BUTTON, TEXT_LINK, TextField } from '../domain/AuthForm';
import { InitialField, initialTaken } from '../domain/InitialField';

/**
 * Pubblica: chi apre il link del gruppo di solito non ha ancora un account. Si vede
 * la lega e chi invita; per entrare si passa da registrazione o accesso, e si torna
 * qui con {@code ?dopo}.
 */
export function InviteRoute() {
  const { token = '' } = useParams();
  const preview = useInvitePreview(token);
  const me = useMe();
  const accept = useAcceptInvite(token);
  const navigate = useNavigate();
  const [teamName, setTeamName] = useState('');
  const [initial, setInitial] = useState('');
  const back = encodeURIComponent(`/invito/${token}`);
  const errors = fieldErrors(accept.error);

  if (preview.isError) {
    return (
      <AuthLayout title="Invito">
        <p role="alert" className="text-sm font-medium text-destructive">
          {userMessage(preview.error, 'Non riesco ad aprire questo invito. Riprova fra poco.')}
        </p>
      </AuthLayout>
    );
  }
  if (!preview.data || me.isPending) return <AuthLayout title="Invito"><p className="text-sm">Un attimo…</p></AuthLayout>;
  const p = preview.data;

  return (
    <AuthLayout title={p.leagueName}>
      <p className="text-sm">{p.invitedBy} ti invita in <strong>{p.leagueName}</strong>.</p>
      {!me.data ? (
        <div className="mt-6 grid gap-3">
          <Link to={`/registrati?dopo=${back}`} className={`${PRIMARY_BUTTON} mt-0 flex items-center justify-center`}>
            Registrati
          </Link>
          <p className="text-sm">Hai già un account? <Link to={`/accedi?dopo=${back}`} className={TEXT_LINK}>Accedi</Link></p>
        </div>
      ) : p.alreadyMember ? (
        <p className="mt-6 text-sm">
          Fai già parte di questa lega. <Link to={`/leghe/${p.leagueId}`} className={TEXT_LINK}>Vai alla lega</Link>
        </p>
      ) : (
        <form
          className="mt-6"
          onSubmit={(e) => {
            e.preventDefault();
            accept.mutate({ teamName, initial }, { onSuccess: (league) => navigate(`/leghe/${league.id}`) });
          }}
        >
          <TextField id="invite-team" label="La tua squadra" value={teamName} onChange={setTeamName}
            errors={errors.teamName} />
          <InitialField id="invite-initial" value={initial} onChange={setInitial}
            taken={p.takenInitials} errors={errors.initial} />
          {accept.isError && Object.keys(errors).length === 0 ? (
            <p role="alert" className="mt-4 text-sm font-medium text-destructive">
              {userMessage(accept.error, 'Non sono riuscito a farti entrare. Riprova fra poco.')}
            </p>
          ) : null}
          <button type="submit" className={PRIMARY_BUTTON}
            disabled={accept.isPending || initialTaken(initial, p.takenInitials)}>
            {accept.isPending ? 'Entro…' : 'Entra nella lega'}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
```

- [ ] **Step 5: Rotte**

In `frontend/src/router.tsx` aggiungere:

```tsx
  { path: '/leghe', element: <RequireAuth><LeaguesRoute /></RequireAuth> },
  { path: '/leghe/:leagueId', element: <RequireAuth><LeagueRoute /></RequireAuth> },
  // Pubblica: chi apre l'invito spesso non ha ancora un account.
  { path: '/invito/:token', element: <InviteRoute /> },
```

In `SpaRoutesController.java`:

```java
    static final String LEGHE = "/leghe";
    static final String LEGA = "/leghe/{leagueId}";
    static final String INVITO = "/invito/{token}";
```

aggiunte a `ROUTES` e a `@GetMapping`. In `SpaRoutesControllerTest.leRotteDelServerCoincidonoConQuelleDelRouterReact`, i parametri si scrivono `:nome` in React Router e `{nome}` in Spring: convertire prima di confrontare, dentro il ciclo:

```java
            // React Router scrive i parametri ":nome", Spring "{nome}": stessa rotta.
            client.add(m.group(1).replaceAll(":([A-Za-z]+)", "{$1}"));
```

e aggiungere un caso:

```java
    @Test
    void unaRottaConParametroRicaricataInoltraAllaSpa() throws Exception {
        mvc.perform(get("/invito/abc"))
                .andExpect(status().isOk())
                .andExpect(forwardedUrl("/index.html"));
    }
```

- [ ] **Step 6: Eseguire i test e vederli passare**

Run (da `frontend/`): `npm test && npm run lint && npm run build`; dalla radice `mvn -q test -Dtest=SpaRoutesControllerTest`.
Expected: PASS.

- [ ] **Step 7: Mutazione**

In `LeagueRoute` rendere `InvitesPanel` sempre visibile (`{true ? ...}`): `chi non e' amministratore non vede gli inviti` deve fallire. Ripristinare.

- [ ] **Step 8: Verifica visiva**

Vite + Playwright come nel Task 6 (intercettare solo le `pathname` che iniziano con `/api/`). Screenshot a 1280×800 e 390×844 di `/leghe` (con due leghe, e vuota), `/leghe/l1` da amministratore dopo aver creato un link, `/invito/abc` senza accesso e con accesso. Nessuna colonna vuota sproporzionata; sul telefono i pannelli si impilano.

- [ ] **Step 9: Commit**

```bash
git add frontend/src src/main/java/com/fantaagent/adapter/in/spa src/test/java/com/fantaagent/adapter/in/spa
git commit -m "Le mie leghe, la pagina della lega e l'invito nel browser

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Parte D — Le aste dentro la lega

Alla fine della Parte D ogni asta appartiene a una lega, i suoi posti sono i membri, l'amministratore registra e corregge, ognuno vede le rose e i propri consigli. **Dal Task 13 al Task 16 le schermate d'asta del browser non funzionano**: l'API passa agli identificativi veri prima che il frontend li usi. I test sono la rete in quell'intervallo; non fermarsi a metà.

### Task 10: Aste, posti e membri che se ne vanno

**Files:**
- Create: `application/port/out/AuctionRecord.java`, `Seat.java`, `AuctionRepository.java`
- Create: `application/service/auction/LeagueAuctionService.java`, `AuctionCard.java`, `SeatRequest.java`, `SeatsLockedException.java`, `NotEnoughMembersException.java`, `AuctionNotFoundException.java`, `LogSummary.java`
- Create: `application/service/league/AdminCannotLeaveException.java`
- Create: `adapter/out/jdbc/JdbcAuctionRepository.java`
- Modify: `config/PersistenceConfig.java`
- Create: `src/test/java/com/fantaagent/testsupport/PortalWorld.java`
- Modify: `src/test/java/com/fantaagent/testsupport/Fixtures.java` (catalogo)
- Test: `src/test/java/com/fantaagent/application/service/auction/LeagueAuctionServiceTest.java`

**Interfaces:**
- Consumes: `LeagueAccess`, `LeagueRepository`, `LeagueService.memberProblems/initialOf`, `AuctionEventStores`, `Transactions`, `InvalidLeagueDataException`.
- Produces:
  - `record AuctionRecord(UUID id, UUID leagueId, String name, UUID createdBy, Instant createdAt, Instant deletedAt, LeagueRulesSettings rules, ScoringSettings scoring, AuctionSettings bidder)`.
  - `record Seat(UUID userId, String teamName, char initial, int position)`.
  - `interface AuctionRepository { void insert(AuctionRecord, List<Seat>); Optional<AuctionRecord> byId(UUID); List<AuctionRecord> byLeague(UUID leagueId); void rename(UUID, String); void updateBidder(UUID, AuctionSettings); void softDelete(UUID, Instant); List<Seat> seats(UUID auctionId); void replaceSeats(UUID auctionId, List<Seat>); void removeSeat(UUID auctionId, UUID userId); List<UUID> auctionsWithSeat(UUID leagueId, UUID userId); void lockForWrite(UUID auctionId); }` — `byLeague` esclude le cancellate, dalla più recente; `seats` in ordine di `position`.
  - `LeagueAuctionService(AuctionRepository, LeagueRepository, AuctionEventStores, Transactions, Clock, List<Role> phases)` con `AuctionRecord create(LeagueAccess, String name)`, `List<AuctionCard> list(LeagueAccess)`, `AuctionRecord find(LeagueAccess, UUID auctionId)`, `void rename(LeagueAccess, UUID, String)`, `void updateBidder(LeagueAccess, UUID, AuctionSettings)`, `void delete(LeagueAccess, UUID)`, `List<Seat> seats(LeagueAccess, UUID)`, `boolean seatsLocked(LeagueAccess, UUID)`, `List<Seat> replaceSeats(LeagueAccess, UUID, List<SeatRequest>)`, `void removeMember(LeagueAccess, UUID userId)`.
  - `record AuctionCard(UUID id, String name, Instant createdAt, Instant lastWritten, int purchases, Role phase, int teams, int budget, int totalSlots, Integer myBudgetRemaining)`.
  - `record SeatRequest(UUID userId, String teamName, String initial)`.
  - `SeatsLockedException()` → 409 `seats-locked`; `NotEnoughMembersException()` → 409 `not-enough-members`; `AuctionNotFoundException(UUID)` → 404 `unknown-auction`; `AdminCannotLeaveException()` → 409 `admin-cannot-leave`.
  - `LogSummary.purchases(List<AuctionEvent>)`, `LogSummary.anyPurchase(List<AuctionEvent>)`, `LogSummary.spentBy(List<AuctionEvent>, String participantId)`, `LogSummary.phase(List<AuctionEvent>, Role fallback)`, `LogSummary.lastWritten(List<AuctionEvent>)`.
  - `testsupport.Fixtures.catalog(): PlayerCatalog` (40 giocatori per ruolo, senza statistiche); `testsupport.PortalWorld` (vedi sotto).

`LogSummary` ricopia tre funzioni statiche di `AuctionRuntime` (`countPurchases`, `spentBy`, `lastPhase`): lì sono package-private, e `AuctionRuntime` resta intoccato per `/legacy`. Quando `/legacy` sparirà, sparirà anche la copia.

**Quando i posti si bloccano:** al primo `PlayerPurchased` nel registro, anche se poi annullato. Chi partecipa, nomi e iniziali restano da lì fissi; l'ordine (il turno di chiamata) no. La regola «si può cambiare solo l'ordine» si applica confrontando l'insieme dei posti richiesti con quello attuale: stessi utenti, stessi nomi, stesse iniziali.

- [ ] **Step 1: Il supporto dei test**

In `Fixtures.java` aggiungere:

```java
    /** Quaranta giocatori per ruolo, senza statistiche: abbastanza per costruire una catena. */
    public static PlayerCatalog catalog() {
        List<Player> players = new ArrayList<>();
        for (Role role : Role.values()) {
            for (int i = 1; i <= 40; i++) {
                players.add(new Player(role.name() + i, role.name() + " " + i, "Squadra", role, 1 + i));
            }
        }
        return new InMemoryPlayerCatalog(players, List.of());
    }
```

(import `com.fantaagent.adapter.out.file.InMemoryPlayerCatalog`, `com.fantaagent.application.port.out.PlayerCatalog`, `com.fantaagent.domain.player.Player`, `java.util.ArrayList`).

`src/test/java/com/fantaagent/testsupport/PortalWorld.java`:

```java
package com.fantaagent.testsupport;

import com.fantaagent.adapter.out.jdbc.JdbcAuctionEventStores;
import com.fantaagent.adapter.out.jdbc.JdbcAuctionRepository;
import com.fantaagent.adapter.out.jdbc.JdbcLeagueRepository;
import com.fantaagent.adapter.out.jdbc.SpringTransactions;
import com.fantaagent.application.port.out.LeagueMember;
import com.fantaagent.application.port.out.MemberRole;
import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.application.service.auction.LeagueAuctionService;
import com.fantaagent.application.service.league.LeagueAccess;
import com.fantaagent.application.service.league.LeagueService;
import com.fantaagent.domain.player.Role;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Un portale intero su un database fresco, senza Spring: repository veri, servizi
 * veri, un orologio fermo. Per i test di servizio che attraversano leghe, aste e
 * registro insieme.
 */
public final class PortalWorld {

    public static final ObjectMapper JSON = JsonMapper.builder().addModule(new JavaTimeModule()).build();
    public static final List<Role> PHASES = List.of(Role.P, Role.D, Role.C, Role.A);

    public final DataSource ds = SharedPostgres.migratedDatabase();
    public final JdbcClient jdbc = JdbcClient.create(ds);
    public final MutableClock clock = new MutableClock(Instant.parse("2026-09-28T20:00:00Z"));
    public final SpringTransactions tx =
            new SpringTransactions(new TransactionTemplate(new DataSourceTransactionManager(ds)));
    public final JdbcLeagueRepository leagueRepository = new JdbcLeagueRepository(jdbc, JSON);
    public final JdbcAuctionRepository auctionRepository = new JdbcAuctionRepository(jdbc, JSON);
    public final JdbcAuctionEventStores stores = new JdbcAuctionEventStores(jdbc, JSON);
    public final PlayerCatalog catalog = Fixtures.catalog();
    public final LeagueService leagues =
            new LeagueService(leagueRepository, Fixtures.template(), tx, clock);
    public final LeagueAuctionService auctions =
            new LeagueAuctionService(auctionRepository, leagueRepository, stores, tx, clock, PHASES);

    public UUID user(String name) {
        return TestRows.user(jdbc, name + "@example.com");
    }

    /** Una lega con {@code admin} amministratore e gli altri membri, iniziale = prima lettera del nome. */
    public LeagueAccess league(String admin, String... members) {
        UUID adminId = user(admin);
        LeagueAccess access = leagues.create(adminId, "Lega", admin + " FC", admin.substring(0, 1));
        for (String member : members) {
            join(access, user(member), member);
        }
        return leagues.access(access.leagueId(), adminId);
    }

    public void join(LeagueAccess league, UUID userId, String name) {
        leagueRepository.insertMember(new LeagueMember(league.leagueId(), userId, MemberRole.MEMBER,
                name + " FC", Character.toUpperCase(name.charAt(0)), clock.instant(), null));
    }

    public LeagueAccess as(LeagueAccess league, UUID userId) {
        return leagues.access(league.leagueId(), userId);
    }

    public UUID userId(LeagueAccess league, String teamName) {
        return leagueRepository.members(league.leagueId()).stream()
                .filter(m -> m.teamName().equals(teamName)).findFirst().orElseThrow().userId();
    }
}
```

- [ ] **Step 2: Scrivere il test che fallisce**

`src/test/java/com/fantaagent/application/service/auction/LeagueAuctionServiceTest.java`:

```java
package com.fantaagent.application.service.auction;

import com.fantaagent.application.port.out.AuctionRecord;
import com.fantaagent.application.port.out.Seat;
import com.fantaagent.application.service.league.AdminCannotLeaveException;
import com.fantaagent.application.service.league.AdminOnlyException;
import com.fantaagent.application.service.league.LeagueAccess;
import com.fantaagent.application.service.league.NotLeagueMemberException;
import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.LeagueRulesSettings;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.player.Role;
import com.fantaagent.testsupport.PortalWorld;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LeagueAuctionServiceTest {

    private PortalWorld world;
    private LeagueAccess admin;
    private UUID bruno;
    private UUID carla;

    @BeforeEach
    void setUp() {
        world = new PortalWorld();
        admin = world.league("anna", "bruno", "carla");
        bruno = world.userId(admin, "bruno FC");
        carla = world.userId(admin, "carla FC");
    }

    @Test
    void lAstaNasceConLeRegoleDellaLegaEIMembriComePosti() {
        AuctionRecord auction = world.auctions.create(admin, " Asta d'estate ");

        assertThat(auction.name()).isEqualTo("Asta d'estate");
        assertThat(auction.rules()).isEqualTo(admin.league().rules());
        assertThat(world.auctions.seats(admin, auction.id()))
                .extracting(Seat::teamName, Seat::position)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple("anna FC", 1),
                        org.assertj.core.groups.Tuple.tuple("bruno FC", 2),
                        org.assertj.core.groups.Tuple.tuple("carla FC", 3));
        assertThat(world.stores.open(auction.id(), admin.userId()).load())
                .singleElement().isInstanceOf(AuctionEvent.AuctionStarted.class);
    }

    @Test
    void cambiareLaLegaNonToccaLeAsteGiaCreate() {
        AuctionRecord auction = world.auctions.create(admin, "Asta");
        world.leagues.updateDefaults(admin, new LeagueRulesSettings(100,
                        Map.of(Role.P, 1, Role.D, 1, Role.C, 1, Role.A, 1)),
                admin.league().scoring(), admin.league().bidder());

        assertThat(world.auctions.find(admin, auction.id()).rules().budget()).isEqualTo(500);
    }

    @Test
    void soloLAmministratoreCreaUnAsta() {
        assertThatThrownBy(() -> world.auctions.create(world.as(admin, bruno), "Asta"))
                .isInstanceOf(AdminOnlyException.class);
    }

    @Test
    void daSoliNonSiFaUnAsta() {
        LeagueAccess alone = world.league("dario");
        assertThatThrownBy(() -> world.auctions.create(alone, "Asta"))
                .isInstanceOf(NotEnoughMembersException.class);
    }

    @Test
    void lElencoDiceAcquistiFaseECreditiMiei() {
        AuctionRecord auction = world.auctions.create(admin, "Asta");
        var store = world.stores.open(auction.id(), admin.userId());
        store.append(new AuctionEvent.PlayerPurchased(2, Instant.now(), "P1", bruno.toString(), 40));
        store.append(new AuctionEvent.PhaseAdvanced(3, Instant.now(), Role.D));

        AuctionCard card = world.auctions.list(world.as(admin, bruno)).getFirst();
        assertThat(card.purchases()).isEqualTo(1);
        assertThat(card.phase()).isEqualTo(Role.D);
        assertThat(card.teams()).isEqualTo(3);
        assertThat(card.totalSlots()).isEqualTo(75);
        assertThat(card.myBudgetRemaining()).isEqualTo(460);
    }

    @Test
    void unAstaCancellataNonSiVedePiu() {
        AuctionRecord auction = world.auctions.create(admin, "Asta");
        world.auctions.delete(admin, auction.id());
        assertThat(world.auctions.list(admin)).isEmpty();
        assertThatThrownBy(() -> world.auctions.find(admin, auction.id()))
                .isInstanceOf(AuctionNotFoundException.class);
    }

    @Test
    void unAstaDiUnAltraLegaNonSiTrova() {
        AuctionRecord auction = world.auctions.create(admin, "Asta");
        LeagueAccess other = world.league("dario", "enzo");
        assertThatThrownBy(() -> world.auctions.find(other, auction.id()))
                .isInstanceOf(AuctionNotFoundException.class);
    }

    @Test
    void primaDelPrimoAcquistoIPostiSiCambiano() {
        AuctionRecord auction = world.auctions.create(admin, "Asta");
        List<Seat> seats = world.auctions.replaceSeats(admin, auction.id(), List.of(
                new SeatRequest(carla, "Carla United", "Z"),
                new SeatRequest(admin.userId(), "anna FC", "A")));

        assertThat(seats).extracting(Seat::teamName).containsExactly("Carla United", "anna FC");
        assertThat(seats).extracting(Seat::position).containsExactly(1, 2);
    }

    @Test
    void dopoIlPrimoAcquistoSiCambiaSoloLOrdine() {
        AuctionRecord auction = world.auctions.create(admin, "Asta");
        world.stores.open(auction.id(), admin.userId())
                .append(new AuctionEvent.PlayerPurchased(2, Instant.now(), "P1", bruno.toString(), 40));

        List<Seat> reordered = world.auctions.replaceSeats(admin, auction.id(), List.of(
                new SeatRequest(carla, "carla FC", "C"),
                new SeatRequest(bruno, "bruno FC", "B"),
                new SeatRequest(admin.userId(), "anna FC", "A")));
        assertThat(reordered).extracting(Seat::teamName).containsExactly("carla FC", "bruno FC", "anna FC");

        assertThatThrownBy(() -> world.auctions.replaceSeats(admin, auction.id(), List.of(
                new SeatRequest(carla, "carla FC", "C"),
                new SeatRequest(admin.userId(), "anna FC", "A"))))
                .isInstanceOf(SeatsLockedException.class);
        assertThatThrownBy(() -> world.auctions.replaceSeats(admin, auction.id(), List.of(
                new SeatRequest(carla, "Altro nome", "C"),
                new SeatRequest(bruno, "bruno FC", "B"),
                new SeatRequest(admin.userId(), "anna FC", "A"))))
                .isInstanceOf(SeatsLockedException.class);
        assertThat(world.auctions.seatsLocked(admin, auction.id())).isTrue();
    }

    @Test
    void unPostoPerChiNonEMembroNonSiDa() {
        AuctionRecord auction = world.auctions.create(admin, "Asta");
        UUID stranger = world.user("sconosciuto");
        assertThatThrownBy(() -> world.auctions.replaceSeats(admin, auction.id(), List.of(
                new SeatRequest(stranger, "X FC", "X"),
                new SeatRequest(admin.userId(), "anna FC", "A"))))
                .isInstanceOf(com.fantaagent.application.service.league.InvalidLeagueDataException.class);
    }

    @Test
    void chiEsceLasciaIlPostoDoveHaGiaComprato() {
        AuctionRecord started = world.auctions.create(admin, "Iniziata");
        world.stores.open(started.id(), admin.userId())
                .append(new AuctionEvent.PlayerPurchased(2, Instant.now(), "P1", bruno.toString(), 40));
        AuctionRecord fresh = world.auctions.create(admin, "Nuova");

        world.auctions.removeMember(world.as(admin, bruno), bruno);

        assertThat(world.auctions.seats(admin, started.id())).extracting(Seat::userId).contains(bruno);
        assertThat(world.auctions.seats(admin, fresh.id())).extracting(Seat::userId).doesNotContain(bruno);
        assertThatThrownBy(() -> world.as(admin, bruno)).isInstanceOf(NotLeagueMemberException.class);
    }

    @Test
    void lAmministratoreToglieUnMembroMaNonSeStesso() {
        world.auctions.removeMember(admin, carla);
        assertThatThrownBy(() -> world.as(admin, carla)).isInstanceOf(NotLeagueMemberException.class);
        assertThatThrownBy(() -> world.auctions.removeMember(admin, admin.userId()))
                .isInstanceOf(AdminCannotLeaveException.class);
        assertThatThrownBy(() -> world.auctions.removeMember(world.as(admin, bruno), admin.userId()))
                .isInstanceOf(AdminOnlyException.class);
    }

    @Test
    void lePreferenzeDelBanditoreSiCambianoAnchePerUnAstaIniziata() {
        AuctionRecord auction = world.auctions.create(admin, "Asta");
        world.auctions.updateBidder(admin, auction.id(), new AuctionSettings(12, false));
        assertThat(world.auctions.find(admin, auction.id()).bidder()).isEqualTo(new AuctionSettings(12, false));
    }
}
```

- [ ] **Step 3: Eseguire il test e vederlo fallire**

Run: `mvn -q test -Dtest=LeagueAuctionServiceTest`
Expected: FAIL di compilazione.

- [ ] **Step 4: Porte**

`application/port/out/AuctionRecord.java`:

```java
package com.fantaagent.application.port.out;

import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.LeagueRulesSettings;
import com.fantaagent.config.ScoringSettings;

import java.time.Instant;
import java.util.UUID;

/**
 * Un'asta di una lega. Regole e punteggio sono quelli della lega al momento della
 * creazione e non cambiano piu': da loro discendono i numeri con cui le rose sono
 * state pagate. Le preferenze del banditore si', perche' non entrano in nessun calcolo.
 */
public record AuctionRecord(UUID id, UUID leagueId, String name, UUID createdBy, Instant createdAt,
                            Instant deletedAt, LeagueRulesSettings rules, ScoringSettings scoring,
                            AuctionSettings bidder) {
}
```

`application/port/out/Seat.java`:

```java
package com.fantaagent.application.port.out;

import java.util.UUID;

/** Un posto d'asta: un membro, con la squadra con cui gioca e il suo turno di chiamata. */
public record Seat(UUID userId, String teamName, char initial, int position) {
}
```

`application/port/out/AuctionRepository.java`:

```java
package com.fantaagent.application.port.out;

import com.fantaagent.config.AuctionSettings;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AuctionRepository {

    /** Asta e posti insieme: chi chiama apre la transazione. */
    void insert(AuctionRecord auction, List<Seat> seats);

    /** Anche se cancellata: e' chi chiama a decidere se una cancellata esiste. */
    Optional<AuctionRecord> byId(UUID id);

    /** Solo le non cancellate, dalla piu' recente. */
    List<AuctionRecord> byLeague(UUID leagueId);

    void rename(UUID id, String name);

    void updateBidder(UUID id, AuctionSettings bidder);

    void softDelete(UUID id, Instant at);

    /** In ordine di turno di chiamata. */
    List<Seat> seats(UUID auctionId);

    void replaceSeats(UUID auctionId, List<Seat> seats);

    void removeSeat(UUID auctionId, UUID userId);

    /** Le aste non cancellate della lega in cui l'utente ha un posto. */
    List<UUID> auctionsWithSeat(UUID leagueId, UUID userId);

    /**
     * Blocca la riga dell'asta fino alla fine della transazione di chi chiama: due
     * scritture sulla stessa asta si mettono in fila invece di scontrarsi sul numero
     * di sequenza. Aste diverse non si bloccano a vicenda.
     */
    void lockForWrite(UUID auctionId);
}
```

- [ ] **Step 5: Il servizio**

`application/service/auction/AuctionNotFoundException.java`:

```java
package com.fantaagent.application.service.auction;

import java.util.UUID;

/** Asta inesistente, cancellata o di un'altra lega: per chi chiede, non c'e'. */
public class AuctionNotFoundException extends RuntimeException {

    public AuctionNotFoundException(UUID auctionId) {
        super("nessuna asta " + auctionId + " in questa lega");
    }
}
```

`application/service/auction/SeatsLockedException.java`:

```java
package com.fantaagent.application.service.auction;

public class SeatsLockedException extends RuntimeException {

    public SeatsLockedException() {
        super("L'asta è iniziata: chi partecipa, i nomi delle squadre e le iniziali non si cambiano più."
                + " Si può cambiare solo il turno di chiamata.");
    }
}
```

`application/service/auction/NotEnoughMembersException.java`:

```java
package com.fantaagent.application.service.auction;

public class NotEnoughMembersException extends RuntimeException {

    public NotEnoughMembersException() {
        super("Servono almeno 2 membri nella lega per creare un'asta.");
    }
}
```

`application/service/league/AdminCannotLeaveException.java`:

```java
package com.fantaagent.application.service.league;

/** Una lega senza amministratore non la potrebbe piu' gestire nessuno. */
public class AdminCannotLeaveException extends RuntimeException {

    public AdminCannotLeaveException() {
        super("L'amministratore non può lasciare la lega.");
    }
}
```

`application/service/auction/SeatRequest.java`:

```java
package com.fantaagent.application.service.auction;

import java.util.UUID;

/** Un posto come lo chiede l'amministratore: la posizione e' l'ordine nella lista. */
public record SeatRequest(UUID userId, String teamName, String initial) {
}
```

`application/service/auction/AuctionCard.java`:

```java
package com.fantaagent.application.service.auction;

import com.fantaagent.domain.player.Role;

import java.time.Instant;
import java.util.UUID;

/**
 * Una riga dell'elenco delle aste: quanto basta per riconoscerla e sapere a che punto
 * e'. {@code myBudgetRemaining} e' null per chi non ha un posto in quell'asta.
 */
public record AuctionCard(UUID id, String name, Instant createdAt, Instant lastWritten,
                          int purchases, Role phase, int teams, int budget, int totalSlots,
                          Integer myBudgetRemaining) {
}
```

`application/service/auction/LogSummary.java`:

```java
package com.fantaagent.application.service.auction;

import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.player.Role;

import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Cio' che l'elenco delle aste legge dal registro senza proiettarlo: la proiezione
 * vuole il catalogo e le regole, e un elenco non deve fallire su un'asta vecchia che
 * nomina un giocatore uscito dal listone.
 *
 * <p>Stessa logica di {@code AuctionRuntime.countPurchases/spentBy/lastPhase}, che
 * restano dove sono per {@code /legacy}.
 */
public final class LogSummary {

    private LogSummary() {
    }

    public static int purchases(List<AuctionEvent> events) {
        Set<Long> revoked = new HashSet<>();
        for (AuctionEvent e : events) {
            if (e instanceof AuctionEvent.PurchaseRevoked r) {
                revoked.add(r.targetSeq());
            }
        }
        int count = 0;
        for (AuctionEvent e : events) {
            if (e instanceof AuctionEvent.PlayerPurchased p && !revoked.contains(p.seq())) {
                count++;
            }
        }
        return count;
    }

    /** Anche uno poi annullato: dal primo acquisto, i posti sono quelli. */
    public static boolean anyPurchase(List<AuctionEvent> events) {
        return events.stream().anyMatch(AuctionEvent.PlayerPurchased.class::isInstance);
    }

    public static int spentBy(List<AuctionEvent> events, String participantId) {
        Map<Long, AuctionEvent.PlayerPurchased> active = new LinkedHashMap<>();
        Map<Long, String> buyer = new HashMap<>();
        Map<Long, Integer> price = new HashMap<>();
        for (AuctionEvent event : events) {
            switch (event) {
                case AuctionEvent.PlayerPurchased p -> {
                    active.put(p.seq(), p);
                    buyer.put(p.seq(), p.participantId());
                    price.put(p.seq(), p.price());
                }
                case AuctionEvent.PurchaseRevoked r -> active.remove(r.targetSeq());
                case AuctionEvent.PurchaseCorrected c -> {
                    if (active.containsKey(c.targetSeq())) {
                        buyer.put(c.targetSeq(), c.newParticipantId());
                        price.put(c.targetSeq(), c.newPrice());
                    }
                }
                default -> {
                    // nome e fasi non spostano crediti
                }
            }
        }
        int spent = 0;
        for (Long seq : active.keySet()) {
            if (participantId.equals(buyer.get(seq))) {
                spent += price.get(seq);
            }
        }
        return spent;
    }

    public static Role phase(List<AuctionEvent> events, Role fallback) {
        Role phase = fallback;
        for (AuctionEvent e : events) {
            if (e instanceof AuctionEvent.PhaseAdvanced advanced) {
                phase = advanced.role();
            }
        }
        return phase;
    }

    public static Instant lastWritten(List<AuctionEvent> events) {
        return events.isEmpty() ? null : events.getLast().at();
    }
}
```

`application/service/auction/LeagueAuctionService.java`:

```java
package com.fantaagent.application.service.auction;

import com.fantaagent.application.port.out.AuctionEventStores;
import com.fantaagent.application.port.out.AuctionRecord;
import com.fantaagent.application.port.out.AuctionRepository;
import com.fantaagent.application.port.out.LeagueMember;
import com.fantaagent.application.port.out.LeagueRepository;
import com.fantaagent.application.port.out.Seat;
import com.fantaagent.application.port.out.Transactions;
import com.fantaagent.application.service.league.AdminCannotLeaveException;
import com.fantaagent.application.service.league.InvalidLeagueDataException;
import com.fantaagent.application.service.league.LeagueAccess;
import com.fantaagent.application.service.league.LeagueService;
import com.fantaagent.config.AuctionSettings;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.player.Role;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Le aste di una lega viste dall'esterno: crearle, elencarle, rinominarle,
 * cancellarle, sistemarne i posti. Cio' che succede DENTRO un'asta — acquisti, fasi,
 * valutazioni — passa da {@link AuctionRegistry}.
 */
public class LeagueAuctionService {

    static final int MAX_NAME = 60;

    private final AuctionRepository auctions;
    private final LeagueRepository leagues;
    private final AuctionEventStores stores;
    private final Transactions tx;
    private final Clock clock;
    private final List<Role> phases;

    public LeagueAuctionService(AuctionRepository auctions, LeagueRepository leagues,
                                AuctionEventStores stores, Transactions tx, Clock clock, List<Role> phases) {
        this.auctions = auctions;
        this.leagues = leagues;
        this.stores = stores;
        this.tx = tx;
        this.clock = clock;
        this.phases = List.copyOf(phases);
    }

    /**
     * I posti sono i membri di adesso, in ordine d'ingresso nella lega: e' il turno di
     * chiamata di partenza, che l'amministratore puo' cambiare. Asta, posti ed evento di
     * avvio nella stessa transazione: un'asta senza registro non comparirebbe mai
     * iniziata, uno senza posti non si potrebbe giocare.
     */
    public AuctionRecord create(LeagueAccess access, String name) {
        access.requireAdmin();
        String clean = cleanName(name);
        List<LeagueMember> members = leagues.members(access.leagueId());
        if (members.size() < 2) {
            throw new NotEnoughMembersException();
        }
        List<Seat> seats = new ArrayList<>();
        for (int i = 0; i < members.size(); i++) {
            LeagueMember m = members.get(i);
            seats.add(new Seat(m.userId(), m.teamName(), m.initial(), i + 1));
        }
        Instant now = clock.instant();
        AuctionRecord auction = new AuctionRecord(UUID.randomUUID(), access.leagueId(), clean,
                access.userId(), now, null, access.league().rules(), access.league().scoring(),
                access.league().bidder());
        tx.run(() -> {
            auctions.insert(auction, seats);
            stores.open(auction.id(), access.userId())
                    .append(new AuctionEvent.AuctionStarted(1, now, clean));
        });
        return auction;
    }

    public List<AuctionCard> list(LeagueAccess access) {
        List<AuctionCard> cards = new ArrayList<>();
        String me = access.userId().toString();
        for (AuctionRecord a : auctions.byLeague(access.leagueId())) {
            List<AuctionEvent> events = stores.open(a.id(), access.userId()).load();
            List<Seat> seats = auctions.seats(a.id());
            int slotsPerTeam = a.rules().slots().values().stream().mapToInt(Integer::intValue).sum();
            boolean seated = seats.stream().anyMatch(s -> s.userId().equals(access.userId()));
            cards.add(new AuctionCard(a.id(), a.name(), a.createdAt(), LogSummary.lastWritten(events),
                    LogSummary.purchases(events), LogSummary.phase(events, phases.getFirst()),
                    seats.size(), a.rules().budget(), seats.size() * slotsPerTeam,
                    seated ? a.rules().budget() - LogSummary.spentBy(events, me) : null));
        }
        return List.copyOf(cards);
    }

    /** @throws AuctionNotFoundException se non esiste, e' cancellata o e' di un'altra lega */
    public AuctionRecord find(LeagueAccess access, UUID auctionId) {
        return auctions.byId(auctionId)
                .filter(a -> a.leagueId().equals(access.leagueId()))
                .filter(a -> a.deletedAt() == null)
                .orElseThrow(() -> new AuctionNotFoundException(auctionId));
    }

    public void rename(LeagueAccess access, UUID auctionId, String name) {
        access.requireAdmin();
        find(access, auctionId);
        auctions.rename(auctionId, cleanName(name));
    }

    public void updateBidder(LeagueAccess access, UUID auctionId, AuctionSettings bidder) {
        access.requireAdmin();
        find(access, auctionId);
        auctions.updateBidder(auctionId, bidder);
    }

    public void delete(LeagueAccess access, UUID auctionId) {
        access.requireAdmin();
        find(access, auctionId);
        auctions.softDelete(auctionId, clock.instant());
    }

    public List<Seat> seats(LeagueAccess access, UUID auctionId) {
        find(access, auctionId);
        return auctions.seats(auctionId);
    }

    public boolean seatsLocked(LeagueAccess access, UUID auctionId) {
        find(access, auctionId);
        return LogSummary.anyPurchase(stores.open(auctionId, access.userId()).load());
    }

    public List<Seat> replaceSeats(LeagueAccess access, UUID auctionId, List<SeatRequest> requested) {
        access.requireAdmin();
        find(access, auctionId);
        Set<UUID> members = leagues.members(access.leagueId()).stream()
                .map(LeagueMember::userId).collect(Collectors.toSet());
        List<Seat> wanted = new ArrayList<>();
        Set<UUID> seen = new HashSet<>();
        Set<Character> initials = new HashSet<>();
        for (SeatRequest r : requested) {
            Map<String, List<String>> problems = LeagueService.memberProblems(r.teamName(), r.initial());
            if (!problems.isEmpty()) {
                throw new InvalidLeagueDataException(problems);
            }
            if (r.userId() == null || !members.contains(r.userId()) || !seen.add(r.userId())) {
                throw new InvalidLeagueDataException(Map.of("seats",
                        List.of("Ogni posto va a un membro diverso della lega.")));
            }
            char initial = LeagueService.initialOf(r.initial());
            if (!initials.add(initial)) {
                throw new InvalidLeagueDataException(Map.of("seats",
                        List.of("Due posti non possono avere la stessa iniziale: " + initial + ".")));
            }
            wanted.add(new Seat(r.userId(), r.teamName().trim(), initial, wanted.size() + 1));
        }
        if (wanted.size() < 2) {
            throw new NotEnoughMembersException();
        }
        if (seatsLocked(access, auctionId) && !sameSeatsIgnoringOrder(auctions.seats(auctionId), wanted)) {
            throw new SeatsLockedException();
        }
        tx.run(() -> auctions.replaceSeats(auctionId, wanted));
        return auctions.seats(auctionId);
    }

    /**
     * Lasciare la lega (se {@code userId} e' chi chiede) o toglierne un membro (se e'
     * l'amministratore). Nelle aste dove si e' gia' comprato il posto resta — una rosa
     * pagata non sparisce; in quelle ancora da iniziare si toglie.
     */
    public void removeMember(LeagueAccess access, UUID userId) {
        if (userId.equals(access.userId())) {
            if (access.isAdmin()) {
                throw new AdminCannotLeaveException();
            }
        } else {
            access.requireAdmin();
        }
        tx.run(() -> {
            for (UUID auctionId : auctions.auctionsWithSeat(access.leagueId(), userId)) {
                if (!LogSummary.anyPurchase(stores.open(auctionId, access.userId()).load())) {
                    auctions.removeSeat(auctionId, userId);
                }
            }
            leagues.deleteMember(access.leagueId(), userId);
        });
    }

    private static boolean sameSeatsIgnoringOrder(List<Seat> current, List<Seat> wanted) {
        record Key(UUID userId, String teamName, char initial) {
        }
        Set<Key> a = current.stream().map(s -> new Key(s.userId(), s.teamName(), s.initial()))
                .collect(Collectors.toSet());
        Set<Key> b = wanted.stream().map(s -> new Key(s.userId(), s.teamName(), s.initial()))
                .collect(Collectors.toSet());
        return current.size() == wanted.size() && a.equals(b);
    }

    private static String cleanName(String name) {
        String clean = name == null ? "" : name.trim();
        if (clean.isEmpty()) {
            throw new InvalidLeagueDataException(Map.of("name", List.of(
                    "Dai un nome all'asta: serve a riconoscerla nell'elenco.")));
        }
        if (clean.length() > MAX_NAME) {
            throw new InvalidLeagueDataException(Map.of("name", List.of(
                    "Il nome dell'asta non può superare " + MAX_NAME + " caratteri.")));
        }
        return clean;
    }
}
```

Il nome dell'asta vive in `auction.name`; rinominare non aggiunge più un `AuctionRenamed` al registro. Il registro conserva il nome di avvio (e le rinomine delle aste importate); la colonna è ciò che si mostra.

- [ ] **Step 6: L'adattatore**

`adapter/out/jdbc/JdbcAuctionRepository.java`:

```java
package com.fantaagent.adapter.out.jdbc;

import com.fantaagent.application.port.out.AuctionRecord;
import com.fantaagent.application.port.out.AuctionRepository;
import com.fantaagent.application.port.out.Seat;
import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.LeagueRulesSettings;
import com.fantaagent.config.ScoringSettings;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static com.fantaagent.adapter.out.jdbc.Columns.fromJson;
import static com.fantaagent.adapter.out.jdbc.Columns.instant;
import static com.fantaagent.adapter.out.jdbc.Columns.json;
import static com.fantaagent.adapter.out.jdbc.Columns.ts;

public class JdbcAuctionRepository implements AuctionRepository {

    private static final String COLUMNS =
            "id, league_id, name, created_by, created_at, deleted_at, rules, scoring, bidder";

    private final JdbcClient jdbc;
    private final ObjectMapper mapper;

    public JdbcAuctionRepository(JdbcClient jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    @Override
    public void insert(AuctionRecord a, List<Seat> seats) {
        jdbc.sql("""
                        INSERT INTO auction (id, league_id, name, created_by, created_at, deleted_at,
                                             rules, scoring, bidder)
                        VALUES (:id, :league, :name, :by, :at, :deleted, CAST(:rules AS jsonb),
                                CAST(:scoring AS jsonb), CAST(:bidder AS jsonb))
                        """)
                .param("id", a.id()).param("league", a.leagueId()).param("name", a.name())
                .param("by", a.createdBy()).param("at", ts(a.createdAt())).param("deleted", ts(a.deletedAt()))
                .param("rules", json(mapper, a.rules())).param("scoring", json(mapper, a.scoring()))
                .param("bidder", json(mapper, a.bidder()))
                .update();
        insertSeats(a.id(), seats);
    }

    @Override
    public Optional<AuctionRecord> byId(UUID id) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM auction WHERE id = :id")
                .param("id", id).query(this::map).optional();
    }

    @Override
    public List<AuctionRecord> byLeague(UUID leagueId) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM auction WHERE league_id = :league AND deleted_at IS NULL"
                        + " ORDER BY created_at DESC")
                .param("league", leagueId).query(this::map).list();
    }

    @Override
    public void rename(UUID id, String name) {
        jdbc.sql("UPDATE auction SET name = :name WHERE id = :id").param("name", name).param("id", id).update();
    }

    @Override
    public void updateBidder(UUID id, AuctionSettings bidder) {
        jdbc.sql("UPDATE auction SET bidder = CAST(:bidder AS jsonb) WHERE id = :id")
                .param("bidder", json(mapper, bidder)).param("id", id).update();
    }

    @Override
    public void softDelete(UUID id, Instant at) {
        jdbc.sql("UPDATE auction SET deleted_at = :at WHERE id = :id AND deleted_at IS NULL")
                .param("at", ts(at)).param("id", id).update();
    }

    @Override
    public List<Seat> seats(UUID auctionId) {
        return jdbc.sql("SELECT user_id, team_name, initial, position FROM auction_seat"
                        + " WHERE auction_id = :a ORDER BY position")
                .param("a", auctionId)
                .query((rs, row) -> new Seat(rs.getObject("user_id", UUID.class), rs.getString("team_name"),
                        rs.getString("initial").charAt(0), rs.getInt("position")))
                .list();
    }

    /** Nella transazione di chi chiama: il vincolo sulla posizione e' differito apposta. */
    @Override
    public void replaceSeats(UUID auctionId, List<Seat> seats) {
        jdbc.sql("DELETE FROM auction_seat WHERE auction_id = :a").param("a", auctionId).update();
        insertSeats(auctionId, seats);
    }

    @Override
    public void removeSeat(UUID auctionId, UUID userId) {
        jdbc.sql("DELETE FROM auction_seat WHERE auction_id = :a AND user_id = :u")
                .param("a", auctionId).param("u", userId).update();
    }

    @Override
    public List<UUID> auctionsWithSeat(UUID leagueId, UUID userId) {
        return jdbc.sql("""
                        SELECT s.auction_id FROM auction_seat s JOIN auction a ON a.id = s.auction_id
                        WHERE a.league_id = :league AND s.user_id = :user AND a.deleted_at IS NULL
                        """)
                .param("league", leagueId).param("user", userId).query(UUID.class).list();
    }

    @Override
    public void lockForWrite(UUID auctionId) {
        jdbc.sql("SELECT id FROM auction WHERE id = :id FOR UPDATE").param("id", auctionId).query(UUID.class).list();
    }

    private void insertSeats(UUID auctionId, List<Seat> seats) {
        for (Seat s : seats) {
            jdbc.sql("INSERT INTO auction_seat (auction_id, user_id, team_name, initial, position)"
                            + " VALUES (:a, :u, :team, :initial, :pos)")
                    .param("a", auctionId).param("u", s.userId()).param("team", s.teamName())
                    .param("initial", String.valueOf(s.initial())).param("pos", s.position())
                    .update();
        }
    }

    private AuctionRecord map(ResultSet rs, int row) throws SQLException {
        return new AuctionRecord(rs.getObject("id", UUID.class), rs.getObject("league_id", UUID.class),
                rs.getString("name"), rs.getObject("created_by", UUID.class),
                instant(rs.getTimestamp("created_at")), instant(rs.getTimestamp("deleted_at")),
                fromJson(mapper, rs.getString("rules"), LeagueRulesSettings.class),
                fromJson(mapper, rs.getString("scoring"), ScoringSettings.class),
                fromJson(mapper, rs.getString("bidder"), AuctionSettings.class));
    }
}
```

`auction_seat` non è append-only: i posti si riscrivono finché l'asta non inizia, e l'ordine anche dopo. La garanzia append-only resta sul registro.

In `PersistenceConfig`:

```java
    @Bean
    public AuctionRepository auctionRepository(JdbcClient jdbc, ObjectMapper json) {
        return new JdbcAuctionRepository(jdbc, json);
    }

    @Bean
    public LeagueAuctionService leagueAuctionService(AuctionRepository auctions, LeagueRepository leagues,
                                                     AuctionEventStores stores, Transactions tx,
                                                     Clock clock, LeagueProperties props) {
        return new LeagueAuctionService(auctions, leagues, stores, tx, clock, props.phases());
    }
```

- [ ] **Step 7: Eseguire il test e vederlo passare**

Run: `mvn -q test -Dtest=LeagueAuctionServiceTest`
Expected: PASS.

- [ ] **Step 8: Mutazione**

In `replaceSeats` togliere temporaneamente il controllo `seatsLocked(...) && !sameSeatsIgnoringOrder(...)`: `dopoIlPrimoAcquistoSiCambiaSoloLOrdine` deve fallire. Ripristinare. Poi in `removeMember` togliere la condizione `!LogSummary.anyPurchase(...)`: `chiEsceLasciaIlPostoDoveHaGiaComprato` deve fallire. Ripristinare.

- [ ] **Step 9: Commit**

```bash
git add src/main/java src/test/java
git commit -m "Aste nella lega: i membri come posti, fissi dal primo acquisto tranne il turno

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Un'asta per richiesta, vista da chi chiede

**Files:**
- Modify: `domain/auction/AuctionProjector.java`, `domain/auction/AuctionState.java`
- Create: `application/service/auction/AuctionRegistry.java`, `AuctionView.java`, `AuctionWriteLock.java`, `NoSeatException.java`
- Modify: `config/PersistenceConfig.java`
- Test: `src/test/java/com/fantaagent/domain/auction/AuctionProjectorTest.java` (caso nuovo), `src/test/java/com/fantaagent/application/service/auction/AuctionRegistryTest.java`

**Interfaces:**
- Consumes: `LeagueAuctionService.find`, `AuctionRepository.seats`, `AuctionEventStores`, `PlayerCatalog`, `AuctionTemplate.scoringRules`, `ValuationChain.build`, i costruttori esistenti `AuctionService(PlayerCatalog, Supplier<AuctionScope>)`, `PlayerAnalysisService(PlayerCatalog, Supplier<ValuationChain>, AuctionService)`, `PlayerSearchService(PlayerCatalog, Supplier<ValuationChain>, AuctionService, PlayerAnalysisService)`.
- Produces:
  - `AuctionProjector.project(...)`: senza nessun partecipante `me`, `myParticipantId` è `null` invece di un'eccezione.
  - `AuctionState.mySquad()`: con `myParticipantId == null` lancia `IllegalStateException("nessun posto per chi guarda")`.
  - `AuctionRegistry(LeagueAuctionService auctions, AuctionRepository repository, AuctionEventStores stores, PlayerCatalog catalog, AuctionTemplate template, List<Double> seasonWeights, List<Role> phases, Transactions tx)` con `AuctionView view(LeagueAccess access, UUID auctionId)`.
  - `record AuctionView(AuctionRecord auction, LeagueAccess access, List<Participant> participants, LeagueRules rules, ValuationChain chain, Optional<String> mySeat, AuctionService service, PlayerAnalysisService analysis, PlayerSearchService search, AuctionWriteLock lock)` con `String requireSeat()` e `<T> T write(Supplier<T> work)`.
  - `record AuctionWriteLock(Transactions tx, AuctionRepository repository, UUID auctionId)` con `<T> T write(Supplier<T> work)`: apre una transazione, blocca la riga dell'asta, esegue.
  - `NoSeatException()` → 403 `no-seat`.

Il dominio cambia in un solo punto e per una sola ragione: un membro senza posto (entrato dopo il primo acquisto) deve poter vedere stato e rose. Prima il proiettore lo rifiutava perché nessun partecipante era segnato `me`; ora proietta e lascia vuoto il posto di chi guarda. Chi chiede i consigli di un posto vuoto si ferma prima, con `NoSeatException`.

- [ ] **Step 1: Scrivere i test che falliscono**

In `src/test/java/com/fantaagent/domain/auction/AuctionProjectorTest.java` (usa già `RULES` e un `LOOKUP` di tipo `RoleLookup`; nessun suo caso si aspetta l'eccezione «no participant flagged as me»), aggiungere:

```java
    @Test
    void senzaUnPostoPerChiGuardaLoStatoSiProiettaLoStesso() {
        List<Participant> nobodyIsMe = PARTICIPANTS.stream()
                .map(p -> new Participant(p.id(), p.name(), p.initial(), false))
                .toList();

        AuctionState state = AuctionProjector.project(RULES, nobodyIsMe, LOOKUP, List.of());

        assertThat(state.myParticipantId()).isNull();
        assertThat(state.squadOf(nobodyIsMe.getFirst().id()).budgetRemaining()).isEqualTo(RULES.budget());
        assertThatThrownBy(state::mySquad).isInstanceOf(IllegalStateException.class);
    }
```

(`PARTICIPANTS`, `RULES`, `LOOKUP` sono le costanti del file; se hanno altri nomi, usare quelli. Import `assertThatThrownBy` se manca.)

`src/test/java/com/fantaagent/application/service/auction/AuctionRegistryTest.java`:

```java
package com.fantaagent.application.service.auction;

import com.fantaagent.application.port.out.AuctionRecord;
import com.fantaagent.application.service.league.LeagueAccess;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.testsupport.Fixtures;
import com.fantaagent.testsupport.PortalWorld;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AuctionRegistryTest {

    private PortalWorld world;
    private AuctionRegistry registry;
    private LeagueAccess admin;
    private UUID bruno;
    private AuctionRecord auction;

    @BeforeEach
    void setUp() {
        world = new PortalWorld();
        registry = new AuctionRegistry(world.auctions, world.auctionRepository, world.stores, world.catalog,
                Fixtures.template(), List.of(1.0), PortalWorld.PHASES, world.tx);
        admin = world.league("anna", "bruno", "carla");
        bruno = world.userId(admin, "bruno FC");
        auction = world.auctions.create(admin, "Asta");
    }

    @Test
    void ilPostoDiChiGuardaEQuelloDellUtente() {
        AuctionView view = registry.view(world.as(admin, bruno), auction.id());

        assertThat(view.mySeat()).contains(bruno.toString());
        assertThat(view.participants()).filteredOn(Participant::me)
                .singleElement().extracting(Participant::id).isEqualTo(bruno.toString());
        assertThat(view.service().state().myParticipantId()).isEqualTo(bruno.toString());
    }

    @Test
    void dueUtentiVedonoLoStessoStatoMaConPostiDiversi() {
        AuctionView anna = registry.view(admin, auction.id());
        AuctionView b = registry.view(world.as(admin, bruno), auction.id());
        anna.write(() -> anna.service().recordPurchase("P1", bruno.toString(), 30, "r-1"));

        assertThat(b.service().state().squadOf(bruno.toString()).budgetRemaining()).isEqualTo(470);
        assertThat(b.service().state().mySquad().budgetRemaining()).isEqualTo(470);
        assertThat(anna.service().state().mySquad().budgetRemaining()).isEqualTo(500);
    }

    @Test
    void iConsigliSonoCalcolatiSulPostoDiChiChiede() {
        AuctionView anna = registry.view(admin, auction.id());
        anna.service().recordPurchase("P1", bruno.toString(), 400, "r-1");

        int annaCap = registry.view(admin, auction.id()).analysis().analyze("D1").hardCap();
        int brunoCap = registry.view(world.as(admin, bruno), auction.id()).analysis().analyze("D1").hardCap();

        assertThat(brunoCap).isLessThan(annaCap);
    }

    @Test
    void chiScriveFirmaLEvento() {
        registry.view(admin, auction.id()).service().recordPurchase("P1", bruno.toString(), 30, "r-1");
        assertThat(world.jdbc.sql("SELECT actor_id FROM auction_event WHERE seq = 2").query(UUID.class).single())
                .isEqualTo(admin.userId());
    }

    @Test
    void unMembroSenzaPostoVedeLoStatoMaNonHaConsigli() {
        registry.view(admin, auction.id()).service().recordPurchase("P1", bruno.toString(), 30, "r-1");
        UUID late = world.user("dario");
        world.join(admin, late, "dario");

        AuctionView view = registry.view(world.as(admin, late), auction.id());

        assertThat(view.mySeat()).isEmpty();
        assertThat(view.service().state().holdings()).hasSize(1);
        assertThatThrownBy(view::requireSeat).isInstanceOf(NoSeatException.class);
    }

    @Test
    void laCatenaSiRiusaFinchePostiERegoleNonCambiano() {
        AuctionView first = registry.view(admin, auction.id());
        AuctionView second = registry.view(world.as(admin, bruno), auction.id());
        assertThat(second.chain()).isSameAs(first.chain());

        world.auctions.removeMember(admin, world.userId(admin, "carla FC"));
        AuctionView third = registry.view(admin, auction.id());
        assertThat(third.chain()).isNotSameAs(first.chain());
        assertThat(third.rules().participants()).isEqualTo(2);
    }

    @Test
    void unAstaDiUnAltraLegaNonSiApre() {
        LeagueAccess other = world.league("enzo", "fabio");
        assertThatThrownBy(() -> registry.view(other, auction.id()))
                .isInstanceOf(AuctionNotFoundException.class);
    }

    @Test
    void ilRegistroScrittoPrimaDellaVistaEGiaDentro() {
        world.stores.open(auction.id(), admin.userId())
                .append(new AuctionEvent.PhaseAdvanced(2, java.time.Instant.now(), com.fantaagent.domain.player.Role.D));
        assertThat(registry.view(admin, auction.id()).service().state().currentPhase())
                .isEqualTo(com.fantaagent.domain.player.Role.D);
    }
}
```

`hardCap` è il campo di `PriceRecommendation` usato da `PlayerDtos.ValuationResponse`; se il nome differisce, usare quello che `ValuationResponse.from` legge.

- [ ] **Step 2: Eseguire i test e vederli fallire**

Run: `mvn -q test -Dtest='AuctionProjectorTest,AuctionRegistryTest'`
Expected: FAIL — `AuctionRegistry` non esiste; il proiettore lancia «no participant flagged as me».

- [ ] **Step 3: Il dominio**

In `AuctionProjector.project`, sostituire:

```java
        String me = participants.stream()
                .filter(Participant::me)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("no participant flagged as me"))
                .id();
```

con:

```java
        // Chi guarda puo' non avere un posto: un membro entrato nella lega dopo il primo
        // acquisto vede l'asta ma non ci gioca. Lo stato si proietta lo stesso; e'
        // mySquad() a rifiutarsi, cioe' solo chi chiede i consigli di un posto che non c'e'.
        String me = participants.stream()
                .filter(Participant::me)
                .findFirst()
                .map(Participant::id)
                .orElse(null);
```

In `AuctionState.mySquad()`:

```java
    public Squad mySquad() {
        if (myParticipantId == null) {
            throw new IllegalStateException("nessun posto per chi guarda");
        }
        return squadOf(myParticipantId);
    }
```

- [ ] **Step 4: Il registro delle aste**

`application/service/auction/NoSeatException.java`:

```java
package com.fantaagent.application.service.auction;

public class NoSeatException extends RuntimeException {

    public NoSeatException() {
        super("Non hai un posto in quest'asta: i consigli non sono disponibili.");
    }
}
```

`application/service/auction/AuctionView.java`:

```java
package com.fantaagent.application.service.auction;

import com.fantaagent.application.port.out.AuctionRecord;
import com.fantaagent.application.service.AuctionService;
import com.fantaagent.application.service.PlayerAnalysisService;
import com.fantaagent.application.service.PlayerSearchService;
import com.fantaagent.application.service.ValuationChain;
import com.fantaagent.application.service.league.LeagueAccess;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;

import java.util.List;
import java.util.Optional;

/**
 * Un'asta come la vede una persona, per la durata di una richiesta.
 *
 * <p>I servizi dentro sono quelli di sempre, istanziati su questo scope: leggono lo
 * stato dal registro dell'asta dell'URL, con i partecipanti in cui {@code me} e' il
 * posto di chi chiede. Per questo nessun endpoint puo' valutare "per il posto X": il
 * posto non e' un parametro, e' una proprieta' di questa vista.
 *
 * @param mySeat il posto di chi guarda; vuoto se e' membro della lega ma non gioca
 *               quest'asta
 */
public record AuctionView(AuctionRecord auction, LeagueAccess access, List<Participant> participants,
                          LeagueRules rules, ValuationChain chain, Optional<String> mySeat,
                          AuctionService service, PlayerAnalysisService analysis,
                          PlayerSearchService search, AuctionWriteLock lock) {

    /** @throws NoSeatException se chi guarda non ha un posto: senza posto, niente consigli */
    public String requireSeat() {
        return mySeat.orElseThrow(NoSeatException::new);
    }

    /** Ogni scrittura nel registro passa di qui: in fila con le altre sulla stessa asta. */
    public <T> T write(java.util.function.Supplier<T> work) {
        return lock.write(work);
    }
}
```

`application/service/auction/AuctionWriteLock.java`:

```java
package com.fantaagent.application.service.auction;

import com.fantaagent.application.port.out.AuctionRepository;
import com.fantaagent.application.port.out.Transactions;

import java.util.UUID;
import java.util.function.Supplier;

/**
 * Le scritture di un'asta, una alla volta. Lettura del registro, controlli e INSERT
 * stanno nella stessa transazione, dietro il lock della riga dell'asta: chi arriva
 * secondo aspetta e poi legge uno stato che contiene gia' la scrittura del primo.
 *
 * <p>Senza questo, due rilanci nello stesso istante si scontrerebbero sul numero di
 * sequenza e uno dovrebbe riprovare; con molte scritture fitte, qualcuno riproverebbe
 * piu' volte di fila e perderebbe. La chiave primaria e la rivalidazione di
 * {@code AuctionService} restano come rete, per chi scrivesse senza passare di qui.
 */
public record AuctionWriteLock(Transactions tx, AuctionRepository repository, UUID auctionId) {

    public <T> T write(Supplier<T> work) {
        return tx.inTransaction(() -> {
            repository.lockForWrite(auctionId);
            return work.get();
        });
    }
}
```

`application/service/auction/AuctionRegistry.java`:

```java
package com.fantaagent.application.service.auction;

import com.fantaagent.application.port.out.AuctionEventStore;
import com.fantaagent.application.port.out.AuctionEventStores;
import com.fantaagent.application.port.out.AuctionRecord;
import com.fantaagent.application.port.out.AuctionRepository;
import com.fantaagent.application.port.out.AuctionTemplate;
import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.application.port.out.Seat;
import com.fantaagent.application.port.out.Transactions;
import com.fantaagent.application.service.AuctionScope;
import com.fantaagent.application.service.AuctionService;
import com.fantaagent.application.service.PlayerAnalysisService;
import com.fantaagent.application.service.PlayerSearchService;
import com.fantaagent.application.service.ValuationChain;
import com.fantaagent.application.service.league.LeagueAccess;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Role;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Prende il posto di {@code AuctionRuntime} per l'API: non c'e' piu' "l'asta
 * selezionata" del processo, c'e' l'asta dell'URL, ricostruita per chi la chiede.
 *
 * <p><b>Cosa si ricalcola e cosa no.</b> Stato e posti si rileggono a ogni richiesta:
 * sono qualche centinaio di righe, e cosi' nessuna cache puo' divergere dal registro.
 * La {@link ValuationChain} no: proiettare l'intero catalogo costa, e la catena
 * dipende solo da regole e punteggio dell'asta — fissi dalla creazione — e dal numero
 * di squadre. Se ne tiene una per (asta, squadre), e quando i posti cambiano prima
 * dell'inizio la chiave cambia con loro.
 *
 * <p><b>Atomicita'.</b> Ogni vista e' un oggetto nuovo e immutabile, costruito per
 * intero prima di essere usato: la garanzia di {@code AuctionRuntime} — chi legge vede
 * tutto il vecchio o tutto il nuovo — vale per costruzione, senza campi volatili.
 */
public class AuctionRegistry {

    static final int MAX_CHAINS = 32;

    private record ChainKey(UUID auctionId, int teams) {
    }

    private final LeagueAuctionService auctions;
    private final AuctionRepository repository;
    private final AuctionEventStores stores;
    private final PlayerCatalog catalog;
    private final AuctionTemplate template;
    private final List<Double> seasonWeights;
    private final List<Role> phases;
    private final Transactions tx;

    /** Accesso solo sotto il lock dell'istanza: LinkedHashMap in ordine d'accesso non e' thread-safe. */
    private final Map<ChainKey, ValuationChain> chains = new LinkedHashMap<>(16, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<ChainKey, ValuationChain> eldest) {
            return size() > MAX_CHAINS;
        }
    };

    public AuctionRegistry(LeagueAuctionService auctions, AuctionRepository repository,
                           AuctionEventStores stores, PlayerCatalog catalog, AuctionTemplate template,
                           List<Double> seasonWeights, List<Role> phases, Transactions tx) {
        this.auctions = auctions;
        this.repository = repository;
        this.stores = stores;
        this.catalog = catalog;
        this.template = template;
        this.seasonWeights = List.copyOf(seasonWeights);
        this.phases = List.copyOf(phases);
        this.tx = tx;
    }

    /** @throws AuctionNotFoundException se l'asta non e' della lega o e' cancellata */
    public AuctionView view(LeagueAccess access, UUID auctionId) {
        AuctionRecord auction = auctions.find(access, auctionId);
        UUID viewer = access.userId();
        List<Seat> seats = repository.seats(auctionId).stream()
                .sorted(Comparator.comparingInt(Seat::position)).toList();
        List<Participant> participants = seats.stream()
                .map(s -> new Participant(s.userId().toString(), s.teamName(), s.initial(),
                        s.userId().equals(viewer)))
                .toList();
        Optional<String> mySeat = seats.stream().anyMatch(s -> s.userId().equals(viewer))
                ? Optional.of(viewer.toString())
                : Optional.empty();

        LeagueRules rules = auction.rules().toRules(participants.size(), phases);
        ValuationChain chain = chainFor(auction, rules);
        AuctionEventStore store = stores.open(auctionId, viewer);
        AuctionScope scope = new AuctionScope(auctionId.toString(), store, participants, rules);
        AuctionService service = new AuctionService(catalog, () -> scope);
        PlayerAnalysisService analysis = new PlayerAnalysisService(catalog, () -> chain, service);
        PlayerSearchService search = new PlayerSearchService(catalog, () -> chain, service, analysis);
        return new AuctionView(auction, access, participants, rules, chain, mySeat, service, analysis, search,
                new AuctionWriteLock(tx, repository, auctionId));
    }

    private synchronized ValuationChain chainFor(AuctionRecord auction, LeagueRules rules) {
        return chains.computeIfAbsent(new ChainKey(auction.id(), rules.participants()),
                key -> ValuationChain.build(rules, template.scoringRules(auction.scoring()),
                        catalog, seasonWeights));
    }
}
```

`PlayerSearchService` costruisce un indice dei nomi del catalogo a ogni istanza: per qualche centinaio di giocatori costa meno di un millisecondo. Se la misura dice altro, l'indice si sposta nella cache insieme alla catena.

In `PersistenceConfig`:

```java
    @Bean
    public AuctionRegistry auctionRegistry(LeagueAuctionService auctions, AuctionRepository repository,
                                           AuctionEventStores stores, PlayerCatalog catalog,
                                           ConfigAuctionTemplate template, LeagueProperties props,
                                           Transactions tx) {
        return new AuctionRegistry(auctions, repository, stores, catalog, template,
                props.scoring().seasonWeights(), props.phases(), tx);
    }
```

- [ ] **Step 5: Eseguire i test e vederli passare**

Run: `mvn -q test -Dtest='AuctionProjectorTest,AuctionRegistryTest'` e poi `mvn -q test`.
Expected: PASS.

- [ ] **Step 6: Mutazione**

In `AuctionRegistry.view` calcolare `me` come `s.position() == 1` invece che dall'utente: `ilPostoDiChiGuardaEQuelloDellUtente` e `iConsigliSonoCalcolatiSulPostoDiChiChiede` devono fallire. Ripristinare.

- [ ] **Step 7: Commit**

```bash
git add src/main/java src/test/java
git commit -m "Un'asta per richiesta: il posto di chi guarda viene dall'accesso, non dalla richiesta

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Scritture che reggono la concorrenza, e la correzione

**Files:**
- Modify: `application/service/AuctionService.java`
- Test: `src/test/java/com/fantaagent/application/service/AuctionServiceConflictTest.java`, `src/test/java/com/fantaagent/application/service/PurchaseCorrectionTest.java`, `src/test/java/com/fantaagent/application/service/auction/ConcurrentWritesTest.java`

**Interfaces:**
- Consumes: `ConcurrentAppendException`, `DuplicateRequestException` (Task 2); `PortalWorld`, `AuctionRegistry` (Task 10-11).
- Produces:
  - `AuctionService.correctPurchase(long targetSeq, String newParticipantId, int newPrice)`.
  - `AuctionService.version(): long` — il seq dell'ultimo evento.
  - `recordPurchase`, `undoLast`, `revokePurchase`, `selectPhase`, `correctPurchase` ritentano fino a 3 volte su `ConcurrentAppendException`, **rifacendo ogni controllo**; al terzo conflitto la lasciano salire. `recordPurchase` su `DuplicateRequestException` restituisce l'evento già registrato.

**Due livelli, e perché.** Le scritture che arrivano dall'API passano da `AuctionView.write` (Task 11): lock sulla riga dell'asta, poi lettura, controlli e INSERT nella stessa transazione. Così due scritture sulla stessa asta si mettono in fila e il conflitto sul numero non avviene. La ripetizione con rivalidazione dentro `AuctionService` è la rete per chi scrive senza lock (test, import, un domani un processo diverso). La specifica, §4.2, lo dice già così.

- [ ] **Step 1: Scrivere i test che falliscono**

`src/test/java/com/fantaagent/application/service/AuctionServiceConflictTest.java`:

```java
package com.fantaagent.application.service;

import com.fantaagent.adapter.out.file.InMemoryPlayerCatalog;
import com.fantaagent.application.port.out.AuctionEventStore;
import com.fantaagent.application.port.out.ConcurrentAppendException;
import com.fantaagent.application.port.out.DuplicateRequestException;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.function.LongFunction;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Cosa succede quando un'altra richiesta scrive fra la lettura e la scrittura. Lo
 * store di prova simula l'altra richiesta: al momento dell'append inserisce prima
 * l'evento "concorrente" e poi rifiuta il seq, esattamente come farebbe la chiave
 * primaria su Postgres.
 */
class AuctionServiceConflictTest {

    private static final LeagueRules RULES = new LeagueRules(2, 100,
            Map.of(Role.P, 1, Role.D, 1, Role.C, 1, Role.A, 1), List.of(Role.P, Role.D, Role.C, Role.A));
    private static final List<Participant> PEOPLE = List.of(
            new Participant("a", "Anna", 'A', true), new Participant("b", "Bruno", 'B', false));
    private static final InMemoryPlayerCatalog CATALOG = new InMemoryPlayerCatalog(List.of(
            new Player("p1", "Portiere Uno", "Inter", Role.P, 10),
            new Player("d1", "Difensore Uno", "Milan", Role.D, 10)), List.of());

    /** Uno store che, alle prime N scritture, si fa superare da un evento altrui. */
    static final class RacingStore extends InMemoryEventStore {
        final Deque<LongFunction<AuctionEvent>> intruders = new ArrayDeque<>();
        boolean duplicateOnce;

        @Override
        public AuctionEvent appendWithNextSeq(LongFunction<AuctionEvent> factory) {
            long seq = nextSeq();
            AuctionEvent mine = factory.apply(seq);
            if (!intruders.isEmpty()) {
                super.append(intruders.poll().apply(seq));
                throw new ConcurrentAppendException(seq, null);
            }
            if (duplicateOnce && mine instanceof AuctionEvent.PlayerPurchased p) {
                duplicateOnce = false;
                super.append(mine);
                throw new DuplicateRequestException(p.requestId());
            }
            super.append(mine);
            return mine;
        }
    }

    private static AuctionService service(RacingStore store) {
        store.append(new AuctionEvent.AuctionStarted(1, Instant.now(), "Asta"));
        return new AuctionService(RULES, PEOPLE, CATALOG, store);
    }

    @Test
    void dopoUnConflittoSiRifannoIControlliNonSiRiscriveAllaCieca() {
        RacingStore store = new RacingStore();
        AuctionService service = service(store);
        store.intruders.add(seq -> new AuctionEvent.PlayerPurchased(seq, Instant.now(), "p1", "b", 5));

        assertThatThrownBy(() -> service.recordPurchase("p1", "a", 7, "r-1"))
                .isInstanceOf(PurchaseRejectedException.class)
                .hasMessageContaining("già stato acquistato");
        assertThat(service.state().squadOf("b").playerIds()).containsExactly("p1");
    }

    @Test
    void seIlConflittoNonCambiaNienteLaScritturaPassaColNumeroDopo() {
        RacingStore store = new RacingStore();
        AuctionService service = service(store);
        store.intruders.add(seq -> new AuctionEvent.PhaseAdvanced(seq, Instant.now(), Role.D));

        AuctionEvent.PlayerPurchased written = service.recordPurchase("p1", "a", 7, "r-1");

        assertThat(written.seq()).isEqualTo(3);
        assertThat(service.version()).isEqualTo(3);
    }

    @Test
    void alTerzoConflittoSiArrende() {
        RacingStore store = new RacingStore();
        AuctionService service = service(store);
        for (int i = 0; i < 3; i++) {
            store.intruders.add(seq -> new AuctionEvent.PhaseAdvanced(seq, Instant.now(), Role.D));
        }
        assertThatThrownBy(() -> service.recordPurchase("p1", "a", 7, "r-1"))
                .isInstanceOf(ConcurrentAppendException.class);
    }

    @Test
    void unaRichiestaGiaScrittaDaUnAltroTornaComeScritta() {
        RacingStore store = new RacingStore();
        AuctionService service = service(store);
        store.duplicateOnce = true;

        AuctionEvent.PlayerPurchased written = service.recordPurchase("p1", "a", 7, "r-1");

        assertThat(written.requestId()).isEqualTo("r-1");
        assertThat(service.state().holdings()).hasSize(1);
    }

    @Test
    void ancheIlCambioFaseRiprova() {
        RacingStore store = new RacingStore();
        AuctionService service = service(store);
        store.intruders.add(seq -> new AuctionEvent.PlayerPurchased(seq, Instant.now(), "d1", "b", 5));

        assertThat(service.selectPhase(Role.D)).isTrue();
        assertThat(service.state().currentPhase()).isEqualTo(Role.D);
    }
}
```

`InMemoryEventStore` è `class` package-private e non `final`: `RacingStore` lo estende nello stesso package. Se il costruttore di `AuctionService(LeagueRules, List<Participant>, PlayerCatalog, AuctionEventStore)` chiama `syncResumeSummary()` e legge lo store, va bene: lo store ha già l'evento di avvio.

`src/test/java/com/fantaagent/application/service/PurchaseCorrectionTest.java`:

```java
package com.fantaagent.application.service;

import com.fantaagent.adapter.out.file.InMemoryPlayerCatalog;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Il potere correttivo dell'amministratore: stesso giocatore, altro prezzo o altro acquirente. */
class PurchaseCorrectionTest {

    private static final LeagueRules RULES = new LeagueRules(2, 100,
            Map.of(Role.P, 1, Role.D, 1, Role.C, 1, Role.A, 1), List.of(Role.P, Role.D, Role.C, Role.A));
    private static final List<Participant> PEOPLE = List.of(
            new Participant("a", "Anna", 'A', true), new Participant("b", "Bruno", 'B', false));

    private InMemoryEventStore store;
    private AuctionService service;
    private long seq;

    @BeforeEach
    void setUp() {
        store = new InMemoryEventStore();
        store.append(new AuctionEvent.AuctionStarted(1, Instant.now(), "Asta"));
        service = new AuctionService(RULES, PEOPLE, new InMemoryPlayerCatalog(List.of(
                new Player("p1", "Portiere Uno", "Inter", Role.P, 10),
                new Player("p2", "Portiere Due", "Milan", Role.P, 10)), List.of()), store);
        seq = service.recordPurchase("p1", "a", 40, "r-1").seq();
    }

    @Test
    void siCorreggeIlPrezzo() {
        service.correctPurchase(seq, "a", 55);
        assertThat(service.state().squadOf("a").budgetRemaining()).isEqualTo(45);
        assertThat(store.load().getLast()).isInstanceOf(AuctionEvent.PurchaseCorrected.class);
    }

    @Test
    void siSpostaAUnAltroPosto() {
        service.correctPurchase(seq, "b", 40);
        assertThat(service.state().squadOf("a").playerIds()).isEmpty();
        assertThat(service.state().squadOf("b").playerIds()).containsExactly("p1");
    }

    @Test
    void ilPrezzoLiberatoContaPerLoStessoAcquirente() {
        service.recordPurchase("p2", "b", 60, "r-2");
        service.correctPurchase(seq, "a", 100);
        assertThat(service.state().squadOf("a").budgetRemaining()).isZero();
    }

    @Test
    void nonSiSuperaIlBudgetDelNuovoAcquirente() {
        service.recordPurchase("p2", "b", 70, "r-2");
        assertThatThrownBy(() -> service.correctPurchase(seq, "b", 40))
                .isInstanceOf(PurchaseRejectedException.class);
    }

    @Test
    void nonSiSpostaAChiHaIlRuoloPieno() {
        service.recordPurchase("p2", "b", 10, "r-2");
        assertThatThrownBy(() -> service.correctPurchase(seq, "b", 40))
                .isInstanceOf(PurchaseRejectedException.class);
    }

    @Test
    void unAcquistoAnnullatoNonSiCorregge() {
        service.revokePurchase(seq);
        assertThatThrownBy(() -> service.correctPurchase(seq, "a", 10))
                .isInstanceOf(PurchaseRevocationException.class);
    }
}
```

`src/test/java/com/fantaagent/application/service/auction/ConcurrentWritesTest.java`:

```java
package com.fantaagent.application.service.auction;

import com.fantaagent.application.port.out.AuctionRecord;
import com.fantaagent.application.service.league.LeagueAccess;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.testsupport.Fixtures;
import com.fantaagent.testsupport.PortalWorld;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Due richieste vere, due thread, lo stesso Postgres: la chiave primaria e la
 * rivalidazione insieme fanno si' che nessun acquisto si perda e nessun giocatore
 * finisca in due rose.
 */
class ConcurrentWritesTest {

    @Test
    void acquistiInParalleloNonSiPerdonoENonSiDoppiano() throws Exception {
        PortalWorld world = new PortalWorld();
        AuctionRegistry registry = new AuctionRegistry(world.auctions, world.auctionRepository, world.stores,
                world.catalog, Fixtures.template(), List.of(1.0), PortalWorld.PHASES, world.tx);
        LeagueAccess admin = world.league("anna", "bruno");
        UUID bruno = world.userId(admin, "bruno FC");
        AuctionRecord auction = world.auctions.create(admin, "Asta");

        ExecutorService pool = Executors.newFixedThreadPool(4);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<?>> results = new ArrayList<>();
        for (int i = 1; i <= 8; i++) {
            String player = "D" + i;
            String buyer = (i % 2 == 0 ? admin.userId() : bruno).toString();
            results.add(pool.submit(() -> {
                start.await();
                AuctionView view = registry.view(admin, auction.id());
                return view.write(() -> view.service().recordPurchase(player, buyer, 2, "r-" + player));
            }));
        }
        // Lo stesso giocatore chiesto due volte in parallelo: uno solo lo prende.
        for (int i = 0; i < 2; i++) {
            results.add(pool.submit(() -> {
                start.await();
                AuctionView view = registry.view(admin, auction.id());
                return view.write(() -> view.service()
                        .recordPurchase("C1", bruno.toString(), 3, "r-C1-" + UUID.randomUUID()));
            }));
        }
        start.countDown();
        int failures = 0;
        for (Future<?> f : results) {
            try {
                f.get();
            } catch (java.util.concurrent.ExecutionException e) {
                failures++;
            }
        }
        pool.shutdown();

        List<AuctionEvent> events = world.stores.open(auction.id(), admin.userId()).load();
        assertThat(events).extracting(AuctionEvent::seq)
                .containsExactlyElementsOf(java.util.stream.LongStream.rangeClosed(1, events.size()).boxed().toList());
        assertThat(events).filteredOn(AuctionEvent.PlayerPurchased.class::isInstance).hasSize(9);
        assertThat(failures).isEqualTo(1);
    }
}
```

La rosa da 25 di `Fixtures.template()` ha 8 difensori per squadra: quattro acquisti di difensori a testa ci stanno. Il fallimento atteso è il secondo `C1` (`ALREADY_SOLD`). Col lock il risultato è deterministico: se `failures` supera 1, il lock non sta mettendo in fila le scritture, e il test deve restare rosso finché non si capisce perché.

- [ ] **Step 2: Eseguire i test e vederli fallire**

Run: `mvn -q test -Dtest='AuctionServiceConflictTest,PurchaseCorrectionTest,ConcurrentWritesTest'`
Expected: FAIL — `correctPurchase` e `version` non esistono; senza ripetizione il primo conflitto sale come eccezione.

- [ ] **Step 3: L'implementazione**

In `AuctionService`:

1. Costante e aiuto per i tentativi:

```java
    /**
     * Quante volte rifare un comando quando un'altra richiesta ha preso il numero di
     * sequenza per prima. Ogni tentativo rilegge il registro e rifa' tutti i
     * controlli: il giocatore potrebbe essere appena stato venduto, il budget speso.
     * Tre bastano per un'asta a turni; se non bastano, e' meglio dirlo che insistere.
     */
    static final int MAX_ATTEMPTS = 3;

    private static <T> T retrying(java.util.function.Supplier<T> once) {
        ConcurrentAppendException last = null;
        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            try {
                return once.get();
            } catch (ConcurrentAppendException e) {
                last = e;
            }
        }
        throw last;
    }
```

2. Rinominare il corpo attuale di `recordPurchase(String, String, int, String)` in `private AuctionEvent.PlayerPurchased recordPurchaseOnce(...)`, e nel punto dell'append catturare il duplicato:

```java
            AuctionEvent written;
            try {
                written = currentStore.appendWithNextSeq(
                        seq -> new AuctionEvent.PlayerPurchased(seq, Instant.now(), playerId,
                                buyer.id(), price, requestId));
            } catch (DuplicateRequestException e) {
                // Un'altra richiesta con la stessa chiave e' arrivata al registro fra il
                // nostro controllo e la nostra scrittura: il vincolo del database l'ha
                // vista, e la risposta giusta e' quella che ha scritto lei.
                return recordedFor(currentStore, requestId).orElseThrow(() -> e);
            }
            markChangedInThisSession();
            return (AuctionEvent.PlayerPurchased) written;
```

e il metodo pubblico diventa:

```java
    public AuctionEvent.PlayerPurchased recordPurchase(String playerId, String participantId,
                                                       int price, String requestId) {
        return retrying(() -> recordPurchaseOnce(playerId, participantId, price, requestId));
    }
```

3. Allo stesso modo: il corpo di `undoLast()` in `undoLastOnce()`, e `public boolean undoLast() { return retrying(this::undoLastOnce); }`; `revokePurchase(long)` → `revokePurchaseOnce(long)` e `public void revokePurchase(long targetSeq) { retrying(() -> { revokePurchaseOnce(targetSeq); return null; }); }`; `selectPhase(Role)` → `selectPhaseOnce(Role)` e `public boolean selectPhase(Role role) { return retrying(() -> selectPhaseOnce(role)); }`.

4. La correzione:

```java
    /**
     * Il giocatore resta quello; cambiano prezzo, acquirente o entrambi. E' uno dei due
     * poteri dell'amministratore: si usa quando il banco ha sbagliato, non per giocare.
     *
     * <p>Il budget del nuovo acquirente si conta come se l'acquisto corretto non ci
     * fosse: se e' lo stesso acquirente, il prezzo vecchio torna disponibile.
     */
    public void correctPurchase(long targetSeq, String newParticipantId, int newPrice) {
        retrying(() -> {
            correctPurchaseOnce(targetSeq, newParticipantId, newPrice);
            return null;
        });
    }

    private void correctPurchaseOnce(long targetSeq, String newParticipantId, int newPrice) {
        AuctionScope currentScope = scope.get();
        AuctionState current = state(currentScope);
        Holding holding = current.holdings().stream()
                .filter(h -> h.seq() == targetSeq)
                .findFirst()
                .orElseThrow(() -> new PurchaseRevocationException(
                        PurchaseRevocationException.Reason.NOT_FOUND,
                        "nessun acquisto attivo con id " + targetSeq));
        Participant buyer = currentScope.participants().stream()
                .filter(p -> p.id().equals(newParticipantId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("partecipante sconosciuto: " + newParticipantId));
        if (newPrice < 1) {
            throw new IllegalArgumentException("il prezzo deve essere almeno 1");
        }
        Squad squad = current.squadOf(buyer.id());
        boolean sameBuyer = buyer.id().equals(holding.participantId());
        int available = squad.budgetRemaining() + (sameBuyer ? holding.price() : 0);
        if (newPrice > available) {
            throw new PurchaseRejectedException(PurchaseRejectedException.Reason.INSUFFICIENT_BUDGET,
                    buyer.name() + " ha solo " + available + " crediti di budget residuo");
        }
        if (!sameBuyer && !squad.hasRoom(holding.role())) {
            throw new PurchaseRejectedException(PurchaseRejectedException.Reason.ROLE_SLOTS_EXHAUSTED,
                    buyer.name() + " ha già coperto tutti gli slot " + holding.role());
        }
        currentScope.store().appendWithNextSeq(seq -> new AuctionEvent.PurchaseCorrected(
                seq, Instant.now(), targetSeq, buyer.id(), newPrice));
        markChangedInThisSession();
    }

    /** Il numero dell'ultimo evento scritto: la versione dello stato che il client ha in mano. */
    public long version() {
        return scope.get().store().nextSeq() - 1;
    }
```

(import `com.fantaagent.application.port.out.ConcurrentAppendException`, `com.fantaagent.application.port.out.DuplicateRequestException`). Il `synchronized (currentStore)` di `recordPurchaseOnce` resta: con lo store su file (`/legacy`) serve ancora, con quello su tabella non fa danni.

- [ ] **Step 4: Eseguire i test e vederli passare**

Run: `mvn -q test -Dtest='AuctionServiceConflictTest,PurchaseCorrectionTest,ConcurrentWritesTest'` poi `mvn -q test`.
Expected: PASS. `ConcurrentWritesTest` eseguirlo tre volte di fila per vedere che non è instabile.

- [ ] **Step 5: Mutazione**

In `retrying` rendere `MAX_ATTEMPTS` 1: `seIlConflittoNonCambiaNienteLaScritturaPassaColNumeroDopo` deve fallire. Poi, ripristinato, sostituire in `retrying` il ritentativo con una riscrittura dell'evento già costruito (ricordare l'ultimo evento e riappenderlo con `seq + 1` senza rileggere): `dopoUnConflittoSiRifannoIControlliNonSiRiscriveAllaCieca` deve fallire. Ripristinare.

- [ ] **Step 6: Commit**

```bash
git add src/main/java/com/fantaagent/application/service/AuctionService.java src/test/java
git commit -m "Scritture concorrenti: in fila per asta, e al conflitto si rilegge; la correzione di un acquisto

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: L'API d'asta in lettura, per chi ha l'accesso

**Files:**
- Modify: `adapter/in/api/ApiAccess.java`, `AuctionStateApi.java`, `PlayerApi.java`, `ExportApi.java`, `board/BoardApi.java`, `board/PublicBidderApi.java`, `dto/StateDtos.java`, `ApiExceptionHandler.java`
- Create: `src/test/java/com/fantaagent/testsupport/AuctionApiFixture.java`
- Test: `src/test/java/com/fantaagent/adapter/in/api/AuctionReadApiTest.java`
- Delete: `src/test/java/com/fantaagent/adapter/in/api/AuctionStateApiTest.java`, `PlayerApiTest.java`, `ExportApiTest.java`, `board/BoardApiTest.java`, `board/PublicBidderApiTest.java`

**Interfaces:**
- Consumes: `AuctionRegistry.view` (Task 11), `ApiAccess.league` (Task 7), `LeagueService`, `LeagueAuctionService`, `InviteService` (per la fixture).
- Produces:
  - `ApiAccess.auction(String leagueId, String auctionId, AppUserPrincipal me): AuctionView`, `ApiAccess.adminAuction(...)`: come sopra, con `requireAdmin()` sulla lega.
  - `StateDtos.AuctionStateResponse` guadagna `long version` e `boolean admin`; `myParticipantId` può essere `null`.
  - Problemi: `unknown-auction` 404 (anche per un id non UUID), `no-seat` 403.
  - `testsupport.AuctionApiFixture`: `create(WebApplicationContext)`, campi `mvc`, `anna`, `bruno`, `carla` (cookie), `annaId`, `brunoId`, `carlaId`, `leagueId`, `auctionId`; metodi `url(String path)`, `stranger(String name): Cookie`, `join(String name): Cookie` (entra nella lega con un invito), `view(String userId): AuctionView`, `player(Role role, int index): String`.

Le rotte non cambiano forma; cambia da dove arrivano lega, asta e posto. `/players?q=` e `/players/teams` non valutano e restano aperti a ogni membro; `/players/phase`, `/players/targets` e `/players/{id}/valuation` valutano, e chi non ha un posto riceve `no-seat`.

Prima di cancellare i cinque test vecchi, leggerli e portare in `AuctionReadApiTest` ogni comportamento del controller che resta vero: il tetto sul `limit` della tabella di fase e degli obiettivi, il ripiego sull'ordine predefinito per una colonna sconosciuta, il 404 `unknown-player`, l'header `Content-Disposition` dell'export con il nome codificato in UTF-8, il tetto del banditore letto dall'asta. I casi che verificavano `LeagueGuard`/`AuctionGuard` (lega `default`, asta `corrente`) non si portano: le guardie non esistono più.

- [ ] **Step 1: La fixture**

`src/test/java/com/fantaagent/testsupport/AuctionApiFixture.java`:

```java
package com.fantaagent.testsupport;

import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.application.service.auction.AuctionRegistry;
import com.fantaagent.application.service.auction.AuctionView;
import com.fantaagent.application.service.auction.LeagueAuctionService;
import com.fantaagent.application.service.league.LeagueService;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;
import java.util.UUID;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * Una lega vera con un'asta vera, costruita come la costruirebbero le persone:
 * registrazione, lega, invito, e l'asta creata dal servizio (la sua API arriva col
 * Task 15). Anna e' l'amministratrice; Bruno e Carla sono membri con un posto.
 */
public final class AuctionApiFixture {

    public MockMvc mvc;
    public Cookie anna;
    public Cookie bruno;
    public Cookie carla;
    public String annaId;
    public String brunoId;
    public String carlaId;
    public String leagueId;
    public String auctionId;
    private WebApplicationContext context;
    private String inviteToken;

    public static AuctionApiFixture create(WebApplicationContext context) throws Exception {
        AuctionApiFixture f = new AuctionApiFixture();
        f.context = context;
        f.mvc = ApiFixture.mvc(context);
        f.anna = ApiFixture.register(f.mvc, ApiFixture.uniqueEmail("anna"), "Anna");
        f.annaId = f.idOf(f.anna);
        String league = f.mvc.perform(post("/api/leagues").with(csrf()).cookie(f.anna)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Lega del Bar\",\"teamName\":\"Anna FC\",\"initial\":\"A\"}"))
                .andReturn().getResponse().getContentAsString();
        f.leagueId = JsonPath.read(league, "$.id");
        String invite = f.mvc.perform(post("/api/leagues/" + f.leagueId + "/invites").with(csrf()).cookie(f.anna))
                .andReturn().getResponse().getContentAsString();
        String link = JsonPath.read(invite, "$.link");
        f.inviteToken = link.substring(link.lastIndexOf('/') + 1);
        f.bruno = f.join("Bruno");
        f.brunoId = f.idOf(f.bruno);
        f.carla = f.join("Carla");
        f.carlaId = f.idOf(f.carla);

        LeagueService leagues = context.getBean(LeagueService.class);
        f.auctionId = context.getBean(LeagueAuctionService.class)
                .create(leagues.access(UUID.fromString(f.leagueId), UUID.fromString(f.annaId)), "Asta d'estate")
                .id().toString();
        return f;
    }

    public String url(String path) {
        return "/api/leagues/" + leagueId + "/auctions/" + auctionId + path;
    }

    /** Qualcuno con un account ma fuori dalla lega. */
    public Cookie stranger(String name) throws Exception {
        return ApiFixture.register(mvc, ApiFixture.uniqueEmail(name.toLowerCase()), name);
    }

    /** Qualcuno che entra nella lega col link d'invito, ora. */
    public Cookie join(String name) throws Exception {
        Cookie cookie = stranger(name);
        mvc.perform(post("/api/invites/" + inviteToken + "/accept").with(csrf()).cookie(cookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"teamName\":\"%s FC\",\"initial\":\"%s\"}".formatted(name, name.substring(0, 1))));
        return cookie;
    }

    /** L'asta vista da un utente, per scrivere nel registro senza passare dall'API. */
    public AuctionView view(String userId) {
        LeagueService leagues = context.getBean(LeagueService.class);
        return context.getBean(AuctionRegistry.class)
                .view(leagues.access(UUID.fromString(leagueId), UUID.fromString(userId)), UUID.fromString(auctionId));
    }

    /** Il giocatore n-esimo di quel ruolo nel listone vero, in ordine di id. */
    public String player(Role role, int index) {
        List<Player> players = context.getBean(PlayerCatalog.class).all().stream()
                .filter(p -> p.role() == role)
                .sorted(java.util.Comparator.comparing(Player::id))
                .toList();
        return players.get(index).id();
    }

    private String idOf(Cookie session) throws Exception {
        String me = mvc.perform(get("/api/me").cookie(session)).andReturn().getResponse().getContentAsString();
        return JsonPath.read(me, "$.id");
    }
}
```

- [ ] **Step 2: Scrivere il test che fallisce**

`src/test/java/com/fantaagent/adapter/in/api/AuctionReadApiTest.java`:

```java
package com.fantaagent.adapter.in.api;

import com.fantaagent.application.service.auction.AuctionView;
import com.fantaagent.application.service.auction.LeagueAuctionService;
import com.fantaagent.application.service.league.LeagueService;
import com.fantaagent.domain.player.Role;
import com.fantaagent.testsupport.AuctionApiFixture;
import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.context.WebApplicationContext;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.lessThanOrEqualTo;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("dev")
class AuctionReadApiTest {

    static final String PROBLEMS = "https://fantaagent.local/problems/";

    @Autowired
    private WebApplicationContext context;

    private AuctionApiFixture f;

    @BeforeEach
    void setUp() throws Exception {
        f = AuctionApiFixture.create(context);
    }

    private void buy(String playerId, String buyerId, int price) {
        AuctionView admin = f.view(f.annaId);
        admin.write(() -> admin.service().recordPurchase(playerId, buyerId, price, UUID.randomUUID().toString()));
    }

    @Test
    void loStatoDiceChiGuardaESeEAmministratore() throws Exception {
        f.mvc.perform(get(f.url("/state")).cookie(f.bruno))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.auctionId").value(f.auctionId))
                .andExpect(jsonPath("$.auctionName").value("Asta d'estate"))
                .andExpect(jsonPath("$.myParticipantId").value(f.brunoId))
                .andExpect(jsonPath("$.admin").value(false))
                .andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.participants.length()").value(3));
        f.mvc.perform(get(f.url("/state")).cookie(f.anna))
                .andExpect(jsonPath("$.admin").value(true))
                .andExpect(jsonPath("$.myParticipantId").value(f.annaId));
    }

    @Test
    void laVersioneCresceAOgniEvento() throws Exception {
        buy(f.player(Role.P, 0), f.brunoId, 10);
        f.mvc.perform(get(f.url("/state")).cookie(f.carla)).andExpect(jsonPath("$.version").value(2));
    }

    @Test
    void chiNonEDellaLegaNonVedeNiente() throws Exception {
        Cookie dario = f.stranger("Dario");
        for (String path : new String[]{"/state", "/board", "/players?q=a", "/export.csv"}) {
            f.mvc.perform(get(f.url(path)).cookie(dario))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.type").value(PROBLEMS + "unknown-league"));
        }
    }

    @Test
    void unAstaInesistenteEUn404() throws Exception {
        f.mvc.perform(get("/api/leagues/" + f.leagueId + "/auctions/" + UUID.randomUUID() + "/state").cookie(f.anna))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "unknown-auction"));
        f.mvc.perform(get("/api/leagues/" + f.leagueId + "/auctions/corrente/state").cookie(f.anna))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "unknown-auction"));
    }

    @Test
    void unAstaDiUnAltraLegaNonSiRaggiungeDallaPropria() throws Exception {
        AuctionApiFixture other = AuctionApiFixture.create(context);
        f.mvc.perform(get("/api/leagues/" + f.leagueId + "/auctions/" + other.auctionId + "/state").cookie(f.anna))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "unknown-auction"));
    }

    @Test
    void unAstaCancellataSparisce() throws Exception {
        LeagueService leagues = context.getBean(LeagueService.class);
        context.getBean(LeagueAuctionService.class).delete(
                leagues.access(UUID.fromString(f.leagueId), UUID.fromString(f.annaId)), UUID.fromString(f.auctionId));
        f.mvc.perform(get(f.url("/state")).cookie(f.anna)).andExpect(status().isNotFound());
    }

    /**
     * La garanzia che regge tutto il resto: i consigli sono di chi li chiede. Bruno ha
     * speso quasi tutto; il tetto che vede lui e' piu' basso di quello che vede Carla,
     * e nessun parametro nella richiesta gli fa vedere quello di lei.
     */
    @Test
    void iConsigliSonoSempreQuelliDelPostoDiChiChiede() throws Exception {
        buy(f.player(Role.A, 0), f.brunoId, 400);
        String target = f.player(Role.D, 0);

        int brunoCap = JsonPath.read(f.mvc.perform(get(f.url("/players/" + target + "/valuation")).cookie(f.bruno))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(), "$.hardCap");
        int carlaCap = JsonPath.read(f.mvc.perform(get(f.url("/players/" + target + "/valuation")).cookie(f.carla))
                .andReturn().getResponse().getContentAsString(), "$.hardCap");
        int brunoAskingForCarla = JsonPath.read(f.mvc.perform(
                        get(f.url("/players/" + target + "/valuation?participantId=" + f.carlaId + "&seat=" + f.carlaId))
                                .cookie(f.bruno))
                .andReturn().getResponse().getContentAsString(), "$.hardCap");

        assertThat(brunoCap).isLessThan(carlaCap);
        assertThat(brunoAskingForCarla).isEqualTo(brunoCap);
    }

    @Test
    void lAmministratoreNonVedeIConsigliDegliAltri() throws Exception {
        buy(f.player(Role.A, 0), f.annaId, 400);
        String target = f.player(Role.D, 0);
        int annaCap = JsonPath.read(f.mvc.perform(get(f.url("/players/" + target + "/valuation")).cookie(f.anna))
                .andReturn().getResponse().getContentAsString(), "$.hardCap");
        int brunoCap = JsonPath.read(f.mvc.perform(get(f.url("/players/" + target + "/valuation")).cookie(f.bruno))
                .andReturn().getResponse().getContentAsString(), "$.hardCap");
        assertThat(annaCap).isLessThan(brunoCap);
    }

    @Test
    void chiEntraDopoIlPrimoAcquistoGuardaMaNonHaConsigli() throws Exception {
        buy(f.player(Role.P, 0), f.brunoId, 10);
        Cookie dario = f.join("Dario");

        f.mvc.perform(get(f.url("/state")).cookie(dario))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.myParticipantId").doesNotExist());
        f.mvc.perform(get(f.url("/board")).cookie(dario)).andExpect(status().isOk());
        f.mvc.perform(get(f.url("/players?q=a")).cookie(dario)).andExpect(status().isOk());
        for (String path : new String[]{"/players/" + f.player(Role.D, 0) + "/valuation",
                "/players/phase", "/players/targets"}) {
            f.mvc.perform(get(f.url(path)).cookie(dario))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.type").value(PROBLEMS + "no-seat"));
        }
    }

    @Test
    void ilTabelloneSegnaLaColonnaDiChiGuarda() throws Exception {
        f.mvc.perform(get(f.url("/board")).cookie(f.carla))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.columns.length()").value(3))
                .andExpect(jsonPath("$.columns[?(@.participantId == '%s')].me".formatted(f.carlaId)).value(true));
    }

    @Test
    void laTabellaDiFaseHaUnTettoEUnOrdineDiRipiego() throws Exception {
        f.mvc.perform(get(f.url("/players/phase?limit=1000&sort=inventato")).cookie(f.bruno))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows.length()").value(lessThanOrEqualTo(25)));
        f.mvc.perform(get(f.url("/players/targets?limit=1000")).cookie(f.bruno))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(lessThanOrEqualTo(10)));
    }

    @Test
    void unGiocatoreSconosciutoEUn404() throws Exception {
        f.mvc.perform(get(f.url("/players/inventato/valuation")).cookie(f.bruno))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "unknown-player"));
    }

    @Test
    void lExportPortaIlNomeDellAsta() throws Exception {
        f.mvc.perform(get(f.url("/export.csv")).cookie(f.bruno))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("text/csv"))
                .andExpect(header().string("Content-Disposition", containsString("filename*=UTF-8''")));
    }

    @Test
    void ilBanditorePubblicoLeggeIlTempoDellAsta() throws Exception {
        f.mvc.perform(get(f.url("/board/bidder/" + f.player(Role.P, 0))).cookie(f.carla))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bidTimerSeconds").isNumber())
                .andExpect(jsonPath("$.maxBid").doesNotExist())
                .andExpect(jsonPath("$.hardCap").doesNotExist());
    }
}
```

`$.rows` è il campo di `PlayerDtos.PhasePageResponse`; il `me` della colonna è `BoardDtos.BoardColumn.me`.

- [ ] **Step 3: Eseguire il test e vederlo fallire**

Run: `mvn -q test -Dtest=AuctionReadApiTest`
Expected: FAIL — i controller guardano ancora `LeagueGuard` e rispondono 404 `unknown-league` a ogni lega che non sia `default`.

- [ ] **Step 4: L'accesso all'asta**

In `ApiAccess` aggiungere il campo `AuctionRegistry registry` al costruttore e:

```java
    public AuctionView auction(String leagueId, String auctionId, AppUserPrincipal me) {
        LeagueAccess league = league(leagueId, me);
        return registry.view(league, parseOr404(auctionId, () -> new AuctionNotFoundException(null)));
    }

    /** Solo l'amministratore scrive nel registro: gli altri membri guardano. */
    public AuctionView adminAuction(String leagueId, String auctionId, AppUserPrincipal me) {
        LeagueAccess league = admin(leagueId, me);
        return registry.view(league, parseOr404(auctionId, () -> new AuctionNotFoundException(null)));
    }
```

In `ApiExceptionHandler`, prima di `unexpected`:

```java
    @ExceptionHandler(AuctionNotFoundException.class)
    ProblemDetail auctionNotFound(AuctionNotFoundException e) {
        return problem(HttpStatus.NOT_FOUND, "unknown-auction", "Asta non trovata.");
    }

    @ExceptionHandler(NoSeatException.class)
    ProblemDetail noSeat(NoSeatException e) {
        return problem(HttpStatus.FORBIDDEN, "no-seat", e.getMessage());
    }
```

- [ ] **Step 5: I controller**

In ognuno dei cinque controller: togliere `LeagueGuard`, `AuctionGuard`, `AuctionService`, `AuctionRuntime`, `PlayerSearchService`, `PlayerAnalysisService`, `AuctionArchive` dal costruttore; aggiungere `ApiAccess access`; ogni metodo riceve `@AuthenticationPrincipal AppUserPrincipal me` e comincia con `AuctionView view = access.auction(leagueId, auctionId, me);`. Poi, metodo per metodo:

`AuctionStateApi.state`:

```java
        AuctionView view = access.auction(leagueId, auctionId, me);
        // Una sola lettura dello stato per richiesta: rileggerlo per il conteggio
        // dei venduti rifolderebbe il log e potrebbe rispondere su due stati
        // diversi dentro la stessa risposta.
        AuctionState state = view.service().state();
        return StateDtos.from(view.auction().id().toString(), view.auction().name(), state,
                view.participants(), view.service().salesInCurrentPhase(state),
                view.service().version(), view.access().isAdmin());
```

`StateDtos`: aggiungere `long version, boolean admin` in fondo ad `AuctionStateResponse` e a `from(...)`.

`BoardApi.board`: sostituire `auction.state()`, `auction.participants()`, `auction.auctionId()`, `auction.playerName(h)` con `view.service().state()`, `view.participants()`, `view.auction().id().toString()`, `view.service().playerName(h)`. (Leggere lo stato una volta sola in una variabile, come fa già.)

`PublicBidderApi.bidder`: il catalogo resta iniettato; `runtime.bidder()` diventa `view.auction().bidder()`.

`PlayerApi`:

```java
    // search: nessuna valutazione, basta essere membri
    AuctionView view = access.auction(leagueId, auctionId, me);
    return view.search().browse(q, role, team).stream().map(PlayerDtos.PlayerSummary::from).toList();

    // teams
    return access.auction(leagueId, auctionId, me).search().teams();

    // phase: valuta ogni riga, serve un posto
    AuctionView view = access.auction(leagueId, auctionId, me);
    view.requireSeat();
    return PlayerDtos.PhasePageResponse.from(view.search().phasePlayers(
            Math.max(0, offset), clampLimit(limit), parseSort(sort), "asc".equalsIgnoreCase(dir)));

    // targets
    AuctionView view = access.auction(leagueId, auctionId, me);
    view.requireSeat();
    int capped = Math.max(1, Math.min(limit, MAX_TARGETS));
    return view.search().targets(capped).stream().map(PlayerDtos.TargetView::from).toList();

    // valuation
    AuctionView view = access.auction(leagueId, auctionId, me);
    view.requireSeat();
    Player player = catalog.byId(playerId).orElseThrow(() -> new UnknownPlayerException(playerId));
    return PlayerDtos.ValuationResponse.from(player, view.analysis().analyze(playerId));
```

Il catalogo resta iniettato in `PlayerApi` (serve per il nome del giocatore). Il Javadoc di `clampLimit` cita i controller Thymeleaf: lasciarlo, è ancora vero.

`ExportApi.export`: niente più `AuctionArchive` né copia su disco.

```java
        AuctionView view = access.auction(leagueId, auctionId, me);
        byte[] csv = RosterCsvExporter.toCsv(view.service()).getBytes(StandardCharsets.UTF_8);
        String fileName = "rose-" + view.auction().name() + ".csv";
```

e il resto del metodo (header `Content-Disposition` con `ContentDisposition.attachment().filename(fileName, UTF_8)`) invariato. Il commento che parlava di id-date e di `AuctionGuard` va riscritto: ora il nome è quello scelto da chi crea l'asta, ed è esattamente il caso che quel costruttore copre.

- [ ] **Step 6: Cancellare i test vecchi**

Dopo aver portato i comportamenti elencati sopra in `AuctionReadApiTest`:

```bash
git rm src/test/java/com/fantaagent/adapter/in/api/AuctionStateApiTest.java \
       src/test/java/com/fantaagent/adapter/in/api/PlayerApiTest.java \
       src/test/java/com/fantaagent/adapter/in/api/ExportApiTest.java \
       src/test/java/com/fantaagent/adapter/in/api/board/BoardApiTest.java \
       src/test/java/com/fantaagent/adapter/in/api/board/PublicBidderApiTest.java
```

- [ ] **Step 7: Eseguire i test e vederli passare**

Run: `mvn -q test -Dtest=AuctionReadApiTest` poi `mvn -q test`.
Expected: PASS.

- [ ] **Step 8: Mutazione**

In `PlayerApi.valuation` sostituire temporaneamente `view.analysis()` con una vista costruita per il primo partecipante (`access.auction(...)` di Anna, per esempio leggendo `view.participants().getFirst()`): `iConsigliSonoSempreQuelliDelPostoDiChiChiede` deve fallire. Poi togliere `view.requireSeat()` da `phase`: `chiEntraDopoIlPrimoAcquistoGuardaMaNonHaConsigli` deve fallire. Ripristinare.

- [ ] **Step 9: Commit**

```bash
git add -A src/main/java src/test/java
git commit -m "API d'asta in lettura: lega, asta e posto dall'accesso; niente consigli senza posto

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: L'API d'asta in scrittura, solo per l'amministratore

**Files:**
- Modify: `adapter/in/api/PurchaseApi.java`, `adapter/in/api/dto/PurchaseDtos.java`, `adapter/in/api/ApiExceptionHandler.java`
- Test: `src/test/java/com/fantaagent/adapter/in/api/AuctionWriteApiTest.java`
- Delete: `src/test/java/com/fantaagent/adapter/in/api/PurchaseApiTest.java`, `PhaseAndVoidApiTest.java`

**Interfaces:**
- Consumes: `ApiAccess.adminAuction`, `AuctionView.write`, `AuctionService.correctPurchase`.
- Produces:
  - `POST .../purchases`, `POST .../purchases/{seq}/void`, `POST .../purchases/void-last`, `POST .../phase` — invariati nella forma, ora solo amministratore e dentro `view.write`.
  - `POST .../purchases/{seq}/correct` con corpo `PurchaseDtos.CorrectionRequest(@NotBlank String participantId, @Min(1) int price)` → 204.
  - Problema `concurrent-write` 409.

Come nel Task 13: prima di cancellare i due test vecchi, portare i casi di comportamento che restano veri (i tre motivi di rifiuto di un acquisto con i loro slug `player-already-sold`, `insufficient-budget`, `role-slots-exhausted`; la risposta composta dall'evento scritto e non dalla richiesta; `nothing-to-undo`; `purchase-already-revoked`).

- [ ] **Step 1: Scrivere il test che fallisce**

`src/test/java/com/fantaagent/adapter/in/api/AuctionWriteApiTest.java`:

```java
package com.fantaagent.adapter.in.api;

import com.fantaagent.domain.player.Role;
import com.fantaagent.testsupport.AuctionApiFixture;
import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.web.context.WebApplicationContext;

import java.util.UUID;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("dev")
class AuctionWriteApiTest {

    static final String PROBLEMS = "https://fantaagent.local/problems/";

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private JdbcClient jdbc;

    private AuctionApiFixture f;

    @BeforeEach
    void setUp() throws Exception {
        f = AuctionApiFixture.create(context);
    }

    private ResultActions buy(Cookie who, String playerId, String buyerId, int price, String requestId) throws Exception {
        return f.mvc.perform(post(f.url("/purchases")).with(csrf()).cookie(who)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"requestId\":\"%s\",\"playerId\":\"%s\",\"participantId\":\"%s\",\"price\":%d}"
                        .formatted(requestId, playerId, buyerId, price)));
    }

    @Test
    void lAmministratoreRegistraEFirma() throws Exception {
        String seq = buy(f.anna, f.player(Role.P, 0), f.brunoId, 12, "r-1")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.participantId").value(f.brunoId))
                .andReturn().getResponse().getContentAsString();
        long written = ((Number) JsonPath.read(seq, "$.seq")).longValue();

        UUID actor = jdbc.sql("SELECT actor_id FROM auction_event WHERE auction_id = :a AND seq = :s")
                .param("a", UUID.fromString(f.auctionId)).param("s", written).query(UUID.class).single();
        assertThat(actor.toString()).isEqualTo(f.annaId);
    }

    @Test
    void unMembroNonScriveNiente() throws Exception {
        buy(f.bruno, f.player(Role.P, 0), f.brunoId, 12, "r-1")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "admin-only"));
        f.mvc.perform(post(f.url("/purchases/void-last")).with(csrf()).cookie(f.bruno))
                .andExpect(status().isForbidden());
        f.mvc.perform(post(f.url("/purchases/2/void")).with(csrf()).cookie(f.bruno))
                .andExpect(status().isForbidden());
        f.mvc.perform(post(f.url("/purchases/2/correct")).with(csrf()).cookie(f.bruno)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"participantId\":\"%s\",\"price\":5}".formatted(f.brunoId)))
                .andExpect(status().isForbidden());
        f.mvc.perform(post(f.url("/phase")).with(csrf()).cookie(f.bruno)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"D\"}"))
                .andExpect(status().isForbidden());
        f.mvc.perform(get(f.url("/state")).cookie(f.bruno)).andExpect(jsonPath("$.version").value(1));
    }

    @Test
    void laStessaRichiestaDueVolteEUnAcquistoSolo() throws Exception {
        String p = f.player(Role.P, 0);
        buy(f.anna, p, f.brunoId, 12, "r-1").andExpect(status().isCreated());
        buy(f.anna, p, f.brunoId, 12, "r-1").andExpect(status().isCreated());
        f.mvc.perform(get(f.url("/state")).cookie(f.anna)).andExpect(jsonPath("$.version").value(2));
    }

    @Test
    void unPostoCheNonEsisteNonCompra() throws Exception {
        buy(f.anna, f.player(Role.P, 0), UUID.randomUUID().toString(), 12, "r-1")
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void laCorrezioneSpostaIlGiocatore() throws Exception {
        String body = buy(f.anna, f.player(Role.P, 0), f.brunoId, 12, "r-1")
                .andReturn().getResponse().getContentAsString();
        long seq = ((Number) JsonPath.read(body, "$.seq")).longValue();

        f.mvc.perform(post(f.url("/purchases/" + seq + "/correct")).with(csrf()).cookie(f.anna)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"participantId\":\"%s\",\"price\":20}".formatted(f.carlaId)))
                .andExpect(status().isNoContent());

        f.mvc.perform(get(f.url("/state")).cookie(f.anna))
                .andExpect(jsonPath("$.participants[?(@.id == '%s')].budgetRemaining".formatted(f.carlaId)).value(480))
                .andExpect(jsonPath("$.participants[?(@.id == '%s')].budgetRemaining".formatted(f.brunoId)).value(500));
    }

    @Test
    void dueAcquistiNelloStessoIstantePassanoEntrambi() throws Exception {
        CompletableFuture<Integer> a = CompletableFuture.supplyAsync(() -> status(f.player(Role.D, 0), f.brunoId));
        CompletableFuture<Integer> b = CompletableFuture.supplyAsync(() -> status(f.player(Role.D, 1), f.carlaId));
        assertThat(a.get()).isEqualTo(201);
        assertThat(b.get()).isEqualTo(201);
        f.mvc.perform(get(f.url("/state")).cookie(f.anna)).andExpect(jsonPath("$.version").value(3));
    }

    private int status(String playerId, String buyerId) {
        try {
            return buy(f.anna, playerId, buyerId, 5, UUID.randomUUID().toString())
                    .andReturn().getResponse().getStatus();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @Test
    void faseEAnnullamentiPerLAmministratore() throws Exception {
        buy(f.anna, f.player(Role.P, 0), f.brunoId, 12, "r-1");
        f.mvc.perform(post(f.url("/purchases/void-last")).with(csrf()).cookie(f.anna))
                .andExpect(status().isNoContent());
        f.mvc.perform(post(f.url("/purchases/void-last")).with(csrf()).cookie(f.anna))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "nothing-to-undo"));
        f.mvc.perform(post(f.url("/phase")).with(csrf()).cookie(f.anna)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"D\"}"))
                .andExpect(status().isNoContent());
        f.mvc.perform(get(f.url("/state")).cookie(f.carla)).andExpect(jsonPath("$.currentPhase").value("D"));
    }
}
```

- [ ] **Step 2: Eseguire il test e vederlo fallire**

Run: `mvn -q test -Dtest=AuctionWriteApiTest`
Expected: FAIL.

- [ ] **Step 3: L'implementazione**

In `PurchaseDtos` aggiungere:

```java
    public record CorrectionRequest(@NotBlank String participantId, @Min(1) int price) {
    }
```

`PurchaseApi` — costruttore con `ApiAccess access` soltanto; ogni metodo con `@AuthenticationPrincipal AppUserPrincipal me`:

```java
    @PostMapping("/purchases")
    @ResponseStatus(HttpStatus.CREATED)
    public PurchaseDtos.PurchaseResponse buy(@AuthenticationPrincipal AppUserPrincipal me,
                                             @PathVariable String leagueId,
                                             @PathVariable String auctionId,
                                             @Valid @RequestBody PurchaseDtos.PurchaseRequest body) {
        AuctionView view = access.adminAuction(leagueId, auctionId, me);
        // La risposta si compone dall'evento scritto, mai dalla richiesta: un
        // secondo invio della stessa chiave con un corpo diverso non scrive
        // nulla, e riportare i dati appena ricevuti darebbe un 201 che descrive
        // un acquisto assente dal registro.
        AuctionEvent.PlayerPurchased recorded = view.write(() -> view.service().recordPurchase(
                body.playerId(), body.participantId(), body.price(), body.requestId()));
        return new PurchaseDtos.PurchaseResponse(recorded.seq(), recorded.playerId(),
                recorded.participantId(), recorded.price());
    }

    @PostMapping("/purchases/{seq}/void")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void voidPurchase(@AuthenticationPrincipal AppUserPrincipal me, @PathVariable String leagueId,
                             @PathVariable String auctionId, @PathVariable long seq) {
        AuctionView view = access.adminAuction(leagueId, auctionId, me);
        view.write(() -> {
            view.service().revokePurchase(seq);
            return null;
        });
    }

    @PostMapping("/purchases/{seq}/correct")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void correct(@AuthenticationPrincipal AppUserPrincipal me, @PathVariable String leagueId,
                        @PathVariable String auctionId, @PathVariable long seq,
                        @Valid @RequestBody PurchaseDtos.CorrectionRequest body) {
        AuctionView view = access.adminAuction(leagueId, auctionId, me);
        view.write(() -> {
            view.service().correctPurchase(seq, body.participantId(), body.price());
            return null;
        });
    }

    @PostMapping("/purchases/void-last")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void voidLast(@AuthenticationPrincipal AppUserPrincipal me, @PathVariable String leagueId,
                         @PathVariable String auctionId) {
        AuctionView view = access.adminAuction(leagueId, auctionId, me);
        if (!view.write(() -> view.service().undoLast())) {
            throw new NothingToUndoException();
        }
    }

    @PostMapping("/phase")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void phase(@AuthenticationPrincipal AppUserPrincipal me, @PathVariable String leagueId,
                      @PathVariable String auctionId, @Valid @RequestBody PhaseRequest body) {
        AuctionView view = access.adminAuction(leagueId, auctionId, me);
        // "Era gia' quella fase" non e' un errore: la richiesta esprime uno stato
        // voluto, e quello stato e' gia' vero.
        view.write(() -> view.service().selectPhase(body.role()));
    }
```

In `ApiExceptionHandler`, prima di `unexpected`:

```java
    @ExceptionHandler(ConcurrentAppendException.class)
    ProblemDetail concurrentWrite(ConcurrentAppendException e) {
        return problem(HttpStatus.CONFLICT, "concurrent-write",
                "Qualcun altro ha scritto nello stesso istante: riprova.");
    }
```

- [ ] **Step 4: Cancellare i test vecchi, eseguire, mutare**

```bash
git rm src/test/java/com/fantaagent/adapter/in/api/PurchaseApiTest.java src/test/java/com/fantaagent/adapter/in/api/PhaseAndVoidApiTest.java
```

Run: `mvn -q test -Dtest=AuctionWriteApiTest` poi `mvn -q test` — PASS.

Mutazione: in `PurchaseApi.buy` usare `access.auction(...)` invece di `access.adminAuction(...)`: `unMembroNonScriveNiente` deve fallire. Ripristinare.

- [ ] **Step 5: Commit**

```bash
git add -A src/main/java src/test/java
git commit -m "API d'asta in scrittura: solo l'amministratore, in fila per asta; la correzione

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: L'elenco delle aste, i posti, e il vecchio che va in pensione

**Files:**
- Create: `adapter/in/api/league/LeagueAuctionsApi.java`
- Modify: `adapter/in/api/league/LeagueDtos.java`, `adapter/in/api/league/LeagueApi.java` (DELETE membri), `adapter/in/api/ApiExceptionHandler.java`
- Delete: `adapter/in/api/LeagueGuard.java`, `AuctionGuard.java`, `AuctionsApi.java`, `SettingsApi.java`, `UnknownLeagueException.java`, `UnknownAuctionException.java`, `dto/AuctionsDtos.java`
- Delete (test): `AuctionsApiTest.java`, `SettingsApiTest.java`, `SettingsApiCreationTest.java`, `SettingsBodies.java`, `UnknownAuctionExceptionTest.java`
- Modify: `adapter/in/api/ApiProblemShapeTest.java`
- Create: `config/LegacyConfig.java`; Modify: `config/BeanConfig.java`
- Modify: ogni classe in `adapter/in/web/` (`@Profile("legacy")`) e ogni test in `src/test/java/com/fantaagent/adapter/in/web/` (`@ActiveProfiles({"dev", "legacy"})`)
- Modify: `src/test/java/com/fantaagent/adapter/in/spa/SpaRoutesControllerTest.java`, `src/test/java/com/fantaagent/architecture/ArchitectureTest.java`
- Test: `src/test/java/com/fantaagent/adapter/in/api/league/LeagueAuctionsApiTest.java`

**Interfaces:**
- Consumes: `LeagueAuctionService` (Task 10), `ApiAccess`, `AuctionApiFixture`.
- Produces:
  - `GET /api/leagues/{leagueId}/auctions` → `List<AuctionCardView>`; `POST` (admin) `{name}` → 201 `AuctionCardView`; `PATCH /{auctionId}` (admin) `{name?, bidder?}` → 204; `DELETE /{auctionId}` (admin) → 204.
  - `GET /api/leagues/{leagueId}/auctions/{auctionId}/seats` → `SeatsView`; `PUT` (admin) `[SeatInput]` → `SeatsView`.
  - `DELETE /api/leagues/{leagueId}/members/{userId}` → 204 (se stessi o amministratore).
  - DTO: `AuctionCardView(String id, String name, Instant createdAt, Instant lastWritten, int purchases, Role phase, int teams, int budget, int totalSlots, Integer myBudgetRemaining)`, `CreateAuctionRequest(String name)`, `UpdateAuctionRequest(String name, SettingsDtos.BidderSettings bidder)`, `SeatView(String userId, String displayName, String teamName, String initial, int position)`, `SeatsView(boolean locked, List<SeatView> seats)`, `SeatInput(String userId, String teamName, String initial)`.
  - Problemi: `seats-locked` 409, `not-enough-members` 409, `admin-cannot-leave` 409.
  - Profilo `legacy`: senza di esso `/legacy` non esiste e i bean di `AuctionRuntime` non si creano.
  - Regola ArchUnit: `domain` e `application` non dipendono da `org.springframework.security..`.

- [ ] **Step 1: Scrivere il test che fallisce**

`src/test/java/com/fantaagent/adapter/in/api/league/LeagueAuctionsApiTest.java`:

```java
package com.fantaagent.adapter.in.api.league;

import com.fantaagent.domain.player.Role;
import com.fantaagent.testsupport.AuctionApiFixture;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.context.WebApplicationContext;

import java.util.UUID;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("dev")
class LeagueAuctionsApiTest {

    static final String PROBLEMS = "https://fantaagent.local/problems/";

    @Autowired
    private WebApplicationContext context;

    private AuctionApiFixture f;
    private String auctions;

    @BeforeEach
    void setUp() throws Exception {
        f = AuctionApiFixture.create(context);
        auctions = "/api/leagues/" + f.leagueId + "/auctions";
    }

    private void buy(String buyerId) {
        var admin = f.view(f.annaId);
        admin.write(() -> admin.service().recordPurchase(f.player(Role.P, 0), buyerId, 10, UUID.randomUUID().toString()));
    }

    @Test
    void lElencoDiceACheSegnoSiamo() throws Exception {
        buy(f.brunoId);
        f.mvc.perform(get(auctions).cookie(f.bruno))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(f.auctionId))
                .andExpect(jsonPath("$[0].purchases").value(1))
                .andExpect(jsonPath("$[0].teams").value(3))
                .andExpect(jsonPath("$[0].myBudgetRemaining").value(490));
    }

    @Test
    void creareERinominareSonoDellAmministratore() throws Exception {
        String body = f.mvc.perform(post(auctions).with(csrf()).cookie(f.anna)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Riparazione\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Riparazione"))
                .andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(body, "$.id");

        f.mvc.perform(patch(auctions + "/" + id).with(csrf()).cookie(f.anna)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Riparazione di gennaio\",\"bidder\":{\"bidTimerSeconds\":9,\"beepEnabled\":false}}"))
                .andExpect(status().isNoContent());
        f.mvc.perform(get(auctions + "/" + id + "/board/bidder/" + f.player(Role.P, 0)).cookie(f.carla))
                .andExpect(jsonPath("$.bidTimerSeconds").value(9));

        f.mvc.perform(post(auctions).with(csrf()).cookie(f.bruno)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Mia\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "admin-only"));
    }

    @Test
    void unaCancellataSparisceDallElencoEDagliIndirizzi() throws Exception {
        f.mvc.perform(delete(auctions + "/" + f.auctionId).with(csrf()).cookie(f.anna))
                .andExpect(status().isNoContent());
        f.mvc.perform(get(auctions).cookie(f.anna)).andExpect(jsonPath("$.length()").value(0));
        f.mvc.perform(get(f.url("/state")).cookie(f.anna)).andExpect(status().isNotFound());
    }

    @Test
    void iPostiSiRiordinanoAncheAdAstaIniziataMaNonSiCambiano() throws Exception {
        buy(f.brunoId);
        f.mvc.perform(get(f.url("/seats")).cookie(f.bruno))
                .andExpect(jsonPath("$.locked").value(true))
                .andExpect(jsonPath("$.seats[0].displayName").value("Anna"));

        f.mvc.perform(put(f.url("/seats")).with(csrf()).cookie(f.anna).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                [{"userId":"%s","teamName":"Carla FC","initial":"C"},
                                 {"userId":"%s","teamName":"Anna FC","initial":"A"},
                                 {"userId":"%s","teamName":"Bruno FC","initial":"B"}]"""
                                .formatted(f.carlaId, f.annaId, f.brunoId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seats[0].userId").value(f.carlaId));

        f.mvc.perform(put(f.url("/seats")).with(csrf()).cookie(f.anna).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                [{"userId":"%s","teamName":"Nuovo nome","initial":"C"},
                                 {"userId":"%s","teamName":"Anna FC","initial":"A"},
                                 {"userId":"%s","teamName":"Bruno FC","initial":"B"}]"""
                                .formatted(f.carlaId, f.annaId, f.brunoId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "seats-locked"));
    }

    @Test
    void chiEsceNonVedePiuLaLega() throws Exception {
        f.mvc.perform(delete("/api/leagues/" + f.leagueId + "/members/" + f.carlaId).with(csrf()).cookie(f.carla))
                .andExpect(status().isNoContent());
        f.mvc.perform(get("/api/leagues/" + f.leagueId).cookie(f.carla)).andExpect(status().isNotFound());
    }

    @Test
    void lAmministratoreNonEsceEUnMembroNonTogliePersone() throws Exception {
        f.mvc.perform(delete("/api/leagues/" + f.leagueId + "/members/" + f.annaId).with(csrf()).cookie(f.anna))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "admin-cannot-leave"));
        f.mvc.perform(delete("/api/leagues/" + f.leagueId + "/members/" + f.carlaId).with(csrf()).cookie(f.bruno))
                .andExpect(status().isForbidden());
    }
}
```

In `ApiProblemShapeTest`: sostituire la preparazione (mock e indirizzi con `default`/`corrente`) con `AuctionApiFixture.create(context)` e richieste autenticate con `cookie(f.anna)` e `with(csrf())` sulle scritture, sugli indirizzi di `f.url(...)`. I quattro casi restano: `seq` non numerico → `invalid-path-variable`; JSON malformato → `malformed-body`; metodo sbagliato → problem+json; rotta inesistente sotto `/api` (autenticata) → `unknown-endpoint`.

- [ ] **Step 2: Eseguire i test e vederli fallire**

Run: `mvn -q test -Dtest='LeagueAuctionsApiTest,ApiProblemShapeTest'`
Expected: FAIL.

- [ ] **Step 3: L'API**

In `LeagueDtos`:

```java
    public record AuctionCardView(String id, String name, java.time.Instant createdAt,
                                  java.time.Instant lastWritten, int purchases,
                                  com.fantaagent.domain.player.Role phase, int teams, int budget,
                                  int totalSlots, Integer myBudgetRemaining) {

        public static AuctionCardView of(com.fantaagent.application.service.auction.AuctionCard c) {
            return new AuctionCardView(c.id().toString(), c.name(), c.createdAt(), c.lastWritten(),
                    c.purchases(), c.phase(), c.teams(), c.budget(), c.totalSlots(), c.myBudgetRemaining());
        }
    }

    public record CreateAuctionRequest(String name) {
    }

    public record UpdateAuctionRequest(String name, SettingsDtos.BidderSettings bidder) {
    }

    public record SeatView(String userId, String displayName, String teamName, String initial, int position) {
    }

    public record SeatsView(boolean locked, List<SeatView> seats) {
    }

    public record SeatInput(String userId, String teamName, String initial) {
    }
```

`adapter/in/api/league/LeagueAuctionsApi.java`:

```java
package com.fantaagent.adapter.in.api.league;

import com.fantaagent.adapter.in.api.ApiAccess;
import com.fantaagent.adapter.in.api.InvalidSettingsException;
import com.fantaagent.adapter.in.security.AppUserPrincipal;
import com.fantaagent.application.port.out.AuctionRecord;
import com.fantaagent.application.port.out.LeagueMember;
import com.fantaagent.application.port.out.Seat;
import com.fantaagent.application.service.auction.AuctionNotFoundException;
import com.fantaagent.application.service.auction.LeagueAuctionService;
import com.fantaagent.application.service.auction.SeatRequest;
import com.fantaagent.application.service.league.InvalidLeagueDataException;
import com.fantaagent.application.service.league.LeagueAccess;
import com.fantaagent.application.service.league.LeagueService;
import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.AuctionSettingsValidator;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/leagues/{leagueId}/auctions")
public class LeagueAuctionsApi {

    private final ApiAccess access;
    private final LeagueAuctionService auctions;
    private final LeagueService leagues;

    public LeagueAuctionsApi(ApiAccess access, LeagueAuctionService auctions, LeagueService leagues) {
        this.access = access;
        this.auctions = auctions;
        this.leagues = leagues;
    }

    @GetMapping
    public List<LeagueDtos.AuctionCardView> list(@AuthenticationPrincipal AppUserPrincipal me,
                                                 @PathVariable String leagueId) {
        return auctions.list(access.league(leagueId, me)).stream().map(LeagueDtos.AuctionCardView::of).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public LeagueDtos.AuctionCardView create(@AuthenticationPrincipal AppUserPrincipal me,
                                             @PathVariable String leagueId,
                                             @RequestBody LeagueDtos.CreateAuctionRequest body) {
        LeagueAccess league = access.league(leagueId, me);
        AuctionRecord created = auctions.create(league, body.name());
        return auctions.list(league).stream().filter(c -> c.id().equals(created.id())).findFirst()
                .map(LeagueDtos.AuctionCardView::of).orElseThrow();
    }

    @PatchMapping("/{auctionId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void update(@AuthenticationPrincipal AppUserPrincipal me, @PathVariable String leagueId,
                       @PathVariable String auctionId, @RequestBody LeagueDtos.UpdateAuctionRequest body) {
        LeagueAccess league = access.league(leagueId, me);
        UUID id = auctionIdOf(auctionId);
        if (body.bidder() != null) {
            AuctionSettings bidder = new AuctionSettings(body.bidder().bidTimerSeconds(), body.bidder().beepEnabled());
            Map<String, List<String>> errors = AuctionSettingsValidator.validateByField(bidder);
            if (!errors.isEmpty()) {
                throw new InvalidSettingsException(errors);
            }
            auctions.updateBidder(league, id, bidder);
        }
        if (body.name() != null) {
            auctions.rename(league, id, body.name());
        }
    }

    @DeleteMapping("/{auctionId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AppUserPrincipal me, @PathVariable String leagueId,
                       @PathVariable String auctionId) {
        auctions.delete(access.league(leagueId, me), auctionIdOf(auctionId));
    }

    @GetMapping("/{auctionId}/seats")
    public LeagueDtos.SeatsView seats(@AuthenticationPrincipal AppUserPrincipal me, @PathVariable String leagueId,
                                      @PathVariable String auctionId) {
        LeagueAccess league = access.league(leagueId, me);
        UUID id = auctionIdOf(auctionId);
        return view(league, auctions.seatsLocked(league, id), auctions.seats(league, id));
    }

    @PutMapping("/{auctionId}/seats")
    public LeagueDtos.SeatsView replaceSeats(@AuthenticationPrincipal AppUserPrincipal me,
                                             @PathVariable String leagueId, @PathVariable String auctionId,
                                             @RequestBody List<LeagueDtos.SeatInput> body) {
        LeagueAccess league = access.league(leagueId, me);
        UUID id = auctionIdOf(auctionId);
        List<SeatRequest> requested = body.stream()
                .map(s -> new SeatRequest(uuidOrNull(s.userId()), s.teamName(), s.initial()))
                .toList();
        List<Seat> seats = auctions.replaceSeats(league, id, requested);
        return view(league, auctions.seatsLocked(league, id), seats);
    }

    /**
     * Il nome della persona accanto a quello della squadra. Chi ha lasciato la lega
     * resta nei posti delle aste gia' iniziate, ma non ha piu' un nome da mostrare:
     * si mostra la squadra.
     */
    private LeagueDtos.SeatsView view(LeagueAccess league, boolean locked, List<Seat> seats) {
        Map<UUID, String> names = leagues.members(league).stream()
                .collect(Collectors.toMap(LeagueMember::userId, LeagueMember::displayName));
        return new LeagueDtos.SeatsView(locked, seats.stream()
                .map(s -> new LeagueDtos.SeatView(s.userId().toString(),
                        names.getOrDefault(s.userId(), s.teamName()), s.teamName(),
                        String.valueOf(s.initial()), s.position()))
                .toList());
    }

    private static UUID auctionIdOf(String raw) {
        return ApiAccess.parseOr404(raw, () -> new AuctionNotFoundException(null));
    }

    private static UUID uuidOrNull(String raw) {
        try {
            return raw == null ? null : UUID.fromString(raw);
        } catch (IllegalArgumentException e) {
            throw new InvalidLeagueDataException(Map.of("seats", List.of("Ogni posto va a un membro diverso della lega.")));
        }
    }
}
```


In `LeagueApi`:

```java
    /** Lasciare la lega, o toglierne qualcuno se si e' l'amministratore. */
    @DeleteMapping("/{leagueId}/members/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeMember(@AuthenticationPrincipal AppUserPrincipal me, @PathVariable String leagueId,
                             @PathVariable String userId) {
        LeagueAccess league = access.league(leagueId, me);
        auctions.removeMember(league, ApiAccess.parseOr404(userId, () -> new NotLeagueMemberException(null)));
    }
```

(con `LeagueAuctionService auctions` aggiunto al costruttore di `LeagueApi`).

In `ApiExceptionHandler`, prima di `unexpected`, e togliendo gli handler di `UnknownLeagueException` e `UnknownAuctionException`:

```java
    @ExceptionHandler(SeatsLockedException.class)
    ProblemDetail seatsLocked(SeatsLockedException e) {
        return problem(HttpStatus.CONFLICT, "seats-locked", e.getMessage());
    }

    @ExceptionHandler(NotEnoughMembersException.class)
    ProblemDetail notEnoughMembers(NotEnoughMembersException e) {
        return problem(HttpStatus.CONFLICT, "not-enough-members", e.getMessage());
    }

    @ExceptionHandler(AdminCannotLeaveException.class)
    ProblemDetail adminCannotLeave(AdminCannotLeaveException e) {
        return problem(HttpStatus.CONFLICT, "admin-cannot-leave", e.getMessage());
    }
```

- [ ] **Step 4: Via il vecchio**

```bash
git rm src/main/java/com/fantaagent/adapter/in/api/LeagueGuard.java \
       src/main/java/com/fantaagent/adapter/in/api/AuctionGuard.java \
       src/main/java/com/fantaagent/adapter/in/api/AuctionsApi.java \
       src/main/java/com/fantaagent/adapter/in/api/SettingsApi.java \
       src/main/java/com/fantaagent/adapter/in/api/UnknownLeagueException.java \
       src/main/java/com/fantaagent/adapter/in/api/UnknownAuctionException.java \
       src/main/java/com/fantaagent/adapter/in/api/dto/AuctionsDtos.java \
       src/test/java/com/fantaagent/adapter/in/api/AuctionsApiTest.java \
       src/test/java/com/fantaagent/adapter/in/api/SettingsApiTest.java \
       src/test/java/com/fantaagent/adapter/in/api/SettingsApiCreationTest.java \
       src/test/java/com/fantaagent/adapter/in/api/SettingsBodies.java \
       src/test/java/com/fantaagent/adapter/in/api/UnknownAuctionExceptionTest.java
```

Prima di cancellare `SettingsApiTest` e `SettingsApiCreationTest`, controllare che ogni verifica sulle regole di validazione (messaggi esatti di crediti, slot, timer) sia coperta dai test dei validatori in `config`: sono loro la fonte. Se una verifica esiste solo lì, portarla in `LeagueApiTest` sul `PUT /rules`.

`grep -rn "UnknownLeagueException\|UnknownAuctionException\|AuctionGuard\|LeagueGuard" src/main src/test` deve tornare vuoto, a parte `adapter/in/web` se lo usa (non dovrebbe).

- [ ] **Step 5: `/legacy` nel suo profilo**

`config/LegacyConfig.java`: spostare qui da `BeanConfig` i bean `auctionArchive`, `auctionRuntime`, `auctionService`, `playerAnalysisService`, `playerSearchService`, identici, sotto:

```java
/**
 * Le schermate Thymeleaf di {@code /legacy} e cio' che solo loro usano: l'asta
 * selezionata del processo e l'archivio su file. Abbandonate dal 17 settembre, restano
 * per confronto in locale e si accendono solo col profilo {@code legacy} — che non va
 * mai attivato su un'installazione raggiungibile da altri: quelle pagine non hanno
 * accesso ne' lega.
 */
@Configuration
@Profile("legacy")
public class LegacyConfig {
    // ... i cinque bean, invariati
}
```

In ogni classe di `src/main/java/com/fantaagent/adapter/in/web/` annotata `@Controller`, `@ControllerAdvice` o `@Component`, aggiungere `@Profile("legacy")` (import `org.springframework.context.annotation.Profile`). Nient'altro in quei file.

In ogni test di `src/test/java/com/fantaagent/adapter/in/web/`, `@ActiveProfiles("dev")` diventa `@ActiveProfiles({"dev", "legacy"})`. Nient'altro.

In `SpaRoutesControllerTest`, `lePagineVecchieRestanoHtml` diventa:

```java
    /**
     * Fuori dal profilo legacy le pagine vecchie non esistono: il portale non le serve,
     * e un indirizzo /legacy da' 404 come ogni altro indirizzo sconosciuto.
     */
    @Test
    void lePagineVecchieNonEsistonoFuoriDalProfiloLegacy() throws Exception {
        mvc.perform(get("/legacy")).andExpect(status().isNotFound());
    }
```

Se altri bean fuori da `adapter/in/web` iniettano `AuctionRuntime`, `AuctionService`, `AuctionArchive`, `PlayerSearchService` o `PlayerAnalysisService` (`grep -rln` su `src/main/java/com/fantaagent/config`), vanno spostati in `LegacyConfig` o resi indipendenti; `ConfigAuctionTemplate` e gli `*SettingsStore` restano fuori, perché il modello delle leghe nuove li usa.

- [ ] **Step 6: La regola di architettura**

In `ArchitectureTest`:

```java
    /**
     * Chi fa la richiesta arriva ai servizi come argomento — un LeagueAccess, un
     * AuctionView — e non lo si ripesca dal contesto di sicurezza. E' cio' che rende
     * impossibile, e non solo improbabile, un consiglio calcolato per la persona sbagliata.
     */
    @Test
    void dominioEServiziNonLeggonoIlContestoDiSicurezza() {
        noClasses().that().resideInAnyPackage("com.fantaagent.domain..", "com.fantaagent.application..")
                .should().dependOnClassesThat().resideInAnyPackage("org.springframework.security..")
                .because("chi chiede arriva come argomento, non si legge dal contesto")
                .check(classes);
    }
```

- [ ] **Step 7: Eseguire i test e vederli passare**

Run: `mvn -q test`
Expected: PASS, compresi i test di `adapter/in/web` col profilo `legacy`.

- [ ] **Step 8: Mutazione**

In `LeagueAuctionService.replaceSeats` (Task 10) la mutazione è già stata vista; qui: in `ArchitectureTest` verificare la regola aggiungendo temporaneamente a `LeagueService` un import e un uso di `org.springframework.security.core.context.SecurityContextHolder`: la regola deve fallire. Ripristinare.

- [ ] **Step 9: Commit**

```bash
git add -A src/main/java src/test/java
git commit -m "Elenco delle aste, posti e uscita dalla lega; /legacy nel suo profilo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: L'asta nel browser, all'indirizzo della sua lega

**Files:**
- Modify: `frontend/src/api/client.ts`, `frontend/src/api/hooks.ts`, `frontend/src/api/types.ts`, `frontend/src/main.tsx`, `frontend/src/router.tsx`
- Create: `frontend/src/routes/WithAuctionContext.tsx`
- Modify: `frontend/src/routes/AuctionRoute.tsx`, `frontend/src/routes/AuctionRoute.test.tsx`, `frontend/src/routes/ProjectionRoute.test.tsx`
- Modify: `frontend/src/domain/RosterGrid.tsx`, `frontend/src/domain/RosterGrid.test.tsx`, `frontend/src/domain/bidChannel.ts`, `frontend/src/domain/bidChannel.test.ts`
- Create: `frontend/src/domain/CorrectPurchaseDialog.tsx`, `CorrectPurchaseDialog.test.tsx`
- Modify: `src/main/java/com/fantaagent/adapter/in/spa/SpaRoutesController.java`
- Test: `frontend/src/routes/WithAuctionContext.test.tsx`, casi nuovi in `AuctionRoute.test.tsx` e `RosterGrid.test.tsx`

**Interfaces:**
- Consumes: `GET .../state` con `admin`, `version`, `myParticipantId: string | null` (Task 13); `POST .../purchases/{seq}/correct` (Task 14).
- Produces:
  - `client.ts`: `auctionContext(): { leagueId: string; auctionId: string }`.
  - `hooks.ts`: ogni chiave di query dell'asta inizia con `['auction', leagueId, auctionId, ...]`; `usePhasePlayers(offset, sort, dir, enabled = true)`; `useValuation(playerId, enabled = true)`; `useCorrectPurchase()` con input `{ auctionId: string; seq: number; participantId: string; price: number }`.
  - `types.ts`: `AuctionStateResponse` con `version: number`, `admin: boolean`, `myParticipantId: string | null`.
  - `WithAuctionContext({ children })`.
  - Rotte: `/leghe/:leagueId/aste/:auctionId`, `/leghe/:leagueId/aste/:auctionId/proiezione`. Spariscono `/asta`, `/proiezione`, `/riepilogo`.
  - `CorrectPurchaseDialog({ purchase, participants, pending, error, onConfirm, onCancel })`.
  - Il canale fra finestre si chiama `fantaagent-bid:<auctionId>`.

**Chi vede cosa.** Con `admin` vero la schermata è quella di oggi. Con `admin` falso spariscono: il cambio di fase (resta scritta la fase), «annulla l'ultimo», il banco d'aggiudicazione (`BidPanel`), la modale del banditore (`BidderDialog`), la ✕ e la correzione nelle rose. Restano: tabella di fase, ricerca, scheda del giocatore coi propri consigli, rose, la propria squadra, la proiezione. Senza posto (`myParticipantId` null) la tabella di fase, gli obiettivi e i consigli non si chiedono nemmeno, e al loro posto c'è una frase: «Non hai un posto in quest'asta: puoi seguirla, ma i consigli non sono disponibili.»

**Le chiavi della cache.** Oggi le chiavi (`['state']`, `['board']`…) non dicono di quale asta sono: con un'asta sola non serviva. Ora passare da un'asta all'altra nella stessa scheda mostrerebbe per un istante lo stato della precedente sotto l'indirizzo della nuova. Ogni chiave porta lega e asta.

- [ ] **Step 1: Scrivere i test che falliscono**

`frontend/src/routes/WithAuctionContext.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { auctionContext } from '../api/client';
import { WithAuctionContext } from './WithAuctionContext';

function Probe() {
  const { leagueId, auctionId } = auctionContext();
  return <p>{leagueId}/{auctionId}</p>;
}

describe('WithAuctionContext', () => {
  it('prende lega e asta dall\'indirizzo prima che i figli chiedano qualcosa', () => {
    const router = createMemoryRouter([{
      path: '/leghe/:leagueId/aste/:auctionId',
      element: <WithAuctionContext><Probe /></WithAuctionContext>,
    }], { initialEntries: ['/leghe/l1/aste/a9'] });
    render(<RouterProvider router={router} />);
    expect(screen.getByText('l1/a9')).toBeInTheDocument();
  });
});
```

In `AuctionRoute.test.tsx`:

1. Nel dato di stato condiviso dai test (l'oggetto che risponde a `/state`), aggiungere `admin: true, version: 1`: i test esistenti verificano i gesti dell'amministratore e devono continuare a farlo.
2. Ogni asserzione su `href="/proiezione"` diventa `href="/leghe/default/aste/a1/proiezione"`; quella sul collegamento alle impostazioni diventa `href="/leghe/default"` con nome accessibile «Vai alla lega».
3. Casi nuovi:

```tsx
  describe('per chi non e\' amministratore', () => {
    it('non mostra i comandi del banco ma mostra la fase', async () => {
      setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
      stubApi({ state: { ...STATE, admin: false } });
      renderAuction();

      expect(await screen.findByText(/Fase:/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Annulla l'ultimo/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('group', { name: /Fase/ })).not.toBeInTheDocument();
    });

    it('senza posto non chiede i consigli e lo dice', async () => {
      setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
      const fetchMock = stubApi({ state: { ...STATE, admin: false, myParticipantId: null } });
      renderAuction();

      expect(await screen.findByText(/Non hai un posto in quest'asta/)).toBeInTheDocument();
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/players/phase'))).toBe(false);
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/players/targets'))).toBe(false);
    });
  });
```

`STATE`, `stubApi` e `renderAuction` sono i nomi da usare per il dato di stato, lo stub di `fetch` e il render già presenti nel file: se si chiamano diversamente, usare quelli esistenti (o estrarli in funzioni con questi nomi, senza cambiare cosa fanno). Il nome del pulsante «annulla» e del gruppo delle fasi sono quelli di `UndoLastButton` e `PhaseSwitcher`: prenderli dai loro test.

In `RosterGrid.test.tsx`, casi nuovi (il test rende `RosterGrid` con lo stato e la board stubbati come fa già):

```tsx
  it('un membro non amministratore non vede la ✕ ne\' la correzione', async () => {
    stubBoardAndState({ admin: false });
    renderGrid();
    await screen.findByText(ANY_PLAYER_NAME);
    expect(screen.queryByRole('button', { name: /Annulla l'acquisto/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Correggi/ })).not.toBeInTheDocument();
  });

  it('l\'amministratore corregge prezzo e squadra', async () => {
    const fetchMock = stubBoardAndState({ admin: true });
    renderGrid();
    await userEvent.click(await screen.findByRole('button', { name: new RegExp(`Correggi.*${ANY_PLAYER_NAME}`) }));
    const dialog = screen.getByRole('dialog', { name: 'Correggi l\'acquisto' });
    await userEvent.clear(within(dialog).getByLabelText('Prezzo'));
    await userEvent.type(within(dialog).getByLabelText('Prezzo'), '33');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salva la correzione' }));

    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/correct'));
    expect(call).toBeDefined();
    expect(JSON.parse(call![1].body)).toMatchObject({ price: 33 });
  });
```

(`stubBoardAndState`, `renderGrid`, `ANY_PLAYER_NAME`: come nel Task precedente, usare gli aiuti già presenti nel file e i nomi dei pulsanti che `RosterGrid` usa oggi per la ✕.)

In `bidChannel.test.ts` un caso: due canali con aste diverse non si sentono.

```ts
  it('ogni asta ha il suo canale', () => {
    setAuctionContext({ leagueId: 'l1', auctionId: 'a1' });
    const received: unknown[] = [];
    const stop = subscribeBid((m) => received.push(m));
    setAuctionContext({ leagueId: 'l1', auctionId: 'a2' });
    publishBid({ kind: 'idle' });
    stop();
    expect(received).toEqual([]);
  });
```

(con `BroadcastChannel` sincrono simulato come fanno già gli altri casi del file; se usano un finto, il nome del canale è ciò che il finto deve distinguere.)

- [ ] **Step 2: Eseguire i test e vederli fallire**

Run (da `frontend/`): `npx vitest run src/routes/WithAuctionContext.test.tsx src/routes/AuctionRoute.test.tsx src/domain/RosterGrid.test.tsx src/domain/bidChannel.test.ts`
Expected: FAIL.

- [ ] **Step 3: Contesto, chiavi, tipi**

In `client.ts`, accanto a `setAuctionContext`:

```ts
/** La lega e l'asta dell'indirizzo corrente: le fissa {@link WithAuctionContext}. */
export function auctionContext(): { leagueId: string; auctionId: string } {
  return context;
}
```

e il valore iniziale di `context` diventa `{ leagueId: '', auctionId: '' }`.

`frontend/src/routes/WithAuctionContext.tsx`:

```tsx
import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { setAuctionContext } from '../api/client';

/**
 * Lega e asta vengono dall'indirizzo, non piu' da una variabile d'ambiente fissata
 * all'avvio. Si impostano durante il render, prima dei figli: le loro query leggono il
 * contesto quando partono, e un effetto arriverebbe dopo la prima richiesta.
 */
export function WithAuctionContext({ children }: { children: ReactNode }) {
  const { leagueId = '', auctionId = '' } = useParams();
  setAuctionContext({ leagueId, auctionId });
  return <>{children}</>;
}
```

In `main.tsx` togliere la chiamata a `setAuctionContext` e l'import (con il commento che la spiega).

In `hooks.ts` sostituire `KEYS` con chiavi che portano l'asta:

```ts
/**
 * Ogni chiave porta lega e asta: passando da un'asta all'altra nella stessa scheda,
 * la cache non deve restituire per un istante i dati della precedente.
 */
function scoped(...parts: readonly unknown[]) {
  const { leagueId, auctionId } = auctionContext();
  return ['auction', leagueId, auctionId, ...parts] as const;
}

const KEYS = {
  state: () => scoped('state'),
  phase: (offset: number, sort: string, dir: string) => scoped('phase', offset, sort, dir),
  valuation: (playerId: string) => scoped('valuation', playerId),
  board: () => scoped('board'),
  publicBidder: (playerId: string) => scoped('public-bidder', playerId),
  targets: () => scoped('targets'),
  auctions: ['auctions'] as const,
};
```

e aggiornare gli usi (`KEYS.state` → `KEYS.state()`, `KEYS.board` → `KEYS.board()`, `['targets']` → `KEYS.targets()`). Aggiungere `enabled` a `usePhasePlayers` e `useValuation`:

```ts
export function usePhasePlayers(offset: number, sort: PhaseSort = 'quotazione', dir: SortDir = 'desc',
  enabled = true) {
  return useQuery({
    queryKey: KEYS.phase(offset, sort, dir),
    queryFn: () => apiGet<PhasePageResponse>(
      `/players/phase?offset=${offset}&limit=25&sort=${sort}&dir=${dir}`),
    enabled,
  });
}

export function useValuation(playerId: string | null, enabled = true) {
  return useQuery({
    queryKey: KEYS.valuation(playerId ?? ''),
    queryFn: () => apiGet<ValuationResponse>(`/players/${playerId}/valuation`),
    enabled: enabled && playerId !== null,
  });
}
```

E la correzione:

```ts
export interface CorrectPurchaseInput {
  /** Come per la revoca: l'asta della board che si sta guardando, non quella del contesto. */
  auctionId: string;
  seq: number;
  participantId: string;
  price: number;
}

export function useCorrectPurchase() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CorrectPurchaseInput) =>
      apiPostToAuction(input.auctionId, `/purchases/${input.seq}/correct`,
        { participantId: input.participantId, price: input.price }),
    onSuccess: () => client.invalidateQueries(),
  });
}
```

In `types.ts`, `AuctionStateResponse`:

```ts
  /** Null per chi e' membro della lega ma non ha un posto in quest'asta. */
  myParticipantId: string | null;
  /** Il numero dell'ultimo evento del registro. */
  version: number;
  /** Se chi guarda e' l'amministratore della lega: solo lui scrive. */
  admin: boolean;
```

In `bidChannel.ts` (import `auctionContext` da `../api/client`) il nome del canale diventa per asta:

```ts
const PREFIX = 'fantaagent-bid';

/**
 * Un canale per asta: due schede su due aste diverse (lo stesso amministratore che ne
 * prepara una mentre ne batte un'altra) non devono proiettare l'una il lotto dell'altra.
 */
function channel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  return new BroadcastChannel(`${PREFIX}:${auctionContext().auctionId}`);
}
```

- [ ] **Step 4: Le rotte**

In `router.tsx` le tre rotte dell'asta diventano:

```tsx
  // Lega e asta nell'indirizzo: e' quello che si manda nel gruppo, ed e' quello che
  // un ricaricamento deve ritrovare.
  {
    path: '/leghe/:leagueId/aste/:auctionId',
    element: <RequireAuth><WithAuctionContext><AuctionRoute /></WithAuctionContext></RequireAuth>,
  },
  {
    path: '/leghe/:leagueId/aste/:auctionId/proiezione',
    element: <RequireAuth><WithAuctionContext><ProjectionRoute /></WithAuctionContext></RequireAuth>,
  },
```

togliendo `/asta`, `/proiezione`, `/riepilogo` e i loro commenti. `/` e `/impostazioni` restano fino al Task 17. In `SpaRoutesController`: via `ASTA`, `PROIEZIONE`, `RIEPILOGO`; dentro `ASTA_DI_LEGA = "/leghe/{leagueId}/aste/{auctionId}"` e `PROIEZIONE_DI_LEGA = "/leghe/{leagueId}/aste/{auctionId}/proiezione"`. In `SpaRoutesControllerTest`, `unaRottaProfondaRicaricataInoltraAllaSpa` chiede `/leghe/l1/aste/a1` invece di `/riepilogo`.

- [ ] **Step 5: La schermata dell'asta**

In `AuctionRoute.tsx`:

1. `const { leagueId = '', auctionId = '' } = useParams();` (import da `react-router-dom`) e, dopo `useAuctionState()`:

```tsx
  // Solo l'amministratore scrive nel registro; gli altri seguono l'asta e vedono i
  // propri consigli. Finche' lo stato non e' arrivato, niente comandi: meglio un
  // istante senza pulsanti che un pulsante che risponde "non puoi".
  const admin = state.data?.admin ?? false;
  const seated = state.data ? state.data.myParticipantId !== null : true;
```

2. Le query che valutano partono solo con un posto: `useTargets(state.isSuccess && !concluded && seated)`, `usePhasePlayers(pageOffset, sort, sortDir, seated)`, `useValuation(selectedId, seated)`.
3. In `slotActions`: `PhaseSwitcher` e `UndoLastButton` solo con `admin`; senza, al posto del selettore:

```tsx
            <span className="flex min-h-11 items-center rounded-full border border-line-strong px-4 font-medium">
              Fase: {ROLE_NAME_PLURAL[state.data?.currentPhase ?? 'P']}
            </span>
```

(import `ROLE_NAME_PLURAL` da `../domain/roles`). Il collegamento alla proiezione diventa `href={`/leghe/${leagueId}/aste/${auctionId}/proiezione`}`; quello alle impostazioni diventa un `Link to={`/leghe/${leagueId}`}` con testo nascosto «Vai alla lega» (il Task 17 lo porterà alle impostazioni dell'asta per l'amministratore).
4. `BidPanel` e `BidderDialog` solo con `admin`. Per chi non lo è, il pannello centrale mostra comunque `PlayerDecisionCard`/`AnalysisPanel` del giocatore scelto: quello che sparisce è il modo di aggiudicarlo, non la scheda.
5. Senza posto, dove oggi c'è la tabella di fase (e gli obiettivi nel banco):

```tsx
          <p className="panel rounded-2xl p-4 text-sm">
            Non hai un posto in quest'asta: puoi seguirla, ma i consigli non sono disponibili.
          </p>
```

   (una sola volta, al posto della tabella; il banco resta vuoto senza ripeterla).
6. `me` (usato per «La tua squadra, …») viene già dai partecipanti con `me: true`: senza posto è `undefined` e il titolo ripiega su «Sul banco», come oggi.

- [ ] **Step 6: Rose e correzione**

`frontend/src/domain/CorrectPurchaseDialog.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';

export interface CorrectablePurchase {
  seq: number;
  playerName: string;
  participantId: string;
  price: number;
}

/**
 * Il secondo potere dell'amministratore: il banco ha sbagliato squadra o prezzo, e
 * si corregge senza annullare e rifare. Stesso {@code <dialog>} nativo delle altre
 * modali; il giocatore non si cambia — per quello si annulla l'acquisto.
 */
export function CorrectPurchaseDialog({
  purchase, participants, pending, error, onConfirm, onCancel,
}: {
  purchase: CorrectablePurchase | null;
  participants: { id: string; name: string }[];
  pending: boolean;
  error: string | null;
  onConfirm: (seq: number, participantId: string, price: number) => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [participantId, setParticipantId] = useState(purchase?.participantId ?? '');
  const [price, setPrice] = useState(String(purchase?.price ?? ''));

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !purchase) return;
    setParticipantId(purchase.participantId);
    setPrice(String(purchase.price));
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [purchase]);

  if (!purchase) return null;
  const parsed = Number.parseInt(price, 10);
  const valid = Number.isInteger(parsed) && parsed >= 1;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="correct-purchase-title"
      onCancel={(e) => { e.preventDefault(); onCancel(); }}
      className="panel m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl p-6 text-foreground backdrop:bg-black/60"
    >
      <form onSubmit={(e) => { e.preventDefault(); if (valid) onConfirm(purchase.seq, participantId, parsed); }}>
        <h2 id="correct-purchase-title" className="w-exp text-lg font-semibold">Correggi l'acquisto</h2>
        <p className="mt-2 text-sm">{purchase.playerName}</p>
        <label htmlFor="correct-participant" className="mt-4 block text-sm font-medium">Squadra</label>
        <select id="correct-participant" value={participantId} onChange={(e) => setParticipantId(e.target.value)}
          className="mt-2 min-h-11 w-full rounded-xl border border-line-strong bg-surface px-4 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
          {participants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <label htmlFor="correct-price" className="mt-4 block text-sm font-medium">Prezzo</label>
        <input id="correct-price" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)}
          className="mt-2 min-h-11 w-32 rounded-xl border border-line-strong bg-surface px-4 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" />
        {error ? <p role="alert" className="mt-3 text-sm font-medium text-destructive">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onCancel}
            className="min-h-11 rounded-full border border-line-strong px-5 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
            Annulla
          </button>
          <button type="submit" disabled={pending || !valid}
            className="min-h-11 rounded-full bg-accent px-5 font-semibold text-on-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground">
            {pending ? 'Salvo…' : 'Salva la correzione'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
```

`CorrectPurchaseDialog.test.tsx`: apre con squadra e prezzo dell'acquisto, il pulsante resta spento con prezzo `0` o vuoto, `onConfirm` riceve `(seq, participantId, prezzo)`, Esc chiama `onCancel`.

In `RosterGrid.tsx`:
- `const admin = state.data?.admin ?? false;`
- la ✕ di ogni riga solo con `admin`; accanto, sempre solo con `admin`, un pulsante «Correggi» (nome accessibile `Correggi l'acquisto di <giocatore>`) che apre `CorrectPurchaseDialog` con `{ seq, playerName, participantId: colonna, price }`;
- `useCorrectPurchase()` con `{ auctionId: board.data.auctionId, ... }`, come fa già la revoca; l'errore passa da `userMessage(error, 'La correzione non è riuscita. Riprova.')`;
- i partecipanti della modale vengono da `state.data.participants` (`{ id, name }`).
- Il componente che rende la singola riga riceve `admin` come prop invece di leggerlo da solo.

Se nella revisione del 22 settembre la ✕ è stata spostata in un menu della riga, «Correggi» va nello stesso menu, non accanto.

- [ ] **Step 7: Eseguire i test e vederli passare**

Run (da `frontend/`): `npm test && npm run lint && npm run build`; dalla radice `mvn -q test -Dtest=SpaRoutesControllerTest`.
Expected: PASS.

- [ ] **Step 8: Mutazione**

In `AuctionRoute` far valere `admin` sempre `true`: `non mostra i comandi del banco ma mostra la fase` deve fallire. Ripristinare.

- [ ] **Step 9: Verifica visiva**

Vite + Playwright (intercettare le `pathname` che iniziano con `/api/`), su `/leghe/l1/aste/a1`, a 1440×900 e 390×844: da amministratore (uguale a prima del Task, a parte i collegamenti), da membro con posto (niente comandi, consigli presenti, nessun buco dove c'erano i pulsanti), da membro senza posto (la frase al posto della tabella, la pagina resta piena). Confrontare con gli screenshot della revisione del 22 settembre se ci sono.

- [ ] **Step 10: Commit**

```bash
git add -A frontend/src src/main/java/com/fantaagent/adapter/in/spa src/test/java/com/fantaagent/adapter/in/spa
git commit -m "L'asta all'indirizzo della sua lega: comandi solo all'amministratore, consigli solo a chi ha un posto

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: La pagina della lega con le sue aste, e le impostazioni dell'asta

**Files:**
- Modify (backend): `application/service/auction/AuctionCard.java`, `LeagueAuctionService.java` (`list`), `adapter/in/api/league/LeagueDtos.java` (`AuctionCardView`), `src/test/java/com/fantaagent/adapter/in/api/league/LeagueAuctionsApiTest.java`
- Modify: `frontend/src/api/types.ts`, `frontend/src/api/leagues.ts`, `frontend/src/router.tsx`, `frontend/src/AppShell.tsx`, `frontend/src/AppShell.test.tsx`
- Modify: `frontend/src/routes/LeagueRoute.tsx`, `LeagueRoute.test.tsx`, `frontend/src/routes/AuctionRoute.tsx`
- Modify: `frontend/src/domain/RenameAuctionDialog.tsx`, `DeleteAuctionDialog.tsx` (e i loro test)
- Create: `frontend/src/routes/AuctionSettingsRoute.tsx`, `AuctionSettingsRoute.test.tsx`
- Modify: `src/main/java/com/fantaagent/adapter/in/spa/SpaRoutesController.java`

**Interfaces:**
- Consumes: le rotte del Task 15.
- Produces:
  - `AuctionCard` e `AuctionCardView` guadagnano `bidder` (`AuctionSettings` / `SettingsDtos.BidderSettings`): è da qui che la pagina delle impostazioni dell'asta legge i valori attuali del banditore.
  - `types.ts`: `LeagueAuctionCard { id; name; createdAt; lastWritten: string | null; purchases; phase: Role; teams; budget; totalSlots; myBudgetRemaining: number | null; bidder: BidderSettings }`, `SeatView { userId; displayName; teamName; initial; position }`, `SeatsView { locked; seats: SeatView[] }`, `SeatInput { userId; teamName; initial }`.
  - `leagues.ts`: `useLeagueAuctions(leagueId)`, `useCreateAuction(leagueId)`, `useUpdateAuction(leagueId)` (`{ auctionId, name?, bidder? }`), `useDeleteAuction(leagueId)`, `useSeats(leagueId, auctionId)`, `useSaveSeats(leagueId, auctionId)`, `useRemoveMember(leagueId)`.
  - `RenameAuctionDialog` e `DeleteAuctionDialog` accettano `auction: { id: string; label: string } | null`.
  - Rotte: `/` diventa l'elenco delle leghe; `/leghe` porta a `/`; `/leghe/:leagueId/aste/:auctionId/impostazioni` → `AuctionSettingsRoute`.
  - `AppShell`: la voce di navigazione è «Le mie leghe».

**La pagina della lega**, dall'alto: il nome; «Aste» a tutta larghezza (l'elenco, e per l'amministratore il campo «Nuova asta»); sotto, affiancati, «Membri» e — per l'amministratore — «Inviti». Ogni asta è una riga-collegamento con nome, «N di M giocatori · fase», «ti restano X crediti» se si ha un posto; per l'amministratore un menu con «Impostazioni dell'asta», «Rinomina», «Elimina». Nei membri: «Lascia la lega» per chi non è amministratore (con conferma), «Togli» accanto agli altri per l'amministratore (con conferma «Sei sicuro? L'azione è irreversibile.»).

**Le impostazioni dell'asta** (`/leghe/:leagueId/aste/:auctionId/impostazioni`), per l'amministratore:
- «Turno di chiamata»: i posti in ordine, ognuno con «Sposta su»/«Sposta giù» (bersagli 44×44, nome accessibile con la squadra). Finché l'asta non è iniziata (`locked` falso) ogni posto ha anche nome della squadra e iniziale modificabili e «Togli», e sotto l'elenco i membri senza posto con «Aggiungi». Da iniziata, una riga dice: «L'asta è iniziata: si può cambiare solo il turno di chiamata.» Un pulsante «Salva il turno» manda il `PUT` con l'elenco nell'ordine a schermo.
- «Banditore»: secondi del conto alla rovescia (`StepperField`, 1–120) e avviso sonoro; «Salva» manda il `PATCH` con `bidder`.
- Per chi non è amministratore la pagina mostra solo il turno, in sola lettura.

Nella schermata dell'asta, il collegamento con l'ingranaggio porta qui per l'amministratore («Impostazioni dell'asta») e alla lega per gli altri («Vai alla lega»).

- [ ] **Step 1: Il banditore nell'elenco (backend)**

`AuctionCard` guadagna in fondo `AuctionSettings bidder`; `LeagueAuctionService.list` lo passa (`a.bidder()`); `AuctionCardView` guadagna `SettingsDtos.BidderSettings bidder` e `of(...)` lo converte. In `LeagueAuctionsApiTest.lElencoDiceACheSegnoSiamo` aggiungere `.andExpect(jsonPath("$[0].bidder.bidTimerSeconds").isNumber())`. `LeagueAuctionServiceTest` compila senza cambi (usa gli accessor per nome).

Run: `mvn -q test -Dtest='LeagueAuctionsApiTest,LeagueAuctionServiceTest'` — PASS.

- [ ] **Step 2: Scrivere i test che falliscono (frontend)**

In `LeagueRoute.test.tsx`, lo stub risponde anche a `GET /api/leagues/l1/auctions` (per i test esistenti, `[]`). Casi nuovi:

```tsx
  it('elenca le aste con il punto a cui sono e i crediti che restano', async () => {
    stub(false, {
      'GET /api/leagues/l1/auctions': () => json([{
        id: 'a1', name: 'Asta d\'estate', createdAt: '2026-09-28T20:00:00Z', lastWritten: '2026-09-28T21:00:00Z',
        purchases: 12, phase: 'D', teams: 8, budget: 500, totalSlots: 200, myBudgetRemaining: 320,
        bidder: { bidTimerSeconds: 5, beepEnabled: true },
      }]),
    });
    renderLeague();
    const link = await screen.findByRole('link', { name: /Asta d'estate/ });
    expect(link).toHaveAttribute('href', '/leghe/l1/aste/a1');
    expect(link).toHaveTextContent('12 di 200 giocatori');
    expect(link).toHaveTextContent('320 crediti');
  });

  it('l\'amministratore crea un\'asta e ci entra', async () => {
    stub(true, {
      'GET /api/leagues/l1/auctions': () => json([]),
      'POST /api/leagues/l1/auctions': () => json({
        id: 'a2', name: 'Riparazione', createdAt: '2026-09-28T20:00:00Z', lastWritten: null, purchases: 0,
        phase: 'P', teams: 2, budget: 500, totalSlots: 50, myBudgetRemaining: 500,
        bidder: { bidTimerSeconds: 5, beepEnabled: true },
      }, 201),
    });
    const router = renderLeagueWithAuctionRoute();
    await userEvent.type(await screen.findByLabelText('Nome della nuova asta'), 'Riparazione');
    await userEvent.click(screen.getByRole('button', { name: 'Crea l\'asta' }));
    expect(await screen.findByText('pagina dell\'asta')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/leghe/l1/aste/a2');
  });

  it('un membro puo\' lasciare la lega, l\'amministratore no', async () => {
    stub(false, { 'GET /api/leagues/l1/auctions': () => json([]) });
    renderLeague();
    expect(await screen.findByRole('button', { name: 'Lascia la lega' })).toBeInTheDocument();
  });
```

(`renderLeagueWithAuctionRoute` è `renderLeague` con in più la rotta `/leghe/:leagueId/aste/:auctionId` che rende `<p>pagina dell'asta</p>`, e che restituisce il router.)

`frontend/src/routes/AuctionSettingsRoute.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryProvider } from '../api/QueryProvider';
import { AuctionSettingsRoute } from './AuctionSettingsRoute';

const LEAGUE = {
  id: 'l1', name: 'Lega del Bar', admin: true, members: [
    { userId: 'u1', displayName: 'Anna', teamName: 'Anna FC', initial: 'A', role: 'ADMIN', me: true },
    { userId: 'u2', displayName: 'Bruno', teamName: 'Bruno FC', initial: 'B', role: 'MEMBER', me: false },
    { userId: 'u3', displayName: 'Carla', teamName: 'Carla FC', initial: 'C', role: 'MEMBER', me: false },
  ],
};
const CARD = {
  id: 'a1', name: 'Asta', createdAt: '2026-09-28T20:00:00Z', lastWritten: null, purchases: 0, phase: 'P',
  teams: 2, budget: 500, totalSlots: 50, myBudgetRemaining: 500, bidder: { bidTimerSeconds: 5, beepEnabled: true },
};
const SEATS = (locked: boolean) => ({
  locked, seats: [
    { userId: 'u1', displayName: 'Anna', teamName: 'Anna FC', initial: 'A', position: 1 },
    { userId: 'u2', displayName: 'Bruno', teamName: 'Bruno FC', initial: 'B', position: 2 },
  ],
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function stub(locked: boolean) {
  const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const key = `${(init?.method ?? 'GET').toUpperCase()} ${url}`;
    const routes: Record<string, () => Response> = {
      'GET /api/me': () => json({ id: 'u1', email: 'a@b.it', displayName: 'Anna', emailVerified: true }),
      'GET /api/leagues/l1': () => json(LEAGUE),
      'GET /api/leagues/l1/auctions': () => json([CARD]),
      'GET /api/leagues/l1/auctions/a1/seats': () => json(SEATS(locked)),
      'PUT /api/leagues/l1/auctions/a1/seats': () => json(SEATS(locked)),
      'PATCH /api/leagues/l1/auctions/a1': () => new Response(null, { status: 204 }),
    };
    if (!routes[key]) throw new Error(`chiamata inattesa: ${key}`);
    return Promise.resolve(routes[key]());
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderSettings() {
  const router = createMemoryRouter([
    { path: '/leghe/:leagueId/aste/:auctionId/impostazioni', element: <AuctionSettingsRoute /> },
  ], { initialEntries: ['/leghe/l1/aste/a1/impostazioni'] });
  render(<QueryProvider><RouterProvider router={router} /></QueryProvider>);
}

describe('AuctionSettingsRoute', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('cambia il turno di chiamata', async () => {
    const fetchMock = stub(true);
    renderSettings();
    await userEvent.click(await screen.findByRole('button', { name: 'Sposta su Bruno FC' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salva il turno' }));

    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
    expect(JSON.parse(put![1].body).map((s: { userId: string }) => s.userId)).toEqual(['u2', 'u1']);
  });

  it('ad asta iniziata nomi e iniziali non si toccano', async () => {
    stub(true);
    renderSettings();
    expect(await screen.findByText(/si può cambiare solo il turno di chiamata/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Nome della squadra di Anna')).not.toBeInTheDocument();
  });

  it('prima dell\'inizio si aggiunge chi non ha un posto', async () => {
    const fetchMock = stub(false);
    renderSettings();
    const missing = await screen.findByRole('list', { name: 'Membri senza posto' });
    await userEvent.click(within(missing).getByRole('button', { name: 'Aggiungi Carla FC' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salva il turno' }));

    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
    expect(JSON.parse(put![1].body)).toHaveLength(3);
  });

  it('salva i secondi del banditore', async () => {
    const fetchMock = stub(true);
    renderSettings();
    await userEvent.click(await screen.findByRole('button', { name: 'Un secondo in più' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salva il banditore' }));

    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(JSON.parse(patch![1].body)).toEqual({ bidder: { bidTimerSeconds: 6, beepEnabled: true } });
  });
});
```

In `AppShell.test.tsx` il test esistente sulla voce di navigazione cerca «Le mie leghe» invece di «Le mie aste».

- [ ] **Step 3: Eseguire i test e vederli fallire**

Run (da `frontend/`): `npx vitest run src/routes/LeagueRoute.test.tsx src/routes/AuctionSettingsRoute.test.tsx src/AppShell.test.tsx`
Expected: FAIL.

- [ ] **Step 4: Tipi e hook**

In `types.ts`:

```ts
/** Un'asta nella pagina della lega. Specchio di {@code LeagueDtos.AuctionCardView}. */
export interface LeagueAuctionCard {
  id: string;
  name: string;
  createdAt: string;
  lastWritten: string | null;
  purchases: number;
  phase: Role;
  teams: number;
  budget: number;
  totalSlots: number;
  /** Null per chi non ha un posto in quest'asta. */
  myBudgetRemaining: number | null;
  bidder: BidderSettings;
}

export interface SeatView {
  userId: string;
  displayName: string;
  teamName: string;
  initial: string;
  position: number;
}

export interface SeatsView {
  /** Vero dal primo acquisto: da li' si cambia solo l'ordine. */
  locked: boolean;
  seats: SeatView[];
}

export interface SeatInput {
  userId: string;
  teamName: string;
  initial: string;
}
```

In `leagues.ts`, con le chiavi `auctions: (id) => ['leagues', id, 'auctions']` e `seats: (id, a) => ['leagues', id, 'auctions', a, 'seats']` in `LEAGUE_KEYS`:

```ts
export function useLeagueAuctions(leagueId: string) {
  return useQuery({
    queryKey: LEAGUE_KEYS.auctions(leagueId),
    queryFn: () => api<LeagueAuctionCard[]>(`${path(leagueId)}/auctions`),
  });
}

export function useCreateAuction(leagueId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api<LeagueAuctionCard>(`${path(leagueId)}/auctions`, { method: 'POST', body: { name } }),
    onSuccess: () => client.invalidateQueries({ queryKey: LEAGUE_KEYS.auctions(leagueId) }),
  });
}

export function useUpdateAuction(leagueId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ auctionId, ...body }: { auctionId: string; name?: string; bidder?: BidderSettings }) =>
      api<null>(`${path(leagueId)}/auctions/${encodeURIComponent(auctionId)}`, { method: 'PATCH', body }),
    onSuccess: () => client.invalidateQueries({ queryKey: LEAGUE_KEYS.auctions(leagueId) }),
  });
}

export function useDeleteAuction(leagueId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (auctionId: string) =>
      api<null>(`${path(leagueId)}/auctions/${encodeURIComponent(auctionId)}`, { method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries({ queryKey: LEAGUE_KEYS.auctions(leagueId) }),
  });
}

export function useSeats(leagueId: string, auctionId: string) {
  return useQuery({
    queryKey: LEAGUE_KEYS.seats(leagueId, auctionId),
    queryFn: () => api<SeatsView>(`${path(leagueId)}/auctions/${encodeURIComponent(auctionId)}/seats`),
    ...STILL,
  });
}

export function useSaveSeats(leagueId: string, auctionId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (seats: SeatInput[]) =>
      api<SeatsView>(`${path(leagueId)}/auctions/${encodeURIComponent(auctionId)}/seats`,
        { method: 'PUT', body: seats }),
    onSuccess: (view) => {
      client.setQueryData(LEAGUE_KEYS.seats(leagueId, auctionId), view);
      return client.invalidateQueries({ queryKey: LEAGUE_KEYS.auctions(leagueId) });
    },
  });
}

export function useRemoveMember(leagueId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api<null>(`${path(leagueId)}/members/${encodeURIComponent(userId)}`, { method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries({ queryKey: LEAGUE_KEYS.all }),
  });
}
```

(import dei tipi nuovi e di `BidderSettings`.)

`RenameAuctionDialog` e `DeleteAuctionDialog`: il tipo della prop `auction` diventa `{ id: string; label: string } | null`; togliere l'import di `AuctionCard` se non serve più. I loro test passano oggetti con almeno `id` e `label`: restano validi.

- [ ] **Step 5: Le schermate**

`LeagueRoute.tsx`: aggiungere in cima alla griglia una sezione «Aste» a tutta larghezza (`lg:col-span-2`):

```tsx
function AuctionsPanel({ leagueId, admin }: { leagueId: string; admin: boolean }) {
  const auctions = useLeagueAuctions(leagueId);
  const create = useCreateAuction(leagueId);
  const update = useUpdateAuction(leagueId);
  const remove = useDeleteAuction(leagueId);
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; label: string } | null>(null);
  const errors = fieldErrors(create.error);

  return (
    <section aria-labelledby="auctions-title" className="panel rounded-2xl p-6 lg:col-span-2">
      <h2 id="auctions-title" className="w-exp text-lg font-semibold">Aste</h2>
      {auctions.data && auctions.data.length === 0 ? (
        <p className="mt-4 text-sm">
          {admin ? 'Nessuna asta ancora: creane una qui sotto.' : 'Nessuna asta ancora: la crea l\'amministratore.'}
        </p>
      ) : null}
      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {auctions.data?.map((a) => (
          <li key={a.id} className="flex items-stretch gap-2">
            <Link to={`/leghe/${leagueId}/aste/${a.id}`}
              className="flex min-h-20 flex-1 flex-col justify-center rounded-xl border border-line-strong px-4 py-3 hover:bg-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
              <span className="font-semibold">{a.name}</span>
              <span className="text-sm text-muted-foreground">
                {a.purchases} di {a.totalSlots} giocatori · {ROLE_NAME_PLURAL[a.phase]}
                {a.myBudgetRemaining !== null ? ` · ti restano ${a.myBudgetRemaining} crediti` : ''}
              </span>
            </Link>
            {admin ? (
              <AuctionAdminMenu
                settingsHref={`/leghe/${leagueId}/aste/${a.id}/impostazioni`}
                onRename={() => setRenaming({ id: a.id, label: a.name })}
                onDelete={() => setDeleting({ id: a.id, label: a.name })}
                label={a.name}
              />
            ) : null}
          </li>
        ))}
      </ul>
      {admin ? (
        <form className="mt-6 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(name, { onSuccess: (a) => navigate(`/leghe/${leagueId}/aste/${a.id}`) });
          }}>
          <div className="min-w-60 flex-1">
            <TextField id="new-auction-name" label="Nome della nuova asta" value={name} onChange={setName}
              errors={errors.name} />
          </div>
          <button type="submit" disabled={create.isPending || name.trim() === ''}
            className="min-h-11 rounded-full bg-accent px-5 font-semibold text-on-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground">
            Crea l'asta
          </button>
        </form>
      ) : null}
      {create.isError && Object.keys(errors).length === 0 ? (
        <p role="alert" className="mt-4 text-sm font-medium text-destructive">
          {userMessage(create.error, 'Non sono riuscito a creare l\'asta. Riprova fra poco.')}
        </p>
      ) : null}
      <RenameAuctionDialog auction={renaming} pending={update.isPending}
        error={update.isError ? userMessage(update.error, 'Non sono riuscito a rinominarla. Riprova.') : null}
        onConfirm={(id, newName) => update.mutate({ auctionId: id, name: newName },
          { onSuccess: () => setRenaming(null) })}
        onCancel={() => { setRenaming(null); update.reset(); }} />
      <DeleteAuctionDialog auction={deleting} pending={remove.isPending}
        error={remove.isError ? userMessage(remove.error, 'Non sono riuscito a eliminarla. Riprova.') : null}
        onConfirm={(id) => remove.mutate(id, { onSuccess: () => setDeleting(null) })}
        onCancel={() => { setDeleting(null); remove.reset(); }} />
    </section>
  );
}
```

`AuctionAdminMenu` è un menu a tendina accessibile con tre voci: seguire lo schema di `AuctionRowMenu.tsx` (pulsante con `aria-haspopup="menu"`, `aria-expanded`, voci `role="menuitem"`, chiusura con Esc e clic fuori), copiandone la struttura invece di importarlo: `AuctionRowMenu` sparirà nel Task 18 insieme alla home vecchia.

Nella sezione «Membri»: con `admin` falso un pulsante «Lascia la lega» in fondo; con `admin` vero, accanto a ogni membro che non è `me`, un pulsante «Togli» (nome accessibile `Togli <squadra>`). Entrambi chiedono conferma con un `<dialog>` come `DeleteAuctionDialog` («Sei sicuro? L'azione è irreversibile.»), poi `useRemoveMember`; chi lascia la lega viene portato a `/`.

`frontend/src/routes/AuctionSettingsRoute.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../AppShell';
import { userMessage } from '../api/client';
import { useLeague, useLeagueAuctions, useSaveSeats, useSeats, useUpdateAuction } from '../api/leagues';
import type { SeatInput } from '../api/types';
import { StepperField } from '../domain/StepperField';

const BUTTON =
  'min-h-11 min-w-11 rounded-full border border-line-strong px-3 font-medium hover:bg-line disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent';
const PRIMARY =
  'min-h-11 rounded-full bg-accent px-5 font-semibold text-on-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground';

export function AuctionSettingsRoute() {
  const { leagueId = '', auctionId = '' } = useParams();
  const league = useLeague(leagueId);
  const auctions = useLeagueAuctions(leagueId);
  const seats = useSeats(leagueId, auctionId);
  const save = useSaveSeats(leagueId, auctionId);
  const update = useUpdateAuction(leagueId);
  const [draft, setDraft] = useState<SeatInput[] | null>(null);
  const [timer, setTimer] = useState<number | null>(null);
  const [beep, setBeep] = useState<boolean | null>(null);

  const card = auctions.data?.find((a) => a.id === auctionId);
  const admin = league.data?.admin ?? false;

  useEffect(() => {
    if (seats.data && draft === null) {
      setDraft(seats.data.seats.map((s) => ({ userId: s.userId, teamName: s.teamName, initial: s.initial })));
    }
  }, [seats.data, draft]);

  if (!league.data || !seats.data || !draft || !card) {
    return <AppShell chrome="top"><p className="text-sm">Un attimo…</p></AppShell>;
  }
  const locked = seats.data.locked;
  const seatedIds = new Set(draft.map((s) => s.userId));
  const missing = league.data.members.filter((m) => !seatedIds.has(m.userId));
  const nameOf = (userId: string) =>
    league.data!.members.find((m) => m.userId === userId)?.displayName ?? '';
  const seconds = timer ?? card.bidder.bidTimerSeconds;
  const beepOn = beep ?? card.bidder.beepEnabled;

  function move(index: number, by: -1 | 1) {
    setDraft((d) => {
      if (!d) return d;
      const next = [...d];
      const [item] = next.splice(index, 1);
      next.splice(index + by, 0, item);
      return next;
    });
  }

  function edit(index: number, patch: Partial<SeatInput>) {
    setDraft((d) => d && d.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  return (
    <AppShell chrome="top">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm"><Link to={`/leghe/${leagueId}/aste/${auctionId}`} className="underline underline-offset-4">Torna all'asta</Link></p>
        <h1 className="w-exp mt-2 text-2xl font-semibold">{card.name}</h1>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <section aria-labelledby="order-title" className="panel rounded-2xl p-6">
            <h2 id="order-title" className="w-exp text-lg font-semibold">Turno di chiamata</h2>
            {locked ? (
              <p className="mt-2 text-sm text-muted-foreground">
                L'asta è iniziata: si può cambiare solo il turno di chiamata.
              </p>
            ) : null}
            <ol aria-label="Turno di chiamata" className="mt-4 divide-y divide-line">
              {draft.map((s, i) => (
                <li key={s.userId} className="flex flex-wrap items-center gap-3 py-2">
                  <span className="w-6 text-right font-semibold tabular-nums">{i + 1}</span>
                  {admin && !locked ? (
                    <>
                      <input aria-label={`Nome della squadra di ${nameOf(s.userId)}`} value={s.teamName}
                        onChange={(e) => edit(i, { teamName: e.target.value })}
                        className="min-h-11 min-w-40 flex-1 rounded-xl border border-line-strong bg-surface px-3" />
                      <input aria-label={`Iniziale di ${nameOf(s.userId)}`} value={s.initial} maxLength={1}
                        onChange={(e) => edit(i, { initial: e.target.value.toUpperCase().slice(-1) })}
                        className="min-h-11 w-14 rounded-xl border border-line-strong bg-surface text-center font-semibold" />
                    </>
                  ) : (
                    <span className="flex-1"><span className="font-medium">{s.teamName}</span>
                      <span className="text-sm text-muted-foreground"> · {s.initial} · {nameOf(s.userId)}</span></span>
                  )}
                  {admin ? (
                    <span className="flex gap-2">
                      <button type="button" className={BUTTON} disabled={i === 0} onClick={() => move(i, -1)}
                        aria-label={`Sposta su ${s.teamName}`}>↑</button>
                      <button type="button" className={BUTTON} disabled={i === draft.length - 1}
                        onClick={() => move(i, 1)} aria-label={`Sposta giù ${s.teamName}`}>↓</button>
                      {!locked ? (
                        <button type="button" className={BUTTON}
                          onClick={() => setDraft(draft.filter((x) => x.userId !== s.userId))}
                          aria-label={`Togli ${s.teamName}`}>Togli</button>
                      ) : null}
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
            {admin && !locked && missing.length > 0 ? (
              <>
                <h3 className="mt-6 text-sm font-semibold">Membri senza posto</h3>
                <ul aria-label="Membri senza posto" className="mt-2 divide-y divide-line">
                  {missing.map((m) => (
                    <li key={m.userId} className="flex min-h-11 items-center justify-between gap-3 py-2">
                      <span>{m.teamName} <span className="text-sm text-muted-foreground">· {m.displayName}</span></span>
                      <button type="button" className={BUTTON}
                        onClick={() => setDraft([...draft, { userId: m.userId, teamName: m.teamName, initial: m.initial }])}
                        aria-label={`Aggiungi ${m.teamName}`}>Aggiungi</button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {admin ? (
              <button type="button" className={`mt-6 ${PRIMARY}`} disabled={save.isPending}
                onClick={() => save.mutate(draft, { onSuccess: (v) => setDraft(v.seats.map((s) => ({
                  userId: s.userId, teamName: s.teamName, initial: s.initial }))) })}>
                {save.isPending ? 'Salvo…' : 'Salva il turno'}
              </button>
            ) : null}
            {save.isError ? (
              <p role="alert" className="mt-4 text-sm font-medium text-destructive">
                {userMessage(save.error, 'Non sono riuscito a salvare il turno. Riprova.')}
              </p>
            ) : null}
          </section>
          {admin ? (
            <section aria-labelledby="bidder-title" className="panel rounded-2xl p-6">
              <h2 id="bidder-title" className="w-exp text-lg font-semibold">Banditore</h2>
              <label htmlFor="bidder-seconds" className="mt-4 block text-sm font-medium">
                Secondi del conto alla rovescia
              </label>
              <div className="mt-2">
                <StepperField id="bidder-seconds" value={seconds} onChange={setTimer} min={1} max={120}
                  decreaseLabel="Un secondo in meno" increaseLabel="Un secondo in più" />
              </div>
              <label className="mt-4 flex min-h-11 items-center gap-3 text-sm font-medium">
                <input type="checkbox" checked={beepOn} onChange={(e) => setBeep(e.target.checked)}
                  className="size-5" />
                Avviso sonoro allo scadere
              </label>
              <button type="button" className={`mt-6 ${PRIMARY}`} disabled={update.isPending}
                onClick={() => update.mutate({ auctionId, bidder: { bidTimerSeconds: seconds, beepEnabled: beepOn } })}>
                Salva il banditore
              </button>
              {update.isSuccess ? <p role="status" className="mt-2 text-sm">Salvato.</p> : null}
            </section>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
```

Un solo `role="alert"` per schermata: se entrambi i salvataggi falliscono, mostrare quello del turno e far cadere l'altro nello stesso paragrafo (`userMessage(save.error ?? update.error, ...)`), come fa `LeagueRoute` con gli inviti.

In `AuctionRoute.tsx` il collegamento con l'ingranaggio: `admin ? { to: `/leghe/${leagueId}/aste/${auctionId}/impostazioni`, label: 'Impostazioni dell\'asta' } : { to: `/leghe/${leagueId}`, label: 'Vai alla lega' }`.

In `AppShell.tsx`: la voce «Le mie aste» diventa «Le mie leghe», sempre verso `/`.

In `router.tsx`:

```tsx
  { path: '/', element: <RequireAuth><LeaguesRoute /></RequireAuth> },
  { path: '/leghe', element: <Navigate to="/" replace /> },
  {
    path: '/leghe/:leagueId/aste/:auctionId/impostazioni',
    element: <RequireAuth><AuctionSettingsRoute /></RequireAuth>,
  },
```

togliendo la vecchia `/` con `HomeRoute` (il file resta fino al Task 18, non più raggiunto). In `SpaRoutesController` aggiungere `IMPOSTAZIONI_ASTA = "/leghe/{leagueId}/aste/{auctionId}/impostazioni"`.

- [ ] **Step 6: Eseguire i test e vederli passare**

Run (da `frontend/`): `npm test && npm run lint && npm run build`; dalla radice `mvn -q test -Dtest='SpaRoutesControllerTest,LeagueAuctionsApiTest'`.
Expected: PASS. I test di `HomeRoute` possono restare verdi (il componente esiste ancora): spariscono nel Task 18.

- [ ] **Step 7: Mutazione**

In `AuctionSettingsRoute` rendere i campi di nome e iniziale visibili anche con `locked`: `ad asta iniziata nomi e iniziali non si toccano` deve fallire. Ripristinare.

- [ ] **Step 8: Verifica visiva**

Vite + Playwright, 1440×900 e 390×844: `/` con due leghe; `/leghe/l1` da amministratore con tre aste e da membro; `/leghe/l1/aste/a1/impostazioni` prima e dopo l'inizio. La sezione «Aste» a tutta larghezza non deve lasciare metà pagina vuota con una sola asta: con una sola riga la griglia a due colonne resta, e il form di creazione sta sotto.

- [ ] **Step 9: Commit**

```bash
git add -A frontend/src src/main/java src/test/java
git commit -m "La lega con le sue aste, il turno di chiamata e il banditore di ogni asta

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 18: Le regole della lega, e via la home vecchia

**Files:**
- Modify: `frontend/src/routes/SettingsRoute.tsx` → rinominato `LeagueRulesRoute.tsx`; `SettingsRoute.test.tsx` → `LeagueRulesRoute.test.tsx`
- Modify: `frontend/src/api/leagues.ts`, `frontend/src/api/types.ts`, `frontend/src/api/hooks.ts`, `frontend/src/api/client.ts`, `frontend/src/router.tsx`, `frontend/src/routes/LeagueRoute.tsx`
- Delete: `frontend/src/routes/HomeRoute.tsx`, `HomeRoute.test.tsx`, e i componenti e test rimasti senza utilizzatori (vedi Step 5)
- Modify: `src/main/java/com/fantaagent/adapter/in/spa/SpaRoutesController.java`

**Interfaces:**
- Consumes: `GET/PUT /api/leagues/{leagueId}/rules` (Task 7).
- Produces:
  - `types.ts`: `LeagueRulesResponse { bidder: BidderSettings; scoring: ScoringSection; rules: RulesSection; canEdit: boolean }`, `SaveLeagueRulesRequest { bidder; scoring; rules }`.
  - `leagues.ts`: `useLeagueRules(leagueId)`, `useSaveLeagueRules(leagueId)`.
  - Rotta `/leghe/:leagueId/regole` → `LeagueRulesRoute`; sparisce `/impostazioni`.

Cosa cambia nella schermata di oggi:
- **via** il nome dell'asta, «Parti da un'asta precedente», la sezione dei partecipanti (`ParticipantsFieldset`), il passaggio alla creazione dell'asta dopo il salvataggio: le aste nascono dalla pagina della lega, e i loro partecipanti sono i membri;
- **via** la modalità «asta aperta»: al suo posto `canEdit`. Chi non è amministratore vede il riepilogo in sola lettura (gli stessi `RulesSummary` e `ScoringSummary` di oggi) con la frase «Solo l'amministratore della lega può cambiare le regole.»;
- **in testa** una riga: «Valgono per le prossime aste della lega. Quelle già create tengono le regole con cui sono nate.»;
- il numero di squadre non si mostra più fra le regole: è quanti membri partecipano a ogni asta;
- dopo il salvataggio si resta sulla pagina, con «Regole salvate.» in un `role="status"`;
- l'indice laterale delle sezioni, il salvataggio fisso in basso e i campi dimensionati della revisione del 22 settembre restano come sono.

- [ ] **Step 1: Scrivere i test che falliscono**

Rinominare `SettingsRoute.test.tsx` in `LeagueRulesRoute.test.tsx` e riscriverne la preparazione: la risposta di `GET /api/leagues/l1/rules` è un `LeagueRulesResponse` (costruirlo dai dati di punteggio e regole che il file già usa per `SettingsResponse`), il salvataggio è `PUT /api/leagues/l1/rules`, la pagina si rende su `/leghe/l1/regole`. Tenere i casi su punteggio, soglie, validazione per campo (422 `invalid-settings` con `errors`), un solo `role="alert"`, salvataggio fisso; togliere quelli su partecipanti, nome dell'asta, «Parti da», creazione e asta aperta. Aggiungere:

```tsx
  it('chi non e\' amministratore legge le regole ma non le cambia', async () => {
    stubRules({ ...RULES, canEdit: false });
    renderRules();
    expect(await screen.findByText('Solo l\'amministratore della lega può cambiare le regole.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Salva/ })).not.toBeInTheDocument();
  });

  it('il salvataggio manda banditore, punteggio e regole, e resta qui', async () => {
    const fetchMock = stubRules(RULES);
    renderRules();
    await userEvent.click(await screen.findByRole('button', { name: /Salva/ }));
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
    expect(Object.keys(JSON.parse(put![1].body)).sort()).toEqual(['bidder', 'rules', 'scoring']);
    expect(await screen.findByRole('status')).toHaveTextContent('Regole salvate.');
  });
```

(`RULES`, `stubRules`, `renderRules`: aiuti del file riscritto.)

- [ ] **Step 2: Eseguire i test e vederli fallire**

Run (da `frontend/`): `npx vitest run src/routes/LeagueRulesRoute.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Tipi e hook**

In `types.ts`:

```ts
/** Le regole con cui nasceranno le prossime aste della lega. */
export interface LeagueRulesResponse {
  bidder: BidderSettings;
  scoring: ScoringSection;
  rules: RulesSection;
  canEdit: boolean;
}

export interface SaveLeagueRulesRequest {
  bidder: BidderSettings;
  scoring: ScoringSection;
  rules: RulesSection;
}
```

In `leagues.ts`:

```ts
export function useLeagueRules(leagueId: string) {
  return useQuery({
    queryKey: ['leagues', leagueId, 'rules'] as const,
    queryFn: () => api<LeagueRulesResponse>(`${path(leagueId)}/rules`),
    ...STILL,
  });
}

export function useSaveLeagueRules(leagueId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: SaveLeagueRulesRequest) =>
      api<LeagueRulesResponse>(`${path(leagueId)}/rules`, { method: 'PUT', body }),
    onSuccess: (saved) => client.setQueryData(['leagues', leagueId, 'rules'], saved),
  });
}
```

- [ ] **Step 4: La schermata**

`git mv frontend/src/routes/SettingsRoute.tsx frontend/src/routes/LeagueRulesRoute.tsx`, rinominare la funzione in `LeagueRulesRoute`, e applicare l'elenco di cambiamenti in testa al Task: `useSettings`/`useSaveSettings`/`useAuctions`/`useSettingsFrom` → `useLeagueRules(leagueId)`/`useSaveLeagueRules(leagueId)` con `leagueId` da `useParams`; lo stato del modulo si inizializza da `rules.data` (bidder, scoring, rules); il corpo del `PUT` è `{ bidder, scoring, rules }`; `auctionOpen` → `!canEdit`; il `LeagueRulesFieldset` non riceve più il numero di partecipanti (se è una sua prop obbligatoria, renderla facoltativa e non mostrare la riga delle squadre quando manca). Il titolo della pagina è «Regole della lega».

In `LeagueRoute.tsx`, sotto il nome della lega, un collegamento «Regole della lega» verso `/leghe/${leagueId}/regole`, per tutti.

In `router.tsx`: via `/impostazioni`, dentro `{ path: '/leghe/:leagueId/regole', element: <RequireAuth><LeagueRulesRoute /></RequireAuth> }`. In `SpaRoutesController`: via `IMPOSTAZIONI`, dentro `REGOLE = "/leghe/{leagueId}/regole"`.

- [ ] **Step 5: Pulizia**

```bash
git rm frontend/src/routes/HomeRoute.tsx frontend/src/routes/HomeRoute.test.tsx
```

Poi, finché qualcosa cambia: `cd frontend && npx tsc -b --noEmit` e `npm run lint` elencano import e simboli non più usati. Togliere:
- da `hooks.ts`: `useAuctions`, `useSelectAuction`, `useLeaveAuction`, `useDeleteAuction`, `useRenameAuction`, `useDuplicateAuction`, `useSettingsFrom`, `useSettings`, `useSaveSettings` e `KEYS.auctions`;
- da `client.ts`: `apiLeagueGet`, `apiLeaguePost`, `apiLeaguePut`, `apiLeaguePatch`, `apiLeagueDelete`, `leagueUrl` se nessuno li importa più (i test di `client.test.ts` che li provano vanno tolti con loro);
- da `types.ts`: `AuctionCard`, `SettingsResponse`, `SaveSettingsRequest`, `SaveSettingsResult`, `ParticipantSettings`, `LeagueRulesView` se non più usati;
- da `src/domain/`: `AuctionRow.tsx`, `AuctionRowMenu.tsx`, `ParticipantsFieldset.tsx`, e ogni altro componente che dopo queste rimozioni nessuno importa, ciascuno col suo test (`grep -rl "from './NomeComponente'\|from '../domain/NomeComponente'" src` vuoto prima di cancellarlo).

`useIdleHeartbeat` e `bidChannel` restano: li usano l'asta e la proiezione.

- [ ] **Step 6: Eseguire i test e vederli passare**

Run (da `frontend/`): `npm test && npm run lint && npm run build`; dalla radice `mvn -q test`.
Expected: PASS.

- [ ] **Step 7: Mutazione**

In `LeagueRulesRoute` ignorare `canEdit` (sempre modificabile): `chi non e' amministratore legge le regole ma non le cambia` deve fallire. Ripristinare.

- [ ] **Step 8: Verifica visiva e commit**

Screenshot di `/leghe/l1/regole` da amministratore e da membro, 1440×900 e 390×844: indice laterale, salvataggio fisso e riepilogo come nella revisione del 22 settembre.

```bash
git add -A frontend/src src/main/java/com/fantaagent/adapter/in/spa src/test/java/com/fantaagent/adapter/in/spa
git commit -m "Le regole della lega al posto delle impostazioni globali; via la home delle aste locali

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Parte E — Importazione delle aste su file

Alla fine della Parte E l'amministratore porta nella lega un'asta giocata col jar di prima, abbinando ogni partecipante a un membro; se le rose ricostruite non coincidono, non resta niente di scritto.

### Task 19: Importare un'asta su file

**Files:**
- Create: `application/port/out/ImportedAuction.java`, `ImportedAuctionReader.java`
- Create: `application/service/importing/AuctionImportService.java`, `ImportPreview.java`, `ImportCheck.java`, `InvalidImportException.java`, `ImportMismatchException.java`
- Modify: `application/service/auction/LogSummary.java` (`playersOf`)
- Create: `adapter/out/importing/FileImportReader.java`
- Create: `adapter/in/api/importing/ImportApi.java`
- Modify: `adapter/in/api/ApiExceptionHandler.java`, `config/PersistenceConfig.java`, `src/main/resources/application.yml`
- Create: `src/test/java/com/fantaagent/testsupport/OldAuctionFiles.java`
- Test: `src/test/java/com/fantaagent/application/service/importing/ImportCheckTest.java`, `AuctionImportServiceTest.java`, `ImportRealAuctionsTest.java`, `src/test/java/com/fantaagent/adapter/in/api/importing/ImportApiTest.java`

**Interfaces:**
- Consumes: `FileAuctionArchive` (esistente, sola lettura), `AuctionTemplate`, `AuctionRepository`, `AuctionEventStores`, `LeagueRepository`, `Transactions`, `LogSummary`.
- Produces:
  - `record ImportedAuction(String name, List<Participant> participants, LeagueRulesSettings rules, ScoringSettings scoring, AuctionSettings bidder, List<AuctionEvent> events)`.
  - `interface ImportedAuctionReader { ImportedAuction read(Map<String, byte[]> files); }` — lancia `InvalidImportException`.
  - `AuctionImportService(ImportedAuctionReader, AuctionRepository, AuctionEventStores, LeagueRepository, Transactions)` con `ImportPreview preview(LeagueAccess, Map<String, byte[]>)` e `UUID importAuction(LeagueAccess, Map<String, byte[]>, Map<String, UUID> mapping)`.
  - `record ImportPreview(String name, int purchases, List<FileParticipant> participants)` con `record FileParticipant(String id, String name, String initial)`.
  - `ImportCheck.verify(List<AuctionEvent> original, List<AuctionEvent> imported, Map<String, UUID> mapping)` — lancia `ImportMismatchException`.
  - `LogSummary.playersOf(List<AuctionEvent>, String participantId): Set<String>`.
  - Rotte: `POST /api/leagues/{leagueId}/imports/preview` (multipart `files`) → `ImportPreview`; `POST /api/leagues/{leagueId}/imports` (multipart `files` + `mapping` JSON `{idNelFile: userId}`) → 201 `{auctionId}`.
  - Problemi: `invalid-import` 422 con `errors` (chiavi `files`, `mapping`), `import-mismatch` 409.
  - `testsupport.OldAuctionFiles.write(Path dir, List<Participant>, List<AuctionEvent>): Map<String, byte[]>`.

I file accettati sono quelli della cartella di un'asta: `events.jsonl` (obbligatorio), `league-members.yml`, `league-rules.yml`, `league-settings.yml`, `auction-settings.yml`. Gli altri (`.bak`, `rose.csv`) si ignorano. Quelli che mancano ricadono sul modello, come faceva `AuctionRuntime` per le aste scritte prima che quei file esistessero.

La verifica non proietta: confronta i registri con `LogSummary`, senza catalogo. Un'asta di una stagione passata nomina giocatori che il listone di oggi non ha, e una proiezione fallirebbe proprio sulle aste che l'importazione serve a salvare. Quello che deve coincidere è ciò che l'abbinamento potrebbe rompere: per ogni partecipante del file e il suo membro, crediti spesi e giocatori in rosa; per l'asta, numero di eventi e fase.

- [ ] **Step 1: Il supporto dei test**

`src/test/java/com/fantaagent/testsupport/OldAuctionFiles.java`:

```java
package com.fantaagent.testsupport;

import com.fantaagent.adapter.out.file.FileAuctionArchive;
import com.fantaagent.application.port.out.AuctionEventStore;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.league.Participant;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

/**
 * La cartella di un'asta come la scriveva il jar di prima, scritta dallo stesso codice
 * che la scriveva allora, e letta come la manderebbe il browser: nome e contenuto.
 */
public final class OldAuctionFiles {

    private OldAuctionFiles() {
    }

    public static Map<String, byte[]> write(Path dataDir, List<Participant> participants, List<AuctionEvent> events) {
        FileAuctionArchive archive = new FileAuctionArchive(dataDir);
        archive.saveParticipants("vecchia", participants);
        AuctionEventStore store = archive.open("vecchia");
        events.forEach(store::append);
        return read(dataDir.resolve("auctions").resolve("vecchia"));
    }

    public static Map<String, byte[]> read(Path auctionDir) {
        Map<String, byte[]> files = new LinkedHashMap<>();
        try (Stream<Path> paths = Files.list(auctionDir)) {
            for (Path p : paths.filter(Files::isRegularFile).toList()) {
                files.put(p.getFileName().toString(), Files.readAllBytes(p));
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return files;
    }
}
```

- [ ] **Step 2: Scrivere i test che falliscono**

`src/test/java/com/fantaagent/application/service/importing/ImportCheckTest.java`:

```java
package com.fantaagent.application.service.importing;

import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ImportCheckTest {

    private static final Instant AT = Instant.parse("2025-08-30T20:00:00Z");
    private static final UUID ANNA = UUID.randomUUID();
    private static final UUID BRUNO = UUID.randomUUID();
    private static final Map<String, UUID> MAPPING = Map.of("me", ANNA, "p2", BRUNO);

    private static final List<AuctionEvent> ORIGINAL = List.of(
            new AuctionEvent.AuctionStarted(1, AT, "Asta"),
            new AuctionEvent.PlayerPurchased(2, AT, "x", "me", 10),
            new AuctionEvent.PlayerPurchased(3, AT, "y", "p2", 20),
            new AuctionEvent.PurchaseCorrected(4, AT, 2, "p2", 12),
            new AuctionEvent.PhaseAdvanced(5, AT, Role.D));

    @Test
    void unRegistroRiscrittoBenePassa() {
        List<AuctionEvent> imported = List.of(
                new AuctionEvent.AuctionStarted(1, AT, "Asta"),
                new AuctionEvent.PlayerPurchased(2, AT, "x", ANNA.toString(), 10),
                new AuctionEvent.PlayerPurchased(3, AT, "y", BRUNO.toString(), 20),
                new AuctionEvent.PurchaseCorrected(4, AT, 2, BRUNO.toString(), 12),
                new AuctionEvent.PhaseAdvanced(5, AT, Role.D));
        assertThatCode(() -> ImportCheck.verify(ORIGINAL, imported, MAPPING)).doesNotThrowAnyException();
    }

    @Test
    void unaCorrezioneNonRiscrittaSiVede() {
        List<AuctionEvent> imported = List.of(
                new AuctionEvent.AuctionStarted(1, AT, "Asta"),
                new AuctionEvent.PlayerPurchased(2, AT, "x", ANNA.toString(), 10),
                new AuctionEvent.PlayerPurchased(3, AT, "y", BRUNO.toString(), 20),
                new AuctionEvent.PurchaseCorrected(4, AT, 2, "p2", 12),
                new AuctionEvent.PhaseAdvanced(5, AT, Role.D));
        assertThatThrownBy(() -> ImportCheck.verify(ORIGINAL, imported, MAPPING))
                .isInstanceOf(ImportMismatchException.class);
    }

    @Test
    void unEventoMancanteSiVede() {
        assertThatThrownBy(() -> ImportCheck.verify(ORIGINAL, ORIGINAL.subList(0, 4), MAPPING))
                .isInstanceOf(ImportMismatchException.class);
    }
}
```

`src/test/java/com/fantaagent/application/service/importing/AuctionImportServiceTest.java`:

```java
package com.fantaagent.application.service.importing;

import com.fantaagent.adapter.out.importing.FileImportReader;
import com.fantaagent.application.service.auction.AuctionCard;
import com.fantaagent.application.service.league.AdminOnlyException;
import com.fantaagent.application.service.league.LeagueAccess;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Role;
import com.fantaagent.testsupport.Fixtures;
import com.fantaagent.testsupport.OldAuctionFiles;
import com.fantaagent.testsupport.PortalWorld;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AuctionImportServiceTest {

    private static final Instant AT = Instant.parse("2025-08-30T20:00:00Z");

    @TempDir
    Path dir;

    private PortalWorld world;
    private AuctionImportService imports;
    private LeagueAccess admin;
    private UUID bruno;
    private Map<String, byte[]> files;

    @BeforeEach
    void setUp() {
        world = new PortalWorld();
        imports = new AuctionImportService(new FileImportReader(Fixtures.template()), world.auctionRepository,
                world.stores, world.leagueRepository, world.tx);
        admin = world.league("anna", "bruno");
        bruno = world.userId(admin, "bruno FC");
        files = OldAuctionFiles.write(dir, List.of(
                        new Participant("me", "Io", 'I', true),
                        new Participant("p2", "Marco", 'M', false)),
                List.of(new AuctionEvent.AuctionStarted(1, AT, "Asta del 2025"),
                        new AuctionEvent.PlayerPurchased(2, AT, "P1", "me", 30),
                        new AuctionEvent.PlayerPurchased(3, AT, "D1", "p2", 45),
                        new AuctionEvent.PhaseAdvanced(4, AT, Role.D)));
    }

    @Test
    void ilRiepilogoDiceNomePartecipantiEAcquisti() {
        ImportPreview preview = imports.preview(admin, files);
        assertThat(preview.name()).isEqualTo("Asta del 2025");
        assertThat(preview.purchases()).isEqualTo(2);
        assertThat(preview.participants()).extracting(ImportPreview.FileParticipant::name)
                .containsExactly("Io", "Marco");
    }

    @Test
    void lAstaImportataEQuellaDiPrimaConIMembriAlPostoDeiNomi() {
        UUID id = imports.importAuction(admin, files, Map.of("me", admin.userId(), "p2", bruno));

        AuctionCard card = world.auctions.list(world.as(admin, bruno)).getFirst();
        assertThat(card.id()).isEqualTo(id);
        assertThat(card.name()).isEqualTo("Asta del 2025");
        assertThat(card.purchases()).isEqualTo(2);
        assertThat(card.phase()).isEqualTo(Role.D);
        assertThat(card.myBudgetRemaining()).isEqualTo(card.budget() - 45);
        assertThat(world.stores.open(id, admin.userId()).load()).extracting(AuctionEvent::seq)
                .containsExactly(1L, 2L, 3L, 4L);
        assertThat(world.stores.open(id, admin.userId()).load().get(1).at()).isEqualTo(AT);
    }

    @Test
    void senzaUnAbbinamentoCompletoNonSiScriveNiente() {
        assertThatThrownBy(() -> imports.importAuction(admin, files, Map.of("me", admin.userId())))
                .isInstanceOfSatisfying(InvalidImportException.class,
                        e -> assertThat(e.errors()).containsKey("mapping"));
        assertThat(world.auctions.list(admin)).isEmpty();
    }

    @Test
    void dueNomiNonVannoAlloStessoMembro() {
        assertThatThrownBy(() -> imports.importAuction(admin, files, Map.of("me", bruno, "p2", bruno)))
                .isInstanceOf(InvalidImportException.class);
    }

    @Test
    void soloMembriDellaLega() {
        UUID stranger = world.user("estraneo");
        assertThatThrownBy(() -> imports.importAuction(admin, files, Map.of("me", admin.userId(), "p2", stranger)))
                .isInstanceOf(InvalidImportException.class);
    }

    @Test
    void soloLAmministratoreImporta() {
        assertThatThrownBy(() -> imports.preview(world.as(admin, bruno), files))
                .isInstanceOf(AdminOnlyException.class);
    }

    @Test
    void unRegistroIllegibileLoDice() {
        Map<String, byte[]> broken = new HashMap<>(files);
        broken.put("events.jsonl", "non e' json".getBytes(StandardCharsets.UTF_8));
        assertThatThrownBy(() -> imports.preview(admin, broken))
                .isInstanceOfSatisfying(InvalidImportException.class,
                        e -> assertThat(e.errors()).containsKey("files"));
    }

    @Test
    void senzaRegistroNonCeUnAsta() {
        Map<String, byte[]> noLog = new HashMap<>(files);
        noLog.remove("events.jsonl");
        assertThatThrownBy(() -> imports.preview(admin, noLog)).isInstanceOf(InvalidImportException.class);
    }
}
```

`src/test/java/com/fantaagent/application/service/importing/ImportRealAuctionsTest.java`:

```java
package com.fantaagent.application.service.importing;

import com.fantaagent.application.port.out.LeagueMember;
import com.fantaagent.application.port.out.LeagueRepository;
import com.fantaagent.application.port.out.MemberRole;
import com.fantaagent.application.service.auction.LeagueAuctionService;
import com.fantaagent.application.service.auction.LogSummary;
import com.fantaagent.application.service.league.LeagueAccess;
import com.fantaagent.application.service.league.LeagueService;
import com.fantaagent.testsupport.OldAuctionFiles;
import com.fantaagent.testsupport.TestRows;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Le aste vere, quelle giocate: ognuna deve entrare e rileggersi uguale. Legge
 * {@code res/auctions} senza toccarlo; i file finiscono in memoria, non su disco.
 */
@SpringBootTest
@ActiveProfiles("dev")
class ImportRealAuctionsTest {

    @Autowired
    AuctionImportService imports;
    @Autowired
    LeagueService leagues;
    @Autowired
    LeagueAuctionService auctions;
    @Autowired
    LeagueRepository leagueRepository;
    @Autowired
    JdbcClient jdbc;

    @Test
    void ogniAstaGiocataSiImportaUguale() throws IOException {
        List<Path> dirs;
        try (Stream<Path> s = Files.list(Path.of("res/auctions"))) {
            dirs = s.filter(d -> Files.exists(d.resolve("events.jsonl"))).sorted().toList();
        }
        assertThat(dirs).isNotEmpty();

        for (Path dir : dirs) {
            Map<String, byte[]> files = OldAuctionFiles.read(dir);
            UUID adminId = TestRows.user(jdbc, "admin+" + UUID.randomUUID() + "@example.com");
            LeagueAccess admin = leagues.create(adminId, "Lega " + dir.getFileName(), "Admin FC", "Z");
            ImportPreview preview = imports.preview(admin, files);

            Map<String, UUID> mapping = new HashMap<>();
            char initial = 'A';
            for (ImportPreview.FileParticipant p : preview.participants()) {
                UUID member = TestRows.user(jdbc, "m+" + UUID.randomUUID() + "@example.com");
                leagueRepository.insertMember(new LeagueMember(admin.leagueId(), member, MemberRole.MEMBER,
                        p.name(), initial++, Instant.now(), null));
                mapping.put(p.id(), member);
            }

            UUID id = imports.importAuction(admin, files, mapping);

            assertThat(auctions.list(admin)).filteredOn(c -> c.id().equals(id)).singleElement()
                    .satisfies(c -> assertThat(c.purchases()).as(dir.toString()).isEqualTo(preview.purchases()));
        }
    }
}
```

`src/test/java/com/fantaagent/adapter/in/api/importing/ImportApiTest.java`:

```java
package com.fantaagent.adapter.in.api.importing;

import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.testsupport.AuctionApiFixture;
import com.fantaagent.testsupport.OldAuctionFiles;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import org.springframework.web.context.WebApplicationContext;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("dev")
class ImportApiTest {

    static final String PROBLEMS = "https://fantaagent.local/problems/";

    @Autowired
    private WebApplicationContext context;

    @TempDir
    Path dir;

    private AuctionApiFixture f;
    private Map<String, byte[]> files;

    @BeforeEach
    void setUp() throws Exception {
        f = AuctionApiFixture.create(context);
        Instant at = Instant.parse("2025-08-30T20:00:00Z");
        files = OldAuctionFiles.write(dir, List.of(
                        new Participant("me", "Io", 'I', true), new Participant("p2", "Marco", 'M', false)),
                List.of(new AuctionEvent.AuctionStarted(1, at, "Asta del 2025"),
                        new AuctionEvent.PlayerPurchased(2, at, f.player(com.fantaagent.domain.player.Role.P, 0), "p2", 45)));
    }

    private MockMultipartHttpServletRequestBuilder upload(String path) {
        MockMultipartHttpServletRequestBuilder builder = multipart("/api/leagues/" + f.leagueId + path);
        files.forEach((name, bytes) -> builder.file(new MockMultipartFile("files", name, "application/octet-stream", bytes)));
        return builder;
    }

    @Test
    void ilRiepilogoEPoiLImportazione() throws Exception {
        f.mvc.perform(upload("/imports/preview").with(csrf()).cookie(f.anna))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Asta del 2025"))
                .andExpect(jsonPath("$.participants[1].name").value("Marco"));

        MockMultipartFile mapping = new MockMultipartFile("mapping", "", MediaType.APPLICATION_JSON_VALUE,
                "{\"me\":\"%s\",\"p2\":\"%s\"}".formatted(f.annaId, f.brunoId).getBytes(StandardCharsets.UTF_8));
        f.mvc.perform(upload("/imports").file(mapping).with(csrf()).cookie(f.anna))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.auctionId").exists());

        f.mvc.perform(get("/api/leagues/" + f.leagueId + "/auctions").cookie(f.bruno))
                .andExpect(jsonPath("$[?(@.name == 'Asta del 2025')].myBudgetRemaining").value(455));
    }

    @Test
    void unMembroNonImporta() throws Exception {
        f.mvc.perform(upload("/imports/preview").with(csrf()).cookie(f.bruno))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "admin-only"));
    }

    @Test
    void unAbbinamentoIncompletoEDettoPerCampo() throws Exception {
        MockMultipartFile mapping = new MockMultipartFile("mapping", "", MediaType.APPLICATION_JSON_VALUE,
                "{\"me\":\"%s\"}".formatted(f.annaId).getBytes(StandardCharsets.UTF_8));
        f.mvc.perform(upload("/imports").file(mapping).with(csrf()).cookie(f.anna))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "invalid-import"))
                .andExpect(jsonPath("$.errors.mapping").isArray());
    }
}
```

- [ ] **Step 3: Eseguire i test e vederli fallire**

Run: `mvn -q test -Dtest='ImportCheckTest,AuctionImportServiceTest,ImportRealAuctionsTest,ImportApiTest'`
Expected: FAIL di compilazione.

- [ ] **Step 4: Porte, verifica, servizio**

`application/port/out/ImportedAuction.java`:

```java
package com.fantaagent.application.port.out;

import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.LeagueRulesSettings;
import com.fantaagent.config.ScoringSettings;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.league.Participant;

import java.util.List;

/** Un'asta letta dalla cartella del jar di prima, con i ripieghi sul modello gia' applicati. */
public record ImportedAuction(String name, List<Participant> participants, LeagueRulesSettings rules,
                              ScoringSettings scoring, AuctionSettings bidder, List<AuctionEvent> events) {
}
```

`application/port/out/ImportedAuctionReader.java`:

```java
package com.fantaagent.application.port.out;

import java.util.Map;

public interface ImportedAuctionReader {

    /**
     * @param files nome del file (senza cartella) → contenuto
     * @throws com.fantaagent.application.service.importing.InvalidImportException se manca
     *         il registro o un file non si legge
     */
    ImportedAuction read(Map<String, byte[]> files);
}
```

`application/service/importing/InvalidImportException.java`:

```java
package com.fantaagent.application.service.importing;

import java.util.List;
import java.util.Map;

public class InvalidImportException extends RuntimeException {

    private final Map<String, List<String>> errors;

    public InvalidImportException(Map<String, List<String>> errors) {
        super("importazione non valida: " + errors.keySet());
        this.errors = Map.copyOf(errors);
    }

    public Map<String, List<String>> errors() {
        return errors;
    }
}
```

`application/service/importing/ImportMismatchException.java`:

```java
package com.fantaagent.application.service.importing;

public class ImportMismatchException extends RuntimeException {

    public ImportMismatchException(String what) {
        super("Le rose ricostruite non coincidono con quelle dell'asta originale: l'importazione è stata annullata."
                + " (" + what + ")");
    }
}
```

(Il `detail` mostrato è il messaggio intero; la parte fra parentesi aiuta chi legge il log. Se si preferisce non mostrarla, l'handler usa il testo fisso della tabella dei problemi: fare così.)

`application/service/importing/ImportPreview.java`:

```java
package com.fantaagent.application.service.importing;

import java.util.List;

public record ImportPreview(String name, int purchases, List<FileParticipant> participants) {

    public record FileParticipant(String id, String name, String initial) {
    }
}
```

In `LogSummary` aggiungere:

```java
    /** I giocatori in rosa di un partecipante, dopo annullamenti e correzioni. */
    public static Set<String> playersOf(List<AuctionEvent> events, String participantId) {
        Map<Long, String> player = new HashMap<>();
        Map<Long, String> buyer = new HashMap<>();
        for (AuctionEvent event : events) {
            switch (event) {
                case AuctionEvent.PlayerPurchased p -> {
                    player.put(p.seq(), p.playerId());
                    buyer.put(p.seq(), p.participantId());
                }
                case AuctionEvent.PurchaseRevoked r -> {
                    player.remove(r.targetSeq());
                    buyer.remove(r.targetSeq());
                }
                case AuctionEvent.PurchaseCorrected c -> {
                    if (buyer.containsKey(c.targetSeq())) {
                        buyer.put(c.targetSeq(), c.newParticipantId());
                    }
                }
                default -> {
                    // nome e fasi non spostano giocatori
                }
            }
        }
        Set<String> mine = new HashSet<>();
        buyer.forEach((seq, who) -> {
            if (participantId.equals(who)) {
                mine.add(player.get(seq));
            }
        });
        return mine;
    }
```

`application/service/importing/ImportCheck.java`:

```java
package com.fantaagent.application.service.importing;

import com.fantaagent.application.service.auction.LogSummary;
import com.fantaagent.domain.auction.AuctionEvent;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Il registro importato dice le stesse cose dell'originale, con i membri al posto dei
 * nomi? Senza catalogo e senza proiezione, apposta: vedi {@link AuctionImportService}.
 */
public final class ImportCheck {

    private ImportCheck() {
    }

    public static void verify(List<AuctionEvent> original, List<AuctionEvent> imported, Map<String, UUID> mapping) {
        if (original.size() != imported.size()) {
            throw new ImportMismatchException("eventi: " + original.size() + " contro " + imported.size());
        }
        if (!Objects.equals(LogSummary.phase(original, null), LogSummary.phase(imported, null))) {
            throw new ImportMismatchException("fase");
        }
        for (Map.Entry<String, UUID> e : mapping.entrySet()) {
            String member = e.getValue().toString();
            if (LogSummary.spentBy(original, e.getKey()) != LogSummary.spentBy(imported, member)) {
                throw new ImportMismatchException("crediti di " + e.getKey());
            }
            if (!LogSummary.playersOf(original, e.getKey()).equals(LogSummary.playersOf(imported, member))) {
                throw new ImportMismatchException("rosa di " + e.getKey());
            }
        }
    }
}
```

`application/service/importing/AuctionImportService.java`:

```java
package com.fantaagent.application.service.importing;

import com.fantaagent.application.port.out.AuctionEventStore;
import com.fantaagent.application.port.out.AuctionEventStores;
import com.fantaagent.application.port.out.AuctionRecord;
import com.fantaagent.application.port.out.AuctionRepository;
import com.fantaagent.application.port.out.ImportedAuction;
import com.fantaagent.application.port.out.ImportedAuctionReader;
import com.fantaagent.application.port.out.LeagueMember;
import com.fantaagent.application.port.out.LeagueRepository;
import com.fantaagent.application.port.out.Seat;
import com.fantaagent.application.port.out.Transactions;
import com.fantaagent.application.service.auction.LogSummary;
import com.fantaagent.application.service.league.LeagueAccess;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.league.Participant;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Porta nella lega un'asta giocata col jar di prima.
 *
 * <p>Tutto o niente: asta, posti, eventi e verifica stanno nella stessa transazione.
 * Se la verifica trova una differenza, la transazione si annulla e nel database non
 * resta nulla — anche il registro, che e' append-only per chi scrive ma non per un
 * ROLLBACK di righe mai confermate.
 *
 * <p>Gli eventi mantengono numero e data. Chi li firma e' l'amministratore che importa:
 * e' lui che li ha messi qui, e una firma inventata sarebbe peggio di una vera.
 */
public class AuctionImportService {

    private final ImportedAuctionReader reader;
    private final AuctionRepository auctions;
    private final AuctionEventStores stores;
    private final LeagueRepository leagues;
    private final Transactions tx;

    public AuctionImportService(ImportedAuctionReader reader, AuctionRepository auctions,
                                AuctionEventStores stores, LeagueRepository leagues, Transactions tx) {
        this.reader = reader;
        this.auctions = auctions;
        this.stores = stores;
        this.leagues = leagues;
        this.tx = tx;
    }

    public ImportPreview preview(LeagueAccess access, Map<String, byte[]> files) {
        access.requireAdmin();
        ImportedAuction a = reader.read(files);
        return new ImportPreview(a.name(), LogSummary.purchases(a.events()), a.participants().stream()
                .map(p -> new ImportPreview.FileParticipant(p.id(), p.name(), String.valueOf(p.initial())))
                .toList());
    }

    public UUID importAuction(LeagueAccess access, Map<String, byte[]> files, Map<String, UUID> mapping) {
        access.requireAdmin();
        ImportedAuction a = reader.read(files);
        validate(access, a, mapping);

        UUID id = UUID.randomUUID();
        List<Seat> seats = new ArrayList<>();
        for (Participant p : a.participants()) {
            seats.add(new Seat(mapping.get(p.id()), p.name(), p.initial(), seats.size() + 1));
        }
        AuctionRecord record = new AuctionRecord(id, access.leagueId(), a.name(), access.userId(),
                a.events().getFirst().at(), null, a.rules(), a.scoring(), a.bidder());
        List<AuctionEvent> rewritten = a.events().stream().map(e -> rewrite(e, mapping)).toList();

        tx.run(() -> {
            auctions.insert(record, seats);
            AuctionEventStore store = stores.open(id, access.userId());
            rewritten.forEach(store::append);
            ImportCheck.verify(a.events(), store.load(), mapping);
        });
        return id;
    }

    private void validate(LeagueAccess access, ImportedAuction a, Map<String, UUID> mapping) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        if (a.events().isEmpty()) {
            errors.put("files", List.of("Il registro dell'asta è vuoto."));
        }
        Set<String> known = a.participants().stream().map(Participant::id).collect(Collectors.toSet());
        boolean strangers = a.events().stream().anyMatch(e -> switch (e) {
            case AuctionEvent.PlayerPurchased p -> !known.contains(p.participantId());
            case AuctionEvent.PurchaseCorrected c -> !known.contains(c.newParticipantId());
            default -> false;
        });
        if (strangers) {
            errors.put("files", List.of("Il registro nomina partecipanti che non sono fra quelli dell'asta."));
        }
        Set<UUID> members = leagues.members(access.leagueId()).stream()
                .map(LeagueMember::userId).collect(Collectors.toSet());
        List<String> problems = new ArrayList<>();
        Set<UUID> used = new HashSet<>();
        for (Participant p : a.participants()) {
            UUID member = mapping.get(p.id());
            if (member == null) {
                problems.add("Abbina «" + p.name() + "» a un membro della lega.");
            } else if (!members.contains(member)) {
                problems.add("Chi hai scelto per «" + p.name() + "» non è un membro della lega.");
            } else if (!used.add(member)) {
                problems.add("Due partecipanti non possono andare allo stesso membro.");
            }
        }
        if (!problems.isEmpty()) {
            errors.put("mapping", List.copyOf(new java.util.LinkedHashSet<>(problems)));
        }
        if (!errors.isEmpty()) {
            throw new InvalidImportException(errors);
        }
    }

    static AuctionEvent rewrite(AuctionEvent e, Map<String, UUID> mapping) {
        return switch (e) {
            case AuctionEvent.PlayerPurchased p -> new AuctionEvent.PlayerPurchased(p.seq(), p.at(), p.playerId(),
                    mapping.get(p.participantId()).toString(), p.price(), p.requestId());
            case AuctionEvent.PurchaseCorrected c -> new AuctionEvent.PurchaseCorrected(c.seq(), c.at(),
                    c.targetSeq(), mapping.get(c.newParticipantId()).toString(), c.newPrice());
            default -> e;
        };
    }
}
```

- [ ] **Step 5: La lettura dei file**

`adapter/out/importing/FileImportReader.java`:

```java
package com.fantaagent.adapter.out.importing;

import com.fantaagent.adapter.out.file.FileAuctionArchive;
import com.fantaagent.application.port.out.AuctionTemplate;
import com.fantaagent.application.port.out.ImportedAuction;
import com.fantaagent.application.port.out.ImportedAuctionReader;
import com.fantaagent.application.service.importing.InvalidImportException;
import com.fantaagent.domain.auction.AuctionEvent;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;

/**
 * Legge la cartella di un'asta del jar di prima riusando {@link FileAuctionArchive}
 * cosi' com'e': i file si copiano in una cartella temporanea con la struttura che
 * l'archivio si aspetta, si leggono, e la cartella si cancella. L'archivio su file non
 * si estende; si usa soltanto, finche' esistono aste da portare dentro.
 */
public class FileImportReader implements ImportedAuctionReader {

    static final String ID = "importata";
    static final Set<String> ACCEPTED = Set.of("events.jsonl", "league-members.yml",
            "league-rules.yml", "league-settings.yml", "auction-settings.yml");

    private final AuctionTemplate template;

    public FileImportReader(AuctionTemplate template) {
        this.template = template;
    }

    @Override
    public ImportedAuction read(Map<String, byte[]> files) {
        if (!files.containsKey("events.jsonl")) {
            throw invalid("Manca il registro degli acquisti dell'asta.");
        }
        Path root = null;
        try {
            root = Files.createTempDirectory("fantaagent-import");
            Path dir = Files.createDirectories(root.resolve("auctions").resolve(ID));
            for (Map.Entry<String, byte[]> f : files.entrySet()) {
                if (ACCEPTED.contains(f.getKey())) {
                    Files.write(dir.resolve(f.getKey()), f.getValue());
                }
            }
            FileAuctionArchive archive = new FileAuctionArchive(root);
            List<AuctionEvent> events;
            try {
                events = archive.open(ID).load();
            } catch (RuntimeException e) {
                throw invalid("Il registro degli acquisti non si legge: è danneggiato o non viene da FantaAgent.");
            }
            try {
                return new ImportedAuction(nameOf(events),
                        archive.participants(ID).orElseGet(template::participants),
                        archive.rules(ID).orElseGet(template::rules),
                        archive.scoring(ID).orElseGet(template::scoring),
                        archive.bidder(ID).orElseGet(template::bidder),
                        events);
            } catch (RuntimeException e) {
                throw invalid("Le impostazioni dell'asta non si leggono: sono danneggiate o non vengono da FantaAgent.");
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        } finally {
            deleteQuietly(root);
        }
    }

    /** L'ultimo nome dato all'asta, o uno di ripiego per i registri che non ne hanno. */
    static String nameOf(List<AuctionEvent> events) {
        String name = null;
        for (AuctionEvent e : events) {
            if (e instanceof AuctionEvent.AuctionStarted s && s.name() != null && !s.name().isBlank()) {
                name = s.name();
            }
            if (e instanceof AuctionEvent.AuctionRenamed r) {
                name = r.name();
            }
        }
        return name == null ? "Asta importata" : name;
    }

    private static InvalidImportException invalid(String message) {
        return new InvalidImportException(Map.of("files", List.of(message)));
    }

    private static void deleteQuietly(Path root) {
        if (root == null) {
            return;
        }
        try (Stream<Path> paths = Files.walk(root)) {
            paths.sorted(Comparator.reverseOrder()).forEach(p -> p.toFile().delete());
        } catch (IOException ignored) {
            // una cartella temporanea rimasta non e' un errore di chi importa
        }
    }
}
```

- [ ] **Step 6: API e configurazione**

`adapter/in/api/importing/ImportApi.java`:

```java
package com.fantaagent.adapter.in.api.importing;

import com.fantaagent.adapter.in.api.ApiAccess;
import com.fantaagent.adapter.in.security.AppUserPrincipal;
import com.fantaagent.application.service.importing.AuctionImportService;
import com.fantaagent.application.service.importing.ImportPreview;
import com.fantaagent.application.service.importing.InvalidImportException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/leagues/{leagueId}/imports")
public class ImportApi {

    public record ImportResult(String auctionId) {
    }

    private final ApiAccess access;
    private final AuctionImportService imports;
    private final ObjectMapper json;

    public ImportApi(ApiAccess access, AuctionImportService imports, ObjectMapper json) {
        this.access = access;
        this.imports = imports;
        this.json = json;
    }

    @PostMapping(value = "/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ImportPreview preview(@AuthenticationPrincipal AppUserPrincipal me, @PathVariable String leagueId,
                                 @RequestPart("files") List<MultipartFile> files) {
        return imports.preview(access.league(leagueId, me), contents(files));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ImportResult importAuction(@AuthenticationPrincipal AppUserPrincipal me, @PathVariable String leagueId,
                                      @RequestPart("files") List<MultipartFile> files,
                                      @RequestPart("mapping") String mapping) {
        UUID id = imports.importAuction(access.league(leagueId, me), contents(files), parse(mapping));
        return new ImportResult(id.toString());
    }

    /** Il nome senza cartella: il browser puo' mandare "asta/events.jsonl". */
    private static Map<String, byte[]> contents(List<MultipartFile> files) {
        Map<String, byte[]> out = new LinkedHashMap<>();
        for (MultipartFile f : files) {
            String name = f.getOriginalFilename() == null ? "" : f.getOriginalFilename();
            String base = name.substring(Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\')) + 1);
            try {
                out.put(base, f.getBytes());
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        }
        return out;
    }

    private Map<String, UUID> parse(String mapping) {
        try {
            Map<String, String> raw = json.readValue(mapping, new TypeReference<>() {
            });
            Map<String, UUID> out = new LinkedHashMap<>();
            raw.forEach((k, v) -> out.put(k, UUID.fromString(v)));
            return out;
        } catch (IOException | IllegalArgumentException e) {
            throw new InvalidImportException(Map.of("mapping", List.of("Abbina ogni partecipante a un membro della lega.")));
        }
    }
}
```

In `PersistenceConfig`:

```java
    @Bean
    public AuctionImportService auctionImportService(ConfigAuctionTemplate template, AuctionRepository auctions,
                                                     AuctionEventStores stores, LeagueRepository leagues,
                                                     Transactions tx) {
        return new AuctionImportService(new FileImportReader(template), auctions, stores, leagues, tx);
    }
```

In `ApiExceptionHandler`, prima di `unexpected`:

```java
    @ExceptionHandler(InvalidImportException.class)
    ProblemDetail invalidImport(InvalidImportException e) {
        ProblemDetail problem = problem(HttpStatus.UNPROCESSABLE_ENTITY, "invalid-import",
                "L'asta non si può importare così.");
        problem.setProperty("errors", e.errors());
        return problem;
    }

    @ExceptionHandler(ImportMismatchException.class)
    ProblemDetail importMismatch(ImportMismatchException e) {
        logger.warn("importazione annullata: " + e.getMessage());
        return problem(HttpStatus.CONFLICT, "import-mismatch",
                "Le rose ricostruite non coincidono con quelle dell'asta originale: l'importazione è stata annullata.");
    }
```

In `application.yml`, sotto `spring:`:

```yaml
  servlet:
    multipart:
      # Il registro di un'asta intera sta in qualche centinaio di KB.
      max-file-size: 5MB
      max-request-size: 20MB
```

- [ ] **Step 7: Eseguire i test e vederli passare**

Run: `mvn -q test -Dtest='ImportCheckTest,AuctionImportServiceTest,ImportRealAuctionsTest,ImportApiTest'` poi `mvn -q test`.
Expected: PASS. Se `ImportRealAuctionsTest` fallisce su un'asta vera, **non** correggere la verifica per farla passare: annotare quale cartella e quale differenza, e fermarsi a discuterne.

- [ ] **Step 8: Mutazione**

In `AuctionImportService.rewrite` non riscrivere `PurchaseCorrected` (restituire `e`): la verifica deve annullare l'importazione di un'asta che ha correzioni. Aggiungere al test `lAstaImportata…` una correzione nel registro di partenza se serve a vederlo. Ripristinare.

- [ ] **Step 9: Commit**

```bash
git add -A src/main src/test
git commit -m "Importazione delle aste su file: abbinamento obbligatorio, tutto o niente

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 20: Importare dal browser

**Files:**
- Modify: `frontend/src/api/client.ts`, `frontend/src/api/leagues.ts`, `frontend/src/api/types.ts`, `frontend/src/router.tsx`, `frontend/src/routes/LeagueRoute.tsx`
- Create: `frontend/src/routes/ImportRoute.tsx`, `ImportRoute.test.tsx`
- Modify: `src/main/java/com/fantaagent/adapter/in/spa/SpaRoutesController.java`

**Interfaces:**
- Consumes: le rotte del Task 19.
- Produces:
  - `client.ts`: `apiUpload<T>(path: string, form: FormData): Promise<T>`.
  - `types.ts`: `ImportPreview { name; purchases; participants: { id; name; initial }[] }`, `ImportResult { auctionId }`.
  - `leagues.ts`: `useImportPreview(leagueId)` (mutazione su `File[]`), `useImportAuction(leagueId)` (mutazione su `{ files: File[]; mapping: Record<string, string> }`).
  - Rotta `/leghe/:leagueId/importa`.

I testi parlano di «cartella dell'asta sul tuo computer»: è la cartella dell'utente, non una del programma. Niente nomi di file nell'interfaccia.

- [ ] **Step 1: Scrivere il test che fallisce**

`frontend/src/routes/ImportRoute.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryProvider } from '../api/QueryProvider';
import { ImportRoute } from './ImportRoute';

const LEAGUE = {
  id: 'l1', name: 'Lega del Bar', admin: true, members: [
    { userId: 'u1', displayName: 'Anna', teamName: 'Anna FC', initial: 'A', role: 'ADMIN', me: true },
    { userId: 'u2', displayName: 'Marco', teamName: 'Marco FC', initial: 'M', role: 'MEMBER', me: false },
  ],
};
const PREVIEW = { name: 'Asta del 2025', purchases: 12, participants: [
  { id: 'me', name: 'Io', initial: 'I' }, { id: 'p2', name: 'Marco', initial: 'M' },
] };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' },
  });
}

function stub(importResponse: () => Response = () => json({ auctionId: 'a9' }, 201)) {
  const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const key = `${(init?.method ?? 'GET').toUpperCase()} ${url}`;
    const routes: Record<string, () => Response> = {
      'GET /api/me': () => json({ id: 'u1', email: 'a@b.it', displayName: 'Anna', emailVerified: true }),
      'GET /api/leagues/l1': () => json(LEAGUE),
      'POST /api/leagues/l1/imports/preview': () => json(PREVIEW),
      'POST /api/leagues/l1/imports': importResponse,
    };
    if (!routes[key]) throw new Error(`chiamata inattesa: ${key}`);
    return Promise.resolve(routes[key]());
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderImport() {
  const router = createMemoryRouter([
    { path: '/leghe/:leagueId/importa', element: <ImportRoute /> },
    { path: '/leghe/:leagueId/aste/:auctionId', element: <p>asta importata</p> },
  ], { initialEntries: ['/leghe/l1/importa'] });
  render(<QueryProvider><RouterProvider router={router} /></QueryProvider>);
  return router;
}

const FILES = [
  new File(['{}'], 'events.jsonl'),
  new File(['x'], 'league-members.yml'),
  new File(['x'], 'rose.csv'),
];

describe('ImportRoute', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('legge la cartella, propone gli abbinamenti per nome e importa', async () => {
    const fetchMock = stub();
    const router = renderImport();

    await userEvent.upload(await screen.findByLabelText('Scegli la cartella dell\'asta'), FILES);
    expect(await screen.findByText('Asta del 2025')).toBeInTheDocument();

    const table = screen.getByRole('table', { name: 'Abbinamenti' });
    expect(within(table).getByLabelText('Membro per Marco')).toHaveValue('u2');
    await userEvent.selectOptions(within(table).getByLabelText('Membro per Io'), 'u1');
    await userEvent.click(screen.getByRole('button', { name: 'Importa l\'asta' }));

    expect(await screen.findByText('asta importata')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/leghe/l1/aste/a9');
    const preview = fetchMock.mock.calls.find(([url]) => url === '/api/leagues/l1/imports/preview');
    const sent = (preview![1].body as FormData).getAll('files') as File[];
    expect(sent.map((f) => f.name).sort()).toEqual(['events.jsonl', 'league-members.yml']);
  });

  it('non importa finche\' manca un abbinamento', async () => {
    stub();
    renderImport();
    await userEvent.upload(await screen.findByLabelText('Scegli la cartella dell\'asta'), FILES);
    await screen.findByText('Asta del 2025');
    expect(screen.getByRole('button', { name: 'Importa l\'asta' })).toBeDisabled();
  });

  it('una cartella senza asta lo dice', async () => {
    stub();
    renderImport();
    await userEvent.upload(await screen.findByLabelText('Scegli la cartella dell\'asta'), [new File(['x'], 'foto.jpg')]);
    expect(await screen.findByRole('alert')).toHaveTextContent('In questa cartella non c\'è un\'asta di FantaAgent.');
  });

  it('se le rose non coincidono lo dice e non va avanti', async () => {
    stub(() => json({
      type: 'https://fantaagent.local/problems/import-mismatch',
      detail: 'Le rose ricostruite non coincidono con quelle dell\'asta originale: l\'importazione è stata annullata.',
    }, 409));
    renderImport();
    await userEvent.upload(await screen.findByLabelText('Scegli la cartella dell\'asta'), FILES);
    await userEvent.selectOptions(await screen.findByLabelText('Membro per Io'), 'u1');
    await userEvent.click(screen.getByRole('button', { name: 'Importa l\'asta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('non coincidono');
  });
});
```

- [ ] **Step 2: Eseguire il test e vederlo fallire**

Run (da `frontend/`): `npx vitest run src/routes/ImportRoute.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Client, tipi, hook**

In `client.ts`:

```ts
/** Un invio di documenti: il browser mette da se' l'intestazione del modulo, col suo separatore. */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  return (await request<T>(path, { method: 'POST', headers: { accept: 'application/json' }, body: form })) as T;
}
```

In `types.ts`:

```ts
export interface ImportPreview {
  name: string;
  purchases: number;
  participants: { id: string; name: string; initial: string }[];
}

export interface ImportResult {
  auctionId: string;
}
```

In `leagues.ts`:

```ts
/** I soli documenti che servono: il resto della cartella non parte nemmeno. */
export const IMPORT_FILES = ['events.jsonl', 'league-members.yml', 'league-rules.yml',
  'league-settings.yml', 'auction-settings.yml'];

function importForm(files: File[]): FormData {
  const form = new FormData();
  files.filter((f) => IMPORT_FILES.includes(f.name)).forEach((f) => form.append('files', f, f.name));
  return form;
}

export function useImportPreview(leagueId: string) {
  return useMutation({
    mutationFn: (files: File[]) => apiUpload<ImportPreview>(`${path(leagueId)}/imports/preview`, importForm(files)),
  });
}

export function useImportAuction(leagueId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ files, mapping }: { files: File[]; mapping: Record<string, string> }) => {
      const form = importForm(files);
      form.append('mapping', new Blob([JSON.stringify(mapping)], { type: 'application/json' }));
      return apiUpload<ImportResult>(`${path(leagueId)}/imports`, form);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: LEAGUE_KEYS.auctions(leagueId) }),
  });
}
```

- [ ] **Step 4: La schermata**

`frontend/src/routes/ImportRoute.tsx`:

```tsx
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../AppShell';
import { fieldErrors, userMessage } from '../api/client';
import { IMPORT_FILES, useImportAuction, useImportPreview, useLeague } from '../api/leagues';
import type { MemberView } from '../api/types';

/** Il membro che porta lo stesso nome, se ce n'e' uno solo: un suggerimento, non una scelta. */
function guess(name: string, members: MemberView[]): string {
  const n = name.trim().toLowerCase();
  const hits = members.filter((m) =>
    m.displayName.trim().toLowerCase() === n || m.teamName.trim().toLowerCase() === n);
  return hits.length === 1 ? hits[0].userId : '';
}

export function ImportRoute() {
  const { leagueId = '' } = useParams();
  const league = useLeague(leagueId);
  const preview = useImportPreview(leagueId);
  const doImport = useImportAuction(leagueId);
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [noAuction, setNoAuction] = useState(false);

  const members = league.data?.members ?? [];
  const participants = preview.data?.participants ?? [];
  const chosen = participants.map((p) => mapping[p.id] ?? '');
  const complete = participants.length > 0 && chosen.every((c) => c !== '')
    && new Set(chosen).size === chosen.length;
  const errors = fieldErrors(doImport.error ?? preview.error);
  const alert = noAuction
    ? 'In questa cartella non c\'è un\'asta di FantaAgent.'
    : doImport.isError || preview.isError
      ? [...(errors.files ?? []), ...(errors.mapping ?? [])].join(' ')
        || userMessage(doImport.error ?? preview.error, 'L\'importazione non è riuscita. Riprova.')
      : null;

  function choose(list: FileList | null) {
    const picked = Array.from(list ?? []);
    doImport.reset();
    if (!picked.some((f) => f.name === 'events.jsonl')) {
      setNoAuction(true);
      return;
    }
    setNoAuction(false);
    setFiles(picked.filter((f) => IMPORT_FILES.includes(f.name)));
    preview.mutate(picked, {
      onSuccess: (p) => setMapping(Object.fromEntries(p.participants.map((x) => [x.id, guess(x.name, members)]))),
    });
  }

  return (
    <AppShell chrome="top">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm"><Link to={`/leghe/${leagueId}`} className="underline underline-offset-4">Torna alla lega</Link></p>
        <h1 className="w-exp mt-2 text-2xl font-semibold">Importa un'asta</h1>
        <section className="panel mt-4 rounded-2xl p-6">
          <p className="text-sm">
            Scegli la cartella di un'asta giocata con la versione di FantaAgent installata sul tuo computer.
            Poi abbina ogni partecipante a un membro della lega.
          </p>
          <label htmlFor="import-folder" className="mt-4 block text-sm font-medium">Scegli la cartella dell'asta</label>
          <input id="import-folder" type="file" multiple
            {...{ webkitdirectory: '', directory: '' }}
            onChange={(e) => choose(e.target.files)}
            className="mt-2 block min-h-11 text-sm" />
          {alert ? <p role="alert" className="mt-4 text-sm font-medium text-destructive">{alert}</p> : null}
        </section>
        {preview.data ? (
          <section className="panel mt-4 rounded-2xl p-6">
            <h2 className="w-exp text-lg font-semibold">{preview.data.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{preview.data.purchases} acquisti</p>
            <table aria-label="Abbinamenti" className="mt-4 w-full text-sm">
              <thead>
                <tr><th className="py-2 text-left">Nell'asta</th><th className="py-2 text-left">Membro della lega</th></tr>
              </thead>
              <tbody>
                {participants.map((p) => (
                  <tr key={p.id} className="border-t border-line">
                    <td className="py-2">{p.name} <span className="text-muted-foreground">· {p.initial}</span></td>
                    <td className="py-2">
                      <select aria-label={`Membro per ${p.name}`} value={mapping[p.id] ?? ''}
                        onChange={(e) => setMapping({ ...mapping, [p.id]: e.target.value })}
                        className="min-h-11 w-full rounded-xl border border-line-strong bg-surface px-3">
                        <option value="">Scegli…</option>
                        {members.map((m) => (
                          <option key={m.userId} value={m.userId}>{m.teamName} · {m.displayName}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!complete ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Ogni partecipante va a un membro diverso. Chi non è ancora nella lega va invitato prima.
              </p>
            ) : null}
            <button type="button" disabled={!complete || doImport.isPending}
              onClick={() => doImport.mutate({ files, mapping },
                { onSuccess: (r) => navigate(`/leghe/${leagueId}/aste/${r.auctionId}`) })}
              className="mt-6 min-h-11 rounded-full bg-accent px-5 font-semibold text-on-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground">
              {doImport.isPending ? 'Importo…' : 'Importa l\'asta'}
            </button>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
```

L'abbinamento suggerito si calcola quando arriva il riepilogo; se in quel momento i membri non sono ancora caricati, il suggerimento è vuoto e l'utente sceglie: accettabile, e il test carica la lega prima di caricare la cartella.

In `LeagueRoute.tsx`, nella sezione «Aste» e solo per l'amministratore, accanto al campo «Nuova asta»: un collegamento «Importa un'asta» verso `/leghe/${leagueId}/importa`.

In `router.tsx`: `{ path: '/leghe/:leagueId/importa', element: <RequireAuth><ImportRoute /></RequireAuth> }`; in `SpaRoutesController`: `IMPORTA = "/leghe/{leagueId}/importa"`.

- [ ] **Step 5: Eseguire i test e vederli passare**

Run (da `frontend/`): `npm test && npm run lint && npm run build`; dalla radice `mvn -q test -Dtest=SpaRoutesControllerTest`.
Expected: PASS. Se TypeScript rifiuta `webkitdirectory` anche passato così, dichiararlo in un `declare module 'react'` in `src/vite-env.d.ts` (`interface InputHTMLAttributes<T> { webkitdirectory?: string; directory?: string }`).

- [ ] **Step 6: Mutazione e commit**

Mutazione: in `complete` togliere il controllo `new Set(chosen).size === chosen.length`; aggiungere al test il caso «due partecipanti allo stesso membro → pulsante spento», vederlo fallire, ripristinare.

```bash
git add -A frontend/src src/main/java/com/fantaagent/adapter/in/spa
git commit -m "Importare un'asta dal browser, abbinando i partecipanti ai membri

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Parte F — Chiusura

### Task 21: Avvio locale, documentazione, prova completa

**Files:**
- Modify: `run.sh`, `README.md`, `.env.example`, `src/test/resources/config/application-local.properties`
- Modify: `frontend/e2e/critical-path.spec.ts`

**Interfaces:**
- Consumes: tutto quanto sopra.
- Produces: `./run.sh` avvia il portale con un Postgres incorporato in `data/pg` (o in `$FANTAAGENT_DB_DIR`); il README descrive il portale; un elenco di ciò che serve per il deploy.

- [ ] **Step 1: Avvio locale**

`src/test/resources/config/application-local.properties`:

```properties
# ./run.sh: un Postgres incorporato che conserva i dati fra un avvio e l'altro.
fantaagent.db.embedded=persistent
fantaagent.db.embedded-dir=${FANTAAGENT_DB_DIR:data/pg}
```

`run.sh`, l'ultima parte:

```bash
echo "Portale su :8080 (API). Frontend React: dev server su :5173 (cd frontend && npm run dev)." \
     "Database locale in ${FANTAAGENT_DB_DIR:-data/pg}; le email finiscono nel log."
# Il classpath dei test porta il Postgres incorporato (EmbeddedPostgresConfig): il jar
# di produzione non lo contiene, e li' il database arriva da FANTAAGENT_DB_URL.
exec mvn -q -DskipTests spring-boot:run \
  -Dspring-boot.run.useTestClasspath=true \
  -Dspring-boot.run.profiles=local
```

Verifica: `FANTAAGENT_DB_DIR=<scratchpad>/pg ./run.sh` in background, `curl -s localhost:8080/actuator/health` → `{"status":"UP"}`, `curl -s -o /dev/null -w '%{http_code}' localhost:8080/api/me` → `401`. Fermarlo.

- [ ] **Step 2: Documentazione**

`.env.example`, in fondo:

```
# Database (produzione). In locale ./run.sh usa un Postgres incorporato.
FANTAAGENT_DB_URL=
FANTAAGENT_DB_USER=
FANTAAGENT_DB_PASSWORD=
# Dove si apre l'app: serve a comporre i link delle email e degli inviti.
FANTAAGENT_PUBLIC_URL=http://localhost:5173
# true dietro HTTPS.
FANTAAGENT_COOKIE_SECURE=false
# Posta: senza SPRING_MAIL_HOST le email vanno nel log.
SPRING_MAIL_HOST=
SPRING_MAIL_PORT=587
SPRING_MAIL_USERNAME=
SPRING_MAIL_PASSWORD=
FANTAAGENT_MAIL_FROM=FantaAgent <noreply@example.com>
```

`README.md`:
- L'introduzione: «Gira in locale. Nessun servizio esterno, nessun account, nessuna rete richiesta durante l'asta.» diventa la descrizione del portale — account, leghe con inviti, un'asta a cui partecipano tutti, l'amministratore che registra e corregge, ognuno coi propri consigli privati.
- «Cosa fa»: «Registra l'asta come un libro mastro» parla del registro su Postgres, append-only per vincolo; «Batte l'asta» dice che oggi batte l'amministratore e che il banditore sul server arriva col sotto-progetto 4; «Si proietta» invariato; nuovo punto «Porta dentro le aste di prima» (importazione).
- «Requisiti»: Java 25, Maven 3.9+, Node solo per il frontend; **nessun Postgres da installare in locale**.
- «Avvio»: `./run.sh` + `npm run dev`; primo uso (registrati, crea la lega, invita, crea l'asta o importala); dove finiscono le email in locale; `FANTAAGENT_DB_DIR` per un database di prova.
- `/legacy`: solo col profilo `legacy`, solo in locale, mai su un'installazione raggiungibile da altri.
- Una sezione «Verso il deploy» con l'elenco dello Step 3.

- [ ] **Step 3: L'elenco per il deploy**

Nel README, sezione «Verso il deploy» — il passo che segue questo sotto-progetto:

1. Postgres 17 gestito, con **due ruoli**: uno proprietario che esegue Flyway (`spring.flyway.user`/`password`), uno per l'applicazione con `SELECT, INSERT` su `auction_event` e senza `UPDATE, DELETE, TRUNCATE` (la seconda metà della garanzia append-only: `REVOKE UPDATE, DELETE, TRUNCATE ON auction_event FROM <ruolo_app>`).
2. Variabili d'ambiente di `.env.example`, con `FANTAAGENT_COOKIE_SECURE=true` e `FANTAAGENT_PUBLIC_URL` sull'indirizzo pubblico.
3. `server.forward-headers-strategy=native` dietro un proxy: senza, il limite ai tentativi di accesso vede un solo indirizzo, quello del proxy.
4. SMTP vero per verifica e recupero; mittente con SPF/DKIM del dominio.
5. Backup giornaliero del database: con i file è sparita anche la copia per fase.
6. Il jar di produzione (`mvn -Pprod package`) non contiene il Postgres incorporato: senza `FANTAAGENT_DB_URL` non parte, di proposito.
7. `LoginThrottle` è in memoria: con più istanze il limite è per istanza.

- [ ] **Step 4: La prova end-to-end**

`frontend/e2e/critical-path.spec.ts`: riscriverlo sul percorso nuovo (registrazione di due utenti in due contesti del browser, lega, invito, accettazione, asta, un'aggiudicazione dell'amministratore, il membro che la vede comparire entro l'intervallo di aggiornamento). La precondizione resta un backend avviato: con `FANTAAGENT_DB_DIR` su una cartella temporanea, così la prova non tocca `data/pg`.

- [ ] **Step 5: Verifica completa**

1. `mvn -q test` — PASS.
2. `cd frontend && npm test && npm run lint && npm run build` — PASS.
3. `mvn -q -Pprod package -DskipTests` — il jar si costruisce.
4. `FANTAAGENT_DB_DIR=<scratchpad>/pg ./run.sh` e `npm run dev`; poi `npx playwright test e2e/critical-path.spec.ts` — PASS.
5. A mano, nel browser, con due finestre (una privata): registrazione, verifica dell'indirizzo col link del log, recupero password col link del log (la sessione dell'altra finestra dello stesso utente si chiude), lega, invito, asta, turno di chiamata, aggiudicazione, correzione, annullamento, cambio fase; il membro vede tutto e i suoi consigli, nessun comando; un terzo utente fuori dalla lega che apre l'indirizzo dell'asta vede «Questa lega non esiste, o non ne fai parte.»; importazione di `res/auctions/2026-09-22` (copiata altrove, non spostata). Screenshot delle schermate principali a 1440×900 e 390×844.
6. `grep -rniE "server|file|cartella del progetto|res/|\.yml|\.jsonl" frontend/src --include=*.tsx | grep -v test` — nessun testo visibile all'utente con quelle parole, tranne «cartella dell'asta» nell'importazione.

- [ ] **Step 6: Commit**

```bash
git add run.sh README.md .env.example src/test/resources frontend/e2e
git commit -m "Il portale in locale con ./run.sh, il README nuovo e l'elenco per il deploy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
