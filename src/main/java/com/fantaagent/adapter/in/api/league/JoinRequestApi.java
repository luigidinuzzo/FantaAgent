package com.fantaagent.adapter.in.api.league;

import com.fantaagent.adapter.in.api.ApiAccess;
import com.fantaagent.adapter.in.security.AppUserPrincipal;
import com.fantaagent.application.service.league.JoinRequestGoneException;
import com.fantaagent.application.service.league.JoinRequestService;
import com.fantaagent.application.service.league.NotLeagueMemberException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Entrare in una lega senza link: la ricerca per nome e la richiesta, dal lato di chi
 * chiede ({@code /api/join-requests}) e da quello dell'amministratore
 * ({@code /api/leagues/{id}/join-requests}).
 */
@RestController
public class JoinRequestApi {

    private final ApiAccess access;
    private final JoinRequestService requests;

    public JoinRequestApi(ApiAccess access, JoinRequestService requests) {
        this.access = access;
        this.requests = requests;
    }

    @GetMapping("/api/leagues/search")
    public List<LeagueDtos.LeagueMatchView> search(@AuthenticationPrincipal AppUserPrincipal me,
                                                   @RequestParam(name = "q", defaultValue = "") String query) {
        return requests.search(me.id(), query).stream().map(LeagueDtos.LeagueMatchView::of).toList();
    }

    @GetMapping("/api/join-requests")
    public List<LeagueDtos.MyJoinRequestView> mine(@AuthenticationPrincipal AppUserPrincipal me) {
        return requests.mine(me.id()).stream().map(LeagueDtos.MyJoinRequestView::of).toList();
    }

    @PostMapping("/api/join-requests/{leagueId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void request(@AuthenticationPrincipal AppUserPrincipal me, @PathVariable String leagueId,
                        @RequestBody LeagueDtos.JoinRequestBody body) {
        requests.request(me.id(), ApiAccess.parseOr404(leagueId, () -> new NotLeagueMemberException(null)),
                body.teamName());
    }

    @DeleteMapping("/api/join-requests/{leagueId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void withdraw(@AuthenticationPrincipal AppUserPrincipal me, @PathVariable String leagueId) {
        UUID id;
        try {
            id = UUID.fromString(leagueId);
        } catch (IllegalArgumentException e) {
            return;
        }
        requests.withdraw(me.id(), id);
    }

    @GetMapping("/api/leagues/{leagueId}/join-requests")
    public List<LeagueDtos.JoinRequestView> pending(@AuthenticationPrincipal AppUserPrincipal me,
                                                    @PathVariable String leagueId) {
        return requests.pending(access.league(leagueId, me)).stream().map(LeagueDtos.JoinRequestView::of).toList();
    }

    @PostMapping("/api/leagues/{leagueId}/join-requests/{userId}/approve")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void approve(@AuthenticationPrincipal AppUserPrincipal me, @PathVariable String leagueId,
                        @PathVariable String userId) {
        requests.approve(access.league(leagueId, me),
                ApiAccess.parseOr404(userId, JoinRequestGoneException::new));
    }

    @DeleteMapping("/api/leagues/{leagueId}/join-requests/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reject(@AuthenticationPrincipal AppUserPrincipal me, @PathVariable String leagueId,
                       @PathVariable String userId) {
        requests.reject(access.league(leagueId, me),
                ApiAccess.parseOr404(userId, JoinRequestGoneException::new));
    }
}
