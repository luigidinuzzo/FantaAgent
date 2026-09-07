package com.fantaagent.adapter.in.web;

import com.fantaagent.adapter.in.web.dto.ViewModels;
import com.fantaagent.application.service.AuctionRuntime;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

/**
 * La prima schermata: quale asta si apre.
 *
 * <p>All'avvio l'applicazione non sceglie da sola. Indovinare significherebbe, nel caso
 * peggiore, scrivere gli acquisti di stasera nel registro di un'asta dell'anno scorso:
 * meglio una domanda in piu' che un log sbagliato. Da qui si riprende un'asta esistente
 * — il registro si riproietta da solo nello stato completo, quindi riprendere e'
 * selezione, non ricostruzione — oppure se ne crea una nuova sotto un identificativo
 * datato ancora libero.
 */
@Controller
public class HomeController {

    private static final DateTimeFormatter WHEN =
            DateTimeFormatter.ofPattern("d MMM yyyy, HH:mm", Locale.ITALIAN)
                    .withZone(ZoneId.systemDefault());

    private final AuctionRuntime runtime;

    public HomeController(AuctionRuntime runtime) {
        this.runtime = runtime;
    }

    @GetMapping("/")
    public String home(Model model) {
        model.addAttribute("auctions", cards());
        return "home";
    }

    @PostMapping("/aste/riprendi")
    public String resume(@RequestParam String auctionId) {
        runtime.select(auctionId);
        return "redirect:/asta";
    }

    /**
     * Porta alla schermata di preparazione, e non crea ancora nulla.
     *
     * <p>L'asta nasce quando le impostazioni vengono confermate, non quando si dichiara
     * di volerla cominciare. Prima la cartella veniva creata qui, al primo click: chi
     * tornava indietro dalla schermata di conferma lasciava dietro di se' un'asta vuota
     * che restava per sempre nell'elenco, e piu' d'una se ci ripensava piu' volte.
     */
    @PostMapping("/aste/nuova")
    public String create() {
        // Chiude quella eventualmente aperta: la schermata di preparazione distingue le
        // due modalita' da questo, e senza chiudere si finiva sulle impostazioni
        // dell'asta in corso — in sola lettura, senza campo per il nome — rinominandone
        // i partecipanti invece di crearne una nuova.
        runtime.deselect();
        return "redirect:/impostazioni";
    }

    private List<ViewModels.AuctionCard> cards() {
        return runtime.auctions().stream()
                .map(summary -> new ViewModels.AuctionCard(
                        summary.id(),
                        summary.label(),
                        when(summary.lastWritten()),
                        summary.purchases(),
                        summary.phase().name(),
                        summary.selected()))
                .toList();
    }

    private static String when(Instant instant) {
        return instant == null ? "mai scritta" : WHEN.format(instant);
    }
}
