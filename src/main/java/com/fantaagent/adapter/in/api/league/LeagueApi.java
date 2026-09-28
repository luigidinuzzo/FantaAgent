package com.fantaagent.adapter.in.api.league;

import com.fantaagent.adapter.in.api.ApiAccess;
import com.fantaagent.adapter.in.security.AppUserPrincipal;
import com.fantaagent.application.service.league.LeagueAccess;
import com.fantaagent.application.service.league.LeagueService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/leagues")
public class LeagueApi {

    private final ApiAccess access;
    private final LeagueService leagues;

    public LeagueApi(ApiAccess access, LeagueService leagues) {
        this.access = access;
        this.leagues = leagues;
    }

    @GetMapping
    public List<LeagueDtos.LeagueCard> mine(@AuthenticationPrincipal AppUserPrincipal me) {
        return leagues.mine(me.id()).stream().map(LeagueDtos.LeagueCard::of).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public LeagueDtos.LeagueDetail create(@AuthenticationPrincipal AppUserPrincipal me,
                                          @RequestBody LeagueDtos.CreateLeagueRequest body) {
        LeagueAccess created = leagues.create(me.id(), body.name(), body.teamName(), body.initial());
        return LeagueDtos.LeagueDetail.of(created, leagues.members(created));
    }

    @GetMapping("/{leagueId}")
    public LeagueDtos.LeagueDetail read(@AuthenticationPrincipal AppUserPrincipal me,
                                        @PathVariable String leagueId) {
        LeagueAccess league = access.league(leagueId, me);
        return LeagueDtos.LeagueDetail.of(league, leagues.members(league));
    }

    @PatchMapping("/{leagueId}")
    public LeagueDtos.LeagueDetail rename(@AuthenticationPrincipal AppUserPrincipal me,
                                          @PathVariable String leagueId,
                                          @RequestBody LeagueDtos.RenameRequest body) {
        LeagueAccess league = access.admin(leagueId, me);
        leagues.rename(league, body.name());
        LeagueAccess reread = access.league(leagueId, me);
        return LeagueDtos.LeagueDetail.of(reread, leagues.members(reread));
    }

    @GetMapping("/{leagueId}/members")
    public List<LeagueDtos.MemberView> members(@AuthenticationPrincipal AppUserPrincipal me,
                                               @PathVariable String leagueId) {
        LeagueAccess league = access.league(leagueId, me);
        return leagues.members(league).stream()
                .map(m -> LeagueDtos.MemberView.of(m, me.id())).toList();
    }
}
