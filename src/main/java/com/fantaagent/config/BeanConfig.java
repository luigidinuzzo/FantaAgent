package com.fantaagent.config;

import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.ModifierTable;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.league.ScoringRules;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class BeanConfig {

    @Bean
    public LeagueRules leagueRules(LeagueProperties props) {
        return new LeagueRules(props.participants(), props.budget(), props.slots(), props.phases());
    }

    @Bean
    public ScoringRules scoringRules(LeagueProperties props) {
        LeagueProperties.Scoring s = props.scoring();
        return new ScoringRules(
                s.modifiersConfirmed(), s.goalBonus(), s.assist(),
                s.penaltyScored(), s.penaltyMissed(), s.penaltySaved(),
                s.yellowCard(), s.redCard(), s.goalConceded(), s.cleanSheet(),
                toTable(s.defenceModifier()), toTable(s.goalkeeperModifier()));
    }

    @Bean
    public List<Participant> participants(LeagueProperties props) {
        return props.members().stream()
                .map(m -> new Participant(m.id(), m.name(), m.initial(), m.me()))
                .toList();
    }

    @Bean
    public com.fantaagent.application.port.out.PlayerCatalog playerCatalog(
            @org.springframework.beans.factory.annotation.Value("${fantaagent.data-dir:data}") String dataDir) {
        com.fantaagent.ingestion.CatalogLoader.LoadedCatalog loaded =
                new com.fantaagent.ingestion.CatalogLoader().load(java.nio.file.Path.of(dataDir));
        org.slf4j.LoggerFactory.getLogger(BeanConfig.class)
                .info("catalogo caricato:\n{}", loaded.report().render());
        return loaded.catalog();
    }

    @Bean
    public com.fantaagent.application.port.out.AuctionEventStore auctionEventStore(
            @org.springframework.beans.factory.annotation.Value("${fantaagent.data-dir:data}") String dataDir,
            @org.springframework.beans.factory.annotation.Value("${fantaagent.auction-id:current}") String auctionId) {
        return new com.fantaagent.adapter.out.file.JsonlAuctionEventStore(
                java.nio.file.Path.of(dataDir, "auctions", auctionId, "events.jsonl"));
    }

    @Bean
    public com.fantaagent.application.service.ProjectionRegistry projectionRegistry(
            com.fantaagent.domain.league.LeagueRules rules,
            com.fantaagent.domain.league.ScoringRules scoring,
            com.fantaagent.application.port.out.PlayerCatalog catalog) {
        return com.fantaagent.application.service.ProjectionRegistry.build(rules, scoring, catalog);
    }

    @Bean
    public com.fantaagent.domain.strategy.ValuationEngine valuationEngine(
            com.fantaagent.domain.league.ScoringRules scoring,
            com.fantaagent.application.service.ProjectionRegistry projections) {
        var modifiers = new com.fantaagent.domain.strategy.ModifierCalculator(
                scoring, projections.replacement());
        var completer = new com.fantaagent.domain.strategy.RosterCompleter(
                modifiers, projections.replacement());
        return new com.fantaagent.domain.strategy.ValuationEngine(completer, modifiers);
    }

    @Bean
    public com.fantaagent.application.service.AuctionService auctionService(
            com.fantaagent.domain.league.LeagueRules rules,
            java.util.List<com.fantaagent.domain.league.Participant> participants,
            com.fantaagent.application.port.out.PlayerCatalog catalog,
            com.fantaagent.application.port.out.AuctionEventStore store) {
        return new com.fantaagent.application.service.AuctionService(rules, participants, catalog, store);
    }

    @Bean
    public com.fantaagent.application.service.PlayerAnalysisService playerAnalysisService(
            com.fantaagent.domain.league.LeagueRules rules,
            com.fantaagent.application.port.out.PlayerCatalog catalog,
            com.fantaagent.application.service.ProjectionRegistry projections,
            com.fantaagent.domain.strategy.ValuationEngine engine,
            com.fantaagent.application.service.AuctionService auction) {
        return new com.fantaagent.application.service.PlayerAnalysisService(
                rules, catalog, projections, engine, auction);
    }

    @Bean
    public com.fantaagent.application.service.PlayerSearchService playerSearchService(
            com.fantaagent.application.port.out.PlayerCatalog catalog,
            com.fantaagent.application.service.ProjectionRegistry projections,
            com.fantaagent.application.service.AuctionService auction,
            com.fantaagent.application.service.PlayerAnalysisService analysis) {
        return new com.fantaagent.application.service.PlayerSearchService(
                catalog, projections, auction, analysis);
    }

    private static ModifierTable toTable(LeagueProperties.Table table) {
        return new ModifierTable(table.defendersCounted(),
                table.thresholds().stream()
                        .map(r -> new ModifierTable.Threshold(r.minAverage(), r.bonus()))
                        .toList());
    }
}
