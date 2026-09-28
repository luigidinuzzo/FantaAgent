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
