package com.fantaagent.adapter.in.api.board;

import com.fantaagent.adapter.in.api.ApiAccess;
import com.fantaagent.adapter.in.api.UnknownPlayerException;
import com.fantaagent.adapter.in.security.AppUserPrincipal;
import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.application.service.auction.AuctionView;
import com.fantaagent.config.AuctionSettings;
import com.fantaagent.domain.player.Player;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Il giocatore all'asta e le preferenze del battitore (timer, beep), per il dialogo
 * proiettato — senza valutazione.
 *
 * <p>Vive in {@code adapter.in.api.board}, insieme ai DTO della proiezione, non
 * accanto agli altri endpoint dell'API: non e' una scelta di ordine, e' cio' che mette
 * questa classe sotto la regola ArchUnit che vieta a questo package di raggiungere
 * {@code domain.strategy}. Da qui non e' possibile costruire una risposta che porti un
 * prezzo consigliato nemmeno per errore di chi scrive un metodo nuovo — la build fallirebbe.
 */
@RestController
@RequestMapping("/api/leagues/{leagueId}/auctions/{auctionId}/board")
public class PublicBidderApi {

    private final ApiAccess access;
    private final PlayerCatalog catalog;

    public PublicBidderApi(ApiAccess access, PlayerCatalog catalog) {
        this.access = access;
        this.catalog = catalog;
    }

    @GetMapping("/bidder/{playerId}")
    public BoardDtos.PublicBidderResponse bidder(@PathVariable String leagueId,
                                                 @PathVariable String auctionId,
                                                 @PathVariable String playerId,
                                                 @AuthenticationPrincipal AppUserPrincipal me) {
        AuctionView view = access.auction(leagueId, auctionId, me);
        Player player = catalog.byId(playerId)
                .orElseThrow(() -> new UnknownPlayerException(playerId));
        // Le preferenze dell'asta aperta, non piu' un valore globale.
        AuctionSettings current = view.auction().bidder();
        return new BoardDtos.PublicBidderResponse(player.id(), player.name(),
                player.team(), player.role(), player.listPrice(),
                current.bidTimerSeconds(), current.beepEnabled());
    }
}
