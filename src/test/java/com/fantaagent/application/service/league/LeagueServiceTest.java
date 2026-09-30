package com.fantaagent.application.service.league;

import com.fantaagent.adapter.out.jdbc.JdbcLeagueRepository;
import com.fantaagent.adapter.out.jdbc.SpringTransactions;
import com.fantaagent.application.port.out.InitialTakenException;
import com.fantaagent.application.port.out.LeagueMember;
import com.fantaagent.application.port.out.MemberRole;
import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.LeagueRulesSettings;
import com.fantaagent.testsupport.Fixtures;
import com.fantaagent.testsupport.MutableClock;
import com.fantaagent.testsupport.SharedPostgres;
import com.fantaagent.testsupport.TestRows;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static com.fantaagent.domain.player.Role.A;
import static com.fantaagent.domain.player.Role.C;
import static com.fantaagent.domain.player.Role.D;
import static com.fantaagent.domain.player.Role.P;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LeagueServiceTest {

    private static final ObjectMapper JSON = JsonMapper.builder().addModule(new JavaTimeModule()).build();

    private JdbcClient jdbc;
    private JdbcLeagueRepository repository;
    private LeagueService leagues;
    private UUID anna;
    private UUID bruno;

    @BeforeEach
    void setUp() {
        DataSource ds = SharedPostgres.migratedDatabase();
        jdbc = JdbcClient.create(ds);
        repository = new JdbcLeagueRepository(jdbc, JSON);
        leagues = new LeagueService(repository, Fixtures.template(),
                new SpringTransactions(new TransactionTemplate(new DataSourceTransactionManager(ds))),
                new MutableClock(Instant.parse("2026-09-28T20:00:00Z")));
        anna = TestRows.user(jdbc, "anna@example.com");
        bruno = TestRows.user(jdbc, "bruno@example.com");
    }

    @Test
    void chiCreaLaLegaNeEAmministratore() {
        LeagueAccess access = leagues.create(anna, " Lega del Bar ", " Anna FC ", "a");

        assertThat(access.league().name()).isEqualTo("Lega del Bar");
        assertThat(access.isAdmin()).isTrue();
        assertThat(access.me().teamName()).isEqualTo("Anna FC");
        assertThat(access.me().initial()).isEqualTo('A');
        assertThat(access.me().displayName()).isEqualTo("anna");
    }

    @Test
    void laLegaParteDaiValoriDelModello() {
        LeagueAccess access = leagues.create(anna, "Lega", "Anna FC", "A");
        assertThat(access.league().rules()).isEqualTo(Fixtures.template().rules());
    }

    @Test
    void chiNonEMembroNonVedeLaLega() {
        UUID league = leagues.create(anna, "Lega", "Anna FC", "A").leagueId();
        assertThatThrownBy(() -> leagues.access(league, bruno)).isInstanceOf(NotLeagueMemberException.class);
        assertThatThrownBy(() -> leagues.access(UUID.randomUUID(), anna)).isInstanceOf(NotLeagueMemberException.class);
    }

    @Test
    void unMembroNonAmministratoreNonCambiaLaLega() {
        LeagueAccess admin = leagues.create(anna, "Lega", "Anna FC", "A");
        repository.insertMember(new LeagueMember(admin.leagueId(), bruno, MemberRole.MEMBER, "Bruno FC",
                'B', Instant.now(), null));
        LeagueAccess member = leagues.access(admin.leagueId(), bruno);

        assertThatThrownBy(() -> leagues.rename(member, "Altro nome")).isInstanceOf(AdminOnlyException.class);
    }

    @Test
    void dueInizialiUgualiNonConvivono() {
        LeagueAccess admin = leagues.create(anna, "Lega", "Anna FC", "A");
        assertThatThrownBy(() -> repository.insertMember(new LeagueMember(admin.leagueId(), bruno,
                MemberRole.MEMBER, "Bruno FC", 'A', Instant.now(), null)))
                .isInstanceOf(InitialTakenException.class);
    }

    @Test
    void leRegoleDellaLegaSiRileggonoIdentiche() {
        LeagueAccess admin = leagues.create(anna, "Lega", "Anna FC", "A");
        LeagueRulesSettings rules = new LeagueRulesSettings(300, Map.of(P, 2, D, 6, C, 6, A, 4));
        leagues.updateDefaults(admin, rules, admin.league().scoring(), new AuctionSettings(9, false));

        LeagueAccess reread = leagues.access(admin.leagueId(), anna);
        assertThat(reread.league().rules()).isEqualTo(rules);
        assertThat(reread.league().scoring()).isEqualTo(admin.league().scoring());
        assertThat(reread.league().bidder()).isEqualTo(new AuctionSettings(9, false));
    }

    @Test
    void leMieLeghe() {
        leagues.create(anna, "Zeta", "Anna FC", "A");
        leagues.create(anna, "Alfa", "Anna FC", "A");
        leagues.create(bruno, "Di Bruno", "Bruno FC", "B");

        assertThat(leagues.mine(anna)).extracting(a -> a.league().name()).containsExactly("Alfa", "Zeta");
    }

    @Test
    void datiNonValidiPerCampo() {
        assertThatThrownBy(() -> leagues.create(anna, " ", "", "7"))
                .isInstanceOfSatisfying(InvalidLeagueDataException.class, e ->
                        assertThat(e.errors()).containsOnlyKeys("name", "teamName", "initial"));
    }

    // L'app non chiede piu' l'iniziale: la sceglie il server, dalla squadra.
    @Test
    void senzaInizialeLaLegaLaPrendeDalNomeDellaSquadra() {
        LeagueAccess access = leagues.create(anna, "Lega", " erasmus FC", null);
        assertThat(access.me().initial()).isEqualTo('E');
    }

    @Test
    void lInizialeSceltaDalServerSaltaLeLetterePrese() {
        assertThat(LeagueService.initialOr("", "Erasmus", Set.of('E', 'R'))).isEqualTo('A');
        assertThat(LeagueService.initialOr(null, "12 !!", Set.of('A'))).isEqualTo('B');
        assertThat(LeagueService.initialOr(" x ", "Erasmus", Set.of())).isEqualTo('X');
    }

    // I posti di un'asta la riportano sempre: li' non c'e' nessuno che la scelga.
    @Test
    void lInizialeEFacoltativaPerEntrareMaNonPerIPostiDiUnAsta() {
        assertThat(LeagueService.memberProblems("Anna FC", "", false)).isEmpty();
        assertThat(LeagueService.memberProblems("Anna FC", "", true)).containsOnlyKeys("initial");
    }
}
