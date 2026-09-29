package com.fantaagent.config;

import com.fantaagent.adapter.out.jdbc.JdbcAuctionEventStores;
import com.fantaagent.adapter.out.jdbc.JdbcAuctionRepository;
import com.fantaagent.adapter.out.jdbc.JdbcInviteRepository;
import com.fantaagent.adapter.out.jdbc.JdbcLeagueRepository;
import com.fantaagent.adapter.out.jdbc.SpringTransactions;
import com.fantaagent.application.port.out.AuctionEventStores;
import com.fantaagent.application.port.out.AuctionRepository;
import com.fantaagent.application.port.out.InviteRepository;
import com.fantaagent.application.port.out.LeagueRepository;
import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.application.port.out.Transactions;
import com.fantaagent.application.port.out.UserRepository;
import com.fantaagent.application.service.auction.AuctionRegistry;
import com.fantaagent.application.service.auction.LeagueAuctionService;
import com.fantaagent.application.service.league.InviteService;
import com.fantaagent.application.service.league.LeagueService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;

@Configuration
public class PersistenceConfig {

    @Bean
    public Transactions transactions(TransactionTemplate template) {
        return new SpringTransactions(template);
    }

    @Bean
    public AuctionEventStores auctionEventStores(JdbcClient jdbc, ObjectMapper json) {
        return new JdbcAuctionEventStores(jdbc, json);
    }

    @Bean
    public LeagueRepository leagueRepository(JdbcClient jdbc, ObjectMapper json) {
        return new JdbcLeagueRepository(jdbc, json);
    }

    @Bean
    public LeagueService leagueService(LeagueRepository leagues, ConfigAuctionTemplate template,
                                       Transactions tx, Clock clock) {
        return new LeagueService(leagues, template, tx, clock);
    }

    @Bean
    public AuctionRepository auctionRepository(JdbcClient jdbc, ObjectMapper json) {
        return new JdbcAuctionRepository(jdbc, json);
    }

    @Bean
    public LeagueAuctionService leagueAuctionService(AuctionRepository auctions, LeagueRepository leagues,
                                                     AuctionEventStores stores, Transactions tx,
                                                     Clock clock, LeagueProperties props) {
        return new LeagueAuctionService(auctions, leagues, stores, tx, clock, props.phases());
    }

    @Bean
    public AuctionRegistry auctionRegistry(LeagueAuctionService auctions, AuctionRepository repository,
                                           AuctionEventStores stores, PlayerCatalog catalog,
                                           ConfigAuctionTemplate template, LeagueProperties props,
                                           Transactions tx) {
        return new AuctionRegistry(auctions, repository, stores, catalog, template,
                props.scoring().seasonWeights(), props.phases(), tx);
    }

    @Bean
    public InviteRepository inviteRepository(JdbcClient jdbc) {
        return new JdbcInviteRepository(jdbc);
    }

    @Bean
    public InviteService inviteService(InviteRepository invites, LeagueRepository leagues,
                                       UserRepository users, Clock clock,
                                       @Value("${fantaagent.public-url}") String publicUrl) {
        return new InviteService(invites, leagues, users, clock, publicUrl);
    }
}
