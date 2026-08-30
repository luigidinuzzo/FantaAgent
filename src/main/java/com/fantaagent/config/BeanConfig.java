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

    private static ModifierTable toTable(LeagueProperties.Table table) {
        return new ModifierTable(table.defendersCounted(),
                table.thresholds().stream()
                        .map(r -> new ModifierTable.Threshold(r.minAverage(), r.bonus()))
                        .toList());
    }
}
