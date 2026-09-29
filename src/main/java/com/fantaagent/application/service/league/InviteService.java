package com.fantaagent.application.service.league;

import com.fantaagent.application.port.out.Invite;
import com.fantaagent.application.port.out.InviteRepository;
import com.fantaagent.application.port.out.League;
import com.fantaagent.application.port.out.LeagueMember;
import com.fantaagent.application.port.out.LeagueRepository;
import com.fantaagent.application.port.out.MemberRole;
import com.fantaagent.application.port.out.UserAccount;
import com.fantaagent.application.port.out.UserRepository;
import com.fantaagent.application.service.account.Tokens;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Il link d'invito: riutilizzabile finche' non scade o non viene ritirato, cosi' che
 * l'amministratore lo mandi una volta nel gruppo e basti per tutti.
 */
public class InviteService {

    static final Duration TTL = Duration.ofDays(14);

    private final InviteRepository invites;
    private final LeagueRepository leagues;
    private final UserRepository users;
    private final Clock clock;
    private final String publicUrl;

    public InviteService(InviteRepository invites, LeagueRepository leagues, UserRepository users,
                         Clock clock, String publicUrl) {
        this.invites = invites;
        this.leagues = leagues;
        this.users = users;
        this.clock = clock;
        this.publicUrl = publicUrl.endsWith("/") ? publicUrl.substring(0, publicUrl.length() - 1) : publicUrl;
    }

    public CreatedInvite create(LeagueAccess access) {
        access.requireAdmin();
        String token = Tokens.generate();
        Instant now = clock.instant();
        Invite invite = new Invite(UUID.randomUUID(), access.leagueId(), Tokens.hash(token),
                access.userId(), now, now.plus(TTL), null);
        invites.insert(invite);
        return new CreatedInvite(invite, publicUrl + "/invito/" + token);
    }

    public List<Invite> active(LeagueAccess access) {
        access.requireAdmin();
        Instant now = clock.instant();
        return invites.byLeague(access.leagueId()).stream().filter(i -> i.usableAt(now)).toList();
    }

    /** Ritirare un invito gia' ritirato, o di un'altra lega, non fa niente e non e' un errore. */
    public void revoke(LeagueAccess access, UUID inviteId) {
        access.requireAdmin();
        invites.revoke(access.leagueId(), inviteId, clock.instant());
    }

    /** @param viewer chi apre il link, o null se non ha fatto l'accesso */
    public InvitePreview preview(String token, UUID viewer) {
        Invite invite = usable(token);
        League league = leagues.byId(invite.leagueId()).orElseThrow(InviteUnavailableException::new);
        String invitedBy = users.byId(invite.createdBy()).map(UserAccount::displayName).orElse("");
        List<LeagueMember> members = leagues.members(league.id());
        boolean member = viewer != null && members.stream().anyMatch(m -> m.userId().equals(viewer));
        return new InvitePreview(league.id(), league.name(), invitedBy, member,
                members.stream().map(m -> String.valueOf(m.initial())).toList());
    }

    /**
     * Chi e' gia' membro resta com'era: aprire di nuovo il link del gruppo non deve
     * cambiare la squadra di nessuno.
     *
     * @return la lega in cui si e' entrati
     */
    public UUID accept(String token, UUID userId, String teamName, String initial) {
        Invite invite = usable(token);
        if (leagues.member(invite.leagueId(), userId).isPresent()) {
            return invite.leagueId();
        }
        Map<String, List<String>> problems = LeagueService.memberProblems(teamName, initial);
        if (!problems.isEmpty()) {
            throw new InvalidLeagueDataException(problems);
        }
        leagues.insertMember(new LeagueMember(invite.leagueId(), userId, MemberRole.MEMBER,
                teamName.trim(), LeagueService.initialOf(initial), clock.instant(), null));
        return invite.leagueId();
    }

    private Invite usable(String token) {
        Instant now = clock.instant();
        return invites.byHash(Tokens.hash(token == null ? "" : token))
                .filter(i -> i.usableAt(now))
                .orElseThrow(InviteUnavailableException::new);
    }
}
