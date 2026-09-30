package com.fantaagent.application.service.league;

import com.fantaagent.adapter.out.jdbc.JdbcInviteRepository;
import com.fantaagent.adapter.out.jdbc.JdbcJoinRequestRepository;
import com.fantaagent.adapter.out.jdbc.JdbcLeagueRepository;
import com.fantaagent.adapter.out.jdbc.JdbcUserRepository;
import com.fantaagent.adapter.out.jdbc.SpringTransactions;
import com.fantaagent.application.port.out.LeagueMatch;
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
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JoinRequestServiceTest {

    private static final ObjectMapper JSON = JsonMapper.builder().addModule(new JavaTimeModule()).build();

    private JdbcLeagueRepository leagueRepository;
    private LeagueService leagues;
    private JoinRequestService requests;
    private InviteService invites;
    private LeagueAccess admin;
    private UUID bruno;

    @BeforeEach
    void setUp() {
        DataSource ds = SharedPostgres.migratedDatabase();
        JdbcClient jdbc = JdbcClient.create(ds);
        MutableClock clock = new MutableClock(Instant.parse("2026-09-30T20:00:00Z"));
        leagueRepository = new JdbcLeagueRepository(jdbc, JSON);
        leagues = new LeagueService(leagueRepository, Fixtures.template(),
                new SpringTransactions(new TransactionTemplate(new DataSourceTransactionManager(ds))), clock);
        requests = new JoinRequestService(new JdbcJoinRequestRepository(jdbc), leagueRepository, clock);
        invites = new InviteService(new JdbcInviteRepository(jdbc), leagueRepository,
                new JdbcUserRepository(jdbc), clock, "https://fanta.example");
        admin = leagues.create(TestRows.user(jdbc, "anna@example.com"), "Lega del Bar", "Anna FC", "A");
        bruno = TestRows.user(jdbc, "bruno@example.com");
    }

    @Test
    void siTrovaUnaLegaDaUnPezzoDelNome() {
        List<LeagueMatch> found = requests.search(bruno, "  del bar ");
        assertThat(found).singleElement().satisfies(m -> {
            assertThat(m.name()).isEqualTo("Lega del Bar");
            assertThat(m.adminName()).isEqualTo("anna");
            assertThat(m.members()).isEqualTo(1);
            assertThat(m.member()).isFalse();
            assertThat(m.pending()).isFalse();
        });
    }

    @Test
    void sottoTreLettereNonSiCerca() {
        assertThat(requests.search(bruno, "Le")).isEmpty();
    }

    @Test
    void primaLeLegheCheCominciano() {
        leagues.create(bruno, "Barcellona e amici", "Bruno FC", null);
        assertThat(requests.search(bruno, "bar")).extracting(LeagueMatch::name)
                .containsExactly("Barcellona e amici", "Lega del Bar");
    }

    @Test
    void chiedereEAccettareFaEntrareConLaSquadraDellaRichiesta() {
        requests.request(bruno, admin.leagueId(), " Bruno FC ");
        assertThat(requests.search(bruno, "Lega del").getFirst().pending()).isTrue();
        assertThat(requests.mine(bruno)).singleElement()
                .satisfies(r -> assertThat(r.leagueName()).isEqualTo("Lega del Bar"));
        assertThat(requests.pendingCounts(List.of(admin))).containsEntry(admin.leagueId(), 1);

        requests.approve(admin, bruno);

        LeagueAccess joined = leagues.access(admin.leagueId(), bruno);
        assertThat(joined.me().teamName()).isEqualTo("Bruno FC");
        assertThat(joined.isAdmin()).isFalse();
        assertThat(requests.mine(bruno)).isEmpty();
        assertThat(requests.pending(admin)).isEmpty();
        assertThat(requests.search(bruno, "Lega del").getFirst().member()).isTrue();
    }

    @Test
    void rifiutareCancellaLaRichiesta() {
        requests.request(bruno, admin.leagueId(), "Bruno FC");
        requests.reject(admin, bruno);
        assertThat(requests.mine(bruno)).isEmpty();
        assertThatThrownBy(() -> leagues.access(admin.leagueId(), bruno))
                .isInstanceOf(NotLeagueMemberException.class);
        assertThatThrownBy(() -> requests.approve(admin, bruno)).isInstanceOf(JoinRequestGoneException.class);
    }

    @Test
    void chiRitiraNonAspettaPiu() {
        requests.request(bruno, admin.leagueId(), "Bruno FC");
        requests.withdraw(bruno, admin.leagueId());
        assertThat(requests.pending(admin)).isEmpty();
    }

    @Test
    void soloLAmministratoreDecide() {
        UUID carla = UUID.randomUUID();
        requests.request(bruno, admin.leagueId(), "Bruno FC");
        requests.approve(admin, bruno);
        LeagueAccess member = leagues.access(admin.leagueId(), bruno);
        assertThatThrownBy(() -> requests.pending(member)).isInstanceOf(AdminOnlyException.class);
        assertThatThrownBy(() -> requests.reject(member, carla)).isInstanceOf(AdminOnlyException.class);
    }

    @Test
    void laSquadraVaScritta() {
        assertThatThrownBy(() -> requests.request(bruno, admin.leagueId(), " "))
                .isInstanceOf(InvalidLeagueDataException.class);
    }

    @Test
    void unaLegaCheNonCeNonSiChiede() {
        assertThatThrownBy(() -> requests.request(bruno, UUID.randomUUID(), "Bruno FC"))
                .isInstanceOf(NotLeagueMemberException.class);
    }

    @Test
    void entratoColLinkLaRichiestaNonEPiuAperta_eUscendoNonTorna() {
        requests.request(bruno, admin.leagueId(), "Bruno FC");
        String link = invites.create(admin).link();
        invites.accept(link.substring(link.lastIndexOf('/') + 1), bruno, "Bruno FC", null);
        assertThat(requests.pending(admin)).isEmpty();
        assertThat(requests.mine(bruno)).isEmpty();

        leagueRepository.deleteMember(admin.leagueId(), bruno);
        assertThat(requests.pending(admin)).isEmpty();
    }
}
