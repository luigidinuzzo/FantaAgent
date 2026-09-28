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
