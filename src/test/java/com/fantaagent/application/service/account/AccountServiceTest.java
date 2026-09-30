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

    /**
     * La posta e' un di piu': se non parte, l'account resta creato e la richiesta
     * riesce. Un'eccezione qui, dopo l'inserimento, diventava un 500 con l'account
     * gia' salvato — e il nuovo tentativo un «esiste gia' un account».
     */
    @Test
    void unaPostaCheNonParteNonFermaRegistrazioneReinvioERecupero() {
        JdbcClient jdbc = JdbcClient.create(SharedPostgres.migratedDatabase());
        AccountService broken = new AccountService(new JdbcUserRepository(jdbc), new JdbcUserTokenRepository(jdbc),
                hasher, new PasswordPolicy(Set.of()), (to, subject, body) -> {
                    throw new IllegalStateException("smtp non raggiungibile");
                }, clock, "https://fanta.example");

        UserAccount user = broken.register("anna@example.com", GOOD, "Anna");

        assertThat(broken.byId(user.id()).email()).isEqualTo("anna@example.com");
        broken.resendVerification(user.id());
        jdbc.sql("UPDATE app_user SET email_verified_at = now() WHERE id = ?").param(user.id()).update();
        broken.requestPasswordReset("anna@example.com");
    }
}
