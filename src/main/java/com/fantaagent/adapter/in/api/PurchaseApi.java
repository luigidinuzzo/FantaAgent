package com.fantaagent.adapter.in.api;

import com.fantaagent.adapter.in.api.dto.PurchaseDtos;
import com.fantaagent.application.service.AuctionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/leagues/{leagueId}/auctions/{auctionId}")
public class PurchaseApi {

    private final LeagueGuard leagues;
    private final AuctionService auction;

    public PurchaseApi(LeagueGuard leagues, AuctionService auction) {
        this.leagues = leagues;
        this.auction = auction;
    }

    @PostMapping("/purchases")
    @ResponseStatus(HttpStatus.CREATED)
    public PurchaseDtos.PurchaseResponse buy(@PathVariable String leagueId,
                                             @Valid @RequestBody PurchaseDtos.PurchaseRequest body) {
        leagues.check(leagueId);
        long seq = auction.recordPurchase(body.playerId(), body.participantId(),
                body.price(), body.requestId());
        return new PurchaseDtos.PurchaseResponse(seq, body.playerId(),
                body.participantId(), body.price());
    }
}
