package com.fantaagent.application.service.league;

import com.fantaagent.application.port.out.League;
import com.fantaagent.application.port.out.LeagueMember;
import com.fantaagent.application.port.out.MemberRole;

import java.util.UUID;

/**
 * La prova che chi chiede e' membro della lega, con il suo ruolo. Si ottiene solo da
 * {@link LeagueService#access}: un servizio che la riceve come argomento non deve
 * ricontrollare niente, e uno che non la riceve non puo' toccare la lega.
 */
public record LeagueAccess(League league, LeagueMember me) {

    public boolean isAdmin() {
        return me.role() == MemberRole.ADMIN;
    }

    public LeagueAccess requireAdmin() {
        if (!isAdmin()) {
            throw new AdminOnlyException();
        }
        return this;
    }

    public UUID userId() {
        return me.userId();
    }

    public UUID leagueId() {
        return league.id();
    }
}
