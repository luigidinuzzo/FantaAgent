package com.fantaagent.adapter.in.api;

import com.fantaagent.adapter.in.api.dto.AuctionsDtos;
import com.fantaagent.application.service.AuctionRuntime;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * L'elenco delle aste, e il passaggio dall'una all'altra.
 *
 * <p><b>{@link AuctionGuard} non si applica a questi endpoint, ed e' deliberato.</b>
 * Quella guardia accetta solo l'asta aperta e il letterale {@code corrente};
 * {@code select} riceve per definizione l'id di un'asta DIVERSA da quella aperta.
 * Applicarla renderebbe impossibile cambiare asta, e il difetto si scoprirebbe solo
 * dal vivo. La validita' dell'id la verifica {@link AuctionRuntime#select}, che
 * conosce l'archivio.
 */
@RestController
@RequestMapping("/api/leagues/{leagueId}/auctions")
public class AuctionsApi {

    private final LeagueGuard leagues;
    private final AuctionRuntime runtime;

    public AuctionsApi(LeagueGuard leagues, AuctionRuntime runtime) {
        this.leagues = leagues;
        this.runtime = runtime;
    }

    @GetMapping
    public List<AuctionsDtos.AuctionCard> list(@PathVariable String leagueId) {
        leagues.check(leagueId);
        return runtime.auctions().stream().map(AuctionsDtos.AuctionCard::from).toList();
    }

    @PostMapping("/{auctionId}/select")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void select(@PathVariable String leagueId, @PathVariable String auctionId) {
        leagues.check(leagueId);
        try {
            runtime.select(auctionId);
        } catch (IllegalArgumentException e) {
            throw new UnknownAuctionException(auctionId);
        }
    }

    @PostMapping("/current/leave")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void leave(@PathVariable String leagueId) {
        leagues.check(leagueId);
        // Chiude davvero invece di limitarsi a cambiare schermata: la preparazione di
        // una nuova asta distingue le sue due modalita' proprio da questo, e uscire
        // lasciando l'asta aperta riporterebbe al caso in cui "nuova asta" mostrava le
        // impostazioni di quella in corso. Non si perde nulla: il registro e' su disco.
        runtime.deselect();
    }
}
