package com.fantaagent.adapter.in.web;

import com.fantaagent.adapter.in.web.dto.ViewModels;
import com.fantaagent.application.service.AuctionRuntime;
import com.fantaagent.application.service.AuctionService;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;


/**
 * Pagina di riepilogo: una colonna per partecipante, i suoi giocatori raggruppati per
 * ruolo con il prezzo pagato. Ogni riga può essere rimossa con una "✕" a due click —
 * gestita interamente lato client (vedi recap.js): un click sbagliato cambierebbe in
 * silenzio il budget di un partecipante e quindi ogni raccomandazione successiva.
 */
@Controller
@RequestMapping("/legacy")
public class RecapController {

    private final AuctionService auction;
    private final AuctionRuntime runtime;

    public RecapController(AuctionService auction, AuctionRuntime runtime) {
        this.auction = auction;
        this.runtime = runtime;
    }

    @GetMapping("/riepilogo")
    public String show(Model model) {
        if (!runtime.hasAuction()) {
            return "redirect:/legacy";
        }
        populate(model, null);
        return "recap";
    }

    @PostMapping("/riepilogo/revoca")
    public String revoke(@RequestParam long targetSeq, Model model) {
        String message;
        try {
            auction.revokePurchase(targetSeq);
            message = "↩ acquisto rimosso";
        } catch (IllegalArgumentException e) {
            message = "✗ " + e.getMessage();
        }
        populate(model, message);
        return "recap";
    }

    private void populate(Model model, String message) {
        model.addAttribute("columns", RecapView.columns(auction));
        model.addAttribute("roles", RecapView.ROLE_ORDER);
        model.addAttribute("message", message);
    }
}
