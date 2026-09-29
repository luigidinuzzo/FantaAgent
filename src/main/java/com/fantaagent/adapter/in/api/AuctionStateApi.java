package com.fantaagent.adapter.in.api;

import com.fantaagent.adapter.in.api.dto.StateDtos;
import com.fantaagent.adapter.in.security.AppUserPrincipal;
import com.fantaagent.application.service.auction.AuctionView;
import com.fantaagent.domain.auction.AuctionState;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/leagues/{leagueId}/auctions/{auctionId}")
public class AuctionStateApi {

    private final ApiAccess access;

    public AuctionStateApi(ApiAccess access) {
        this.access = access;
    }

    @GetMapping("/state")
    public StateDtos.AuctionStateResponse state(@PathVariable String leagueId,
                                                @PathVariable String auctionId,
                                                @AuthenticationPrincipal AppUserPrincipal me) {
        AuctionView view = access.auction(leagueId, auctionId, me);
        // Una sola lettura dello stato per richiesta: rileggerlo per il conteggio
        // dei venduti rifolderebbe il log e potrebbe rispondere su due stati
        // diversi dentro la stessa risposta.
        AuctionState state = view.service().state();
        return StateDtos.from(view.auction().id().toString(), view.auction().name(), state,
                view.participants(), view.service().salesInCurrentPhase(state),
                view.service().version(), view.access().isAdmin());
    }
}
