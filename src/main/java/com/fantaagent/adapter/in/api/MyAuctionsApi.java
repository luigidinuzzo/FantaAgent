package com.fantaagent.adapter.in.api;

import com.fantaagent.adapter.in.security.AppUserPrincipal;
import com.fantaagent.application.service.auction.LeagueAuctionService;
import com.fantaagent.application.service.auction.MyAuction;
import com.fantaagent.application.service.league.LeagueService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

/** Le aste dell'utente in tutte le sue leghe: la prima cosa della home. */
@RestController
public class MyAuctionsApi {

    private final LeagueService leagues;
    private final LeagueAuctionService auctions;

    public MyAuctionsApi(LeagueService leagues, LeagueAuctionService auctions) {
        this.leagues = leagues;
        this.auctions = auctions;
    }

    public record MyAuctionView(String id, String leagueId, String leagueName, String name, String status,
                                String phase, int budgetRemaining, int slotsRemaining, Instant lastActivity,
                                boolean admin) {
        static MyAuctionView of(MyAuction a) {
            return new MyAuctionView(a.id().toString(), a.leagueId().toString(), a.leagueName(), a.name(),
                    a.status().name(), a.phase().name(), a.budgetRemaining(), a.slotsRemaining(),
                    a.lastActivity(), a.admin());
        }
    }

    @GetMapping("/api/auctions")
    public List<MyAuctionView> mine(@AuthenticationPrincipal AppUserPrincipal me) {
        return auctions.mine(leagues.mine(me.id())).stream().map(MyAuctionView::of).toList();
    }
}
