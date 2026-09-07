package com.fantaagent.adapter.in.api;

import com.fantaagent.application.service.NoAuctionSelectedException;
import com.fantaagent.application.service.PurchaseRejectedException;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.net.URI;

/**
 * Traduce le eccezioni dell'applicazione in RFC 9457.
 *
 * <p>Limitato al package dell'API: {@code NoAuctionAdvice} continua a servire i
 * controller HTML rimandando alla home, che su un'API non avrebbe senso.
 */
@RestControllerAdvice(basePackages = "com.fantaagent.adapter.in.api")
public class ApiExceptionHandler {

    static final String TYPE_BASE = "https://fantaagent.local/problems/";

    @ExceptionHandler(UnknownLeagueException.class)
    ProblemDetail unknownLeague(UnknownLeagueException e) {
        return problem(HttpStatus.NOT_FOUND, "unknown-league", e.getMessage());
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

    static ProblemDetail problem(HttpStatusCode status, String slug, String detail) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setType(URI.create(TYPE_BASE + slug));
        return problem;
    }
}
