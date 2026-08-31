package com.fantaagent.adapter.in.web;

import com.fantaagent.adapter.in.web.dto.ViewModels;
import com.fantaagent.application.service.AuctionService;
import com.fantaagent.application.service.PlayerAnalysisService;
import com.fantaagent.application.service.PlayerSearchService;
import com.fantaagent.domain.auction.AuctionState;
import com.fantaagent.domain.auction.Squad;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import com.fantaagent.domain.search.CommandParser;
import com.fantaagent.domain.search.ParsedCommand;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Controller
public class AuctionController {

    private static final int TARGET_ROWS = 10;

    /**
     * Le viste che cambiano stato aggiornano tre regioni in una sola risposta:
     * #main come swap normale, #status e #board come out-of-band (i loro tag
     * portano hx-swap-oob="true"). #resume è incluso a sua volta: l'elemento è
     * sempre presente nel markup (nascosto con l'attributo hidden quando non
     * c'e' un'asta ripresa) proprio perché uno swap out-of-band può sostituire
     * solo un elemento che la risposta contiene davvero — se th:if lo rimuovesse
     * dal markup, un banner già mostrato non potrebbe più essere ripulito.
     * La ricerca dal vivo (GET /fragments/main) non cambia stato e continua a
     * restituire il solo pannello principale.
     */
    private static final String UPDATE_VIEW = "fragments/update :: update";

    private final AuctionService auction;
    private final PlayerAnalysisService analysis;
    private final PlayerSearchService search;

    public AuctionController(AuctionService auction, PlayerAnalysisService analysis,
                             PlayerSearchService search) {
        this.auction = auction;
        this.analysis = analysis;
        this.search = search;
    }

    @GetMapping("/")
    public String index(Model model) {
        populateShell(model);
        model.addAttribute("panel", new ViewModels.MainPanel(List.of(), null, null));
        return "index";
    }

    @GetMapping("/fragments/main")
    public String main(@RequestParam(name = "cmd", defaultValue = "") String q, Model model) {
        // La ricerca non cambia stato: nessuna necessità di aggiornare status/board.
        model.addAttribute("panel", searchPanel(q, null));
        return "index :: main";
    }

    @PostMapping("/command")
    public String command(@RequestParam(defaultValue = "") String cmd, Model model) {
        ParsedCommand parsed = CommandParser.parse(cmd);
        String message = null;

        if (parsed.isPurchase()) {
            List<Player> matches = search.search(parsed.term());
            if (matches.isEmpty()) {
                message = "nessun giocatore trovato per \"" + parsed.term() + "\"";
            } else {
                Player player = matches.getFirst();
                Optional<Participant> buyer = parsed.participantInitial().isPresent()
                        ? auction.byInitial(parsed.participantInitial().get())
                        : Optional.of(auction.me());
                if (buyer.isEmpty()) {
                    message = "nessun partecipante con iniziale "
                            + parsed.participantInitial().orElse('?');
                } else {
                    try {
                        auction.recordPurchase(player.id(), buyer.get().id(),
                                parsed.price().orElseThrow());
                        message = "✓ " + player.name() + " → " + buyer.get().name()
                                + " " + parsed.price().orElseThrow() + " · Ctrl+Z per annullare";
                    } catch (IllegalArgumentException e) {
                        message = "✗ " + e.getMessage();
                    }
                }
            }
        }

        populateShell(model);
        model.addAttribute("panel",
                searchPanel(parsed.isPurchase() ? "" : parsed.term(), message));
        return UPDATE_VIEW;
    }

    @PostMapping("/undo")
    public String undo(Model model) {
        String message = auction.undoLast()
                ? "↩ ultimo acquisto annullato"
                : "niente da annullare";
        populateShell(model);
        model.addAttribute("panel", new ViewModels.MainPanel(List.of(), null, message));
        return UPDATE_VIEW;
    }

    @PostMapping("/phase/next")
    public String nextPhase(Model model) {
        auction.advancePhase();
        populateShell(model);
        model.addAttribute("panel", new ViewModels.MainPanel(List.of(), null,
                "fase avanzata a " + auction.state().currentPhase()));
        return UPDATE_VIEW;
    }

    @GetMapping("/fragments/targets")
    public String targets(Model model) {
        model.addAttribute("targets", search.targets(TARGET_ROWS));
        return "index :: targets";
    }

    private ViewModels.MainPanel searchPanel(String query, String message) {
        List<Player> results = query.isBlank() ? List.of() : search.search(query);
        ViewModels.Analysis analysisView = results.isEmpty()
                ? null
                : new ViewModels.Analysis(results.getFirst(),
                        analysis.analyze(results.getFirst().id()));
        return new ViewModels.MainPanel(results, analysisView, message);
    }

    private void populateShell(Model model) {
        AuctionState state = auction.state();
        Squad mine = state.mySquad();

        model.addAttribute("status", new ViewModels.StatusBar(
                state.currentPhase().name(), auction.salesInCurrentPhase(),
                mine.budgetRemaining(), composition(mine), mine.slotsRemaining()));

        List<ViewModels.BoardRow> board = new ArrayList<>();
        for (Participant participant : auction.participants()) {
            Squad squad = state.squadOf(participant.id());
            board.add(new ViewModels.BoardRow(participant.name(), participant.initial(),
                    squad.budgetRemaining(), composition(squad), squad.slotsRemaining(),
                    participant.me()));
        }
        model.addAttribute("board", board);
        auction.resumeSummary().ifPresent(summary -> model.addAttribute("resume", summary));
    }

    private static String composition(Squad squad) {
        StringBuilder sb = new StringBuilder();
        for (Role role : Role.values()) {
            sb.append(squad.count(role)).append(role.name()).append(' ');
        }
        return sb.toString().trim();
    }
}
