package com.fantaagent.adapter.in.api.league;

import com.fantaagent.adapter.in.api.ApiAccess;
import com.fantaagent.adapter.in.security.AppUserPrincipal;
import com.fantaagent.application.service.auction.LeagueAuctionService;
import com.fantaagent.application.service.league.CreatedInvite;
import com.fantaagent.application.service.league.InvitePreview;
import com.fantaagent.application.service.league.InviteService;
import com.fantaagent.application.service.league.LeagueService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
public class InviteApi {

    private final ApiAccess access;
    private final InviteService invites;
    private final LeagueService leagues;
    private final LeagueAuctionService auctions;

    public InviteApi(ApiAccess access, InviteService invites, LeagueService leagues,
                     LeagueAuctionService auctions) {
        this.access = access;
        this.invites = invites;
        this.leagues = leagues;
        this.auctions = auctions;
    }

    @PostMapping("/api/leagues/{leagueId}/invites")
    @ResponseStatus(HttpStatus.CREATED)
    public LeagueDtos.CreatedInviteView create(@AuthenticationPrincipal AppUserPrincipal me,
                                               @PathVariable String leagueId) {
        CreatedInvite created = invites.create(access.league(leagueId, me));
        return new LeagueDtos.CreatedInviteView(created.invite().id().toString(), created.link(),
                created.invite().expiresAt());
    }

    @GetMapping("/api/leagues/{leagueId}/invites")
    public List<LeagueDtos.InviteView> active(@AuthenticationPrincipal AppUserPrincipal me,
                                              @PathVariable String leagueId) {
        return invites.active(access.league(leagueId, me)).stream().map(LeagueDtos.InviteView::of).toList();
    }

    @DeleteMapping("/api/leagues/{leagueId}/invites/{inviteId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revoke(@AuthenticationPrincipal AppUserPrincipal me, @PathVariable String leagueId,
                       @PathVariable String inviteId) {
        var league = access.league(leagueId, me);
        UUID id;
        try {
            id = UUID.fromString(inviteId);
        } catch (IllegalArgumentException e) {
            return;
        }
        invites.revoke(league, id);
    }

    /** Pubblica: chi apre il link di solito non ha ancora un account. */
    @GetMapping("/api/invites/{token}")
    public LeagueDtos.InvitePreviewView preview(@AuthenticationPrincipal AppUserPrincipal me,
                                                @PathVariable String token) {
        InvitePreview p = invites.preview(token, me == null ? null : me.id());
        return new LeagueDtos.InvitePreviewView(p.leagueId().toString(), p.leagueName(), p.invitedBy(),
                p.alreadyMember(), p.takenInitials());
    }

    @PostMapping("/api/invites/{token}/accept")
    @ResponseStatus(HttpStatus.CREATED)
    public LeagueDtos.LeagueCard accept(@AuthenticationPrincipal AppUserPrincipal me,
                                        @PathVariable String token,
                                        @RequestBody LeagueDtos.AcceptInviteRequest body) {
        UUID leagueId = invites.accept(token, me.id(), body.teamName(), body.initial());
        // Chi entra col link non amministra: niente richieste da decidere.
        var joined = leagues.access(leagueId, me.id());
        return LeagueDtos.LeagueCard.of(joined, leagues.members(joined).size(), auctions.count(joined), 0);
    }
}
