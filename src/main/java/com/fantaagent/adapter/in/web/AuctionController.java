package com.fantaagent.adapter.in.web;

import com.fantaagent.adapter.in.web.dto.ViewModels;
import com.fantaagent.application.port.out.PlayerCatalog;
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
import jakarta.servlet.http.HttpServletResponse;
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

    /**
     * Nome dell'evento HTMX emesso, via header di risposta HX-Trigger, ogni volta
     * che una richiesta cambia davvero lo stato dell'asta (acquisto registrato,
     * annullamento effettivo, fase avanzata). #phaseTable lo ascolta per
     * ricaricarsi da sé dopo che l'assegnazione è già stata applicata: il batch
     * costa circa 380 ms da rendere, troppo per infilarlo nella risposta composita
     * che serve invece #main/#status/#board/#resume all'istante.
     */
    private static final String STATE_CHANGED_EVENT = "fantaStateChanged";

    private final AuctionService auction;
    private final PlayerAnalysisService analysis;
    private final PlayerSearchService search;
    private final PlayerCatalog catalog;

    public AuctionController(AuctionService auction, PlayerAnalysisService analysis,
                             PlayerSearchService search, PlayerCatalog catalog) {
        this.auction = auction;
        this.analysis = analysis;
        this.search = search;
        this.catalog = catalog;
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
        // Deve passare dallo stesso CommandParser di /command: appena l'utente digita
        // anche il prezzo ("bast 47") il termine di ricerca è solo "bast", altrimenti
        // la ricerca sul testo grezzo non trova nulla e il pannello di analisi — con
        // sopra il max bid — sparisce proprio mentre l'utente decide quanto offrire.
        ParsedCommand parsed = CommandParser.parse(q);
        model.addAttribute("participants", auction.participants());
        model.addAttribute("panel", searchPanel(parsed.term(), null));
        return "index :: main";
    }

    @PostMapping("/command")
    public String command(@RequestParam(defaultValue = "") String cmd, Model model,
                          HttpServletResponse response) {
        ParsedCommand parsed = CommandParser.parse(cmd);
        String message = null;
        boolean purchased = false;

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
                                + " " + parsed.price().orElseThrow() + " · ↩ annulla o Cmd+Z";
                        purchased = true;
                    } catch (IllegalArgumentException e) {
                        message = "✗ " + e.getMessage();
                    }
                }
            }
        }

        if (purchased) {
            response.setHeader("HX-Trigger", STATE_CHANGED_EVENT);
        }
        populateShell(model);
        model.addAttribute("panel",
                searchPanel(parsed.isPurchase() ? "" : parsed.term(), message));
        return UPDATE_VIEW;
    }

    /**
     * Assegnazione senza barra comando: complementa "bast 47 m" per chi non la
     * conosce, ma passa dallo stesso {@link AuctionService#recordPurchase} — nessuna
     * seconda via, più debole, per registrare un acquisto.
     */
    @PostMapping("/assign")
    public String assign(@RequestParam String playerId, @RequestParam String participantId,
                         @RequestParam int price, Model model, HttpServletResponse response) {
        String message;
        try {
            auction.recordPurchase(playerId, participantId, price);
            Player player = catalog.byId(playerId).orElseThrow();
            Participant buyer = auction.participants().stream()
                    .filter(p -> p.id().equals(participantId))
                    .findFirst().orElseThrow();
            message = "✓ " + player.name() + " → " + buyer.name()
                    + " " + price + " · ↩ annulla o Cmd+Z";
            response.setHeader("HX-Trigger", STATE_CHANGED_EVENT);
        } catch (IllegalArgumentException e) {
            message = "✗ " + e.getMessage();
        }

        populateShell(model);
        model.addAttribute("panel", new ViewModels.MainPanel(List.of(), null, message));
        return UPDATE_VIEW;
    }

    @PostMapping("/undo")
    public String undo(Model model, HttpServletResponse response) {
        boolean undone = auction.undoLast();
        String message = undone ? "↩ ultimo acquisto annullato" : "niente da annullare";
        if (undone) {
            response.setHeader("HX-Trigger", STATE_CHANGED_EVENT);
        }
        populateShell(model);
        model.addAttribute("panel", new ViewModels.MainPanel(List.of(), null, message));
        return UPDATE_VIEW;
    }

    @PostMapping("/phase/next")
    public String nextPhase(Model model, HttpServletResponse response) {
        boolean advanced = auction.advancePhase();
        String message;
        if (advanced) {
            response.setHeader("HX-Trigger", STATE_CHANGED_EVENT);
            message = "fase avanzata a " + auction.state().currentPhase();
        } else {
            message = "già all'ultima fase";
        }
        populateShell(model);
        model.addAttribute("panel", new ViewModels.MainPanel(List.of(), null, message));
        return UPDATE_VIEW;
    }

    @GetMapping("/fragments/targets")
    public String targets(Model model) {
        model.addAttribute("targets", search.targets(TARGET_ROWS));
        return "index :: targets";
    }

    @GetMapping("/fragments/phase-players")
    public String phasePlayers(@RequestParam(defaultValue = "0") int offset, Model model) {
        model.addAttribute("phasePage", search.phasePlayers(offset, PlayerSearchService.PHASE_PAGE_SIZE));
        model.addAttribute("participants", auction.participants());
        model.addAttribute("phase", auction.state().currentPhase());
        // offset == 0: prima apertura o cambio fase, sostituisce l'intero pannello
        // (intestazione compresa). offset > 0: "carica altri 25", sostituisce solo le
        // righe già caricate — l'intestazione non deve ricomparire in fondo alla tabella.
        return offset == 0 ? "fragments/phase-table :: phaseTable" : "fragments/phase-table :: phaseRowsBody";
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
                mine.budgetRemaining(), composition(mine), mine.slotsRemaining(),
                !state.holdings().isEmpty()));

        List<ViewModels.BoardRow> board = new ArrayList<>();
        for (Participant participant : auction.participants()) {
            Squad squad = state.squadOf(participant.id());
            board.add(new ViewModels.BoardRow(participant.name(), participant.initial(),
                    squad.budgetRemaining(), composition(squad), squad.slotsRemaining(),
                    participant.me()));
        }
        model.addAttribute("board", board);
        model.addAttribute("participants", auction.participants());
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
