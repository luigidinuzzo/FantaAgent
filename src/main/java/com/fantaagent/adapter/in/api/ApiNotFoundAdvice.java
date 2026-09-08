package com.fantaagent.adapter.in.api;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * L'unico errore dell'API che {@link ApiExceptionHandler} non puo' vedere.
 *
 * <p>Un indirizzo inesistente non raggiunge nessun controller, e Spring sceglie gli
 * advice in base al controller che ha gestito la richiesta: un advice limitato per
 * package non viene mai consultato, e la richiesta usciva con un 404 senza corpo.
 * Il frontend legge gli errori in un punto solo e li riconosce dal {@code type}: un
 * 404 vuoto diventava li' un {@code unknown} senza nulla da mostrare.
 *
 * <p>Questo advice e' quindi senza selettori — l'unica forma che intercetta anche
 * cio' che non ha un controller — e sceglie da se' il proprio confine guardando il
 * percorso. Fuori da {@code /api/} rilancia la STESSA istanza ricevuta:
 * {@code ExceptionHandlerExceptionResolver} lo interpreta come "non gestita da qui"
 * e passa la mano al resolver successivo, che e' esattamente cio' che accadeva
 * prima. Le pagine d'errore dei controller HTML restano quelle di oggi: erano fuori
 * dal perimetro di questo sotto-progetto.
 *
 * <p>La via alternativa — un controller vero mappato su {@code /api/**} — e' stata
 * provata e scartata: un handler pieno vince sul confronto per metodo, e un GET su
 * un endpoint di soli POST smetteva di rispondere 405 per rispondere 404.
 */
@RestControllerAdvice
public class ApiNotFoundAdvice {

    @ExceptionHandler(NoResourceFoundException.class)
    ProblemDetail unknownEndpoint(NoResourceFoundException e, HttpServletRequest request)
            throws NoResourceFoundException {
        if (!request.getRequestURI().startsWith("/api/")) {
            throw e;
        }
        return ApiExceptionHandler.problem(HttpStatus.NOT_FOUND, "unknown-endpoint",
                "Indirizzo inesistente: " + request.getRequestURI());
    }
}
