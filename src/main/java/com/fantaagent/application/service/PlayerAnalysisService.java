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
import java.util.function.Supplier;

/**
 * Valutazione di un giocatore contro lo stato dell'asta.
 *
 * <p>La catena di valutazione non è più catturata alla costruzione ma riletta ad ogni
 * richiesta: salvare le impostazioni la sostituisce in blocco (vedi
 * {@link AuctionRuntime}). Ogni metodo pubblico legge la catena UNA volta e poi la
 * passa esplicitamente a chi gli serve — una seconda lettura, a metà di un calcolo,
 * potrebbe cadere dopo una ricostruzione e mescolare due modelli di punteggio dentro
 * lo stesso numero.
 */
public class PlayerAnalysisService {

    private final LeagueRules rules;
    private final PlayerCatalog catalog;
    private final Supplier<ValuationChain> chain;
    private final AuctionService auction;

    public PlayerAnalysisService(LeagueRules rules, PlayerCatalog catalog,
                                 Supplier<ValuationChain> chain, AuctionService auction) {
        this.rules = rules;
        this.catalog = catalog;
        this.chain = chain;
        this.auction = auction;
    }

    /** Catena fissa, decisa alla costruzione: la forma usata dai test. */
    public PlayerAnalysisService(LeagueRules rules, PlayerCatalog catalog,
                                 ProjectionRegistry projections, ValuationEngine engine,
                                 AuctionService auction) {
        this(rules, catalog, fixedChain(projections, engine), auction);
    }

    private static Supplier<ValuationChain> fixedChain(ProjectionRegistry projections,
                                                       ValuationEngine engine) {
        ValuationChain fixed = new ValuationChain(projections.scoring(), projections, engine);
        return () -> fixed;
    }

    /** La catena corrente, per chi deve valutare più righe con lo stesso modello. */
    public Supplier<ValuationChain> chains() {
        return chain;
    }

    public PriceRecommendation analyze(String playerId) {
        ValuationChain current = chain.get();
        AuctionState state = auction.state();
        return analyze(playerId, state, priceModelFor(state, current), current);
    }

    /**
     * Riusa stato, modello di prezzo e catena già presi dal chiamante: {@code targets()}
     * e {@code phasePlayers()} valutano molti candidati sullo stesso stato e altrimenti
     * ricalcolerebbero il modello — che scansiona l'intero catalogo — una volta per
     * candidato. La catena viaggia come argomento perché tutte le righe di una pagina
     * devono essere calcolate con lo stesso modello di punteggio.
     */
    public PriceRecommendation analyze(String playerId, AuctionState state, PriceModel prices,
                                       ValuationChain chain) {
        return chain.engine().evaluate(context(playerId, state, prices, chain));
    }

    /** Costruisce il modello di prezzo per uno stato, da riusare su più valutazioni. */
    public PriceModel priceModelFor(AuctionState state, ValuationChain chain) {
        return PriceModel.build(rules, state, chain.projections().all(),
                id -> catalog.byId(id).map(Player::listPrice).orElse(1));
    }

    private ValuationContext context(String playerId, AuctionState state, PriceModel prices,
                                     ValuationChain chain) {
        ProjectionRegistry projections = chain.projections();
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
