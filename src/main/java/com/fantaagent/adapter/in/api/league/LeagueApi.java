package com.fantaagent.adapter.in.api.league;

import com.fantaagent.adapter.in.api.ApiAccess;
import com.fantaagent.adapter.in.security.AppUserPrincipal;
import com.fantaagent.application.service.auction.LeagueAuctionService;
import com.fantaagent.application.service.league.JoinRequestService;
import com.fantaagent.application.service.league.LeagueAccess;
import com.fantaagent.application.service.league.LeagueService;
import com.fantaagent.application.service.league.NotLeagueMemberException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/leagues")
public class LeagueApi {

    private final ApiAccess access;
    private final LeagueService leagues;
    private final LeagueAuctionService auctions;
    private final JoinRequestService requests;

    public LeagueApi(ApiAccess access, LeagueService leagues, LeagueAuctionService auctions,
                     JoinRequestService requests) {
        this.access = access;
        this.leagues = leagues;
        this.auctions = auctions;
        this.requests = requests;
    }

    @GetMapping
    public List<LeagueDtos.LeagueCard> mine(@AuthenticationPrincipal AppUserPrincipal me) {
        List<LeagueAccess> mine = leagues.mine(me.id());
        Map<UUID, Integer> pending = requests.pendingCounts(mine);
        return mine.stream()
                .map(a -> LeagueDtos.LeagueCard.of(a, leagues.members(a).size(), auctions.count(a),
                        pending.getOrDefault(a.leagueId(), 0)))
                .toList();
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

    /** Lasciare la lega, o toglierne qualcuno se si e' l'amministratore. */
    @DeleteMapping("/{leagueId}/members/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeMember(@AuthenticationPrincipal AppUserPrincipal me, @PathVariable String leagueId,
                             @PathVariable String userId) {
        LeagueAccess league = access.league(leagueId, me);
        auctions.removeMember(league, ApiAccess.parseOr404(userId, () -> new NotLeagueMemberException(null)));
    }
}
