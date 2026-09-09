package com.fantaagent.adapter.in.api;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Il secondo errore che {@link ApiExceptionHandler} non puo' vedere, per la stessa
 * ragione del primo: {@link HttpRequestMethodNotSupportedException} nasce prima che
 * Spring scelga un handler, quindi non c'e' un controller da cui dedurre quale advice
 * consultare, e uno limitato per package viene saltato.
 *
 * <p>Senza questo, un verbo sbagliato usciva con un 405 senza corpo: il frontend legge
 * gli errori in un punto solo e li riconosce dal {@code type}, e li' trovava un
 * {@code unknown} senza niente da mostrare.
 *
 * <p>Stessa forma di {@link ApiNotFoundAdvice}: senza selettori, perche' e' l'unica che
 * intercetta cio' che non ha un controller, e con il confine deciso guardando il
 * percorso. Fuori da {@code /api/} rilancia la STESSA istanza, che
 * {@code ExceptionHandlerExceptionResolver} legge come "non gestita qui" e passa al
 * resolver successivo: le pagine d'errore dei controller HTML restano quelle di oggi.
 */
@RestControllerAdvice
public class ApiMethodNotAllowedAdvice {

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ProblemDetail wrongMethod(HttpRequestMethodNotSupportedException e,
                              HttpServletRequest request)
            throws HttpRequestMethodNotSupportedException {
        if (!request.getRequestURI().startsWith("/api/")) {
            throw e;
        }
        return ApiExceptionHandler.problem(HttpStatus.METHOD_NOT_ALLOWED,
                "method-not-allowed",
                "Metodo " + e.getMethod() + " non ammesso su " + request.getRequestURI());
    }
}
