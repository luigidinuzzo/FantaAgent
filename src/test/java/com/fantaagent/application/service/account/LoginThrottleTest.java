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
