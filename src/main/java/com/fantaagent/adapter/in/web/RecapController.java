package com.fantaagent.adapter.in.web;

import com.fantaagent.adapter.in.web.dto.ViewModels;
import com.fantaagent.application.service.AuctionRuntime;
import com.fantaagent.application.service.AuctionService;
import com.fantaagent.domain.auction.AuctionState;
import com.fantaagent.domain.auction.Squad;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Role;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Pagina di riepilogo: una colonna per partecipante, i suoi giocatori raggruppati per
 * ruolo con il prezzo pagato. Ogni riga può essere rimossa con una "✕" a due click —
 * gestita interamente lato client (vedi recap.js): un click sbagliato cambierebbe in
 * silenzio il budget di un partecipante e quindi ogni raccomandazione successiva.
 */
@Controller
public class RecapController {

    private static final List<Role> ROLE_ORDER = List.of(Role.P, Role.D, Role.C, Role.A);

    private final AuctionService auction;
    private final AuctionRuntime runtime;

    public RecapController(AuctionService auction, AuctionRuntime runtime) {
        this.auction = auction;
        this.runtime = runtime;
    }

    @GetMapping("/riepilogo")
    public String show(Model model) {
        if (!runtime.hasAuction()) {
            return "redirect:/";
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
        AuctionState state = auction.state();
        List<ViewModels.RecapColumn> columns = new ArrayList<>();
        for (Participant participant : auction.participants()) {
            Squad squad = state.squadOf(participant.id());

            Map<Role, List<ViewModels.RecapPlayer>> byRole = new EnumMap<>(Role.class);
            for (Role role : ROLE_ORDER) {
                List<ViewModels.RecapPlayer> players = squad.holdings().stream()
                        .filter(h -> h.role() == role)
                        .map(h -> new ViewModels.RecapPlayer(
                                h.seq(), auction.playerName(h), h.price()))
                        .toList();
                byRole.put(role, players);
            }

            columns.add(new ViewModels.RecapColumn(participant.id(), participant.name(),
                    participant.me(), squad.budgetRemaining(), squad.slotsRemaining(), byRole));
        }

        model.addAttribute("columns", columns);
        model.addAttribute("roles", ROLE_ORDER);
        model.addAttribute("message", message);
    }
}
