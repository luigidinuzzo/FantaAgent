package com.fantaagent.adapter.in.api;

import org.junit.jupiter.api.Test;
import org.springframework.http.ProblemDetail;
import org.springframework.jdbc.CannotGetJdbcConnectionException;
import org.springframework.security.authentication.InternalAuthenticationServiceException;

import static org.assertj.core.api.Assertions.assertThat;

class ApiExceptionHandlerUnavailableTest {

    @Test
    void senzaDatabaseSiRisponde503() {
        ProblemDetail p = new ApiExceptionHandler().unavailable(new CannotGetJdbcConnectionException("giu'"));
        assertThat(p.getStatus()).isEqualTo(503);
        assertThat(p.getType().toString()).endsWith("/service-unavailable");
    }

    /**
     * DaoAuthenticationProvider avvolge cosi' un guasto del database avvenuto DENTRO
     * loadUserByUsername durante il login: deve restare un'attesa (503), non
     * diventare "password sbagliata" (401).
     */
    @Test
    void unDatabaseGiuDuranteIlLoginRestaUnAttesaENonUnaPasswordSbagliata() {
        ProblemDetail p = new ApiExceptionHandler().authenticationServiceUnavailable(
                new InternalAuthenticationServiceException("giu'", new CannotGetJdbcConnectionException("giu'")));
        assertThat(p.getStatus()).isEqualTo(503);
        assertThat(p.getType().toString()).endsWith("/service-unavailable");
    }

    /** Una causa diversa dal database resta un errore interno generico, non un 401 né un 503. */
    @Test
    void unGuastoDiLoginNonLegatoAlDatabaseRestaUnErroreInterno() {
        ProblemDetail p = new ApiExceptionHandler().authenticationServiceUnavailable(
                new InternalAuthenticationServiceException("boh", new IllegalStateException("boh")));
        assertThat(p.getStatus()).isEqualTo(500);
        assertThat(p.getType().toString()).endsWith("/internal-error");
    }
}
