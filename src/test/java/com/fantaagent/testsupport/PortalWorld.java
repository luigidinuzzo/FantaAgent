package com.fantaagent.testsupport;

import com.fantaagent.adapter.out.jdbc.JdbcAuctionEventStores;
import com.fantaagent.adapter.out.jdbc.JdbcAuctionRepository;
import com.fantaagent.adapter.out.jdbc.JdbcLeagueRepository;
import com.fantaagent.adapter.out.jdbc.SpringTransactions;
import com.fantaagent.application.port.out.LeagueMember;
import com.fantaagent.application.port.out.MemberRole;
import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.application.service.auction.LeagueAuctionService;
import com.fantaagent.application.service.league.LeagueAccess;
import com.fantaagent.application.service.league.LeagueService;
import com.fantaagent.domain.player.Role;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Un portale intero su un database fresco, senza Spring: repository veri, servizi
 * veri, un orologio fermo. Per i test di servizio che attraversano leghe, aste e
 * registro insieme.
 */
public final class PortalWorld {

    public static final ObjectMapper JSON = JsonMapper.builder().addModule(new JavaTimeModule()).build();
    public static final List<Role> PHASES = List.of(Role.P, Role.D, Role.C, Role.A);

    public final DataSource ds;
    public final JdbcClient jdbc;
    public final MutableClock clock = new MutableClock(Instant.parse("2026-09-28T20:00:00Z"));
    public final SpringTransactions tx;
    public final JdbcLeagueRepository leagueRepository;
    public final JdbcAuctionRepository auctionRepository;
    public final JdbcAuctionEventStores stores;
    public final PlayerCatalog catalog = Fixtures.catalog();
    public final LeagueService leagues;
    public final LeagueAuctionService auctions;

    public PortalWorld() {
        this(SharedPostgres.migratedDatabase());
    }

    /** Su un DataSource scelto da chi chiama, gia' migrato: per misurare con un pool come in produzione. */
    public PortalWorld(DataSource ds) {
        this.ds = ds;
        this.jdbc = JdbcClient.create(ds);
        this.tx = new SpringTransactions(new TransactionTemplate(new DataSourceTransactionManager(ds)));
        this.leagueRepository = new JdbcLeagueRepository(jdbc, JSON);
        this.auctionRepository = new JdbcAuctionRepository(jdbc, JSON);
        this.stores = new JdbcAuctionEventStores(jdbc, JSON);
        this.leagues = new LeagueService(leagueRepository, Fixtures.template(), tx, clock);
        this.auctions = new LeagueAuctionService(auctionRepository, leagueRepository, stores, tx, clock, PHASES);
    }

    public UUID user(String name) {
        return TestRows.user(jdbc, name + "@example.com");
    }

    /** Una lega con {@code admin} amministratore e gli altri membri, iniziale = prima lettera del nome. */
    public LeagueAccess league(String admin, String... members) {
        UUID adminId = user(admin);
        LeagueAccess access = leagues.create(adminId, "Lega", admin + " FC", admin.substring(0, 1));
        for (String member : members) {
            join(access, user(member), member);
        }
        return leagues.access(access.leagueId(), adminId);
    }

    public void join(LeagueAccess league, UUID userId, String name) {
        leagueRepository.insertMember(new LeagueMember(league.leagueId(), userId, MemberRole.MEMBER,
                name + " FC", Character.toUpperCase(name.charAt(0)), clock.instant(), null));
    }

    public LeagueAccess as(LeagueAccess league, UUID userId) {
        return leagues.access(league.leagueId(), userId);
    }

    public UUID userId(LeagueAccess league, String teamName) {
        return leagueRepository.members(league.leagueId()).stream()
                .filter(m -> m.teamName().equals(teamName)).findFirst().orElseThrow().userId();
    }
}
