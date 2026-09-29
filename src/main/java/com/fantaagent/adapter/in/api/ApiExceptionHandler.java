package com.fantaagent.adapter.in.api;

import com.fantaagent.application.port.out.ConcurrentAppendException;
import com.fantaagent.application.port.out.EmailTakenException;
import com.fantaagent.application.port.out.InitialTakenException;
import com.fantaagent.application.service.NoAuctionSelectedException;
import com.fantaagent.application.service.PurchaseRejectedException;
import com.fantaagent.application.service.PurchaseRevocationException;
import com.fantaagent.application.service.account.InvalidAccountDataException;
import com.fantaagent.application.service.account.InvalidTokenException;
import com.fantaagent.application.service.account.TooManyAttemptsException;
import com.fantaagent.application.service.auction.AuctionNotFoundException;
import com.fantaagent.application.service.auction.NoSeatException;
import com.fantaagent.application.service.auction.NotEnoughMembersException;
import com.fantaagent.application.service.auction.SeatsLockedException;
import com.fantaagent.application.service.league.AdminCannotLeaveException;
import com.fantaagent.application.service.league.AdminOnlyException;
import com.fantaagent.application.service.league.InvalidLeagueDataException;
import com.fantaagent.application.service.league.InviteUnavailableException;
import com.fantaagent.application.service.league.NotLeagueMemberException;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.authentication.InternalAuthenticationServiceException;
import org.springframework.security.core.AuthenticationException;
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

    /**
     * Vince sul gestore di {@link IllegalArgumentException} per specificita' della
     * gerarchia, non per posizione nel file: Spring sceglie il gestore piu' vicino al
     * tipo lanciato. L'ordine di dichiarazione non conta.
     */
    @ExceptionHandler(PurchaseRevocationException.class)
    ProblemDetail revocation(PurchaseRevocationException e) {
        boolean notFound = e.reason() == PurchaseRevocationException.Reason.NOT_FOUND;
        return problem(notFound ? HttpStatus.NOT_FOUND : HttpStatus.CONFLICT,
                notFound ? "purchase-not-found" : "purchase-already-revoked",
                e.getMessage());
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
        // Per campo, non per sezione: i tre validatori espongono validateByField
        // apposta (task 16), e SettingsApi ne unisce le mappe. validate() — le sole
        // frasi, senza le chiavi — resta per SettingsController, la schermata
        // Thymeleaf su /legacy che questa tappa lascia intatta.
        problem.setProperty("errors", e.errors());
        return problem;
    }

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

    /**
     * {@code DaoAuthenticationProvider} incapsula qui ogni fallimento di
     * {@code UserDetailsService} che NON sia "utente sconosciuto" — un database
     * irraggiungibile durante il login, per esempio. E' comunque una
     * {@link AuthenticationException}: senza questo gestore piu' specifico finirebbe
     * in {@link #badCredentials}, e un guasto del database si presenterebbe come
     * "password sbagliata" invece che come attesa.
     */
    @ExceptionHandler(InternalAuthenticationServiceException.class)
    ProblemDetail authenticationServiceUnavailable(InternalAuthenticationServiceException e) {
        return e.getCause() instanceof DataAccessResourceFailureException cause
                ? unavailable(cause)
                : unexpected(e);
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

    @ExceptionHandler(TooManyAttemptsException.class)
    ResponseEntity<ProblemDetail> tooManyAttempts(TooManyAttemptsException e) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header(HttpHeaders.RETRY_AFTER, String.valueOf(Math.max(1, e.waitFor().toSeconds())))
                .body(problem(HttpStatus.TOO_MANY_REQUESTS, "too-many-attempts", e.getMessage()));
    }

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

    @ExceptionHandler(InviteUnavailableException.class)
    ProblemDetail inviteUnavailable(InviteUnavailableException e) {
        return problem(HttpStatus.GONE, "invite-unavailable", e.getMessage());
    }

    @ExceptionHandler(AuctionNotFoundException.class)
    ProblemDetail auctionNotFound(AuctionNotFoundException e) {
        return problem(HttpStatus.NOT_FOUND, "unknown-auction", "Asta non trovata.");
    }

    @ExceptionHandler(NoSeatException.class)
    ProblemDetail noSeat(NoSeatException e) {
        return problem(HttpStatus.FORBIDDEN, "no-seat", e.getMessage());
    }

    @ExceptionHandler(ConcurrentAppendException.class)
    ProblemDetail concurrentWrite(ConcurrentAppendException e) {
        return problem(HttpStatus.CONFLICT, "concurrent-write",
                "Qualcun altro ha scritto nello stesso istante: riprova.");
    }

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
