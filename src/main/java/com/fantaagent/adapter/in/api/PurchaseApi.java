package com.fantaagent.adapter.in.api;

import com.fantaagent.adapter.in.api.dto.PurchaseDtos;
import com.fantaagent.adapter.in.security.AppUserPrincipal;
import com.fantaagent.application.service.auction.AuctionView;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.player.Role;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Solo l'amministratore scrive nel registro d'asta: {@link ApiAccess#adminAuction}
 * lo verifica prima di ogni comando, e {@link AuctionView#write} lo esegue in fila
 * con le altre scritture sulla stessa asta.
 */
@RestController
@RequestMapping("/api/leagues/{leagueId}/auctions/{auctionId}")
public class PurchaseApi {

    private final ApiAccess access;

    public PurchaseApi(ApiAccess access) {
        this.access = access;
    }

    @PostMapping("/purchases")
    @ResponseStatus(HttpStatus.CREATED)
    public PurchaseDtos.PurchaseResponse buy(@AuthenticationPrincipal AppUserPrincipal me,
                                             @PathVariable String leagueId,
                                             @PathVariable String auctionId,
                                             @Valid @RequestBody PurchaseDtos.PurchaseRequest body) {
        AuctionView view = access.adminAuction(leagueId, auctionId, me);
        // La risposta si compone dall'evento scritto, mai dalla richiesta: un
        // secondo invio della stessa chiave con un corpo diverso non scrive
        // nulla, e riportare i dati appena ricevuti darebbe un 201 che descrive
        // un acquisto assente dal registro.
        AuctionEvent.PlayerPurchased recorded = view.write(() -> view.service().recordPurchase(
                body.playerId(), body.participantId(), body.price(), body.requestId()));
        return new PurchaseDtos.PurchaseResponse(recorded.seq(), recorded.playerId(),
                recorded.participantId(), recorded.price());
    }

    @PostMapping("/purchases/{seq}/void")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void voidPurchase(@AuthenticationPrincipal AppUserPrincipal me, @PathVariable String leagueId,
                             @PathVariable String auctionId, @PathVariable long seq) {
        AuctionView view = access.adminAuction(leagueId, auctionId, me);
        view.write(() -> {
            view.service().revokePurchase(seq);
            return null;
        });
    }

    @PostMapping("/purchases/{seq}/correct")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void correct(@AuthenticationPrincipal AppUserPrincipal me, @PathVariable String leagueId,
                        @PathVariable String auctionId, @PathVariable long seq,
                        @Valid @RequestBody PurchaseDtos.CorrectionRequest body) {
        AuctionView view = access.adminAuction(leagueId, auctionId, me);
        view.write(() -> {
            view.service().correctPurchase(seq, body.participantId(), body.price());
            return null;
        });
    }

    @PostMapping("/purchases/void-last")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void voidLast(@AuthenticationPrincipal AppUserPrincipal me, @PathVariable String leagueId,
                         @PathVariable String auctionId) {
        AuctionView view = access.adminAuction(leagueId, auctionId, me);
        if (!view.write(() -> view.service().undoLast())) {
            throw new NothingToUndoException();
        }
    }

    public record PhaseRequest(@NotNull Role role) {
    }

    @PostMapping("/phase")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void phase(@AuthenticationPrincipal AppUserPrincipal me, @PathVariable String leagueId,
                      @PathVariable String auctionId, @Valid @RequestBody PhaseRequest body) {
        AuctionView view = access.adminAuction(leagueId, auctionId, me);
        // "Era gia' quella fase" non e' un errore: la richiesta esprime uno stato
        // voluto, e quello stato e' gia' vero.
        view.write(() -> view.service().selectPhase(body.role()));
    }
}
