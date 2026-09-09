package com.fantaagent.adapter.in.api.board;

import com.fantaagent.adapter.in.api.AuctionGuard;
import com.fantaagent.adapter.in.api.LeagueGuard;
import com.fantaagent.adapter.in.api.UnknownPlayerException;
import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.AuctionSettingsHolder;
import com.fantaagent.domain.player.Player;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/leagues/{leagueId}/auctions/{auctionId}/board")
public class PublicBidderApi {

    private final LeagueGuard leagues;
    private final AuctionGuard auctions;
    private final PlayerCatalog catalog;
    private final AuctionSettingsHolder settings;

    public PublicBidderApi(LeagueGuard leagues, AuctionGuard auctions,
                           PlayerCatalog catalog, AuctionSettingsHolder settings) {
        this.leagues = leagues;
        this.auctions = auctions;
        this.catalog = catalog;
        this.settings = settings;
    }

    @GetMapping("/bidder/{playerId}")
    public BoardDtos.PublicBidderResponse bidder(@PathVariable String leagueId,
                                                 @PathVariable String auctionId,
                                                 @PathVariable String playerId) {
        leagues.check(leagueId);
        auctions.check(auctionId);
        Player player = catalog.byId(playerId)
                .orElseThrow(() -> new UnknownPlayerException(playerId));
        AuctionSettings current = settings.get();
        return new BoardDtos.PublicBidderResponse(player.id(), player.name(),
                player.team(), player.role(), player.listPrice(),
                current.bidTimerSeconds(), current.beepEnabled());
    }
}
