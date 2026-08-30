package com.fantaagent.application.service;

import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.domain.auction.AuctionState;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.PlayerProjection;
import com.fantaagent.domain.strategy.PriceModel;
import com.fantaagent.domain.strategy.PriceRecommendation;
import com.fantaagent.domain.strategy.ValuationContext;
import com.fantaagent.domain.strategy.ValuationEngine;

import java.util.List;
import java.util.Set;

public class PlayerAnalysisService {

    private final LeagueRules rules;
    private final PlayerCatalog catalog;
    private final ProjectionRegistry projections;
    private final ValuationEngine engine;
    private final AuctionService auction;

    public PlayerAnalysisService(LeagueRules rules, PlayerCatalog catalog,
                                 ProjectionRegistry projections, ValuationEngine engine,
                                 AuctionService auction) {
        this.rules = rules;
        this.catalog = catalog;
        this.projections = projections;
        this.engine = engine;
        this.auction = auction;
    }

    public PriceRecommendation analyze(String playerId) {
        return engine.evaluate(context(playerId, auction.state()));
    }

    /** Riusa lo stato già proiettato: serve alla lista target, che valuta molti giocatori. */
    public PriceRecommendation analyze(String playerId, AuctionState state) {
        return engine.evaluate(context(playerId, state));
    }

    private ValuationContext context(String playerId, AuctionState state) {
        PlayerProjection target = projections.of(playerId);
        Set<String> sold = state.soldPlayerIds();

        List<PlayerProjection> owned = state.mySquad().playerIds().stream()
                .map(projections::of)
                .toList();
        List<PlayerProjection> available = projections.all().stream()
                .filter(p -> !sold.contains(p.playerId()))
                .toList();

        PriceModel prices = PriceModel.build(rules, state, projections.all(),
                id -> catalog.byId(id).map(Player::listPrice).orElse(1));

        return new ValuationContext(state, target, owned, available, prices,
                auction.salesInCurrentPhase());
    }
}
