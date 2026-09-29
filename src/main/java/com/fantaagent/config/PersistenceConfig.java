package com.fantaagent.config;

import com.fantaagent.adapter.out.jdbc.JdbcAuctionEventStores;
import com.fantaagent.adapter.out.jdbc.JdbcInviteRepository;
import com.fantaagent.adapter.out.jdbc.JdbcLeagueRepository;
import com.fantaagent.adapter.out.jdbc.SpringTransactions;
import com.fantaagent.application.port.out.AuctionEventStores;
import com.fantaagent.application.port.out.InviteRepository;
import com.fantaagent.application.port.out.LeagueRepository;
import com.fantaagent.application.port.out.Transactions;
import com.fantaagent.application.port.out.UserRepository;
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
