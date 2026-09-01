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
 */
@ControllerAdvice
public class NoAuctionAdvice {

    @ExceptionHandler(NoAuctionSelectedException.class)
    public ModelAndView toHome(HttpServletRequest request, HttpServletResponse response) {
        if (request.getHeader("HX-Request") != null) {
            response.setHeader("HX-Redirect", "/");
            return new ModelAndView("fragments/empty :: empty");
        }
        return new ModelAndView("redirect:/");
    }
}
