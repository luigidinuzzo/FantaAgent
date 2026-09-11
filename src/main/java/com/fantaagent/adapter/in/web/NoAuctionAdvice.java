package com.fantaagent.adapter.in.web;

import com.fantaagent.application.service.NoAuctionSelectedException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.servlet.ModelAndView;

/**
 * Chi arriva a una schermata d'asta senza averne scelta una viene rimandato alla home,
 * invece di vedere un errore o — peggio — di lavorare su un'asta indovinata.
 *
 * <p>Le richieste HTMX non seguono un redirect HTTP come farebbe il browser: per quelle
 * si usa l'header {@code HX-Redirect}, che htmx traduce in un cambio di pagina vero.
 *
 * <p>{@code basePackages} limita questo advice ai controller delle pagine vecchie, cosi'
 * come {@link com.fantaagent.adapter.in.api.ApiExceptionHandler} e' limitato al package
 * dell'API: senza, i due sono entrambi applicabili a una richiesta {@code /api} che lancia
 * {@link NoAuctionSelectedException}, e chi vince e' un pareggio non ordinato fra due
 * advice globali. Oggi vince quello giusto — un test lo pinna — ma da questa tappa la
 * posta e' piu' alta: perdere quel pareggio manda a un chiamante API un {@code 302} verso
 * {@code /legacy} invece di un {@code 409} in problem+json. Questo confine rende il
 * pareggio impossibile, non solo vinto per ora.
 */
@ControllerAdvice(basePackages = "com.fantaagent.adapter.in.web")
public class NoAuctionAdvice {

    @ExceptionHandler(NoAuctionSelectedException.class)
    public ModelAndView toHome(HttpServletRequest request, HttpServletResponse response) {
        if (request.getHeader("HX-Request") != null) {
            response.setHeader("HX-Redirect", "/legacy");
            return new ModelAndView("fragments/empty :: empty");
        }
        return new ModelAndView("redirect:/legacy");
    }
}
