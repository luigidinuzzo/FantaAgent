package com.fantaagent.adapter.in.api;

import com.fantaagent.adapter.in.api.dto.PlayerDtos;
import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.application.service.PlayerAnalysisService;
import com.fantaagent.application.service.PlayerSearchService;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/leagues/{leagueId}/auctions/{auctionId}/players")
public class PlayerApi {

    private final LeagueGuard leagues;
    private final AuctionGuard auctions;
    private final PlayerSearchService search;
    private final PlayerAnalysisService analysis;
    private final PlayerCatalog catalog;

    public PlayerApi(LeagueGuard leagues, AuctionGuard auctions, PlayerSearchService search,
                     PlayerAnalysisService analysis, PlayerCatalog catalog) {
        this.leagues = leagues;
        this.auctions = auctions;
        this.search = search;
        this.analysis = analysis;
        this.catalog = catalog;
    }

    /**
     * Nome, ruolo, squadra: in qualunque combinazione, e anche solo filtri senza nome —
     * la modale di ricerca sfoglia, non interroga soltanto. Senza niente di tutto
     * questo il servizio torna un elenco vuoto: aprire la modale non e' una domanda.
     */
    @GetMapping
    public List<PlayerDtos.PlayerSummary> search(@PathVariable String leagueId,
                                                 @PathVariable String auctionId,
                                                 @RequestParam(defaultValue = "") String q,
                                                 @RequestParam(required = false) Role role,
                                                 @RequestParam(required = false) String team) {
        leagues.check(leagueId);
        auctions.check(auctionId);
        return search.browse(q, role, team).stream().map(PlayerDtos.PlayerSummary::from).toList();
    }

    /**
     * Le squadre di Serie A su cui si puo' filtrare, dedotte dal listone. Rotta a se'
     * e non un campo della ricerca: cambia solo quando cambia il listone, mentre i
     * risultati cambiano a ogni tasto premuto.
     */
    @GetMapping("/teams")
    public List<String> teams(@PathVariable String leagueId, @PathVariable String auctionId) {
        leagues.check(leagueId);
        auctions.check(auctionId);
        return search.teams();
    }

    @GetMapping("/phase")
    public PlayerDtos.PhasePageResponse phase(
            @PathVariable String leagueId,
            @PathVariable String auctionId,
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "25") int limit) {
        leagues.check(leagueId);
        auctions.check(auctionId);
        return PlayerDtos.PhasePageResponse.from(
                search.phasePlayers(Math.max(0, offset), clampLimit(limit)));
    }

    /**
     * {@code phasePlayers} calcola un {@code PriceRecommendation} completo per riga
     * (circa 12 ms l'una secondo il Javadoc del servizio): senza un tetto qui, una
     * richiesta anonima con {@code limit} enorme forzerebbe la valutazione di una
     * fase intera, ripetibile a piacere. Il tetto vive nel controller e non nel
     * servizio perche' {@code PlayerSearchService} serve anche i controller
     * Thymeleaf in {@code adapter/in/web}, che questo piano non tocca: il limite
     * appartiene al confine HTTP pubblicamente raggiungibile, non alla logica di
     * paginazione condivisa. Un {@code limit} non positivo (incluso negativo)
     * arriverebbe altrimenti a {@code Stream.limit(long)}, che rifiuta i negativi
     * con un messaggio JDK in inglese finito, tal quale, nel corpo 422 dell'API.
     */
    private static int clampLimit(int limit) {
        return Math.max(1, Math.min(limit, PlayerSearchService.PHASE_PAGE_SIZE));
    }

    @GetMapping("/{playerId}/valuation")
    public PlayerDtos.ValuationResponse valuation(@PathVariable String leagueId,
                                                  @PathVariable String auctionId,
                                                  @PathVariable String playerId) {
        leagues.check(leagueId);
        auctions.check(auctionId);
        Player player = catalog.byId(playerId)
                .orElseThrow(() -> new UnknownPlayerException(playerId));
        return PlayerDtos.ValuationResponse.from(player, analysis.analyze(playerId));
    }
}
