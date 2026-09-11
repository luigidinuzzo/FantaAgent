package com.fantaagent.adapter.in.spa;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

import java.util.List;

/**
 * Le rotte della SPA, elencate una per una.
 *
 * <p>Non e' un fallback che inghiotte tutto, e la scelta e' deliberata. Un fallback
 * generico vive di esclusioni — {@code /api}, {@code /legacy}, le risorse statiche — e
 * la prossima esclusione da ricordare la si scopre in produzione. Soprattutto,
 * inghiottire tutto trasforma un indirizzo sbagliato in una pagina bianca senza errore,
 * che e' esattamente il difetto che questa migrazione ha passato due tappe a togliere
 * dalle schermate.
 *
 * <p>Cio' che non e' qui dentro da' 404, che e' la verita'. E un test confronta
 * questo elenco con quello di {@code router.tsx}, cosi' che i due non possano
 * divergere in silenzio — il test rende la divergenza rossa, non impossibile.
 */
@Controller
public class SpaRoutesController {

    static final String ROOT = "/";
    static final String ASTA = "/asta";
    static final String PROIEZIONE = "/proiezione";
    static final String IMPOSTAZIONI = "/impostazioni";
    static final String RIEPILOGO = "/riepilogo";

    /**
     * Le stesse di {@code frontend/src/router.tsx}, verificate da un test.
     *
     * <p>Costruita dalle costanti sopra invece di ripetere le stringhe: sono le stesse
     * che l'annotazione {@code @GetMapping} usa qui sotto, cosi' una modifica al VALORE
     * di una rotta si fa in un punto solo. Le costanti condivise impediscono solo
     * questo: che il valore di una rotta diverga fra le due copie. Non impediscono che
     * qualcuno ne aggiunga una a un elenco scordandosi dell'altro — per quello serve il
     * test di reflection su {@link #spa()}, non le costanti.
     */
    static final List<String> ROUTES = List.of(ROOT, ASTA, PROIEZIONE, IMPOSTAZIONI, RIEPILOGO);

    /**
     * Inoltra, non redirige: l'indirizzo nella barra deve restare quello che l'utente
     * ha chiesto, altrimenti un ricaricamento profondo lo riporterebbe alla home e
     * perderebbe il punto in cui era.
     */
    @GetMapping({ROOT, ASTA, PROIEZIONE, IMPOSTAZIONI, RIEPILOGO})
    public String spa() {
        return "forward:/index.html";
    }
}
