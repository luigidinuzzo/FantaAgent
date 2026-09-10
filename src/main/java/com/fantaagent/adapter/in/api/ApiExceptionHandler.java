package com.fantaagent.adapter.in.api;

import com.fantaagent.application.service.NoAuctionSelectedException;
import com.fantaagent.application.service.PurchaseRejectedException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.ErrorResponseException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.net.URI;

/**
 * Traduce le eccezioni dell'applicazione in RFC 9457.
 *
 * <p>Limitato al package dell'API: {@code NoAuctionAdvice} continua a servire i
 * controller HTML rimandando alla home, che su un'API non avrebbe senso.
 *
 * <p>Estende {@link ResponseEntityExceptionHandler} perche' i soli handler scritti
 * a mano coprivano le eccezioni di dominio, non quelle che solleva Spring prima
 * ancora di entrare nel controller: un {@code {seq}} non numerico, un corpo JSON
 * malformato, un {@code requestId} mancante uscivano con {@code type: about:blank}
 * e un messaggio in inglese. Il frontend ha un solo punto in cui legge gli errori
 * ({@code client.ts}) e li distingue per {@code type}: senza uno slug stabile
 * mostrava quella frase inglese a un utente italiano, classificandola
 * {@code unknown}. La classe base sa gia' produrre il ProblemDetail giusto con lo
 * status giusto per ognuna; qui si aggiunge solo cio' che le manca, il {@code type}
 * sotto il prefisso comune.
 */
@RestControllerAdvice(basePackages = "com.fantaagent.adapter.in.api")
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {

    static final String TYPE_BASE = "https://fantaagent.local/problems/";

    @ExceptionHandler(UnknownLeagueException.class)
    ProblemDetail unknownLeague(UnknownLeagueException e) {
        return problem(HttpStatus.NOT_FOUND, "unknown-league", e.getMessage());
    }

    @ExceptionHandler(UnknownAuctionException.class)
    ProblemDetail unknownAuction(UnknownAuctionException e) {
        return problem(HttpStatus.NOT_FOUND, "unknown-auction", e.getMessage());
    }

    @ExceptionHandler(NoAuctionSelectedException.class)
    ProblemDetail noAuction(NoAuctionSelectedException e) {
        return problem(HttpStatus.CONFLICT, "no-auction-selected",
                "Nessuna asta è aperta. Scegline una dalla home.");
    }

    @ExceptionHandler(UnknownPlayerException.class)
    ProblemDetail unknownPlayer(UnknownPlayerException e) {
        return problem(HttpStatus.NOT_FOUND, "unknown-player", e.getMessage());
    }

    /**
     * Spring instrada qui i rifiuti di dominio, e non al gestore generico sotto,
     * scegliendo l'handler più specifico per il tipo lanciato — non serve un ordine
     * particolare fra i due metodi. Il generico resta per le richieste malformate
     * (giocatore o partecipante sconosciuto, prezzo non valido).
     */
    @ExceptionHandler(PurchaseRejectedException.class)
    ProblemDetail rejected(PurchaseRejectedException e) {
        HttpStatus status = e.reason() == PurchaseRejectedException.Reason.ALREADY_SOLD
                ? HttpStatus.CONFLICT
                : HttpStatus.UNPROCESSABLE_ENTITY;
        return problem(status, slug(e.reason()), e.getMessage());
    }

    private static String slug(PurchaseRejectedException.Reason reason) {
        return switch (reason) {
            case ALREADY_SOLD -> "player-already-sold";
            case INSUFFICIENT_BUDGET -> "insufficient-budget";
            case ROLE_SLOTS_EXHAUSTED -> "role-slots-exhausted";
        };
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ProblemDetail invalid(IllegalArgumentException e) {
        return problem(HttpStatus.UNPROCESSABLE_ENTITY, "invalid-request", e.getMessage());
    }

    @ExceptionHandler(NothingToUndoException.class)
    ProblemDetail nothingToUndo(NothingToUndoException e) {
        return problem(HttpStatus.CONFLICT, "nothing-to-undo", e.getMessage());
    }

    @ExceptionHandler(InvalidSettingsException.class)
    ProblemDetail invalidSettings(InvalidSettingsException e) {
        ProblemDetail problem = problem(HttpStatus.UNPROCESSABLE_ENTITY, "invalid-settings",
                "Alcune impostazioni non sono valide.");
        // Per sezione e non per campo: i validatori restituiscono frasi in italiano, non
        // coppie campo-messaggio, e la loro firma serve anche a SettingsController, la
        // schermata Thymeleaf su /impostazioni che questa tappa lascia intatta. Nella
        // tappa 6 i validatori crescono un metodo per-campo e questo diventa il suo
        // appiattimento.
        problem.setProperty("errors", e.errors());
        return problem;
    }

    /**
     * Ultima rete: qualunque cosa non prevista esce comunque come problem+json
     * tipizzato invece che come pagina d'errore HTML, che il frontend proverebbe a
     * interpretare come JSON fallendo a sua volta e perdendo l'errore vero.
     */
    @ExceptionHandler(Exception.class)
    ProblemDetail unexpected(Exception e) {
        logger.error("Errore non previsto nell'API", e);
        return problem(HttpStatus.INTERNAL_SERVER_ERROR, "internal-error",
                "Errore interno del server.");
    }

    /**
     * Unico punto in cui passano tutte le eccezioni gestite dalla classe base: qui
     * si timbra il {@code type}, cosi' che aggiungere in futuro un caso alla classe
     * base non riapra il buco dell'{@code about:blank}.
     */
    @Override
    protected ResponseEntity<Object> handleExceptionInternal(Exception ex, Object body,
                                                             HttpHeaders headers,
                                                             HttpStatusCode statusCode,
                                                             WebRequest request) {
        ResponseEntity<Object> response =
                super.handleExceptionInternal(ex, body, headers, statusCode, request);
        if (response != null && response.getBody() instanceof ProblemDetail problem
                && problem.getType().equals(URI.create("about:blank"))) {
            problem.setType(URI.create(TYPE_BASE + frameworkSlug(ex)));
        }
        return response;
    }

    /**
     * Slug per famiglia di causa, non per classe: al frontend serve sapere se ha
     * sbagliato l'indirizzo, la forma del corpo o il tipo di un segmento, non quale
     * classe Spring lo ha rilevato.
     */
    private static String frameworkSlug(Exception ex) {
        return switch (ex) {
            case NoResourceFoundException ignored -> "unknown-endpoint";
            case MethodArgumentTypeMismatchException ignored -> "invalid-path-variable";
            case MethodArgumentNotValidException ignored -> "invalid-body";
            case HandlerMethodValidationException ignored -> "invalid-body";
            case HttpMessageNotReadableException ignored -> "malformed-body";
            case ErrorResponseException ignored -> "invalid-request";
            default -> "invalid-request";
        };
    }

    static ProblemDetail problem(HttpStatusCode status, String slug, String detail) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setType(URI.create(TYPE_BASE + slug));
        return problem;
    }
}
