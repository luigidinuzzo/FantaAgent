package com.fantaagent.application.service.league;

import com.fantaagent.adapter.out.jdbc.JdbcInviteRepository;
import com.fantaagent.adapter.out.jdbc.JdbcLeagueRepository;
import com.fantaagent.adapter.out.jdbc.JdbcUserRepository;
import com.fantaagent.adapter.out.jdbc.SpringTransactions;
import com.fantaagent.application.port.out.InitialTakenException;
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
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class InviteServiceTest {

    private static final ObjectMapper JSON = JsonMapper.builder().addModule(new JavaTimeModule()).build();

    private MutableClock clock;
    private LeagueService leagues;
    private InviteService invites;
    private LeagueAccess admin;
    private UUID bruno;

    @BeforeEach
    void setUp() {
        DataSource ds = SharedPostgres.migratedDatabase();
        JdbcClient jdbc = JdbcClient.create(ds);
        clock = new MutableClock(Instant.parse("2026-09-28T20:00:00Z"));
        JdbcLeagueRepository leagueRepository = new JdbcLeagueRepository(jdbc, JSON);
        leagues = new LeagueService(leagueRepository, Fixtures.template(),
                new SpringTransactions(new TransactionTemplate(new DataSourceTransactionManager(ds))), clock);
        invites = new InviteService(new JdbcInviteRepository(jdbc), leagueRepository,
                new JdbcUserRepository(jdbc), clock, "https://fanta.example");
        admin = leagues.create(TestRows.user(jdbc, "anna@example.com"), "Lega del Bar", "Anna FC", "A");
        bruno = TestRows.user(jdbc, "bruno@example.com");
    }

    private static String tokenOf(CreatedInvite created) {
        return created.link().substring(created.link().lastIndexOf('/') + 1);
    }

    @Test
    void ilLinkPortaAllInvito() {
        CreatedInvite created = invites.create(admin);
        assertThat(created.link()).startsWith("https://fanta.example/invito/");
        assertThat(created.invite().expiresAt()).isEqualTo(clock.instant().plus(Duration.ofDays(14)));
    }

    @Test
    void chiApreIlLinkVedeLaLegaEChiInvita() {
        InvitePreview preview = invites.preview(tokenOf(invites.create(admin)), null);
        assertThat(preview.leagueName()).isEqualTo("Lega del Bar");
        assertThat(preview.invitedBy()).isEqualTo("anna");
        assertThat(preview.alreadyMember()).isFalse();
        assertThat(preview.takenInitials()).containsExactly("A");
    }

    @Test
    void accettareFaEntrareNellaLega() {
        String token = tokenOf(invites.create(admin));
        UUID leagueId = invites.accept(token, bruno, "Bruno FC", "b");

        LeagueAccess access = leagues.access(leagueId, bruno);
        assertThat(access.isAdmin()).isFalse();
        assertThat(access.me().initial()).isEqualTo('B');
    }

    @Test
    void ilLinkSiRiusaFinoAllaScadenza() {
        String token = tokenOf(invites.create(admin));
        invites.accept(token, bruno, "Bruno FC", "B");
        clock.advance(Duration.ofDays(13));
        assertThat(invites.preview(token, null).leagueName()).isEqualTo("Lega del Bar");
        clock.advance(Duration.ofDays(2));
        assertThatThrownBy(() -> invites.preview(token, null)).isInstanceOf(InviteUnavailableException.class);
    }

    @Test
    void unInvitoRitiratoNonVale() {
        CreatedInvite created = invites.create(admin);
        invites.revoke(admin, created.invite().id());
        assertThatThrownBy(() -> invites.accept(tokenOf(created), bruno, "Bruno FC", "B"))
                .isInstanceOf(InviteUnavailableException.class);
        assertThat(invites.active(admin)).isEmpty();
    }

    @Test
    void chiEGiaMembroRestaComEra() {
        String token = tokenOf(invites.create(admin));
        UUID leagueId = invites.accept(token, admin.userId(), "Altro nome", "Z");
        assertThat(leagues.access(leagueId, admin.userId()).me().teamName()).isEqualTo("Anna FC");
        assertThat(invites.preview(token, admin.userId()).alreadyMember()).isTrue();
    }

    @Test
    void lInizialeGiaPresaNonSiPrende() {
        String token = tokenOf(invites.create(admin));
        assertThatThrownBy(() -> invites.accept(token, bruno, "Bruno FC", "A"))
                .isInstanceOf(InitialTakenException.class);
    }

    @Test
    void soloLAmministratoreInvita() {
        String token = tokenOf(invites.create(admin));
        UUID leagueId = invites.accept(token, bruno, "Bruno FC", "B");
        LeagueAccess member = leagues.access(leagueId, bruno);
        assertThatThrownBy(() -> invites.create(member)).isInstanceOf(AdminOnlyException.class);
    }

    @Test
    void unTokenInventatoNonVale() {
        assertThatThrownBy(() -> invites.preview("inventato", null)).isInstanceOf(InviteUnavailableException.class);
    }
}
