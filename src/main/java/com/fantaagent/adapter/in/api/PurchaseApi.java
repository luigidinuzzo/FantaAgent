package com.fantaagent.adapter.in.api;

import com.fantaagent.adapter.in.api.dto.PurchaseDtos;
import com.fantaagent.application.service.AuctionService;
import com.fantaagent.domain.player.Role;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
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

    @PostMapping("/purchases/{seq}/void")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void voidPurchase(@PathVariable String leagueId, @PathVariable long seq) {
        leagues.check(leagueId);
        auction.revokePurchase(seq);
    }

    @PostMapping("/purchases/void-last")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void voidLast(@PathVariable String leagueId) {
        leagues.check(leagueId);
        if (!auction.undoLast()) {
            throw new NothingToUndoException();
        }
    }

    public record PhaseRequest(@NotNull Role role) {
    }

    @PostMapping("/phase")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void phase(@PathVariable String leagueId, @Valid @RequestBody PhaseRequest body) {
        leagues.check(leagueId);
        // Il valore di ritorno "era gia' quella fase" non e' un errore: la
        // richiesta esprime uno stato voluto, e quello stato e' gia' vero.
        auction.selectPhase(body.role());
    }
}
