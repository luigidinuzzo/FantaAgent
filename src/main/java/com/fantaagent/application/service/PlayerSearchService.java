package com.fantaagent.application.service;

import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.domain.auction.AuctionState;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.search.PlayerSearch;
import com.fantaagent.domain.strategy.PriceRecommendation;

import java.util.Comparator;
import java.util.List;
import java.util.Set;

public class PlayerSearchService {

    private static final int SEARCH_LIMIT = 8;

    /**
     * Quanti candidati valutare per la lista target. Ogni valutazione costa qualche
     * decina di millisecondi: quindici righe restano sotto il quarto di secondo, che è
     * accettabile per un pannello aperto su richiesta.
     */
    private static final int TARGET_CANDIDATES = 15;

    public record TargetRow(Player player, PriceRecommendation recommendation) {

        public int margin() {
            return recommendation.margin();
        }
    }

    private final PlayerCatalog catalog;
    private final PlayerSearch search;
    private final AuctionService auction;
    private final PlayerAnalysisService analysis;
    private final ProjectionRegistry projections;

    public PlayerSearchService(PlayerCatalog catalog, ProjectionRegistry projections,
                               AuctionService auction, PlayerAnalysisService analysis) {
        this.catalog = catalog;
        this.projections = projections;
        this.auction = auction;
        this.analysis = analysis;
        this.search = new PlayerSearch(catalog.all(),
                id -> projections.of(id).basePoints());
    }

    public List<Player> search(String query) {
        AuctionState state = auction.state();
        Set<String> sold = state.soldPlayerIds();
        return search.search(query, state.currentPhase(), SEARCH_LIMIT * 2).stream()
                .filter(p -> !sold.contains(p.id()))
                .limit(SEARCH_LIMIT)
                .toList();
    }

    /** Migliori obiettivi della fase corrente, ordinati per margine decrescente. */
    public List<TargetRow> targets(int limit) {
        AuctionState state = auction.state();
        Set<String> sold = state.soldPlayerIds();

        return projections.all().stream()
                .filter(p -> p.role() == state.currentPhase())
                .filter(p -> !sold.contains(p.playerId()))
                .sorted(Comparator.comparingDouble(
                        com.fantaagent.domain.player.PlayerProjection::basePoints).reversed())
                .limit(TARGET_CANDIDATES)
                .map(p -> new TargetRow(
                        catalog.byId(p.playerId()).orElseThrow(),
                        analysis.analyze(p.playerId(), state)))
                .sorted(Comparator.comparingInt(TargetRow::margin).reversed())
                .limit(limit)
                .toList();
    }
}
