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
        AuctionState state = auction.state();
        return analyze(playerId, state, priceModelFor(state));
    }

    /** Riusa lo stato già proiettato: serve alla lista target, che valuta molti giocatori. */
    public PriceRecommendation analyze(String playerId, AuctionState state) {
        return analyze(playerId, state, priceModelFor(state));
    }

    /**
     * Riusa sia lo stato sia il modello di prezzo già costruiti: {@code targets()} valuta
     * molti candidati sullo stesso stato e altrimenti ricalcolerebbe il modello — che
     * scansiona l'intero catalogo — una volta per candidato.
     */
    public PriceRecommendation analyze(String playerId, AuctionState state, PriceModel prices) {
        return engine.evaluate(context(playerId, state, prices));
    }

    /** Costruisce il modello di prezzo per uno stato, da riusare su più valutazioni. */
    public PriceModel priceModelFor(AuctionState state) {
        return PriceModel.build(rules, state, projections.all(),
                id -> catalog.byId(id).map(Player::listPrice).orElse(1));
    }

    private ValuationContext context(String playerId, AuctionState state, PriceModel prices) {
        PlayerProjection target = projections.of(playerId);
        Set<String> sold = state.soldPlayerIds();

        List<PlayerProjection> owned = state.mySquad().playerIds().stream()
                .map(projections::of)
                .toList();
        List<PlayerProjection> available = projections.all().stream()
                .filter(p -> !sold.contains(p.playerId()))
                .toList();

        return new ValuationContext(state, target, owned, available, prices,
                auction.salesInCurrentPhase(state));
    }
}
