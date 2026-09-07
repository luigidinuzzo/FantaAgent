package com.fantaagent.adapter.in.api;

import com.fantaagent.adapter.in.api.dto.StateDtos;
import com.fantaagent.application.service.AuctionRuntime;
import com.fantaagent.application.service.AuctionService;
import com.fantaagent.domain.auction.AuctionState;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/leagues/{leagueId}/auctions/{auctionId}")
public class AuctionStateApi {

    private final LeagueGuard leagues;
    private final AuctionService auction;
    private final AuctionRuntime runtime;

    public AuctionStateApi(LeagueGuard leagues, AuctionService auction, AuctionRuntime runtime) {
        this.leagues = leagues;
        this.auction = auction;
        this.runtime = runtime;
    }

    @GetMapping("/state")
    public StateDtos.AuctionStateResponse state(@PathVariable String leagueId,
                                                @PathVariable String auctionId) {
        leagues.check(leagueId);
        // Una sola lettura dello stato per richiesta: rileggerlo per il conteggio
        // dei venduti rifolderebbe il log e potrebbe rispondere su due stati
        // diversi dentro la stessa risposta.
        AuctionState state = auction.state();
        return StateDtos.from(auction.auctionId(), runtime.currentAuctionLabel(),
                state, auction.participants(), auction.salesInCurrentPhase(state));
    }
}
