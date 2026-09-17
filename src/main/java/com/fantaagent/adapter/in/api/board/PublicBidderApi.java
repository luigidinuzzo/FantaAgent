package com.fantaagent.adapter.in.api.board;

import com.fantaagent.adapter.in.api.AuctionGuard;
import com.fantaagent.adapter.in.api.LeagueGuard;
import com.fantaagent.adapter.in.api.UnknownPlayerException;
import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.config.AuctionSettings;
import com.fantaagent.application.service.AuctionRuntime;
import com.fantaagent.domain.player.Player;
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

    private final LeagueGuard leagues;
    private final AuctionGuard auctions;
    private final PlayerCatalog catalog;
    private final AuctionRuntime runtime;

    public PublicBidderApi(LeagueGuard leagues, AuctionGuard auctions,
                           PlayerCatalog catalog, AuctionRuntime runtime) {
        this.leagues = leagues;
        this.auctions = auctions;
        this.catalog = catalog;
        this.runtime = runtime;
    }

    @GetMapping("/bidder/{playerId}")
    public BoardDtos.PublicBidderResponse bidder(@PathVariable String leagueId,
                                                 @PathVariable String auctionId,
                                                 @PathVariable String playerId) {
        leagues.check(leagueId);
        auctions.check(auctionId);
        Player player = catalog.byId(playerId)
                .orElseThrow(() -> new UnknownPlayerException(playerId));
        // Le preferenze dell'asta aperta, non piu' un valore globale.
        AuctionSettings current = runtime.bidder();
        return new BoardDtos.PublicBidderResponse(player.id(), player.name(),
                player.team(), player.role(), player.listPrice(),
                current.bidTimerSeconds(), current.beepEnabled());
    }
}
